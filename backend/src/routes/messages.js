const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const { createMessage, getMessagesBetweenUsers, findUserById } = require('../models/fileStorage');

const router = express.Router();

const MESSAGE_MAX = 5000;

/**
 * POST /api/messages
 * Send a new message. The sender is ALWAYS the authenticated user (req.user);
 * any senderId supplied by the client is ignored.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { receiverId, content } = req.body || {};

    // Validation (type checks first: .trim() on a non-string would throw -> 500)
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

    // Verify receiver exists
    const receiver = await findUserById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Create message object
    const newMessage = {
      id: uuidv4(),
      senderId: req.user.id,
      receiverId,
      content: trimmed,
      timestamp: new Date().toISOString(),
      read: false
    };

    // Save message (atomic append under the storage lock)
    await createMessage(newMessage);

    res.status(201).json({
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * GET /api/messages/:userId
 * Get all messages between current user and specified user
 */
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify other user exists
    const otherUser = await findUserById(userId);
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get messages between both users
    const messages = await getMessagesBetweenUsers(req.user.id, userId);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
