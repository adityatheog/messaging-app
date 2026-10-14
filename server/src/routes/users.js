const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getUsers, findUserById } = require('../storage/fileStorage');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await getUsers();
    const sanitized = users
      .filter((u) => u.id !== req.user.id)
      .map(({ password, ...u }) => u);

    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
