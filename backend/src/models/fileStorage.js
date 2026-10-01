const fs = require('fs').promises;
const path = require('path');

/**
 * JSON-file storage.
 *
 * Guarantees provided here (the previous version provided none of them):
 *  - All writes are serialized through a single in-process lock, so
 *    read-modify-write sequences (create user, append message, set online)
 *    cannot overwrite each other.
 *  - Writes are atomic (temp file + fsync + rename): a reader never sees a
 *    half-written file and a crash cannot truncate users.json.
 *  - A read error is an ERROR. It is never silently turned into "empty
 *    database" (which the next write would then persist, wiping all data).
 *
 * Limits: this is still a single-process file store. Do not run more than one
 * backend instance against the same data directory.
 */

// Resolved lazily so DATA_DIR from .env (loaded by server.js) is honoured.
const getDataDir = () =>
  process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '../../data');
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

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

let lockChain = Promise.resolve();

/** Run fn exclusively; later callers wait for earlier ones (success or failure). */
const withLock = (fn) => {
  const result = lockChain.then(() => fn());
  lockChain = result.catch(() => {});
  return result;
};

/**
 * Read and parse a JSON array file.
 * - Missing file (ENOENT)  -> [] (nothing was ever stored)
 * - Anything else wrong    -> throws StorageError (never pretends the DB is empty)
 */
const readJsonArray = async (filePath) => {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new StorageError(`Cannot read ${filePath}: ${error.message}`, error);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new StorageError(
      `${filePath} contains invalid JSON and was left untouched: ${error.message}`,
      error
    );
  }

  if (!Array.isArray(parsed)) {
    throw new StorageError(`${filePath} does not contain a JSON array and was left untouched`);
  }
  return parsed;
};

/** Atomically replace filePath with data. Caller must hold the lock. */
const writeJsonAtomic = async (filePath, data) => {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const handle = await fs.open(tmpPath, 'w');
    try {
      await handle.writeFile(JSON.stringify(data, null, 2), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    await fs.unlink(tmpPath).catch(() => {});
    throw new StorageError(`Cannot write ${filePath}: ${error.message}`, error);
  }
};

// ---------------------------------------------------------------------------
// Initialisation (once per process)
// ---------------------------------------------------------------------------

let initPromise = null;

const doInitialize = async () => {
  const dir = getDataDir();
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.access(dir, require('fs').constants.W_OK);
  } catch (error) {
    throw new StorageError(`Data directory ${dir} is not usable: ${error.message}`, error);
  }

  for (const file of [usersFile(), messagesFile()]) {
    try {
      // 'wx' = create only if it does not exist; never overwrites existing data.
      await fs.writeFile(file, '[]', { flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw new StorageError(`Cannot create ${file}: ${error.message}`, error);
      }
    }
    // Fail fast at startup if an existing file is corrupt.
    await readJsonArray(file);
  }
};

/** Ensure data directory and files exist and are readable. Safe to call repeatedly. */
const initializeStorage = () => {
  if (!initPromise) {
    initPromise = doInitialize().catch((error) => {
      initPromise = null; // allow a retry on the next call
      throw error;
    });
  }
  return initPromise;
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const normalizeUsername = (username) => String(username == null ? '' : username).trim().toLowerCase();

const getUsers = async () => {
  await initializeStorage();
  return readJsonArray(usersFile());
};

const saveUsers = (users) =>
  withLock(async () => {
    await initializeStorage();
    await writeJsonAtomic(usersFile(), users);
  });

/** Exact match wins (keeps pre-existing case-variant accounts reachable), then case-insensitive. */
const findUserByUsername = async (username) => {
  const users = await getUsers();
  const exact = users.find((u) => u.username === username);
  if (exact) return exact;
  const needle = normalizeUsername(username);
  return users.find((u) => normalizeUsername(u.username) === needle);
};

const findUserById = async (id) => {
  const users = await getUsers();
  return users.find((u) => u.id === id);
};

/** Atomic "check duplicate + insert". Throws DuplicateUsernameError. */
const createUser = (userData) =>
  withLock(async () => {
    await initializeStorage();
    const users = await readJsonArray(usersFile());
    const needle = normalizeUsername(userData.username);
    if (users.some((u) => normalizeUsername(u.username) === needle)) {
      throw new DuplicateUsernameError(userData.username);
    }
    users.push(userData);
    await writeJsonAtomic(usersFile(), users);
    return userData;
  });

/** Set isOnline for a user. Returns the updated user, or null if the user does not exist. */
const setUserOnline = (id, isOnline) =>
  withLock(async () => {
    await initializeStorage();
    const users = await readJsonArray(usersFile());
    const user = users.find((u) => u.id === id);
    if (!user) return null;
    user.isOnline = Boolean(isOnline);
    await writeJsonAtomic(usersFile(), users);
    return user;
  });

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const getMessages = async () => {
  await initializeStorage();
  return readJsonArray(messagesFile());
};

const saveMessages = (messages) =>
  withLock(async () => {
    await initializeStorage();
    await writeJsonAtomic(messagesFile(), messages);
  });

const createMessage = (messageData) =>
  withLock(async () => {
    await initializeStorage();
    const messages = await readJsonArray(messagesFile());
    messages.push(messageData);
    await writeJsonAtomic(messagesFile(), messages);
    return messageData;
  });

const getMessagesBetweenUsers = async (userId1, userId2) => {
  const messages = await getMessages();
  return messages
    .filter(
      (m) =>
        (m.senderId === userId1 && m.receiverId === userId2) ||
        (m.senderId === userId2 && m.receiverId === userId1)
    )
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

module.exports = {
  StorageError,
  DuplicateUsernameError,
  initializeStorage,
  getUsers,
  saveUsers,
  findUserByUsername,
  findUserById,
  createUser,
  setUserOnline,
  getMessages,
  saveMessages,
  createMessage,
  getMessagesBetweenUsers
};
