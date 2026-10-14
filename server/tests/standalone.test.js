const path = require('node:path');
const fs = require('node:fs').promises;
const JsonStore = require('../src/storage/JsonStore');

describe('SimpleLink Backend JsonStore Integration & Cryptographic Privacy Audit', () => {
  const testDir = path.join(__dirname, '../data_test_' + Date.now());
  const store = new JsonStore({ dataDir: testDir, presenceTimeout: 5000 });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  test('Initializes schema and seeds demo users', async () => {
    await store.initialize();
    const users = await store.getUsers();
    expect(users.length).toBeGreaterThanOrEqual(4);
    const sarah = users.find(u => u.username === 'sarah_j');
    expect(sarah).toBeDefined();
    expect(sarah.isOnline).toBe(true);
  });

  test('Creates new user and prevents duplicate usernames', async () => {
    const newUser = await store.createUser({
      id: 'test-user-1',
      username: 'Alice_Test',
      password: 'hashedPassword',
      fullName: 'Alice Test'
    });
    expect(newUser.id).toBe('test-user-1');

    await expect(
      store.createUser({
        id: 'test-user-2',
        username: 'alice_test',
        password: 'hashedPassword',
        fullName: 'Alice Duplicate'
      })
    ).rejects.toThrow(/already exists/i);
  });

  test('Creates and retrieves message with clientMsgId idempotency', async () => {
    const msgData = {
      id: 'msg-audit-1',
      clientMsgId: 'client-audit-1',
      senderId: 'test-user-1',
      receiverId: 'user-sarah',
      content: 'ENC:test_encrypted_payload_simplex_channel',
      timestamp: new Date().toISOString(),
      read: false
    };

    const created = await store.createMessage(msgData);
    expect(created.id).toBe('msg-audit-1');

    // Idempotency test
    const duplicate = await store.findMessageByClientMsgId('test-user-1', 'client-audit-1');
    expect(duplicate).toBeDefined();
    expect(duplicate.id).toBe('msg-audit-1');

    const conversation = await store.getMessagesBetween('test-user-1', 'user-sarah');
    expect(conversation.length).toBe(1);
    expect(conversation[0].content).toBe('ENC:test_encrypted_payload_simplex_channel');
  });

  test('Marks messages as read', async () => {
    const marked = await store.markMessagesAsRead('test-user-1', 'user-sarah');
    expect(marked).toBe(true);

    const conversation = await store.getMessagesBetween('test-user-1', 'user-sarah');
    expect(conversation[0].read).toBe(true);
  });
});

