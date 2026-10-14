const request = require('supertest');
const { app } = require('../src/index.js');

describe('CORS configuration', () => {
  it('should allow valid origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('should reject invalid origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://evil.com');
    // It should not have access-control-allow-origin or it should return 500 error depending on implementation
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
