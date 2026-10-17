class Store {
  async initialize() {
    throw new Error('Method initialize() must be implemented');
  }

  async getUsers() {
    throw new Error('Method getUsers() must be implemented');
  }

  async findUserById(_id) {
    throw new Error('Method findUserById() must be implemented');
  }

  async findUserByUsername(_username) {
    throw new Error('Method findUserByUsername() must be implemented');
  }

  async createUser(_userData) {
    throw new Error('Method createUser() must be implemented');
  }

  async updateUserProfile(_userId, _updates) {
    throw new Error('Method updateUserProfile() must be implemented');
  }

  async deleteUser(_userId) {
    throw new Error('Method deleteUser() must be implemented');
  }

  async getContacts(_userId) {
    throw new Error('Method getContacts() must be implemented');
  }

  async addContact(_userId, _contactId) {
    throw new Error('Method addContact() must be implemented');
  }

  async removeContact(_userId, _contactId) {
    throw new Error('Method removeContact() must be implemented');
  }

  async getMessagesBetween(_userId1, _userId2, _options = {}) {
    throw new Error('Method getMessagesBetween() must be implemented');
  }

  async findMessageByClientMsgId(_senderId, _clientMsgId) {
    throw new Error('Method findMessageByClientMsgId() must be implemented');
  }

  async createMessage(_messageData) {
    throw new Error('Method createMessage() must be implemented');
  }

  async markMessagesAsRead(_senderId, _receiverId) {
    throw new Error('Method markMessagesAsRead() must be implemented');
  }

  async getConversations(_userId) {
    throw new Error('Method getConversations() must be implemented');
  }

  async createAttachment(_attachmentData) {
    throw new Error('Method createAttachment() must be implemented');
  }

  async getAttachmentById(_id) {
    throw new Error('Method getAttachmentById() must be implemented');
  }

  async close() {}
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
