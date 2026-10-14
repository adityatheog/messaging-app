const request = require('supertest');
const { app } = require('../src/index');

describe('Messaging App REST API Contract Tests', () => {
  const testUser = {
    username: `testuser_${Date.now()}`,
    password: 'password123',
    fullName: 'Test User'
  };

  let token = '';
  let userId = '';
  let recipientId = 'user-sarah';

  test('GET /health returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('POST /api/register creates a new user and returns token', async () => {
    const res = await request(app)
      .post('/api/register')
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.username).toBe(testUser.username.toLowerCase());
    expect(res.body.user).not.toHaveProperty('password');

    token = res.body.token;
    userId = res.body.user.id;
  });

  test('POST /api/login authenticates registered user', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({
        username: testUser.username,
        password: testUser.password
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.id).toBe(userId);
  });

  test('GET /api/me returns authenticated user', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.id).toBe(userId);
  });

  test('GET /api/users returns list of users excluding current user', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((u) => u.id === userId)).toBe(false);
  });

  test('PATCH /api/auth/profile updates user profile', async () => {
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
  });

  test('POST /api/messages sends a message to another user', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        receiverId: recipientId,
        content: 'Hello Sarah from supertest suite!'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.content).toBe('Hello Sarah from supertest suite!');
    expect(res.body.data.senderId).toBe(userId);
    expect(res.body.data.receiverId).toBe(recipientId);
  });

  test('GET /api/messages/:userId fetches conversation messages', async () => {
    const res = await request(app)
      .get(`/api/messages/${recipientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('PATCH /api/messages/read/:senderId marks messages as read', async () => {
    const res = await request(app)
      .patch(`/api/messages/read/${recipientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Messages marked as read');
  });

  test('POST /api/logout clears session', async () => {
    const res = await request(app)
      .post('/api/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Logged out');
  });
});
