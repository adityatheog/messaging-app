const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const { getStore } = require('../storage');
const { getIo } = require('../sockets');

const router = express.Router();
const MESSAGE_MAX = 5000;

router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const store = getStore();
    const conversations = await store.getConversations(req.user.id);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, clientMsgId } = req.body || {};

    if (typeof receiverId !== 'string' || !receiverId || typeof content !== 'string') {
      return res.status(400).json({ error: 'Receiver ID and content are required' });
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'Message content cannot be empty' });
    }
    if (trimmed.length > MESSAGE_MAX) {
      return res.status(400).json({ error: `Message must be at most ${MESSAGE_MAX} characters` });
    }
    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'You cannot send a message to yourself' });
    }

    const store = getStore();
    const receiver = await store.findUserById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Idempotent check: if message with clientMsgId exists, return it
    if (clientMsgId) {
      const existing = await store.findMessageByClientMsgId(req.user.id, clientMsgId);
      if (existing) {
        return res.status(200).json({ message: 'Message already created', data: existing });
      }
    }

    const newMessage = {
      id: clientMsgId || uuidv4(),
      clientMsgId: clientMsgId || null,
      senderId: req.user.id,
      receiverId,
      content: trimmed,
      timestamp: new Date().toISOString(),
      read: false
    };

    const saved = await store.createMessage(newMessage);

    // Broadcast over Socket.IO if active
    const io = getIo();
    if (io) {
      io.to(`user:${receiverId}`).emit('message:new', { message: saved });
      io.to(`user:${req.user.id}`).emit('message:new', { message: saved });
    }

    res.status(201).json({
      message: 'Message sent successfully',
      data: saved
    });
  } catch (error) {
    console.error('Error sending message:', error.message);
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
    console.error('Error fetching messages:', error.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.patch('/read/:senderId', authMiddleware, async (req, res) => {
  try {
    const { senderId } = req.params;
    const store = getStore();
    await store.markMessagesAsRead(senderId, req.user.id);

    const io = getIo();
    if (io) {
      io.to(`user:${senderId}`).emit('message:read', { senderId, readerId: req.user.id });
      io.to(`user:${req.user.id}`).emit('message:read', { senderId, readerId: req.user.id });
    }

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages read:', error.message);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

module.exports = router;
