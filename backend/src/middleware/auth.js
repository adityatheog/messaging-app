const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/env');
const { findUserById, updatePresence } = require('../models/fileStorage');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });

    const user = await findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    // Refresh memory presence timestamp automatically on any valid API interaction.
    updatePresence(user.id);

    // Ensure password is stripped before attaching to req
    const { password, ...safeUser } = user;
    req.user = safeUser;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError || error.name === 'NotBeforeError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Authentication error:', error.message);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = authMiddleware;
