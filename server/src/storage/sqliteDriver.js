const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const normalizeParams = (params = []) =>
  Array.isArray(params) ? params.map((p) => (p === undefined ? null : p)) : [];

const PYTHON_BRIDGE_SCRIPT = `
import os
import sys
import json
import sqlite3

db_path = sys.argv[1]

def open_db(target_path):
    try:
        conn = sqlite3.connect(target_path, isolation_level=None, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        conn.execute("CREATE TABLE IF NOT EXISTS _fs_probe (id INTEGER PRIMARY KEY);")
        conn.execute("DROP TABLE _fs_probe;")
        return conn
    except Exception:
        try:
            conn.close()
        except Exception:
            pass
        for suffix in ("-wal", "-shm", "-journal"):
            try:
                if os.path.exists(target_path + suffix):
                    os.remove(target_path + suffix)
            except Exception:
                pass
        uri_path = f"file:{target_path}?nolock=1"
        conn = sqlite3.connect(uri_path, uri=True, isolation_level=None, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = MEMORY;")
        conn.execute("PRAGMA synchronous = OFF;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        return conn

def exec_sql(conn, sql):
    buf = ""
    for chunk in sql.split(";"):
        candidate = buf + chunk + ";"
        if sqlite3.complete_statement(candidate):
            stmt = candidate.strip()
            if stmt and stmt != ";":
                conn.execute(stmt)
            buf = ""
        else:
            buf = candidate
    if buf.strip() and buf.strip() != ";":
        conn.execute(buf.strip())

conn = open_db(db_path)

for raw_line in sys.stdin:
    line = raw_line.strip()
    if not line:
        continue
    req_id = None
    try:
        req = json.loads(line)
        req_id = req.get("id")
        action = req.get("action")
        sql = req.get("sql", "")
        params = req.get("params", [])

        if action == "exec":
            exec_sql(conn, sql)
            res = {"id": req_id, "ok": True, "result": True}
        elif action == "run":
            cur = conn.execute(sql, params)
            res = {
                "id": req_id,
                "ok": True,
                "result": {
                    "changes": cur.rowcount,
                    "lastInsertRowid": cur.lastrowid
                }
            }
        elif action == "get":
            cur = conn.execute(sql, params)
            row = cur.fetchone()
            res = {"id": req_id, "ok": True, "result": dict(row) if row is not None else None}
        elif action == "all":
            cur = conn.execute(sql, params)
            rows = [dict(r) for r in cur.fetchall()]
            res = {"id": req_id, "ok": True, "result": rows}
        elif action == "backup":
            dest_path = req.get("destPath")
            bck = open_db(dest_path)
            try:
                with bck:
                    conn.backup(bck)
            finally:
                bck.close()
            res = {"id": req_id, "ok": True, "result": {"destPath": dest_path}}
        elif action == "close":
            conn.close()
            res = {"id": req_id, "ok": True, "result": True}
            sys.stdout.write(json.dumps(res) + "\\n")
            sys.stdout.flush()
            break
        else:
            res = {"id": req_id, "ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        res = {"id": req_id, "ok": False, "error": str(e), "code": type(e).__name__}

    sys.stdout.write(json.dumps(res) + "\\n")
    sys.stdout.flush()
`;

class PythonSqliteBridge {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
    this.closed = false;

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.proc = spawn('python3', ['-u', '-c', PYTHON_BRIDGE_SCRIPT, dbPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk;
      let idx;
      while ((idx = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          const handler = this.pending.get(msg.id);
          if (handler) {
            this.pending.delete(msg.id);
            if (msg.ok) {
              handler.resolve(msg.result);
            } else {
              const err = new Error(msg.error || 'SQLite error');
              err.code = msg.code || 'SQLITE_ERROR';
              handler.reject(err);
            }
          }
        } catch (_err) {
          // Ignore malformed stdout lines
        }
      }
    });

    this.proc.on('exit', (code) => {
      this.closed = true;
      for (const [, handler] of this.pending.entries()) {
        handler.reject(new Error(`SQLite bridge process exited with code ${code}`));
      }
      this.pending.clear();
    });
  }

  _send(payload) {
    if (this.closed) {
      return Promise.reject(new Error('SQLite connection is closed'));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ ...payload, id }) + '\n');
    });
  }

  exec(sql) {
    return this._send({ action: 'exec', sql });
  }

  run(sql, params = []) {
    return this._send({ action: 'run', sql, params: normalizeParams(params) });
  }

  get(sql, params = []) {
    return this._send({ action: 'get', sql, params: normalizeParams(params) });
  }

  all(sql, params = []) {
    return this._send({ action: 'all', sql, params: normalizeParams(params) });
  }

  backup(destPath) {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return this._send({ action: 'backup', destPath });
  }

  async close() {
    if (this.closed) return;
    try {
      await this._send({ action: 'close' });
    } catch (_err) {
      // Ignore close error if process already terminated
    }
    this.closed = true;
  }
}

class NodeSqliteAdapter {
  constructor(DatabaseSync, dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    try {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
    } catch (_err) {
      this.db.exec('PRAGMA journal_mode = MEMORY;');
      this.db.exec('PRAGMA synchronous = OFF;');
    }
    this.db.exec('PRAGMA busy_timeout = 5000;');
  }

  async exec(sql) {
    this.db.exec(sql);
    return true;
  }

  async run(sql, params = []) {
    const info = this.db.prepare(sql).run(...normalizeParams(params));
    return {
      changes: Number(info.changes),
      lastInsertRowid: Number(info.lastInsertRowid)
    };
  }

  async get(sql, params = []) {
    const row = this.db.prepare(sql).get(...normalizeParams(params));
    return row === undefined ? null : { ...row };
  }

  async all(sql, params = []) {
    const rows = this.db.prepare(sql).all(...normalizeParams(params));
    return rows.map((r) => ({ ...r }));
  }

  async backup(destPath) {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
    const escaped = destPath.replace(/'/g, "''");
    this.db.exec(`VACUUM INTO '${escaped}';`);
    return { destPath };
  }

  async close() {
    this.db.close();
  }
}

class BetterSqliteAdapter {
  constructor(Database, dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    try {
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
    } catch (_err) {
      this.db.pragma('journal_mode = MEMORY');
      this.db.pragma('synchronous = OFF');
    }
    this.db.pragma('busy_timeout = 5000');
  }

  async exec(sql) {
    this.db.exec(sql);
    return true;
  }

  async run(sql, params = []) {
    const info = this.db.prepare(sql).run(...normalizeParams(params));
    return {
      changes: info.changes,
      lastInsertRowid: Number(info.lastInsertRowid)
    };
  }

  async get(sql, params = []) {
    const row = this.db.prepare(sql).get(...normalizeParams(params));
    return row === undefined ? null : row;
  }

  async all(sql, params = []) {
    return this.db.prepare(sql).all(...normalizeParams(params));
  }

  async backup(destPath) {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await this.db.backup(destPath);
    return { destPath };
  }

  async close() {
    this.db.close();
  }
}

const openSqliteConnection = (dbPath) => {
  try {
    // eslint-disable-next-line global-require
    const { DatabaseSync } = require('node:sqlite');
    if (DatabaseSync) {
      return new NodeSqliteAdapter(DatabaseSync, dbPath);
    }
  } catch (_err) {
    // Fall through to better-sqlite3 or Python sqlite3 bridge
  }

  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const Database = require('better-sqlite3');
    return new BetterSqliteAdapter(Database, dbPath);
  } catch (_err) {
    return new PythonSqliteBridge(dbPath);
  }
};

module.exports = { openSqliteConnection };
