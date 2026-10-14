const JsonStore = require('./JsonStore');
const FirestoreStore = require('./FirestoreStore');
const { DuplicateUsernameError } = require('./Store');

let activeStore = null;

const getStore = () => {
  if (!activeStore) {
    const hasServiceAccount =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON &&
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim().length > 1;
    const explicitlyEnabled = process.env.USE_FIRESTORE === 'true';

    if (process.env.NODE_ENV !== 'test' && (hasServiceAccount || explicitlyEnabled)) {
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
