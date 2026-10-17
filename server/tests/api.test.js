const path = require('path');
const fs = require('fs').promises;
const request = require('supertest');

const testDataDir = path.join(__dirname, '../data_test_api_' + Date.now());
process.env.DATA_DIR = testDataDir;

const { app, io } = require('../src/index');
const { clearPresenceTimers } = require('../src/sockets');
const { closeStore } = require('../src/storage');

describe('Messaging App REST API Contract Tests', () => {
  const testUser = {
    username: `testuser_${Date.now()}`,
    password: 'password123',
    fullName: 'Test User'
  };

  let token = '';
  let userId = '';
  const recipientId = 'user-sarah';

  afterAll(async () => {
    clearPresenceTimers();
    if (io) {
      io.close();
    }
    await closeStore();
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {});
  });

  test('GET /health returns status ok and active storage backend', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.storage).toBe('sqlite');
  });

  describe('POST /api/register Error Paths', () => {
    test('fails with missing username or password', async () => {
      let res = await request(app).post('/api/register').send({ password: 'password' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Username and password are required');

      res = await request(app).post('/api/register').send({ username: 'user' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Username and password are required');
    });

    test('fails with non-text full name', async () => {
      const res = await request(app).post('/api/register').send({
        username: 'user1',
        password: 'password',
        fullName: 123
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Full name must be text');
    });

    test('fails with short username', async () => {
      const res = await request(app).post('/api/register').send({ username: 'ab', password: 'password' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Username must be at least \d+ characters/);
    });

    test('fails with long username', async () => {
      const longUsername = 'a'.repeat(31);
      const res = await request(app).post('/api/register').send({ username: longUsername, password: 'password' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Username must be at most \d+ characters/);
    });

    test('fails with short password', async () => {
      const res = await request(app).post('/api/register').send({ username: 'user2', password: 'pass' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Password must be at least \d+ characters/);
    });

    test('fails with long password', async () => {
      const longPassword = 'a'.repeat(73);
      const res = await request(app).post('/api/register').send({ username: 'user2', password: longPassword });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Password must be at most \d+ characters/);
    });

    test('fails with long full name', async () => {
      const longFullName = 'a'.repeat(101);
      const res = await request(app).post('/api/register').send({
        username: 'user3',
        password: 'password',
        fullName: longFullName
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Full name must be at most \d+ characters/);
    });

    test('fails with duplicate username', async () => {
      await request(app).post('/api/register').send(testUser);
      const res = await request(app).post('/api/register').send(testUser);
      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('Username already exists');
    });
  });

  test('POST /api/register creates a new user and returns token', async () => {
    const freshTestUser = {
      ...testUser,
      username: `freshuser_${Date.now()}`
    };

    const res = await request(app).post('/api/register').send(freshTestUser);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.username).toBe(freshTestUser.username);
    expect(res.body.user).not.toHaveProperty('password');

    token = res.body.token;
    userId = res.body.user.id;
    testUser.username = freshTestUser.username;
  });

  test('POST /api/login authenticates registered user and rejects wrong password', async () => {
    const badRes = await request(app).post('/api/login').send({
      username: testUser.username,
      password: 'wrongpassword'
    });
    expect(badRes.statusCode).toBe(401);

    const res = await request(app).post('/api/login').send({
      username: testUser.username,
      password: testUser.password
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user).not.toHaveProperty('password');
    token = res.body.token;
  });

  test('GET /api/me returns authenticated user', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('GET /api/users and /api/users/contacts manage directory and contacts', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((u) => u.id === userId)).toBe(false);
    expect(res.body.every((u) => !('password' in u))).toBe(true);

    const addRes = await request(app)
      .post('/api/users/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ contactId: recipientId });
    expect(addRes.statusCode).toBe(201);
    expect(addRes.body.contact.id).toBe(recipientId);

    const listContacts = await request(app)
      .get('/api/users/contacts')
      .set('Authorization', `Bearer ${token}`);
    expect(listContacts.statusCode).toBe(200);
    expect(listContacts.body).toHaveLength(1);

    const delRes = await request(app)
      .delete(`/api/users/contacts/${recipientId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.statusCode).toBe(200);
  });

  test('PATCH /api/auth/profile updates user profile and rejects invalid avatarColor', async () => {
    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Updated Name',
        avatarColor: '#ff0000'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Profile updated');
    expect(res.body.user.fullName).toBe('Updated Name');
    expect(res.body.user.avatarColor).toBe('#ff0000');
    expect(res.body.user).not.toHaveProperty('password');

    const badColor = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatarColor: 'not-a-hex-color' });

    expect(badColor.statusCode).toBe(400);
    expect(badColor.body.error).toBe('Invalid avatar color');
  });

  test('PATCH /api/auth/profile returns 401 without token', async () => {
    const res = await request(app)
      .patch('/api/auth/profile')
      .send({ fullName: 'Unauthorized Attempt' });

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/uploads validates MIME type and magic bytes and stores valid files', async () => {
    const onePixelPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const uploadRes = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'pixel.png',
        mimeType: 'image/png',
        dataBase64: onePixelPngBase64
      });

    expect(uploadRes.statusCode).toBe(201);
    expect(uploadRes.body.attachment.url).toMatch(/^\/api\/uploads\//);

    const getUploadRes = await request(app)
      .get(uploadRes.body.attachment.url)
      .set('Authorization', `Bearer ${token}`);
    expect(getUploadRes.statusCode).toBe(200);
    expect(getUploadRes.headers['content-type']).toBe('image/png');
    expect(getUploadRes.headers['x-content-type-options']).toBe('nosniff');

    const spoofedRes = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'spoof.png',
        mimeType: 'image/png',
        dataBase64: Buffer.from('not a png file').toString('base64')
      });
    expect(spoofedRes.statusCode).toBe(400);
    expect(spoofedRes.body.error).toBe('File content does not match declared MIME type');
  });

  test('POST /api/messages sends a message to another user', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        receiverId: recipientId,
        content: 'Hello Sarah from supertest suite.'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.content).toBe('Hello Sarah from supertest suite.');
    expect(res.body.data.senderId).toBe(userId);
    expect(res.body.data.receiverId).toBe(recipientId);
  });

  describe('POST /api/messages Edge Cases', () => {
    test('fails when receiver ID is missing', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello.' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Receiver ID and content are required');
    });

    test('fails when content is missing', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ receiverId: recipientId });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Receiver ID and content are required');
    });

    test('fails when content is empty after trimming', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ receiverId: recipientId, content: '   ' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Message content cannot be empty');
    });

    test('fails when content exceeds maximum length', async () => {
      const longContent = 'A'.repeat(5001);
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ receiverId: recipientId, content: longContent });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Message must be at most 5000 characters');
    });
  });

  test('GET /api/conversations returns active conversations without password hashes', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].user.id).toBe(recipientId);
    expect(res.body[0].user).not.toHaveProperty('password');
  });

  test('GET /api/messages/:userId fetches only authenticated user conversation messages', async () => {
    const res = await request(app)
      .get(`/api/messages/${recipientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.every((m) => m.senderId === userId || m.receiverId === userId)
    ).toBe(true);
  });

  test('PATCH /api/messages/read/:senderId marks messages as read', async () => {
    const res = await request(app)
      .patch(`/api/messages/read/${recipientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Messages marked as read');
  });

  test('POST /api/logout revokes session token and blocks subsequent requests', async () => {
    const res = await request(app)
      .post('/api/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Logged out');

    const meAfterLogout = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meAfterLogout.statusCode).toBe(401);
  });
});

describe('Auth Middleware Error Tests', () => {
  test('returns 401 when no authorization header is provided', async () => {
    const res = await request(app).get('/api/me');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('No authentication token provided');
  });

  test('returns 401 when authorization header does not start with Bearer', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'InvalidPrefix token123');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('No authentication token provided');
  });

  test('returns 401 when token is empty after Bearer prefix', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer  \xA0');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid token format');
  });

  test('returns 401 when token is invalid or expired', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer invalid.token.string');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });
});
