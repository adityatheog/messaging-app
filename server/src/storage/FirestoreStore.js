const admin = require('firebase-admin');
const { Store, DuplicateUsernameError } = require('./Store');

class FirestoreStore extends Store {
  constructor(options = {}) {
    super();
    this.db = null;
    this.initialized = false;
    this.options = options;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      if (!admin.apps.length) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          let serviceAccount;
          try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
          } catch {
            serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
          }
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
        } else {
          admin.initializeApp({
            credential: admin.credential.applicationDefault()
          });
        }
      }
      this.db = admin.firestore();
      this.initialized = true;
      console.log('Production Firestore Store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firestore Store:', error.message);
      throw error;
    }
  }

  async getUsers() {
    await this.initialize();
    const snap = await this.db.collection('users').get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        isOnline: Boolean(data.isOnline)
      };
    });
  }

  async findUserById(id) {
    await this.initialize();
    const doc = await this.db.collection('users').doc(id).get();
    if (!doc.exists) return undefined;
    return { id: doc.id, ...doc.data() };
  }

  async findUserByUsername(username) {
    await this.initialize();
    const needle = String(username || '').trim().toLowerCase();
    const snap = await this.db.collection('users').where('usernameLower', '==', needle).limit(1).get();
    if (snap.empty) return undefined;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async createUser(userData) {
    await this.initialize();
    const needle = String(userData.username || '').trim().toLowerCase();
    const usernameRef = this.db.collection('usernames').doc(needle);
    const userRef = this.db.collection('users').doc(userData.id);

    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(usernameRef);
      if (existing.exists) {
        throw new DuplicateUsernameError(userData.username);
      }
      transaction.set(usernameRef, { uid: userData.id, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      transaction.set(userRef, {
        ...userData,
        usernameLower: needle,
        isOnline: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return { ...userData, isOnline: true };
  }

  async updateUserProfile(userId, updates) {
    await this.initialize();
    const userRef = this.db.collection('users').doc(userId);
    const dataToUpdate = {};
    if (updates.fullName) dataToUpdate.fullName = updates.fullName.trim();
    if (updates.avatarColor) dataToUpdate.avatarColor = updates.avatarColor;
    if (updates.isOnline !== undefined) dataToUpdate.isOnline = updates.isOnline;

    await userRef.update(dataToUpdate);
    const snap = await userRef.get();
    return { id: snap.id, ...snap.data() };
  }

  async findMessageByClientMsgId(senderId, clientMsgId) {
    await this.initialize();
    if (!clientMsgId) return null;
    const snap = await this.db.collection('messages')
      .where('senderId', '==', senderId)
      .where('clientMsgId', '==', clientMsgId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  async getMessagesBetween(userId1, userId2, options = {}) {
    await this.initialize();
    // Query direct messages
    const q1 = await this.db.collection('messages')
      .where('senderId', '==', userId1)
      .where('receiverId', '==', userId2)
      .get();
    const q2 = await this.db.collection('messages')
      .where('senderId', '==', userId2)
      .where('receiverId', '==', userId1)
      .get();

    const all = [
      ...q1.docs.map((d) => ({ id: d.id, ...d.data() })),
      ...q2.docs.map((d) => ({ id: d.id, ...d.data() }))
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let list = all;
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
    await this.initialize();
    // Idempotent check
    if (messageData.clientMsgId) {
      const existing = await this.findMessageByClientMsgId(messageData.senderId, messageData.clientMsgId);
      if (existing) return existing;
    }

    const docRef = this.db.collection('messages').doc(messageData.id);
    await docRef.set({
      ...messageData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return messageData;
  }

  async markMessagesAsRead(senderId, receiverId) {
    await this.initialize();
    const snap = await this.db.collection('messages')
      .where('senderId', '==', senderId)
      .where('receiverId', '==', receiverId)
      .where('read', '==', false)
      .get();

    const batch = this.db.batch();
    snap.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();
  }

  async getConversations(userId) {
    await this.initialize();
    const otherUsers = (await this.getUsers()).filter((u) => u.id !== userId);
    const otherUsersMap = new Map(otherUsers.map((u) => [u.id, u]));

    const [sentSnap, receivedSnap] = await Promise.all([
      this.db.collection('messages').where('senderId', '==', userId).get(),
      this.db.collection('messages').where('receiverId', '==', userId).get()
    ]);

    const messages = [];
    const seenMsgs = new Set();

    const addMsgs = (snap) => {
      snap.docs.forEach((doc) => {
        if (!seenMsgs.has(doc.id)) {
          seenMsgs.add(doc.id);
          messages.push({ id: doc.id, ...doc.data() });
        }
      });
    };

    addMsgs(sentSnap);
    addMsgs(receivedSnap);

    const conversationsMap = new Map();

    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversationsMap.has(otherId)) {
        conversationsMap.set(otherId, []);
      }
      conversationsMap.get(otherId).push(msg);
    }

    const conversations = [];

    for (const [otherId, msgs] of conversationsMap.entries()) {
      const otherUser = otherUsersMap.get(otherId);
      if (!otherUser) continue;

      msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const unreadCount = msgs.filter(
        (m) => m.senderId === otherId && m.receiverId === userId && !m.read
      ).length;

      if (lastMessage) {
        conversations.push({
          user: otherUser,
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

module.exports = FirestoreStore;
