const fs = require('fs').promises;
const path = require('path');
const SqliteStore = require('../storage/SqliteStore');

const getPaths = () => {
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '../../data');
  const dbPath = process.env.SQLITE_DB_PATH
    ? path.resolve(process.env.SQLITE_DB_PATH)
    : path.join(dataDir, 'simplelink.db');
  return { dataDir, dbPath };
};

const backup = async (targetPath) => {
  const { dataDir, dbPath } = getPaths();
  const dest = targetPath
    ? path.resolve(targetPath)
    : path.join(dataDir, 'backups', `simplelink-backup-${Date.now()}.db`);

  const store = new SqliteStore({ dataDir, dbPath, seedOnEmpty: false });
  try {
    const savedTo = await store.backupDatabase(dest);
    console.log(`Backup written to ${savedTo}`);
    return savedTo;
  } finally {
    await store.close();
  }
};

const restore = async (sourcePath) => {
  if (!sourcePath) {
    throw new Error('Restore requires a source backup file path');
  }
  const resolvedSource = path.resolve(sourcePath);
  await fs.access(resolvedSource);

  const { dataDir, dbPath } = getPaths();
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.rm(`${dbPath}-wal`, { force: true }).catch(() => {});
  await fs.rm(`${dbPath}-shm`, { force: true }).catch(() => {});
  await fs.copyFile(resolvedSource, dbPath);
  console.log(`Database restored from ${resolvedSource} to ${dbPath}`);
  return dbPath;
};

const main = async () => {
  const [action, argPath] = process.argv.slice(2);
  try {
    if (action === 'restore') {
      await restore(argPath);
    } else {
      await backup(argPath);
    }
  } catch (err) {
    console.error(`Database ${action || 'backup'} failed:`, err.message);
    process.exitCode = 1;
  }
};

if (require.main === module) {
  main();
}

module.exports = { backup, restore };
