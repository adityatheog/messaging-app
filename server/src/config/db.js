const { initializeStorage } = require('../storage/fileStorage');

const connectDB = async () => {
  try {
    await initializeStorage();
    console.log('File-based storage initialized successfully');
  } catch (error) {
    console.error('Failed to initialize storage:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
