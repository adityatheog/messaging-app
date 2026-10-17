const SqliteStore = require('./SqliteStore');
const JsonStore = require('./JsonStore');
const { DuplicateUsernameError } = require('./Store');

let activeStore = null;
let activeDataDir = null;

const getStore = () => {
  const configuredDir = process.env.DATA_DIR || '';
  if (!activeStore || activeDataDir !== configuredDir) {
    activeDataDir = configuredDir;
    if (process.env.STORAGE_BACKEND === 'json') {
      activeStore = new JsonStore();
    } else {
      activeStore = new SqliteStore();
    }
  }
  return activeStore;
};

const closeStore = async () => {
  if (activeStore && activeStore.close) {
    await activeStore.close();
  }
  activeStore = null;
  activeDataDir = null;
};

module.exports = {
  getStore,
  closeStore,
  SqliteStore,
  JsonStore,
  DuplicateUsernameError
};
