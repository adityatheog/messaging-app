const JsonStore = require('./JsonStore');
const FirestoreStore = require('./FirestoreStore');
const { DuplicateUsernameError } = require('./Store');

let activeStore = null;

const getStore = () => {
  if (!activeStore) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.USE_FIRESTORE === 'true') {
      activeStore = new FirestoreStore();
    } else {
      activeStore = new JsonStore();
    }
  }
  return activeStore;
};

module.exports = {
  getStore,
  DuplicateUsernameError
};
