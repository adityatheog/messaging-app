const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { rateLimit } = require('express-rate-limit');
const connectDB = require('./config/db');
const { getPort, getCorsOrigins } = require('./config/env');
const { initSockets, clearPresenceTimers } = require('./sockets');
const { closeStore } = require('./storage');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/uploads');

const app = express();
const PORT = getPort();

if (process.env.NODE_ENV !== 'test') {
  connectDB().catch((err) => {
    console.error('Database startup error:', err.message);
  });
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

const allowedOrigins = getCorsOrigins();
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      const err = new Error('Not allowed by CORS');
      err.status = 403;
      return callback(err);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    storage: process.env.STORAGE_BACKEND === 'json' ? 'json' : 'sqlite',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/login', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/uploads', uploadRoutes);

app.get('/api/conversations', (req, res, next) => {
  req.url = '/conversations';
  messageRoutes(req, res, next);
});

app.use('/api/contacts', (req, res, next) => {
  req.url = `/contacts${req.url === '/' ? '' : req.url}`;
  userRoutes(req, res, next);
});

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
    res.send(`<!DOCTYPE html>
<html>
  <head><title>SimpleLink API</title></head>
  <body style="font-family: sans-serif; padding: 40px; background: #0d1117; color: #f0f6fc;">
    <h1 style="color: #10b981;">SimpleLink Server</h1>
    <p>API is running. Run <code>npm run build</code> to serve the web client.</p>
    <p><a href="/health" style="color: #10b981;">Health check</a></p>
  </body>
</html>`);
  });
}

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, _next) => {
  if (err && (err.message === 'Not allowed by CORS' || err.status === 403)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (err && (err.type === 'entity.parse.failed' || err.status === 400)) {
    return res.status(400).json({ error: 'Invalid request payload' });
  }
  if (err && err.status === 413) {
    return res.status(413).json({ error: 'Request payload too large' });
  }
  console.error('Unhandled error:', err ? err.message : 'Unknown error');
  res.status(500).json({ error: 'Internal server error' });
});

const httpServer = http.createServer(app);
const io = initSockets(httpServer);

const shutdown = async (signal) => {
  console.log(`Received ${signal}, shutting down server`);
  clearPresenceTimers();
  if (io) {
    io.close();
  }
  if (httpServer.listening) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await closeStore();
  process.exit(0);
};

if (require.main === module && process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on 0.0.0.0:${PORT}`);
  });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { app, httpServer, io };
