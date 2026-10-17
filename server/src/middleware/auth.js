const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/env');
const { getStore } = require('../storage');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!decoded || typeof decoded.id !== 'string' || !decoded.id) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const store = getStore();
    const tokenHash = hashToken(token);
    if (store.isSessionRevoked && (await store.isSessionRevoked(tokenHash))) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await store.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found or session expired' });
    }

    if (store.updatePresence) {
      store.updatePresence(user.id);
    }

    const { password: _password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    req.token = token;
    req.tokenHash = tokenHash;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(500).json({ error: 'Internal server authentication error' });
  }
};

authMiddleware.hashToken = hashToken;

module.exports = authMiddleware;
