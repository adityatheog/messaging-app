const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Store, DuplicateUsernameError } = require('./Store');

const sanitizeUser = (user, isOnline) => {
  const { password: _password, ...rest } = user;
  return { ...rest, isOnline };
};

class JsonStore extends Store {
  constructor(options = {}) {
    super();
    this.dataDir =
      options.dataDir ||
      (process.env.DATA_DIR
        ? path.resolve(process.env.DATA_DIR)
        : path.join(__dirname, '../../data'));
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.messagesFile = path.join(this.dataDir, 'messages.json');

    this.memUsers = null;
    this.memMessages = null;
    this.memContacts = new Map();
    this.memAttachments = new Map();
    this.revokedTokens = new Set();
    this.presenceMap = new Map();
    const envTimeout = process.env.PRESENCE_TIMEOUT_MS
      ? parseInt(process.env.PRESENCE_TIMEOUT_MS, 10)
      : NaN;
    this.PRESENCE_TIMEOUT_MS =
      options.presenceTimeout || (!Number.isNaN(envTimeout) && envTimeout > 0 ? envTimeout : 15000);

    this.lockChain = Promise.resolve();
    this.initPromise = null;
  }

  withLock(fn) {
    const result = this.lockChain.then(() => fn());
    this.lockChain = result.catch(() => {});
    return result;
  }

