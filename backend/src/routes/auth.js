const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const { getJwtSecret } = require('../config/env');
const {
  findUserByUsername,
  createUser,
  updatePresence,
  clearPresence,
  DuplicateUsernameError
} = require('../models/fileStorage');

const router = express.Router();

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72; 
const FULLNAME_MAX = 100;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const signToken = (user) =>
  jwt.sign({ id: user.id, username: user.username }, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: '7d'
  });

const stripPassword = ({ password, ...rest }) => rest;

// Security: Prevent brute-force login/registration attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: { error: 'Too many requests, please try again later' }
});

router.post('/register', authLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const { username, password, fullName } = body;

    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (fullName !== undefined && fullName !== null && typeof fullName !== 'string') {
      return res.status(400).json({ error: 'Full name must be text' });
    }

    const cleanUsername = username.trim();
    const cleanFullName = typeof fullName === 'string' ? fullName.trim() : '';

    if (cleanUsername.length < USERNAME_MIN) return res.status(400).json({ error: `Username must be at least ${USERNAME_MIN} characters` });
    if (cleanUsername.length > USERNAME_MAX) return res.status(400).json({ error: `Username must be at most ${USERNAME_MAX} characters` });
    if (password.length < PASSWORD_MIN) return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters` });
    if (password.length > PASSWORD_MAX) return res.status(400).json({ error: `Password must be at most ${PASSWORD_MAX} characters` });
    if (cleanFullName.length > FULLNAME_MAX) return res.status(400).json({ error: `Full name must be at most ${FULLNAME_MAX} characters` });

    if (await findUserByUsername(cleanUsername)) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      username: cleanUsername,
      password: hashedPassword,
      fullName: cleanFullName || cleanUsername,
      createdAt: new Date().toISOString()
    };

    const token = signToken(newUser);
    const savedUser = await createUser(newUser);

    res.status(201).json({
      message: 'User registered successfully',
      user: stripPassword(savedUser),
      token
    });
  } catch (error) {
    if (error instanceof DuplicateUsernameError) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Registration error:', error.message);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const { username, password } = body;

    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await findUserByUsername(username.trim());
    const isValidPassword = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
    
    if (!user || !isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);

    // Force presence initialization immediately upon valid login.
    updatePresence(user.id);

    res.json({
      message: 'Login successful',
      user: stripPassword({ ...user, isOnline: true }),
      token
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    clearPresence(req.user.id);
    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error.message);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
