const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const { getJwtSecret } = require('../config/env');
const { getStore, DuplicateUsernameError } = require('../storage');

const router = express.Router();

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;
const FULLNAME_MAX = 100;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
// Compare against a fixed hash when the username is missing to keep response timing consistent.
const DUMMY_HASH = bcrypt.hashSync('dummy-comparison-password-placeholder', 10);

const signToken = (user) =>
  jwt.sign({ id: user.id, username: user.username, jti: uuidv4() }, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: '7d'
  });

const stripPassword = ({ password: _password, ...rest }) => rest;

router.post('/register', async (req, res) => {
  try {
    const { username, password, fullName } = req.body || {};

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

    const store = getStore();
    if (await store.findUserByUsername(cleanUsername)) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      username: cleanUsername,
      password: hashedPassword,
      fullName: cleanFullName || cleanUsername,
      avatarColor: '#5e72e4',
      createdAt: new Date().toISOString()
    };

    const savedUser = await store.createUser(newUser);
    const token = signToken(savedUser);
    if (store.createSession) {
      await store.createSession(
        authMiddleware.hashToken(token),
        savedUser.id,
        new Date(Date.now() + SESSION_TTL_MS).toISOString()
      );
    }

    res.status(201).json({
      message: 'User registered',
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

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const store = getStore();
    const user = await store.findUserByUsername(username.trim());
    const candidatePassword = password.slice(0, PASSWORD_MAX);
    const isValidPassword = await bcrypt.compare(
      candidatePassword,
      user && user.password ? user.password : DUMMY_HASH
    );

    if (!user || !isValidPassword || password.length > PASSWORD_MAX) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    if (store.createSession) {
      await store.createSession(
        authMiddleware.hashToken(token),
        user.id,
        new Date(Date.now() + SESSION_TTL_MS).toISOString()
      );
    }
    if (store.updatePresence) {
      store.updatePresence(user.id);
    }

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
    const store = getStore();
    if (store.revokeSession && req.tokenHash) {
      await store.revokeSession(req.tokenHash);
    }
    if (store.clearPresence) {
      store.clearPresence(req.user.id);
    }
    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error.message);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const { fullName, avatarColor } = req.body || {};
    if (fullName !== undefined && fullName !== null && typeof fullName !== 'string') {
      return res.status(400).json({ error: 'Full name must be text' });
    }
    if (avatarColor !== undefined && avatarColor !== null && typeof avatarColor !== 'string') {
      return res.status(400).json({ error: 'Avatar color must be text' });
    }
    if (typeof fullName === 'string' && fullName.trim().length > FULLNAME_MAX) {
      return res.status(400).json({ error: `Full name must be at most ${FULLNAME_MAX} characters` });
    }
    if (typeof avatarColor === 'string' && avatarColor.trim() && !HEX_COLOR_RE.test(avatarColor.trim())) {
      return res.status(400).json({ error: 'Invalid avatar color' });
    }

    const store = getStore();
    const updated = await store.updateUserProfile(req.user.id, { fullName, avatarColor });
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'Profile updated', user: stripPassword(updated) });
  } catch (error) {
    console.error('Profile update error:', error.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const store = getStore();
    const deleted = await store.deleteUser(req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Account deletion error:', error.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
