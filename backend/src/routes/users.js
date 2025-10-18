const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getUsers, findUserById } = require('../models/fileStorage');

const router = express.Router();

/**
 * GET /api/users
 * Get all users (excluding current user and passwords)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await getUsers();
    
    // Remove passwords and exclude current user
    const sanitizedUsers = users
      .filter(user => user.id !== req.user.id)
      .map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/:id
 * Get a specific user by ID
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;