const request = require('supertest');
const { app, io } = require('../src/index.js');
const { clearPresenceTimers } = require('../src/sockets');

describe('CORS configuration', () => {
  afterAll(() => {
    clearPresenceTimers();
    if (io) {
      io.close();
    }
  });

  it('allows configured origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('rejects unconfigured origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://evil.com');
    expect(res.statusCode).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
