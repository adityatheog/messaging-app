const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getJwtSecret, getCorsOrigins } = require('../config/env');
const { getStore } = require('../storage');

// User presence tracking (multi-device & multi-tab safe)
const userSockets = new Map(); // userId -> Set<socketId>
const disconnectTimers = new Map(); // userId -> TimeoutId
const PRESENCE_GRACE_PERIOD_MS = 15000;

let ioInstance = null;

const initSockets = (httpServer) => {
  const allowedOrigins = getCorsOrigins();

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  ioInstance = io;

  // Authentication middleware using handshake.auth.token
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
      } catch (err) {
        return next(new Error('Authentication error: Invalid or expired token'));
      }

      const store = getStore();
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

    // Join user's personal room for all devices
    socket.join(room);

    // Track active socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Cancel pending disconnect grace timer if user reconnected
    if (disconnectTimers.has(userId)) {
      clearTimeout(disconnectTimers.get(userId));
      disconnectTimers.delete(userId);
    }

    // Broadcast presence online to everyone
    io.emit('presence', { userId, isOnline: true });

    // Handle real-time sending
    socket.on('message:send', async (payload, callback) => {
      try {
        const { receiverId, content, clientMsgId } = payload || {};
        if (!receiverId || !content || typeof content !== 'string' || !content.trim()) {
          if (callback) callback({ error: 'Receiver ID and content are required' });
          return;
        }

        const trimmed = content.trim();
        const store = getStore();

        // Check deduplication
        if (clientMsgId) {
          const existing = await store.findMessageByClientMsgId(userId, clientMsgId);
          if (existing) {
            if (callback) callback({ success: true, data: existing });
            return;
          }
        }

        const message = {
          id: clientMsgId || uuidv4(),
          clientMsgId: clientMsgId || null,
          senderId: userId,
          receiverId,
          content: trimmed,
          timestamp: new Date().toISOString(),
          read: false
        };

        const saved = await store.createMessage(message);

        // Echo to both receiver and sender's other devices
        io.to(`user:${receiverId}`).emit('message:new', { message: saved });
        io.to(room).emit('message:new', { message: saved });

        // If receiver is currently online, emit delivered status
        if (userSockets.has(receiverId) && userSockets.get(receiverId).size > 0) {
          io.to(room).emit('message:delivered', { messageId: saved.id, deliveredTo: receiverId });
        }

        if (callback) callback({ success: true, data: saved });
      } catch (err) {
        console.error('Socket message:send error:', err);
        if (callback) callback({ error: 'Failed to send message' });
      }
    });

    // Handle real-time read receipt
    socket.on('message:read', async (payload) => {
      try {
        const { senderId } = payload || {};
        if (!senderId) return;

        const store = getStore();
        await store.markMessagesAsRead(senderId, userId);

        // Notify both parties that messages were read
        io.to(`user:${senderId}`).emit('message:read', { senderId, readerId: userId });
        io.to(room).emit('message:read', { senderId, readerId: userId });
      } catch (err) {
        console.error('Socket message:read error:', err);
      }
    });

    // Handle typing indicator
    socket.on('typing', (payload) => {
      const { receiverId, isTyping } = payload || {};
      if (receiverId) {
        io.to(`user:${receiverId}`).emit('typing', {
          senderId: userId,
          isTyping: Boolean(isTyping)
        });
      }
    });

    // Handle socket disconnect
    socket.on('disconnect', () => {
      const currentSet = userSockets.get(userId);
      if (currentSet) {
        currentSet.delete(socket.id);
        if (currentSet.size === 0) {
          userSockets.delete(userId);

          // 15-second grace period before declaring user offline
          const timer = setTimeout(() => {
            if (!userSockets.has(userId) || userSockets.get(userId).size === 0) {
              io.emit('presence', { userId, isOnline: false });
            }
            disconnectTimers.delete(userId);
          }, PRESENCE_GRACE_PERIOD_MS);

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
  getIo
};
