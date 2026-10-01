const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const { createMessage, getMessagesBetweenUsers, findUserById, markMessagesAsRead } = require('../models/fileStorage');

const router = express.Router();
const MESSAGE_MAX = 5000;

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { receiverId, content } = req.body || {};

    if (typeof receiverId !== 'string' || !receiverId || typeof content !== 'string') {
      return res.status(400).json({ error: 'Receiver ID and content are required' });
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) return res.status(400).json({ error: 'Message content cannot be empty' });
    if (trimmed.length > MESSAGE_MAX) return res.status(400).json({ error: `Message must be at most ${MESSAGE_MAX} characters` });
    if (receiverId === req.user.id) return res.status(400).json({ error: 'You cannot send a message to yourself' });

    const receiver = await findUserById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    const newMessage = {
      id: uuidv4(),
      senderId: req.user.id,
      receiverId,
      content: trimmed,
      timestamp: new Date().toISOString(),
      read: false
    };

    await createMessage(newMessage);

    res.status(201).json({
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Error sending message:', error.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const otherUser = await findUserById(userId);
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const messages = await getMessagesBetweenUsers(req.user.id, userId);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * PATCH /api/messages/read/:senderId
 * Note: While currently uncalled by the frontend React application, this provides 
 * correct API isolation for future client-side read-receipt implementation.
 */
router.patch('/read/:senderId', authMiddleware, async (req, res) => {
  try {
    const { senderId } = req.params;
    
    // Strict isolation: The receiverId being marked as read MUST be the authenticated user.
    await markMessagesAsRead(senderId, req.user.id);
    
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages read:', error.message);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

module.exports = router;
