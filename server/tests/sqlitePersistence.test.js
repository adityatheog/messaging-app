const path = require('node:path');
const fs = require('node:fs').promises;
const SqliteStore = require('../src/storage/SqliteStore');
const { getJwtSecret } = require('../src/config/env');

describe('SqliteStore Persistence, Migrations, Backup, and Security Tests', () => {
  const testDir = path.join(__dirname, '../data_test_sqlite_' + Date.now());
  const jsonMigrateDir = path.join(__dirname, '../data_test_migrate_' + Date.now());

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(jsonMigrateDir, { recursive: true, force: true }).catch(() => {});
  });

  test('Initializes SQLite schema, applies idempotent migrations, and seeds demo data', async () => {
    const store = new SqliteStore({ dataDir: testDir, presenceTimeout: 5000 });
    await store.initialize();
    await store.applyMigrations();

    const users = await store.getUsers();
    expect(users.length).toBeGreaterThanOrEqual(5);
    expect(users.every((u) => !('password' in u))).toBe(true);
    await store.close();
  });

  test('Persists users, contacts, sessions, conversations, and messages across restarts', async () => {
    const store1 = new SqliteStore({ dataDir: testDir, presenceTimeout: 5000 });
    await store1.initialize();

    const alice = await store1.createUser({
      id: 'user-persist-alice',
      username: 'persist_alice',
      password: 'hashed_password_1',
      fullName: 'Persist Alice'
    });
    expect(alice.id).toBe('user-persist-alice');
    expect(alice).not.toHaveProperty('password');

    await store1.createSession(
      'hash-1',
      alice.id,
      new Date(Date.now() + 60000).toISOString()
    );
    expect(await store1.isSessionRevoked('hash-1')).toBe(false);

    const addedContact = await store1.addContact(alice.id, 'user-sarah');
    expect(addedContact.id).toBe('user-sarah');

    const msg = await store1.createMessage({
      id: 'msg-persist-1',
      clientMsgId: 'cid-persist-1',
      senderId: alice.id,
      receiverId: 'user-sarah',
      content: 'Survives restart',
      messageType: 'TEXT',
      timestamp: new Date().toISOString(),
      read: false
    });
    expect(msg.id).toBe('msg-persist-1');
    expect(
      await store1.isConversationMember('direct:user-persist-alice:user-sarah', alice.id)
    ).toBe(true);
    expect(
      await store1.isConversationMember('direct:user-persist-alice:user-sarah', 'user-david')
    ).toBe(false);

    const backupFile = path.join(testDir, 'backups', 'snapshot.db');
    await store1.backupDatabase(backupFile);
    await store1.close();

    const store2 = new SqliteStore({ dataDir: testDir, presenceTimeout: 5000 });
    await store2.initialize();

    const reloadedAlice = await store2.findUserById(alice.id);
    expect(reloadedAlice).toBeDefined();
    expect(reloadedAlice.username).toBe('persist_alice');

    const contacts = await store2.getContacts(alice.id);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].id).toBe('user-sarah');

    const msgs = await store2.getMessagesBetween(alice.id, 'user-sarah');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('Survives restart');

    await store2.revokeSession('hash-1');
    expect(await store2.isSessionRevoked('hash-1')).toBe(true);

    await store2.removeContact(alice.id, 'user-sarah');
    expect(await store2.getContacts(alice.id)).toHaveLength(0);

    const deleted = await store2.deleteUser(alice.id);
    expect(deleted).toBe(true);
    expect(await store2.findUserById(alice.id)).toBeUndefined();

    await store2.close();
  });

  test('Automatically migrates existing users.json and messages.json into SQLite without deleting JSON files', async () => {
    await fs.mkdir(jsonMigrateDir, { recursive: true });
    const legacyUsers = [
      {
        id: 'legacy-u1',
        username: 'legacy_alice',
        password: 'hashed_legacy_pass',
        fullName: 'Legacy Alice',
        avatarColor: '#10b981',
        createdAt: '2026-10-01T00:00:00.000Z'
      },
      {
        id: 'legacy-u2',
        username: 'legacy_bob',
        password: 'hashed_legacy_pass',
        fullName: 'Legacy Bob',
        avatarColor: '#3b82f6',
        createdAt: '2026-10-01T00:00:00.000Z'
      }
    ];
    const legacyMessages = [
      {
        id: 'legacy-m1',
        clientMsgId: 'legacy-cid-1',
        senderId: 'legacy-u1',
        receiverId: 'legacy-u2',
        content: 'Migrated from JSON',
        timestamp: '2026-10-01T01:00:00.000Z',
        read: false
      }
    ];

    await fs.writeFile(
      path.join(jsonMigrateDir, 'users.json'),
      JSON.stringify(legacyUsers, null, 2)
    );
    await fs.writeFile(
      path.join(jsonMigrateDir, 'messages.json'),
      JSON.stringify(legacyMessages, null, 2)
    );

    const store = new SqliteStore({ dataDir: jsonMigrateDir, seedOnEmpty: false });
    await store.initialize();

    const u1 = await store.findUserById('legacy-u1');
    expect(u1).toBeDefined();
    expect(u1.username).toBe('legacy_alice');

    const msgs = await store.getMessagesBetween('legacy-u1', 'legacy-u2');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('Migrated from JSON');

    const jsonStillExists = await fs
      .access(path.join(jsonMigrateDir, 'users.json'))
      .then(() => true)
      .catch(() => false);
    expect(jsonStillExists).toBe(true);

    await store.close();
  });

  test('Rejects missing or placeholder JWT_SECRET in production', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);

      process.env.JWT_SECRET = 'change_this_secret_in_production';
      expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);

      process.env.JWT_SECRET = 'a-strong-random-production-secret-value-123456';
      expect(getJwtSecret()).toBe('a-strong-random-production-secret-value-123456');
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = prevSecret;
      }
    }
  });
});
