const { getStore } = require('../storage');

const connectDB = async () => {
  try {
    await getStore().initialize();
  } catch (error) {
    console.error('Storage initialization failed:', error.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;
