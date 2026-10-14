const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/env');
const { findUserById, updatePresence } = require('../storage/fileStorage');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found or session expired' });
    }

    // Refresh presence timestamp on authenticated requests
    updatePresence(user.id);

    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(500).json({ error: 'Internal server authentication error' });
  }
};

module.exports = authMiddleware;
