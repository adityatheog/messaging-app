const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Store, DuplicateUsernameError } = require('./Store');
const { openSqliteConnection } = require('./sqliteDriver');

const MIGRATIONS = [
  {
    version: 1,
    name: '001_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        avatar_color TEXT NOT NULL DEFAULT '#10b981',
        created_at TEXT NOT NULL,
        last_seen TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS contacts (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, contact_id),
        CHECK (user_id != contact_id)
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
        title TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversation_members (
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TEXT NOT NULL,
        last_read_at TEXT,
        PRIMARY KEY (conversation_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        client_msg_id TEXT,
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'IMAGE', 'VOICE', 'DOCUMENT')),
        media_url TEXT,
        media_name TEXT,
        media_size INTEGER,
        audio_duration_seconds INTEGER,
        timestamp TEXT NOT NULL,
        delivered INTEGER NOT NULL DEFAULT 0,
        read INTEGER NOT NULL DEFAULT 0,
        read_at TEXT,
        UNIQUE (sender_id, client_msg_id)
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        uploader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
      CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_time ON messages(conversation_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_participants_time ON messages(sender_id, receiver_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages(receiver_id, sender_id, read);
      CREATE INDEX IF NOT EXISTS idx_attachments_uploader ON attachments(uploader_id);
    `
  }
];

const directConversationId = (userId1, userId2) => {
  const [a, b] = [String(userId1), String(userId2)].sort();
  return `direct:${a}:${b}`;
};

class SqliteStore extends Store {
  constructor(options = {}) {
    super();
    this.dataDir =
      options.dataDir ||
      (process.env.DATA_DIR
        ? path.resolve(process.env.DATA_DIR)
        : path.join(__dirname, '../../data'));
    this.dbPath =
      options.dbPath ||
      (process.env.SQLITE_DB_PATH
        ? path.resolve(process.env.SQLITE_DB_PATH)
        : path.join(this.dataDir, 'simplelink.db'));
    this.uploadsDir =
      options.uploadsDir ||
      (process.env.UPLOADS_DIR
        ? path.resolve(process.env.UPLOADS_DIR)
        : path.join(this.dataDir, 'uploads'));

    this.usersJsonPath = path.join(this.dataDir, 'users.json');
    this.messagesJsonPath = path.join(this.dataDir, 'messages.json');

    const envTimeout = process.env.PRESENCE_TIMEOUT_MS
      ? parseInt(process.env.PRESENCE_TIMEOUT_MS, 10)
      : NaN;
    this.PRESENCE_TIMEOUT_MS =
      options.presenceTimeout || (!Number.isNaN(envTimeout) && envTimeout > 0 ? envTimeout : 15000);

    this.seedOnEmpty = options.seedOnEmpty !== false;
    this.presenceMap = new Map();
    this.conn = null;
    this.initPromise = null;
    this.lockChain = Promise.resolve();
  }

  withLock(fn) {
    const result = this.lockChain.then(() => fn());
    this.lockChain = result.catch(() => {});
    return result;
  }

  async runInTransaction(fn) {
    return this.withLock(async () => {
      await this.conn.exec('BEGIN IMMEDIATE;');
      try {
        const out = await fn();
        await this.conn.exec('COMMIT;');
        return out;
      } catch (err) {
        await this.conn.exec('ROLLBACK;').catch(() => {});
        throw err;
      }
    });
  }

  mapUserRow(row, includePassword = false) {
    if (!row) return undefined;
    const mapped = {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      avatarColor: row.avatar_color,
      createdAt: row.created_at,
      lastSeen: row.last_seen,
      isOnline: this.isOnline(row.id)
    };
    if (includePassword) {
      mapped.password = row.password;
    }
    return mapped;
  }

  mapMessageRow(row) {
    if (!row) return null;
    const msg = {
      id: row.id,
      conversationId: row.conversation_id,
      clientMsgId: row.client_msg_id || null,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      content: row.content,
      messageType: row.message_type || 'TEXT',
      timestamp: row.timestamp,
      delivered: Boolean(row.delivered),
      read: Boolean(row.read)
    };
    if (row.media_url) msg.mediaUrl = row.media_url;
    if (row.media_name) msg.mediaName = row.media_name;
    if (row.media_size !== null && row.media_size !== undefined) msg.mediaSize = Number(row.media_size);
    if (row.audio_duration_seconds !== null && row.audio_duration_seconds !== undefined) {
      msg.audioDurationSeconds = Number(row.audio_duration_seconds);
    }
    if (row.read_at) msg.readAt = row.read_at;
    return msg;
  }

  async applyMigrations() {
    await this.conn.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    const appliedRows = await this.conn.all('SELECT version FROM schema_migrations ORDER BY version ASC;');
    const appliedVersions = new Set(appliedRows.map((r) => Number(r.version)));

    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) continue;
      await this.runInTransaction(async () => {
        await this.conn.exec(migration.sql);
        await this.conn.run(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          [migration.version, migration.name, new Date().toISOString()]
        );
      });
    }
  }

  async readJsonArraySafe(filePath) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      if (!raw.trim()) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async ensureDirectConversationInternal(userId1, userId2, timestamp) {
    const convId = directConversationId(userId1, userId2);
    const ts = timestamp || new Date().toISOString();
    await this.conn.run(
      `INSERT INTO conversations (id, type, title, created_at, updated_at)
       VALUES (?, 'direct', NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET updated_at = CASE WHEN excluded.updated_at > conversations.updated_at THEN excluded.updated_at ELSE conversations.updated_at END;`,
      [convId, ts, ts]
    );
    await this.conn.run(
      `INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, joined_at)
       VALUES (?, ?, ?);`,
      [convId, userId1, ts]
    );
    await this.conn.run(
      `INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, joined_at)
       VALUES (?, ?, ?);`,
      [convId, userId2, ts]
    );
    return convId;
  }

  async migrateFromJsonIfNeeded() {
    const jsonUsers = await this.readJsonArraySafe(this.usersJsonPath);
    const jsonMessages = await this.readJsonArraySafe(this.messagesJsonPath);
    if (jsonUsers.length === 0 && jsonMessages.length === 0) {
      return { usersMigrated: 0, messagesMigrated: 0 };
    }

    let usersMigrated = 0;
    let messagesMigrated = 0;

    await this.runInTransaction(async () => {
      for (const u of jsonUsers) {
        if (!u || !u.id || !u.username || !u.password) continue;
        const now = u.createdAt || new Date().toISOString();
        const res = await this.conn.run(
          `INSERT OR IGNORE INTO users (id, username, password, full_name, avatar_color, created_at, last_seen)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            String(u.id),
            String(u.username).trim(),
            String(u.password),
            String(u.fullName || u.username).trim(),
            String(u.avatarColor || '#5e72e4'),
            now,
            u.lastSeen || now
          ]
        );
        if (res.changes > 0) usersMigrated++;
      }

      for (const m of jsonMessages) {
        if (!m || !m.id || !m.senderId || !m.receiverId || !m.content) continue;
        const senderRow = await this.conn.get('SELECT id FROM users WHERE id = ?;', [m.senderId]);
        const receiverRow = await this.conn.get('SELECT id FROM users WHERE id = ?;', [m.receiverId]);
        if (!senderRow || !receiverRow) continue;

        const ts = m.timestamp || new Date().toISOString();
        const convId = await this.ensureDirectConversationInternal(m.senderId, m.receiverId, ts);
        const res = await this.conn.run(
          `INSERT OR IGNORE INTO messages (
             id, conversation_id, client_msg_id, sender_id, receiver_id,
             content, message_type, media_url, media_name, media_size,
             audio_duration_seconds, timestamp, delivered, read, read_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            String(m.id),
            convId,
            m.clientMsgId || null,
            String(m.senderId),
            String(m.receiverId),
            String(m.content),
            m.messageType || 'TEXT',
            m.mediaUrl || null,
            m.mediaName || null,
            m.mediaSize ?? null,
            m.audioDurationSeconds ?? null,
            ts,
            m.delivered ? 1 : 0,
            m.read ? 1 : 0,
            m.read ? ts : null
          ]
        );
        if (res.changes > 0) messagesMigrated++;
      }
    });

    return { usersMigrated, messagesMigrated };
  }

  async seedInitialDataIfNeeded() {
    if (!this.seedOnEmpty) return;
    const countRow = await this.conn.get('SELECT COUNT(*) AS cnt FROM users;');
    if (countRow && Number(countRow.cnt) > 0) return;

    const defaultPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
    const now = new Date().toISOString();

    const demoUsers = [
      {
        id: 'user-sarah',
        username: 'sarah_j',
        password: hashedPassword,
        fullName: 'Sarah Jenkins',
        avatarColor: '#5e72e4',
        createdAt: now
      },
      {
        id: 'user-alex',
        username: 'alex_r',
        password: hashedPassword,
        fullName: 'Alex Rivera',
        avatarColor: '#2dce89',
        createdAt: now
      },
      {
        id: 'user-david',
        username: 'david_c',
        password: hashedPassword,
        fullName: 'David Chen',
        avatarColor: '#11cdef',
        createdAt: now
      },
      {
        id: 'user-emily',
        username: 'emily_w',
        password: hashedPassword,
        fullName: 'Emily Watson',
        avatarColor: '#fb6340',
        createdAt: now
      },
      {
        id: 'user-michael',
        username: 'mscott',
        password: hashedPassword,
        fullName: 'Michael Scott',
        avatarColor: '#825ee4',
        createdAt: now
      }
    ];

    const t1 = new Date(Date.now() - 3600000).toISOString();
    const t2 = new Date(Date.now() - 2400000).toISOString();

    await this.runInTransaction(async () => {
      for (const u of demoUsers) {
        await this.conn.run(
          `INSERT INTO users (id, username, password, full_name, avatar_color, created_at, last_seen)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [u.id, u.username, u.password, u.fullName, u.avatarColor, u.createdAt, u.createdAt]
        );
      }

      const convId = await this.ensureDirectConversationInternal('user-sarah', 'user-alex', t2);

      await this.conn.run(
        `INSERT INTO messages (
           id, conversation_id, client_msg_id, sender_id, receiver_id,
           content, message_type, timestamp, delivered, read, read_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'TEXT', ?, 1, 1, ?);`,
        [
          'msg-seed-1',
          convId,
          'client-seed-1',
          'user-sarah',
          'user-alex',
          'Hey Alex, the SimpleLink pairwise queue is active and the session ratchet is initialized.',
          t1,
          t1
        ]
      );

      await this.conn.run(
        `INSERT INTO messages (
           id, conversation_id, client_msg_id, sender_id, receiver_id,
           content, message_type, timestamp, delivered, read, read_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'TEXT', ?, 1, 1, ?);`,
        [
          'msg-seed-2',
          convId,
          'client-seed-2',
          'user-alex',
          'user-sarah',
          'Verified safety number: 9A2F · 4B18. No central user IDs exposed.',
          t2,
          t2
        ]
      );
    });

    this.updatePresence('user-sarah');
    this.updatePresence('user-alex');
    this.updatePresence('user-emily');
  }

  async initialize() {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await fs.mkdir(this.dataDir, { recursive: true });
        await fs.mkdir(this.uploadsDir, { recursive: true });
        this.conn = openSqliteConnection(this.dbPath);
        await this.applyMigrations();
        await this.migrateFromJsonIfNeeded();
        await this.seedInitialDataIfNeeded();
      })().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  updatePresence(userId) {
    this.presenceMap.set(userId, Date.now());
  }

  clearPresence(userId) {
    this.presenceMap.delete(userId);
  }

  isOnline(userId) {
    const last = this.presenceMap.get(userId);
    if (!last) return false;
    return Date.now() - last < this.PRESENCE_TIMEOUT_MS;
  }

  async getUsers() {
    await this.initialize();
    const rows = await this.conn.all('SELECT * FROM users ORDER BY full_name ASC, username ASC;');
    return rows.map((r) => this.mapUserRow(r, false));
  }

  async searchUsers(query, excludeUserId) {
    await this.initialize();
    const q = `%${String(query || '').trim().toLowerCase()}%`;
    const rows = await this.conn.all(
      `SELECT * FROM users
       WHERE id != ? AND (LOWER(username) LIKE ? OR LOWER(full_name) LIKE ?)
       ORDER BY full_name ASC, username ASC;`,
      [excludeUserId || '', q, q]
    );
    return rows.map((r) => this.mapUserRow(r, false));
  }

  async findUserById(id) {
    await this.initialize();
    if (typeof id !== 'string' || !id) return undefined;
    const row = await this.conn.get('SELECT * FROM users WHERE id = ?;', [id]);
    return this.mapUserRow(row, false);
  }

  async findUserByUsername(username) {
    await this.initialize();
    const needle = String(username || '').trim();
    if (!needle) return undefined;
    const row = await this.conn.get(
      'SELECT * FROM users WHERE username = ? COLLATE NOCASE;',
      [needle]
    );
    return this.mapUserRow(row, true);
  }

  async createUser(userData) {
    await this.initialize();
    const cleanUsername = String(userData.username || '').trim();
    const now = userData.createdAt || new Date().toISOString();
    const fullName = String(userData.fullName || cleanUsername).trim();
    const avatarColor = String(userData.avatarColor || '#5e72e4').trim();

    return this.runInTransaction(async () => {
      const existing = await this.conn.get(
        'SELECT id FROM users WHERE username = ? COLLATE NOCASE;',
        [cleanUsername]
      );
      if (existing) {
        throw new DuplicateUsernameError(cleanUsername);
      }

      await this.conn.run(
        `INSERT INTO users (id, username, password, full_name, avatar_color, created_at, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [userData.id, cleanUsername, userData.password, fullName, avatarColor, now, now]
      );

      this.updatePresence(userData.id);
      const row = await this.conn.get('SELECT * FROM users WHERE id = ?;', [userData.id]);
      return { ...this.mapUserRow(row, false), isOnline: true };
    });
  }

  async updateUserProfile(userId, updates) {
    await this.initialize();
    return this.runInTransaction(async () => {
      const existing = await this.conn.get('SELECT * FROM users WHERE id = ?;', [userId]);
      if (!existing) return null;

      const nextFullName =
        typeof updates.fullName === 'string' && updates.fullName.trim()
          ? updates.fullName.trim()
          : existing.full_name;
      const nextColor =
        typeof updates.avatarColor === 'string' && updates.avatarColor.trim()
          ? updates.avatarColor.trim()
          : existing.avatar_color;
      const now = new Date().toISOString();

      await this.conn.run(
        'UPDATE users SET full_name = ?, avatar_color = ?, last_seen = ? WHERE id = ?;',
        [nextFullName, nextColor, now, userId]
      );

      const updated = await this.conn.get('SELECT * FROM users WHERE id = ?;', [userId]);
      return this.mapUserRow(updated, false);
    });
  }

  async deleteUser(userId) {
    await this.initialize();
    const attachmentRows = await this.conn.all(
      'SELECT stored_name FROM attachments WHERE uploader_id = ?;',
      [userId]
    );

    const deleted = await this.runInTransaction(async () => {
      const res = await this.conn.run('DELETE FROM users WHERE id = ?;', [userId]);
      await this.conn.run(
        `DELETE FROM conversations
         WHERE id NOT IN (SELECT DISTINCT conversation_id FROM conversation_members);`
      );
      return res.changes > 0;
    });

    this.clearPresence(userId);

    for (const att of attachmentRows) {
      if (att.stored_name) {
        const filePath = path.join(this.uploadsDir, path.basename(att.stored_name));
        await fs.unlink(filePath).catch(() => {});
      }
    }

    return deleted;
  }

  async createSession(tokenHash, userId, expiresAt) {
    await this.initialize();
    const now = new Date().toISOString();
    await this.conn.run(
      `INSERT OR REPLACE INTO sessions (token_hash, user_id, created_at, expires_at, revoked)
       VALUES (?, ?, ?, ?, 0);`,
      [tokenHash, userId, now, expiresAt]
    );
  }

  async revokeSession(tokenHash) {
    await this.initialize();
    if (!tokenHash) return;
    await this.conn.run('UPDATE sessions SET revoked = 1 WHERE token_hash = ?;', [tokenHash]);
  }

  async isSessionRevoked(tokenHash) {
    await this.initialize();
    if (!tokenHash) return false;
    const row = await this.conn.get(
      'SELECT revoked, expires_at FROM sessions WHERE token_hash = ?;',
      [tokenHash]
    );
    if (!row) return false;
    if (Number(row.revoked) === 1) return true;
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return true;
    return false;
  }

  async getContacts(userId) {
    await this.initialize();
    const rows = await this.conn.all(
      `SELECT u.* FROM contacts c
       INNER JOIN users u ON u.id = c.contact_id
       WHERE c.user_id = ?
       ORDER BY u.full_name ASC, u.username ASC;`,
      [userId]
    );
    return rows.map((r) => this.mapUserRow(r, false));
  }

  async addContact(userId, contactId) {
    await this.initialize();
    if (!userId || !contactId || userId === contactId) return null;
    const contactUser = await this.findUserById(contactId);
    if (!contactUser) return null;

    await this.conn.run(
      `INSERT OR IGNORE INTO contacts (user_id, contact_id, created_at)
       VALUES (?, ?, ?);`,
      [userId, contactId, new Date().toISOString()]
    );
    return contactUser;
  }

  async removeContact(userId, contactId) {
    await this.initialize();
    const res = await this.conn.run(
      'DELETE FROM contacts WHERE user_id = ? AND contact_id = ?;',
      [userId, contactId]
    );
    return res.changes > 0;
  }

  async isConversationMember(conversationId, userId) {
    await this.initialize();
    const row = await this.conn.get(
      'SELECT 1 AS ok FROM conversation_members WHERE conversation_id = ? AND user_id = ?;',
      [conversationId, userId]
    );
    return Boolean(row);
  }

  async findMessageByClientMsgId(senderId, clientMsgId) {
    await this.initialize();
    if (!clientMsgId) return null;
    const row = await this.conn.get(
      'SELECT * FROM messages WHERE sender_id = ? AND client_msg_id = ? LIMIT 1;',
      [senderId, clientMsgId]
    );
    return this.mapMessageRow(row);
  }

  async getMessagesBetween(userId1, userId2, options = {}) {
    await this.initialize();
    const rows = await this.conn.all(
      `SELECT * FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY timestamp ASC, rowid ASC;`,
      [userId1, userId2, userId2, userId1]
    );

    let list = rows.map((r) => this.mapMessageRow(r));

    if (options.after) {
      const idx = list.findIndex((m) => m.id === options.after);
      if (idx !== -1) list = list.slice(idx + 1);
    }

    if (options.before) {
      const idx = list.findIndex((m) => m.id === options.before);
      if (idx !== -1) list = list.slice(0, idx);
    }

    const limit = parseInt(options.limit, 10);
    if (!Number.isNaN(limit) && limit > 0) {
      list = options.after ? list.slice(0, limit) : list.slice(-limit);
    }

    return list;
  }

  async createMessage(messageData) {
    await this.initialize();
    return this.runInTransaction(async () => {
      if (messageData.clientMsgId) {
        const existingRow = await this.conn.get(
          'SELECT * FROM messages WHERE sender_id = ? AND client_msg_id = ? LIMIT 1;',
          [messageData.senderId, messageData.clientMsgId]
        );
        if (existingRow) {
          return this.mapMessageRow(existingRow);
        }
      }

      const ts = messageData.timestamp || new Date().toISOString();
      const convId = await this.ensureDirectConversationInternal(
        messageData.senderId,
        messageData.receiverId,
        ts
      );

      await this.conn.run(
        `INSERT INTO messages (
           id, conversation_id, client_msg_id, sender_id, receiver_id,
           content, message_type, media_url, media_name, media_size,
           audio_duration_seconds, timestamp, delivered, read, read_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          messageData.id,
          convId,
          messageData.clientMsgId || null,
          messageData.senderId,
          messageData.receiverId,
          messageData.content,
          messageData.messageType || 'TEXT',
          messageData.mediaUrl || null,
          messageData.mediaName || null,
          messageData.mediaSize ?? null,
          messageData.audioDurationSeconds ?? null,
          ts,
          messageData.delivered ? 1 : 0,
          messageData.read ? 1 : 0,
          messageData.read ? ts : null
        ]
      );

      await this.conn.run('UPDATE users SET last_seen = ? WHERE id = ?;', [
        ts,
        messageData.senderId
      ]);

      const inserted = await this.conn.get('SELECT * FROM messages WHERE id = ?;', [
        messageData.id
      ]);
      return this.mapMessageRow(inserted);
    });
  }

  async markMessageDelivered(messageId) {
    await this.initialize();
    const res = await this.conn.run(
      'UPDATE messages SET delivered = 1 WHERE id = ? AND delivered = 0;',
      [messageId]
    );
    return res.changes > 0;
  }

  async markMessagesAsRead(senderId, receiverId) {
    await this.initialize();
    return this.runInTransaction(async () => {
      const now = new Date().toISOString();
      const res = await this.conn.run(
        `UPDATE messages
         SET read = 1, delivered = 1, read_at = ?
         WHERE sender_id = ? AND receiver_id = ? AND read = 0;`,
        [now, senderId, receiverId]
      );

      if (res.changes > 0) {
        const convId = directConversationId(senderId, receiverId);
        await this.conn.run(
          `UPDATE conversation_members
           SET last_read_at = ?
           WHERE conversation_id = ? AND user_id = ?;`,
          [now, convId, receiverId]
        );
      }

      return res.changes > 0;
    });
  }

  async getConversations(userId) {
    await this.initialize();
    const otherUsers = (await this.getUsers()).filter((u) => u.id !== userId);
    const otherUsersMap = new Map(otherUsers.map((u) => [u.id, u]));

    const rows = await this.conn.all(
      `SELECT * FROM messages
       WHERE sender_id = ? OR receiver_id = ?
       ORDER BY timestamp ASC, rowid ASC;`,
      [userId, userId]
    );

    const grouped = new Map();
    for (const row of rows) {
      const msg = this.mapMessageRow(row);
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!grouped.has(otherId)) {
        grouped.set(otherId, []);
      }
      grouped.get(otherId).push(msg);
    }

    const conversations = [];
    for (const [otherId, msgs] of grouped.entries()) {
      const otherUser = otherUsersMap.get(otherId);
      if (!otherUser || msgs.length === 0) continue;

      const lastMessage = msgs[msgs.length - 1];
      const unreadCount = msgs.filter(
        (m) => m.senderId === otherId && m.receiverId === userId && !m.read
      ).length;

      conversations.push({
        user: otherUser,
        lastMessage,
        unreadCount,
        updatedAt: lastMessage.timestamp
      });
    }

    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return conversations;
  }

  async createAttachment(attachmentData) {
    await this.initialize();
    const now = attachmentData.createdAt || new Date().toISOString();
    await this.conn.run(
      `INSERT INTO attachments (id, uploader_id, original_name, stored_name, mime_type, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        attachmentData.id,
        attachmentData.uploaderId,
        attachmentData.originalName,
        attachmentData.storedName,
        attachmentData.mimeType,
        attachmentData.sizeBytes,
        now
      ]
    );
    return {
      id: attachmentData.id,
      uploaderId: attachmentData.uploaderId,
      originalName: attachmentData.originalName,
      storedName: attachmentData.storedName,
      mimeType: attachmentData.mimeType,
      sizeBytes: attachmentData.sizeBytes,
      createdAt: now
    };
  }

  async getAttachmentById(id) {
    await this.initialize();
    if (!id) return null;
    const row = await this.conn.get('SELECT * FROM attachments WHERE id = ?;', [id]);
    if (!row) return null;
    return {
      id: row.id,
      uploaderId: row.uploader_id,
      originalName: row.original_name,
      storedName: row.stored_name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      createdAt: row.created_at
    };
  }

  async backupDatabase(destPath) {
    await this.initialize();
    const resolvedDest = path.resolve(destPath);
    await this.withLock(async () => {
      await this.conn.backup(resolvedDest);
    });
    return resolvedDest;
  }

  async close() {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
      this.initPromise = null;
    }
  }
}

module.exports = SqliteStore;
