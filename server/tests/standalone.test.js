const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs').promises;
const JsonStore = require('../src/storage/JsonStore');

test('SimpleLink Backend JsonStore Integration & Cryptographic Privacy Audit', async (t) => {
  const testDir = path.join(__dirname, '../data_test_' + Date.now());
  const store = new JsonStore({ dataDir: testDir, presenceTimeout: 5000 });

  await t.test('Initializes schema and seeds demo users', async () => {
    await store.initialize();
    const users = await store.getUsers();
    assert.ok(users.length >= 4, 'Should have at least 4 default contacts seeded');
    const sarah = users.find(u => u.username === 'sarah_j');
    assert.ok(sarah, 'Sarah Jenkins should exist');
    assert.strictEqual(sarah.isOnline, true, 'Seeded user should be marked online');
  });

  await t.test('Creates new user and prevents duplicate usernames', async () => {
    const newUser = await store.createUser({
      id: 'test-user-1',
      username: 'Alice_Test',
      password: 'hashedPassword',
      fullName: 'Alice Test'
    });
    assert.strictEqual(newUser.id, 'test-user-1');

    await assert.rejects(
      async () => {
        await store.createUser({
          id: 'test-user-2',
          username: 'alice_test',
          password: 'hashedPassword',
          fullName: 'Alice Duplicate'
        });
      },
      /already exists/i,
      'Should reject case-insensitive duplicate username'
    );
  });

  await t.test('Creates and retrieves message with clientMsgId idempotency', async () => {
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
    assert.strictEqual(created.id, 'msg-audit-1');

    // Idempotency test
    const duplicate = await store.findMessageByClientMsgId('test-user-1', 'client-audit-1');
    assert.ok(duplicate, 'Should find existing message by clientMsgId');
    assert.strictEqual(duplicate.id, 'msg-audit-1');

    const conversation = await store.getMessagesBetween('test-user-1', 'user-sarah');
    assert.strictEqual(conversation.length, 1);
    assert.strictEqual(conversation[0].content, 'ENC:test_encrypted_payload_simplex_channel');
  });

  await t.test('Marks messages as read', async () => {
    const marked = await store.markMessagesAsRead('test-user-1', 'user-sarah');
    assert.strictEqual(marked, true, 'Should mark message as read');

    const conversation = await store.getMessagesBetween('test-user-1', 'user-sarah');
    assert.strictEqual(conversation[0].read, true, 'Message read status should now be true');
  });

  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});
