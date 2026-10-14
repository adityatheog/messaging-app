const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { rateLimit } = require('express-rate-limit');
const connectDB = require('./config/db');
const { getPort, getCorsOrigins } = require('./config/env');
const { initSockets, getIo } = require('./sockets');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');

const app = express();
const PORT = getPort();

// Connect and initialize persistent storage
connectDB();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// CORS configuration
const allowedOrigins = getCorsOrigins();
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiting for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/login', authLimiter);

// Auth routes mounted at both /api/auth and /api for full compatibility
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);

app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Alias /api/conversations directly
app.get('/api/conversations', (req, res, next) => {
  req.url = '/conversations';
  messageRoutes(req, res, next);
});

// Serve frontend client if built
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Messaging App API</title></head>
        <body style="font-family: sans-serif; padding: 40px; background: #f8f9fe;">
          <h1 style="color: #5e72e4;">Messaging App API Server</h1>
          <p>API is running. Build the client using <code>npm run build</code> to serve the Argon UI.</p>
          <p><a href="/health">Health check</a></p>
        </body>
      </html>
    `);
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const httpServer = http.createServer(app);
const io = initSockets(httpServer);

if (require.main === module && process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Messaging App Server listening on 0.0.0.0:${PORT} (Socket.IO enabled)`);
  });
}

module.exports = { app, httpServer, io };
