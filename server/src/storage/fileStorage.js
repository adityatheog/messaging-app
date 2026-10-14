const { getStore, DuplicateUsernameError } = require('./index');

const store = getStore();

module.exports = {
  StorageError: Error,
  DuplicateUsernameError,
  initializeStorage: () => store.initialize(),
  getUsers: () => store.getUsers(),
  findUserByUsername: (u) => store.findUserByUsername(u),
  findUserById: (id) => store.findUserById(id),
  createUser: (d) => store.createUser(d),
  updateUserProfile: (id, u) => store.updateUserProfile(id, u),
  updatePresence: (id) => {
    if (store.updatePresence) store.updatePresence(id);
  },
  clearPresence: (id) => {
    if (store.clearPresence) store.clearPresence(id);
  },
  isOnline: (id) => (store.isOnline ? store.isOnline(id) : false),
  getMessagesBetweenUsers: (u1, u2, opt) => store.getMessagesBetween(u1, u2, opt),
  createMessage: (m) => store.createMessage(m),
  markMessagesAsRead: (s, r) => store.markMessagesAsRead(s, r),
  getConversations: (u) => store.getConversations(u)
};