  async readJsonArray(filePath) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      if (!raw.trim()) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async writeJsonAtomic(filePath, data) {
    const rand = crypto.randomBytes(4).toString('hex');
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${rand}.tmp`;

    try {
      const handle = await fs.open(tmpPath, 'w');
      try {
        await handle.writeFile(JSON.stringify(data, null, 2), 'utf8');
        await handle.sync().catch((err) => {
          if (err.code !== 'ENOTSUP' && err.code !== 'EINVAL') {
            throw err;
          }
        });
      } finally {
        await handle.close();
      }
      await fs.rename(tmpPath, filePath);
    } catch (error) {
      await fs.unlink(tmpPath).catch(() => {});
      throw error;
    }
  }

  async seedInitialDataIfNeeded() {
    if (this.memUsers.length > 0) return;

    const defaultPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
    const now = new Date().toISOString();

    this.memUsers = [
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

    this.memMessages = [
      {
        id: 'msg-seed-1',
        clientMsgId: 'client-seed-1',
        senderId: 'user-sarah',
        receiverId: 'user-alex',
        content: 'Hey Alex, the SimpleLink pairwise queue is active and the session ratchet is initialized.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: true
      },
      {
        id: 'msg-seed-2',
        clientMsgId: 'client-seed-2',
        senderId: 'user-alex',
        receiverId: 'user-sarah',
        content: 'Verified safety number: 9A2F · 4B18. No central user IDs exposed.',
        timestamp: new Date(Date.now() - 2400000).toISOString(),
        read: true
      }
    ];

    await this.writeJsonAtomic(this.usersFile, this.memUsers);
    await this.writeJsonAtomic(this.messagesFile, this.memMessages);

    this.updatePresence('user-sarah');
    this.updatePresence('user-alex');
    this.updatePresence('user-emily');
  }

  async initialize() {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await fs.mkdir(this.dataDir, { recursive: true });
        for (const file of [this.usersFile, this.messagesFile]) {
          try {
            await fs.writeFile(file, '[]', { flag: 'wx' });
          } catch (err) {
            if (err.code !== 'EEXIST') throw err;
          }
        }
        this.memUsers = await this.readJsonArray(this.usersFile);
        this.memMessages = await this.readJsonArray(this.messagesFile);
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
    return this.memUsers.map((u) => sanitizeUser(u, this.isOnline(u.id)));
  }

  async searchUsers(query, excludeUserId) {
    const users = await this.getUsers();
    const q = String(query || '').trim().toLowerCase();
    return users.filter(
      (u) =>
        u.id !== excludeUserId &&
        (!q ||
          u.username.toLowerCase().includes(q) ||
          (u.fullName && u.fullName.toLowerCase().includes(q)))
    );
  }

  async findUserById(id) {
    await this.initialize();
    const user = this.memUsers.find((u) => u.id === id);
    return user ? sanitizeUser(user, this.isOnline(user.id)) : undefined;
  }

  async findUserByUsername(username) {
    await this.initialize();
    const needle = String(username || '').trim().toLowerCase();
    const user = this.memUsers.find((u) => u.username.toLowerCase() === needle);
    return user ? { ...user, isOnline: this.isOnline(user.id) } : undefined;
  }

  async createUser(userData) {
    return this.withLock(async () => {
      await this.initialize();
      const needle = String(userData.username || '').trim().toLowerCase();
      if (this.memUsers.some((u) => u.username.toLowerCase() === needle)) {
        throw new DuplicateUsernameError(userData.username);
      }

      const userToSave = { ...userData };
      delete userToSave.isOnline;
      const nextUsers = [...this.memUsers, userToSave];

      await this.writeJsonAtomic(this.usersFile, nextUsers);
      this.memUsers = nextUsers;
      this.updatePresence(userData.id);

      return sanitizeUser(userToSave, true);
    });
  }

  async updateUserProfile(userId, updates) {
    return this.withLock(async () => {
      await this.initialize();
      let updated = null;
      const nextUsers = this.memUsers.map((u) => {
        if (u.id === userId) {
          updated = {
            ...u,
            ...(typeof updates.fullName === 'string' && updates.fullName.trim()
              ? { fullName: updates.fullName.trim() }
              : {}),
            ...(typeof updates.avatarColor === 'string' && updates.avatarColor.trim()
              ? { avatarColor: updates.avatarColor.trim() }
              : {})
          };
          return updated;
        }
        return u;
      });

      if (!updated) return null;

      await this.writeJsonAtomic(this.usersFile, nextUsers);
      this.memUsers = nextUsers;
      return sanitizeUser(updated, this.isOnline(updated.id));
    });
  }

  async deleteUser(userId) {
    return this.withLock(async () => {
      await this.initialize();
      const nextUsers = this.memUsers.filter((u) => u.id !== userId);
      if (nextUsers.length === this.memUsers.length) return false;
      const nextMessages = this.memMessages.filter(
        (m) => m.senderId !== userId && m.receiverId !== userId
      );
      await this.writeJsonAtomic(this.usersFile, nextUsers);
      await this.writeJsonAtomic(this.messagesFile, nextMessages);
      this.memUsers = nextUsers;
      this.memMessages = nextMessages;
      this.memContacts.delete(userId);
      this.clearPresence(userId);
      return true;
    });
  }

  async createSession(_tokenHash, _userId, _expiresAt) {}

  async revokeSession(tokenHash) {
    if (tokenHash) this.revokedTokens.add(tokenHash);
  }

  async isSessionRevoked(tokenHash) {
    return Boolean(tokenHash && this.revokedTokens.has(tokenHash));
  }

  async getContacts(userId) {
    await this.initialize();
    const set = this.memContacts.get(userId) || new Set();
    const users = await this.getUsers();
    return users.filter((u) => set.has(u.id));
  }

  async addContact(userId, contactId) {
    await this.initialize();
    if (!userId || !contactId || userId === contactId) return null;
    const contact = await this.findUserById(contactId);
    if (!contact) return null;
    if (!this.memContacts.has(userId)) this.memContacts.set(userId, new Set());
    this.memContacts.get(userId).add(contactId);
    return contact;
  }

  async removeContact(userId, contactId) {
    await this.initialize();
    const set = this.memContacts.get(userId);
    if (!set) return false;
    return set.delete(contactId);
  }

  async findMessageByClientMsgId(senderId, clientMsgId) {
    await this.initialize();
    if (!clientMsgId) return null;
    const found = this.memMessages.find(
      (m) => m.senderId === senderId && m.clientMsgId === clientMsgId
    );
    return found ? { ...found } : null;
  }

  async getMessagesBetween(userId1, userId2, options = {}) {
    await this.initialize();
    let list = this.memMessages
      .filter(
        (m) =>
          (m.senderId === userId1 && m.receiverId === userId2) ||
          (m.senderId === userId2 && m.receiverId === userId1)
      )
      .map((m) => ({ ...m }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

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
    return this.withLock(async () => {
      await this.initialize();

      if (messageData.clientMsgId) {
        const existing = this.memMessages.find(
          (m) => m.senderId === messageData.senderId && m.clientMsgId === messageData.clientMsgId
        );
        if (existing) return { ...existing };
      }

      const toSave = { ...messageData };
      const nextMessages = [...this.memMessages, toSave];
      await this.writeJsonAtomic(this.messagesFile, nextMessages);
      this.memMessages = nextMessages;
      return { ...toSave };
    });
  }

  async markMessagesAsRead(senderId, receiverId) {
    return this.withLock(async () => {
      await this.initialize();
      let changed = false;

      const nextMessages = this.memMessages.map((m) => {
        if (m.senderId === senderId && m.receiverId === receiverId && !m.read) {
          changed = true;
          return { ...m, read: true };
        }
        return m;
      });

      if (changed) {
        await this.writeJsonAtomic(this.messagesFile, nextMessages);
        this.memMessages = nextMessages;
      }
      return changed;
    });
  }

  async getConversations(userId) {
    await this.initialize();
    const otherUsers = (await this.getUsers()).filter((u) => u.id !== userId);
    const otherUsersMap = new Map(otherUsers.map((u) => [u.id, u]));
    const groupedMessages = new Map();

    for (const msg of this.memMessages) {
      if (msg.senderId !== userId && msg.receiverId !== userId) continue;
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!groupedMessages.has(otherId)) {
        groupedMessages.set(otherId, []);
      }
      groupedMessages.get(otherId).push({ ...msg });
    }

    const conversations = [];

    for (const [otherId, msgs] of groupedMessages.entries()) {
      const otherUser = otherUsersMap.get(otherId);
      if (!otherUser || msgs.length === 0) continue;

      msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
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
    const item = {
      ...attachmentData,
      createdAt: attachmentData.createdAt || new Date().toISOString()
    };
    this.memAttachments.set(item.id, item);
    return { ...item };
  }

  async getAttachmentById(id) {
    await this.initialize();
    const item = this.memAttachments.get(id);
    return item ? { ...item } : null;
  }

  async close() {}
}

module.exports = JsonStore;
