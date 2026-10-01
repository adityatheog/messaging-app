const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { validateEnv } = require('./config/env');

// Fail fast on unsafe/incomplete configuration (missing JWT_SECRET, placeholder
// secret or missing CORS_ORIGIN in production) instead of serving broken auth.
let config;
try {
  config = validateEnv();
} catch (error) {
  console.error(`❌ Configuration error: ${error.message}`);
  process.exit(1);
}

// Import routes (after env is validated)
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const { initializeStorage } = require('./models/fileStorage');

// Initialize Express app
const app = express();

// Middleware
app.set('trust proxy', 1);
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  console.error('Error:', err.message);
  res.status(status).json({
    // Never leak internal error details for server-side failures
    error: status >= 500 ? 'Internal server error' : err.message
  });
});

// Start server only after storage is verified readable/writable
const PORT = process.env.PORT || 5000;

initializeStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}`);
      console.log(`🌐 Allowed CORS origins: ${config.corsOrigins.join(', ')}`);
      config.warnings.forEach((warning) => console.warn(`⚠️  ${warning}`));
    });
  })
  .catch((error) => {
    console.error(`❌ Storage initialization failed: ${error.message}`);
    process.exit(1);
  });
