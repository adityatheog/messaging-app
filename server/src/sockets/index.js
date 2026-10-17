const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const { getJwtSecret, getCorsOrigins, getPresenceTimeout } = require('../config/env');
const { getStore } = require('../storage');

const userSockets = new Map();
const disconnectTimers = new Map();
const MESSAGE_MAX = 5000;
const CLIENT_ID_MAX = 128;
const ALLOWED_MESSAGE_TYPES = new Set(['TEXT', 'IMAGE', 'VOICE', 'DOCUMENT']);
const SAFE_UPLOAD_URL_RE = /^\/api\/uploads\/[a-zA-Z0-9_-]{1,64}$/;

const clearPresenceTimers = () => {
  for (const timer of disconnectTimers.values()) {
    clearTimeout(timer);
  }
  disconnectTimers.clear();
  userSockets.clear();
};

const isUserConnected = (userId) => {
  const set = userSockets.get(userId);
  return Boolean(set && set.size > 0);
};

let ioInstance = null;

const initSockets = (httpServer) => {
  clearPresenceTimers();
  const allowedOrigins = getCorsOrigins();

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  ioInstance = io;

  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const headerToken =
        typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : '';
      const token = (socket.handshake.auth?.token || headerToken || '').trim();

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
      } catch {
        return next(new Error('Authentication error: Invalid or expired token'));
      }

      if (!decoded || typeof decoded.id !== 'string' || !decoded.id) {
        return next(new Error('Authentication error: Invalid or expired token'));
      }

      const store = getStore();
      if (store.isSessionRevoked) {
        const revoked = await store.isSessionRevoked(authMiddleware.hashToken(token));
        if (revoked) {
          return next(new Error('Authentication error: Invalid or expired token'));
        }
      }

      const user = await store.findUserById(decoded.id);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = { id: user.id, username: user.username };
      next();
    } catch (err) {
      console.error('Socket auth error:', err.message);
      next(new Error('Internal socket auth error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const room = `user:${userId}`;
    const store = getStore();

    socket.join(room);

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    if (disconnectTimers.has(userId)) {
      clearTimeout(disconnectTimers.get(userId));
      disconnectTimers.delete(userId);
    }

    if (store.updatePresence) {
      store.updatePresence(userId);
    }
    io.emit('presence', { userId, isOnline: true });

    socket.on('message:send', async (payload, callback) => {
      try {
        const {
          receiverId,
          content,
          clientMsgId,
          messageType,
          mediaUrl,
          mediaName,
          mediaSize,
          audioDurationSeconds
        } = payload || {};

        if (
          typeof receiverId !== 'string' ||
          !receiverId.trim() ||
          typeof content !== 'string' ||
          !content.trim()
        ) {
          if (callback) callback({ error: 'Receiver ID and content are required' });
          return;
        }

        const cleanReceiverId = receiverId.trim();
        const trimmed = content.trim();
        if (trimmed.length > MESSAGE_MAX) {
          if (callback) callback({ error: `Message must be at most ${MESSAGE_MAX} characters` });
          return;
        }
        if (cleanReceiverId === userId) {
          if (callback) callback({ error: 'You cannot send a message to yourself' });
          return;
        }

        const resolvedType =
          typeof messageType === 'string' && messageType.trim()
            ? messageType.trim().toUpperCase()
            : 'TEXT';
        if (!ALLOWED_MESSAGE_TYPES.has(resolvedType)) {
          if (callback) callback({ error: 'Invalid message type' });
          return;
        }

        let cleanMediaUrl = null;
        if (mediaUrl !== undefined && mediaUrl !== null && mediaUrl !== '') {
          if (typeof mediaUrl !== 'string' || !SAFE_UPLOAD_URL_RE.test(mediaUrl.trim())) {
            if (callback) callback({ error: 'Invalid media URL' });
            return;
          }
          cleanMediaUrl = mediaUrl.trim();
        }

        const activeStore = getStore();
        if (activeStore.updatePresence) {
          activeStore.updatePresence(userId);
        }

        const receiver = await activeStore.findUserById(cleanReceiverId);
        if (!receiver) {
          if (callback) callback({ error: 'Receiver not found' });
          return;
        }

        const cleanClientMsgId =
          typeof clientMsgId === 'string' && clientMsgId.trim()
            ? clientMsgId.trim().slice(0, CLIENT_ID_MAX)
            : null;

        if (cleanClientMsgId) {
          const existing = await activeStore.findMessageByClientMsgId(userId, cleanClientMsgId);
          if (existing) {
            if (callback) callback({ success: true, data: existing });
            return;
          }
        }

        const recipientOnline = isUserConnected(cleanReceiverId);
        const message = {
          id: uuidv4(),
          clientMsgId: cleanClientMsgId,
          senderId: userId,
          receiverId: cleanReceiverId,
          content: trimmed,
          messageType: resolvedType,
          mediaUrl: cleanMediaUrl,
          mediaName:
            typeof mediaName === 'string' && mediaName.trim()
              ? mediaName.trim().slice(0, 120)
              : null,
          mediaSize:
            typeof mediaSize === 'number' && Number.isFinite(mediaSize) && mediaSize >= 0
              ? Math.floor(mediaSize)
              : null,
          audioDurationSeconds:
            typeof audioDurationSeconds === 'number' &&
            Number.isFinite(audioDurationSeconds) &&
            audioDurationSeconds >= 0
              ? Math.floor(audioDurationSeconds)
              : null,
          timestamp: new Date().toISOString(),
          delivered: recipientOnline,
          read: false
        };

        const saved = await activeStore.createMessage(message);

        io.to(`user:${cleanReceiverId}`).emit('message:new', { message: saved });
        io.to(room).emit('message:new', { message: saved });

        if (recipientOnline) {
          io.to(room).emit('message:delivered', {
            messageId: saved.id,
            deliveredTo: cleanReceiverId
          });
        }

        if (callback) callback({ success: true, data: saved });
      } catch (err) {
        console.error('Socket message:send error:', err.message);
        if (callback) callback({ error: 'Failed to send message' });
      }
    });

    socket.on('message:read', async (payload) => {
      try {
        const { senderId } = payload || {};
        if (typeof senderId !== 'string' || !senderId.trim()) return;

        const cleanSenderId = senderId.trim();
        const activeStore = getStore();
        if (activeStore.updatePresence) {
          activeStore.updatePresence(userId);
        }
        const changed = await activeStore.markMessagesAsRead(cleanSenderId, userId);
        if (changed) {
          io.to(`user:${cleanSenderId}`).emit('message:read', {
            senderId: cleanSenderId,
            readerId: userId
          });
          io.to(room).emit('message:read', {
            senderId: cleanSenderId,
            readerId: userId
          });
        }
      } catch (err) {
        console.error('Socket message:read error:', err.message);
      }
    });

    socket.on('typing', (payload) => {
      const { receiverId, isTyping } = payload || {};
      if (typeof receiverId === 'string' && receiverId.trim()) {
        io.to(`user:${receiverId.trim()}`).emit('typing', {
          senderId: userId,
          isTyping: Boolean(isTyping)
        });
      }
    });

    socket.on('disconnect', () => {
      const currentSet = userSockets.get(userId);
      if (currentSet) {
        currentSet.delete(socket.id);
        if (currentSet.size === 0) {
          userSockets.delete(userId);

          const timer = setTimeout(() => {
            if (!isUserConnected(userId)) {
              const activeStore = getStore();
              if (activeStore.clearPresence) {
                activeStore.clearPresence(userId);
              }
              io.emit('presence', { userId, isOnline: false });
            }
            disconnectTimers.delete(userId);
          }, getPresenceTimeout());

          disconnectTimers.set(userId, timer);
        }
      }
    });
  });

  return io;
};

const getIo = () => ioInstance;

module.exports = {
  initSockets,
  getIo,
  clearPresenceTimers,
  isUserConnected
};
