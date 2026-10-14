const path = require('node:path');
const fs = require('node:fs').promises;
const JsonStore = require('../src/storage/JsonStore');

describe('JsonStore Utility Methods', () => {
  const testDir = path.join(__dirname, '../data_test_utils_' + Date.now());
  const store = new JsonStore({ dataDir: testDir, presenceTimeout: 5000 });

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('readJsonArray', () => {
    test('returns empty array for non-existent file', async () => {
      const result = await store.readJsonArray(path.join(testDir, 'nonexistent.json'));
      expect(result).toEqual([]);
    });

    test('returns empty array if JSON is not an array', async () => {
      const filePath = path.join(testDir, 'notarray.json');
      await fs.writeFile(filePath, JSON.stringify({ a: 1 }));
      const result = await store.readJsonArray(filePath);
      expect(result).toEqual([]);
    });

    test('returns parsed array if valid JSON array', async () => {
      const filePath = path.join(testDir, 'array.json');
      await fs.writeFile(filePath, JSON.stringify([{ a: 1 }]));
      const result = await store.readJsonArray(filePath);
      expect(result).toEqual([{ a: 1 }]);
    });

    test('throws error for invalid JSON', async () => {
      const filePath = path.join(testDir, 'invalid.json');
      await fs.writeFile(filePath, 'not json');
      await expect(store.readJsonArray(filePath)).rejects.toThrow();
    });
  });

  describe('writeJsonAtomic', () => {
    test('writes data atomically', async () => {
      const filePath = path.join(testDir, 'atomic.json');
      const data = [{ b: 2 }];
      await store.writeJsonAtomic(filePath, data);
      const content = await fs.readFile(filePath, 'utf8');
      expect(JSON.parse(content)).toEqual(data);
    });
  });

  describe('withLock', () => {
    test('executes operations sequentially', async () => {
      const order = [];
      const op1 = store.withLock(async () => {
        await new Promise(r => setTimeout(r, 50));
        order.push(1);
      });
      const op2 = store.withLock(async () => {
        order.push(2);
      });
      await Promise.all([op1, op2]);
      expect(order).toEqual([1, 2]);
    });

    test('continues after a failure', async () => {
      const order = [];
      const op1 = store.withLock(async () => {
        throw new Error('fail');
      });
      const op2 = store.withLock(async () => {
        order.push(2);
      });
      await expect(op1).rejects.toThrow('fail');
      await op2;
      expect(order).toEqual([2]);
    });
  });
});
