const { getStore, closeStore, DuplicateUsernameError } = require('./index');

module.exports = {
  DuplicateUsernameError,
  initializeStorage: () => getStore().initialize(),
  closeStorage: () => closeStore(),
  getUsers: () => getStore().getUsers(),
  searchUsers: (query, excludeUserId) => getStore().searchUsers(query, excludeUserId),
  findUserByUsername: (username) => getStore().findUserByUsername(username),
  findUserById: (id) => getStore().findUserById(id),
  createUser: (userData) => getStore().createUser(userData),
  updateUserProfile: (userId, updates) => getStore().updateUserProfile(userId, updates),
  deleteUser: (userId) => getStore().deleteUser(userId),
  getContacts: (userId) => getStore().getContacts(userId),
  addContact: (userId, contactId) => getStore().addContact(userId, contactId),
  removeContact: (userId, contactId) => getStore().removeContact(userId, contactId),
  updatePresence: (userId) => {
    const store = getStore();
    if (store.updatePresence) store.updatePresence(userId);
  },
  clearPresence: (userId) => {
    const store = getStore();
    if (store.clearPresence) store.clearPresence(userId);
  },
  isOnline: (userId) => {
    const store = getStore();
    return store.isOnline ? store.isOnline(userId) : false;
  },
  findMessageByClientMsgId: (senderId, clientMsgId) =>
    getStore().findMessageByClientMsgId(senderId, clientMsgId),
  getMessagesBetween: (userId1, userId2, options) =>
    getStore().getMessagesBetween(userId1, userId2, options),
  createMessage: (messageData) => getStore().createMessage(messageData),
  markMessagesAsRead: (senderId, receiverId) => getStore().markMessagesAsRead(senderId, receiverId),
  getConversations: (userId) => getStore().getConversations(userId),
  createAttachment: (attachmentData) => getStore().createAttachment(attachmentData),
  getAttachmentById: (id) => getStore().getAttachmentById(id)
};
