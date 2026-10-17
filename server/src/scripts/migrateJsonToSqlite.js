const path = require('path');
const SqliteStore = require('../storage/SqliteStore');

const runMigration = async () => {
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '../../data');
  const dbPath = process.env.SQLITE_DB_PATH
    ? path.resolve(process.env.SQLITE_DB_PATH)
    : path.join(dataDir, 'simplelink.db');

  const store = new SqliteStore({ dataDir, dbPath, seedOnEmpty: false });
  try {
    await store.initialize();
    const result = await store.migrateFromJsonIfNeeded();
    const users = await store.getUsers();
    console.log(
      `Migration complete: db=${dbPath} totalUsers=${users.length} newlyMigratedUsers=${result.usersMigrated} newlyMigratedMessages=${result.messagesMigrated}`
    );
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await store.close();
  }
};

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
