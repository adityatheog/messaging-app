const path = require('path');
const fs = require('fs').promises;
const request = require('supertest');
const { io: Client } = require('socket.io-client');

const testDataDir = path.join(__dirname, '../data_test_rt_' + Date.now());
process.env.DATA_DIR = testDataDir;

const { app, httpServer, io } = require('../src/index');
const { clearPresenceTimers } = require('../src/sockets');
const { getStore, closeStore } = require('../src/storage');

describe('Socket.IO Real-time & Idempotency Integration Tests', () => {
  let socketUrl;
  let tokenAlice;
  let tokenBob;
  let aliceId;
  let bobId;

  beforeAll(async () => {
    const store = getStore();
    await store.initialize();

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        const port = httpServer.address().port;
        socketUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    const resAlice = await request(app)
      .post('/api/register')
      .send({
        username: `alice_rt_${Date.now()}`,
        password: 'password123',
        fullName: 'Alice Realtime'
      });
    tokenAlice = resAlice.body.token;
    aliceId = resAlice.body.user.id;

    const resBob = await request(app)
      .post('/api/register')
      .send({
        username: `bob_rt_${Date.now()}`,
        password: 'password123',
        fullName: 'Bob Realtime'
      });
    tokenBob = resBob.body.token;
    bobId = resBob.body.user.id;
  });

  afterAll(async () => {
    clearPresenceTimers();
    if (io) {
      io.close();
    }
    if (httpServer.listening) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    await closeStore();
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {});
  });

  test('Socket connection fails without token', (done) => {
    const client = Client(socketUrl, {
      auth: {},
      transports: ['websocket']
    });

    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/Authentication error/);
      client.disconnect();
      done();
    });
  });

  test('Socket connection succeeds with valid JWT and joins room', (done) => {
    const clientAlice = Client(socketUrl, {
      auth: { token: tokenAlice },
      transports: ['websocket']
    });

    clientAlice.on('connect', () => {
      expect(clientAlice.connected).toBe(true);
      clientAlice.disconnect();
      done();
    });
  });

  test('Real-time message:send delivers to recipient and echoes to sender room', (done) => {
    const clientAlice = Client(socketUrl, {
      auth: { token: tokenAlice },
      transports: ['websocket']
    });

    const clientBob = Client(socketUrl, {
      auth: { token: tokenBob },
      transports: ['websocket']
    });

    let bobReceived = false;
    let aliceEchoed = false;

    const checkDone = () => {
      if (bobReceived && aliceEchoed) {
        clientAlice.disconnect();
        clientBob.disconnect();
        done();
      }
    };

    clientBob.on('message:new', ({ message }) => {
      if (message.content === 'Realtime test message from Alice') {
        expect(message.senderId).toBe(aliceId);
        expect(message.receiverId).toBe(bobId);
        bobReceived = true;
        checkDone();
      }
    });

    clientAlice.on('message:new', ({ message }) => {
      if (message.content === 'Realtime test message from Alice') {
        aliceEchoed = true;
        checkDone();
      }
    });

    let aliceReady = false;
    let bobReady = false;

    const trySend = () => {
      if (aliceReady && bobReady) {
        clientAlice.emit('message:send', {
          receiverId: bobId,
          content: 'Realtime test message from Alice',
          clientMsgId: `cid-${Date.now()}`
        });
      }
    };

    clientAlice.on('connect', () => {
      aliceReady = true;
      trySend();
    });

    clientBob.on('connect', () => {
      bobReady = true;
      trySend();
    });
  });

  test('Idempotent message send: duplicate clientMsgId returns existing message', async () => {
    const clientMsgId = `unique-idempotent-${Date.now()}`;

    const res1 = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        receiverId: bobId,
        content: 'Idempotency test payload',
        clientMsgId
      });

    expect(res1.statusCode).toBe(201);
    const firstMsgId = res1.body.data.id;

    const res2 = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        receiverId: bobId,
        content: 'Idempotency test payload',
        clientMsgId
      });

    expect(res2.statusCode).toBe(200);
    expect(res2.body.data.id).toBe(firstMsgId);

    const listRes = await request(app)
      .get(`/api/messages/${bobId}`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    const matches = listRes.body.filter((m) => m.clientMsgId === clientMsgId);
    expect(matches.length).toBe(1);
  });

  test('Cursor pagination with limit and after', async () => {
    const store = getStore();

    const m1 = await store.createMessage({
      id: `p1-${Date.now()}`,
      senderId: aliceId,
      receiverId: bobId,
      content: 'Page msg 1',
      timestamp: new Date(Date.now() - 3000).toISOString(),
      read: false
    });

    const m2 = await store.createMessage({
      id: `p2-${Date.now()}`,
      senderId: aliceId,
      receiverId: bobId,
      content: 'Page msg 2',
      timestamp: new Date(Date.now() - 2000).toISOString(),
      read: false
    });

    const m3 = await store.createMessage({
      id: `p3-${Date.now()}`,
      senderId: aliceId,
      receiverId: bobId,
      content: 'Page msg 3',
      timestamp: new Date(Date.now() - 1000).toISOString(),
      read: false
    });

    const res = await request(app)
      .get(`/api/messages/${bobId}?after=${m1.id}&limit=2`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((m) => m.id)).toEqual([m2.id, m3.id]);
  });
});
