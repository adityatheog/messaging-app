const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Store, DuplicateUsernameError } = require('./Store');

class JsonStore extends Store {
  constructor(options = {}) {
    super();
    this.dataDir = options.dataDir || (process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '../../data'));
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.messagesFile = path.join(this.dataDir, 'messages.json');

    this.memUsers = null;
    this.memMessages = null;
    this.presenceMap = new Map();
    this.PRESENCE_TIMEOUT_MS = options.presenceTimeout || (process.env.PRESENCE_TIMEOUT_MS ? parseInt(process.env.PRESENCE_TIMEOUT_MS, 10) : 15000);

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
        await handle.sync();
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
    if (this.memUsers.length === 0) {
      const defaultPassword = 'password123';
      const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
      const now = new Date().toISOString();

      const initialUsers = [
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

      const initialMessages = [
        {
          id: 'msg-seed-1',
          clientMsgId: 'client-seed-1',
          senderId: 'user-sarah',
          receiverId: 'user-alex',
          content: 'Hey Alex! SimpleLink pairwise queue is active. End-to-end ratchet initialized.',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          read: true
        },
        {
          id: 'msg-seed-2',
          clientMsgId: 'client-seed-2',
          senderId: 'user-alex',
          receiverId: 'user-sarah',
          content: 'Awesome! Verified safety number: 9A2F · 4B18. No central user IDs exposed.',
          timestamp: new Date(Date.now() - 2400000).toISOString(),
          read: true
        }
      ];

      this.memUsers = initialUsers;
      this.memMessages = initialMessages;

      await this.writeJsonAtomic(this.usersFile, this.memUsers);
      await this.writeJsonAtomic(this.messagesFile, this.memMessages);

      this.updatePresence('user-sarah');
      this.updatePresence('user-alex');
      this.updatePresence('user-emily');
    }
  }

  async initialize() {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await fs.mkdir(this.dataDir, { recursive: true });
        for (const file of [this.usersFile, this.messagesFile]) {
          try {
            await fs.writeFile(file, '[]', { flag: 'wx' });
          } catch (e) {
            if (e.code !== 'EEXIST') throw e;
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
    return this.memUsers.map((u) => ({ ...u, isOnline: this.isOnline(u.id) }));
  }

  async findUserById(id) {
    await this.initialize();
    const u = this.memUsers.find((x) => x.id === id);
    return u ? { ...u, isOnline: this.isOnline(u.id) } : undefined;
  }

  async findUserByUsername(username) {
    await this.initialize();
    const needle = String(username || '').trim().toLowerCase();
    const u = this.memUsers.find((x) => x.username.toLowerCase() === needle);
    return u ? { ...u, isOnline: this.isOnline(u.id) } : undefined;
  }

  async createUser(userData) {
    return this.withLock(async () => {
      await this.initialize();
      const needle = String(userData.username || '').trim().toLowerCase();
      if (this.memUsers.some((x) => x.username.toLowerCase() === needle)) {
        throw new DuplicateUsernameError(userData.username);
      }

      const userToSave = { ...userData };
      delete userToSave.isOnline;
      const nextUsers = [...this.memUsers, userToSave];

      await this.writeJsonAtomic(this.usersFile, nextUsers);
      this.memUsers = nextUsers;
      this.updatePresence(userData.id);

      return { ...userToSave, isOnline: true };
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
            ...(updates.fullName ? { fullName: updates.fullName.trim() } : {}),
            ...(updates.avatarColor ? { avatarColor: updates.avatarColor } : {})
          };
          return updated;
        }
        return u;
      });

      if (updated) {
        await this.writeJsonAtomic(this.usersFile, nextUsers);
        this.memUsers = nextUsers;
        return { ...updated, isOnline: this.isOnline(updated.id) };
      }
      return null;
    });
  }

  async findMessageByClientMsgId(senderId, clientMsgId) {
    await this.initialize();
    if (!clientMsgId) return null;
    return this.memMessages.find((m) => m.senderId === senderId && m.clientMsgId === clientMsgId) || null;
  }

  async getMessagesBetween(userId1, userId2, options = {}) {
    await this.initialize();
    let list = this.memMessages
      .filter(
        (m) =>
          (m.senderId === userId1 && m.receiverId === userId2) ||
          (m.senderId === userId2 && m.receiverId === userId1)
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (options.after) {
      const idx = list.findIndex((m) => m.id === options.after);
      if (idx !== -1) list = list.slice(idx + 1);
    }

    if (options.before) {
      const idx = list.findIndex((m) => m.id === options.before);
      if (idx !== -1) list = list.slice(0, idx);
    }

    if (options.limit && !isNaN(options.limit)) {
      list = list.slice(-parseInt(options.limit, 10));
    }

    return list;
  }

  async createMessage(messageData) {
    return this.withLock(async () => {
      await this.initialize();

      // Idempotency check: if message with clientMsgId already exists, return existing
      if (messageData.clientMsgId) {
        const existing = this.memMessages.find(
          (m) => m.senderId === messageData.senderId && m.clientMsgId === messageData.clientMsgId
        );
        if (existing) return existing;
      }

      const nextMessages = [...this.memMessages, messageData];
      await this.writeJsonAtomic(this.messagesFile, nextMessages);
      this.memMessages = nextMessages;
      return messageData;
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
    const conversations = [];

    for (const other of otherUsers) {
      const msgs = await this.getMessagesBetween(userId, other.id);
      const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const unreadCount = msgs.filter(
        (m) => m.senderId === other.id && m.receiverId === userId && !m.read
      ).length;

      if (lastMessage) {
        conversations.push({
          user: other,
          lastMessage,
          unreadCount,
          updatedAt: lastMessage.timestamp
        });
      }
    }

    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return conversations;
  }
}

module.exports = JsonStore;
