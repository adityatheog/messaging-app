const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

/**
 * Ensure data directory and files exist
 */
const initializeStorage = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Initialize users.json if it doesn't exist
    try {
      await fs.access(USERS_FILE);
    } catch {
      await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2));
    }
    
    // Initialize messages.json if it doesn't exist
    try {
      await fs.access(MESSAGES_FILE);
    } catch {
      await fs.writeFile(MESSAGES_FILE, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
    throw error;
  }
};

/**
 * Read data from a JSON file
 */
const readFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return [];
  }
};

/**
 * Write data to a JSON file
 */
const writeFile = async (filePath, data) => {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
    throw error;
  }
};

// Users operations
const getUsers = async () => {
  await initializeStorage();
  return await readFile(USERS_FILE);
};

const saveUsers = async (users) => {
  await initializeStorage();
  await writeFile(USERS_FILE, users);
};

const findUserByUsername = async (username) => {
  const users = await getUsers();
  return users.find(u => u.username === username);
};

const findUserById = async (id) => {
  const users = await getUsers();
  return users.find(u => u.id === id);
};

const createUser = async (userData) => {
  const users = await getUsers();
  users.push(userData);
  await saveUsers(users);
  return userData;
};

// Messages operations
const getMessages = async () => {
  await initializeStorage();
  return await readFile(MESSAGES_FILE);
};

const saveMessages = async (messages) => {
  await initializeStorage();
  await writeFile(MESSAGES_FILE, messages);
};

const createMessage = async (messageData) => {
  const messages = await getMessages();
  messages.push(messageData);
  await saveMessages(messages);
  return messageData;
};

const getMessagesBetweenUsers = async (userId1, userId2) => {
  const messages = await getMessages();
  return messages.filter(m => 
    (m.senderId === userId1 && m.receiverId === userId2) ||
    (m.senderId === userId2 && m.receiverId === userId1)
  ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

module.exports = {
  initializeStorage,
  getUsers,
  saveUsers,
  findUserByUsername,
  findUserById,
  createUser,
  getMessages,
  saveMessages,
  createMessage,
  getMessagesBetweenUsers
};