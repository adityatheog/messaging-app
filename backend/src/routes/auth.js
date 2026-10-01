const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const { getJwtSecret } = require('../config/env');
const {
  findUserByUsername,
  createUser,
  setUserOnline,
  DuplicateUsernameError
} = require('../models/fileStorage');

const router = express.Router();

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72; // bcrypt only uses the first 72 bytes
const FULLNAME_MAX = 100;

// Used to keep login timing similar whether or not the username exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const signToken = (user) =>
  jwt.sign({ id: user.id, username: user.username }, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: '7d'
  });

const stripPassword = ({ password, ...rest }) => rest;

/**
 * POST /api/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const body = req.body || {};
    const { username, password, fullName } = body;

    // Validation (type checks first: a JSON number/object has no usable .length)
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (fullName !== undefined && fullName !== null && typeof fullName !== 'string') {
      return res.status(400).json({ error: 'Full name must be text' });
    }

    const cleanUsername = username.trim();
    const cleanFullName = typeof fullName === 'string' ? fullName.trim() : '';

    if (cleanUsername.length < USERNAME_MIN) {
      return res.status(400).json({ error: `Username must be at least ${USERNAME_MIN} characters` });
    }
    if (cleanUsername.length > USERNAME_MAX) {
      return res.status(400).json({ error: `Username must be at most ${USERNAME_MAX} characters` });
    }
    if (password.length < PASSWORD_MIN) {
      return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN} characters` });
    }
    if (password.length > PASSWORD_MAX) {
      return res.status(400).json({ error: `Password must be at most ${PASSWORD_MAX} characters` });
    }
    if (cleanFullName.length > FULLNAME_MAX) {
      return res.status(400).json({ error: `Full name must be at most ${FULLNAME_MAX} characters` });
    }

    // Fast duplicate check (createUser repeats it atomically under the storage lock)
    if (await findUserByUsername(cleanUsername)) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user object. The client is logged in right after registering,
    // so the account starts out online.
    const newUser = {
      id: uuidv4(),
      username: cleanUsername,
      password: hashedPassword,
      fullName: cleanFullName || cleanUsername,
      createdAt: new Date().toISOString(),
      isOnline: true
    };

    // Sign BEFORE saving: if signing ever fails, no orphan account is left behind.
    const token = signToken(newUser);

    await createUser(newUser);

    res.status(201).json({
      message: 'User registered successfully',
      user: stripPassword(newUser),
      token
    });
  } catch (error) {
    if (error instanceof DuplicateUsernameError) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /api/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const body = req.body || {};
    const { username, password } = body;

    // Validation
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user (run bcrypt either way so response time does not reveal valid usernames)
    const user = await findUserByUsername(username.trim());
    const isValidPassword = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
    if (!user || !isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = signToken(user);

    // Mark online (serialized with all other storage writes)
    const updated = await setUserOnline(user.id, true);

    res.json({
      message: 'Login successful',
      user: stripPassword(updated || { ...user, isOnline: true }),
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * POST /api/logout
 * Mark the authenticated user offline. (JWTs are stateless; the client discards its token.)
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await setUserOnline(req.user.id, false);
    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

/**
 * GET /api/me
 * Validate the current token and return the current user record.
 */
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
