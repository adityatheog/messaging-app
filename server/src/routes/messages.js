const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const { getStore } = require('../storage');
const { getIo, isUserConnected } = require('../sockets');

const router = express.Router();
const MESSAGE_MAX = 5000;
const CLIENT_ID_MAX = 128;
const ALLOWED_MESSAGE_TYPES = new Set(['TEXT', 'IMAGE', 'VOICE', 'DOCUMENT']);
const SAFE_UPLOAD_URL_RE = /^\/api\/uploads\/[a-zA-Z0-9_-]{1,64}$/;

router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const store = getStore();
    const conversations = await store.getConversations(req.user.id);
    res.json(conversations);
  } catch (error) {
    console.error('Conversations fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
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
    } = req.body || {};

    if (typeof receiverId !== 'string' || !receiverId.trim() || typeof content !== 'string') {
      return res.status(400).json({ error: 'Receiver ID and content are required' });
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'Message content cannot be empty' });
    }
    if (trimmed.length > MESSAGE_MAX) {
      return res.status(400).json({ error: `Message must be at most ${MESSAGE_MAX} characters` });
    }

    const cleanReceiverId = receiverId.trim();
    if (cleanReceiverId === req.user.id) {
      return res.status(400).json({ error: 'You cannot send a message to yourself' });
    }

    const resolvedType =
      typeof messageType === 'string' && messageType.trim()
        ? messageType.trim().toUpperCase()
        : 'TEXT';
    if (!ALLOWED_MESSAGE_TYPES.has(resolvedType)) {
      return res.status(400).json({ error: 'Invalid message type' });
    }

    let cleanMediaUrl = null;
    if (mediaUrl !== undefined && mediaUrl !== null && mediaUrl !== '') {
      if (typeof mediaUrl !== 'string' || !SAFE_UPLOAD_URL_RE.test(mediaUrl.trim())) {
        return res.status(400).json({ error: 'Invalid media URL' });
      }
      cleanMediaUrl = mediaUrl.trim();
    }

    const cleanMediaName =
      typeof mediaName === 'string' && mediaName.trim() ? mediaName.trim().slice(0, 120) : null;
    const cleanMediaSize =
      typeof mediaSize === 'number' && Number.isFinite(mediaSize) && mediaSize >= 0
        ? Math.floor(mediaSize)
        : null;
    const cleanAudioDuration =
      typeof audioDurationSeconds === 'number' &&
      Number.isFinite(audioDurationSeconds) &&
      audioDurationSeconds >= 0
        ? Math.floor(audioDurationSeconds)
        : null;

    const cleanClientMsgId =
      typeof clientMsgId === 'string' && clientMsgId.trim()
        ? clientMsgId.trim().slice(0, CLIENT_ID_MAX)
        : null;

    const store = getStore();
    const receiver = await store.findUserById(cleanReceiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    if (cleanClientMsgId) {
      const existing = await store.findMessageByClientMsgId(req.user.id, cleanClientMsgId);
      if (existing) {
        return res.status(200).json({ message: 'Message already created', data: existing });
      }
    }

    const recipientOnline = isUserConnected(cleanReceiverId);
    const newMessage = {
      id: uuidv4(),
      clientMsgId: cleanClientMsgId,
      senderId: req.user.id,
      receiverId: cleanReceiverId,
      content: trimmed,
      messageType: resolvedType,
      mediaUrl: cleanMediaUrl,
      mediaName: cleanMediaName,
      mediaSize: cleanMediaSize,
      audioDurationSeconds: cleanAudioDuration,
      timestamp: new Date().toISOString(),
      delivered: recipientOnline,
      read: false
    };

    const saved = await store.createMessage(newMessage);

    const io = getIo();
    if (io) {
      io.to(`user:${cleanReceiverId}`).emit('message:new', { message: saved });
      io.to(`user:${req.user.id}`).emit('message:new', { message: saved });
      if (recipientOnline) {
        io.to(`user:${req.user.id}`).emit('message:delivered', {
          messageId: saved.id,
          deliveredTo: cleanReceiverId
        });
      }
    }

    res.status(201).json({
      message: 'Message sent',
      data: saved
    });
  } catch (error) {
    console.error('Message send error:', error.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const store = getStore();
    const otherUser = await store.findUserById(userId);

    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { limit, before, after } = req.query;
    const messages = await store.getMessagesBetween(req.user.id, userId, { limit, before, after });

    res.json(messages);
  } catch (error) {
    console.error('Messages fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.patch('/read/:senderId', authMiddleware, async (req, res) => {
  try {
    const { senderId } = req.params;
    const store = getStore();
    const changed = await store.markMessagesAsRead(senderId, req.user.id);

    const io = getIo();
    if (io && changed) {
      io.to(`user:${senderId}`).emit('message:read', { senderId, readerId: req.user.id });
      io.to(`user:${req.user.id}`).emit('message:read', { senderId, readerId: req.user.id });
    }

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error.message);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

module.exports = router;
