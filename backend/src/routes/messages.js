const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const { createMessage, getMessagesBetweenUsers, findUserById } = require('../models/fileStorage');

const router = express.Router();

/**
 * POST /api/messages
 * Send a new message
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    // Validation
    if (!receiverId || !content) {
      return res.status(400).json({ error: 'Receiver ID and content are required' });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content cannot be empty' });
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
      content: content.trim(),
      timestamp: new Date().toISOString(),
      read: false
    };

    // Save message
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