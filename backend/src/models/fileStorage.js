const fs = require('fs').promises;
const path = require('path');

const getDataDir = () => process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '../../data');
const usersFile = () => path.join(getDataDir(), 'users.json');
const messagesFile = () => path.join(getDataDir(), 'messages.json');

class StorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

class DuplicateUsernameError extends Error {
  constructor(username) {
    super(`Username "${username}" already exists`);
    this.name = 'DuplicateUsernameError';
  }
}

// Memory Cache & Presence map (Single Node.js Process Only)
let memUsers = null;
let memMessages = null;
const presenceMap = new Map();
const PRESENCE_TIMEOUT_MS = process.env.PRESENCE_TIMEOUT_MS ? parseInt(process.env.PRESENCE_TIMEOUT_MS, 10) : 15000;

// Serialized Promise lock to prevent concurrent write corruption
let lockChain = Promise.resolve();
const withLock = (fn) => {
  const result = lockChain.then(() => fn());
  lockChain = result.catch(() => {}); // Prevent a single failure from breaking the queue
  return result;
};

const readJsonArray = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new StorageError(`${filePath} does not contain a JSON array`);
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new StorageError(`Cannot read ${filePath}: ${error.message}`, error);
  }
};

/** 
 * Atomically replaces the file. 
 * Uses compact JSON.stringify to reduce CPU/memory overhead.
 */
const writeJsonAtomic = async (filePath, data) => {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const handle = await fs.open(tmpPath, 'w');
    try {
      await handle.writeFile(JSON.stringify(data), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    await fs.unlink(tmpPath).catch(() => {}); // Clean up stale temp file
    throw new StorageError(`Cannot write ${filePath}: ${error.message}`, error);
  }
};

let initPromise = null;
const doInitialize = async () => {
  const dir = getDataDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.access(dir, require('fs').constants.W_OK);

  memUsers = await readJsonArray(usersFile());
  memMessages = await readJsonArray(messagesFile());

  // Ensure files exist safely without overwriting data
  try { await fs.writeFile(usersFile(), '[]', { flag: 'wx' }); } catch (e) {}
  try { await fs.writeFile(messagesFile(), '[]', { flag: 'wx' }); } catch (e) {}
};

const initializeStorage = () => {
  if (!initPromise) {
    initPromise = doInitialize().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
};

const normalizeUsername = (username) => String(username == null ? '' : username).trim().toLowerCase();

// --- Presence Logic ---
const updatePresence = (userId) => presenceMap.set(userId, Date.now());
const clearPresence = (userId) => presenceMap.delete(userId);
const isOnline = (userId) => {
  const lastActive = presenceMap.get(userId);
  if (!lastActive) return false;
  return (Date.now() - lastActive) < PRESENCE_TIMEOUT_MS;
};

// --- User Logic ---
const getUsers = async () => {
  await initializeStorage();
  return memUsers.map(u => ({ ...u, isOnline: isOnline(u.id) }));
};

const findUserByUsername = async (username) => {
  await initializeStorage();
  const exact = memUsers.find((u) => u.username === username);
  if (exact) return { ...exact, isOnline: isOnline(exact.id) };
  
  const needle = normalizeUsername(username);
  const user = memUsers.find((u) => normalizeUsername(u.username) === needle);
  return user ? { ...user, isOnline: isOnline(user.id) } : undefined;
};

const findUserById = async (id) => {
  await initializeStorage();
  const user = memUsers.find((u) => u.id === id);
  return user ? { ...user, isOnline: isOnline(user.id) } : undefined;
};

const createUser = (userData) =>
  withLock(async () => {
    await initializeStorage();
    const needle = normalizeUsername(userData.username);
    if (memUsers.some((u) => normalizeUsername(u.username) === needle)) {
      throw new DuplicateUsernameError(userData.username);
    }
    
    // 1. Calculate next state
    const userToSave = { ...userData };
    delete userToSave.isOnline; // Clean up legacy boolean if passed
    const nextUsers = [...memUsers, userToSave];
    
    // 2. Persist to disk
    await writeJsonAtomic(usersFile(), nextUsers);
    
    // 3. Commit to memory cache ONLY if disk write succeeds
    memUsers = nextUsers;
    updatePresence(userData.id);
    
    return { ...userToSave, isOnline: true };
  });

// --- Message Logic ---
const getMessagesBetweenUsers = async (userId1, userId2) => {
  await initializeStorage();
  return memMessages
    .filter(m => (m.senderId === userId1 && m.receiverId === userId2) || (m.senderId === userId2 && m.receiverId === userId1))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const createMessage = (messageData) =>
  withLock(async () => {
    await initializeStorage();
    
    // 1. Calculate next state
    const nextMessages = [...memMessages, messageData];
    
    // 2. Persist to disk
    await writeJsonAtomic(messagesFile(), nextMessages);
    
    // 3. Commit to memory cache
    memMessages = nextMessages;
    
    return messageData;
  });

const markMessagesAsRead = (senderId, receiverId) =>
  withLock(async () => {
    await initializeStorage();
    let changed = false;
    
    // 1. Map next state (new objects created to prevent mutating cache before success)
    const nextMessages = memMessages.map(m => {
      if (m.senderId === senderId && m.receiverId === receiverId && !m.read) {
        changed = true;
        return { ...m, read: true };
      }
      return m;
    });

    if (changed) {
      // 2. Persist to disk
      await writeJsonAtomic(messagesFile(), nextMessages);
      // 3. Commit to memory cache
      memMessages = nextMessages;
    }
  });

module.exports = {
  StorageError,
  DuplicateUsernameError,
  initializeStorage,
  getUsers,
  findUserByUsername,
  findUserById,
  createUser,
  updatePresence,
  clearPresence,
  isOnline,
  getMessagesBetweenUsers,
  createMessage,
  markMessagesAsRead
};
