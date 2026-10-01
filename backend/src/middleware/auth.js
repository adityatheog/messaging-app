const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/env');
const { findUserById } = require('../models/fileStorage');

/**
 * Middleware to verify the JWT and authenticate the request.
 *
 * Besides checking the signature/expiry it confirms the account still exists
 * (a token outlives a wiped or reset data store) and attaches the CURRENT,
 * password-free user record as req.user. Identity always comes from here,
 * never from the request body.
 */
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

    // Pin the algorithm so the token header cannot choose it.
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });

    const user = await findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }

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
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = authMiddleware;
