/**
 * Store interface for Messaging App persistence.
 * Implementations: JsonStore (dev, preview, test) and FirestoreStore (production).
 */
class Store {
  async initialize() {
    throw new Error('Method initialize() must be implemented');
  }

  async getUsers() {
    throw new Error('Method getUsers() must be implemented');
  }

  async findUserById(id) {
    throw new Error('Method findUserById() must be implemented');
  }

  async findUserByUsername(username) {
    throw new Error('Method findUserByUsername() must be implemented');
  }

  async createUser(userData) {
    throw new Error('Method createUser() must be implemented');
  }

  async updateUserProfile(userId, updates) {
    throw new Error('Method updateUserProfile() must be implemented');
  }

  async getMessagesBetween(userId1, userId2, options = {}) {
    throw new Error('Method getMessagesBetween() must be implemented');
  }

  async findMessageByClientMsgId(senderId, clientMsgId) {
    throw new Error('Method findMessageByClientMsgId() must be implemented');
  }

  async createMessage(messageData) {
    throw new Error('Method createMessage() must be implemented');
  }

  async markMessagesAsRead(senderId, receiverId) {
    throw new Error('Method markMessagesAsRead() must be implemented');
  }

  async getConversations(userId) {
    throw new Error('Method getConversations() must be implemented');
  }
}

class DuplicateUsernameError extends Error {
  constructor(username) {
    super(`Username "${username}" already exists`);
    this.name = 'DuplicateUsernameError';
  }
}

module.exports = {
  Store,
  DuplicateUsernameError
};
