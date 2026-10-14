const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_PORT = 3000;
const DEFAULT_JWT_SECRET = 'argon-messaging-dev-jwt-secret-key-2026';

const ALLOWED_STATIC_ORIGINS = [
  'http://localhost:5173',
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'app://localhost'
];

/**
 * Validates and parses CORS origins.
 * Allows standard http/https schemes as well as capacitor:// and app://
 */
const parseCorsOrigins = (rawOrigins) => {
  const allowed = new Set(ALLOWED_STATIC_ORIGINS);

  if (rawOrigins) {
    const list = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);
    for (const origin of list) {
      if (
        origin.startsWith('http://') ||
        origin.startsWith('https://') ||
        origin.startsWith('capacitor://') ||
        origin.startsWith('app://')
      ) {
        allowed.add(origin);
      }
    }
  }

  return Array.from(allowed);
};

const getPort = () => {
  if (process.env.APP_PORT) {
    const p = parseInt(process.env.APP_PORT, 10);
    return isNaN(p) ? DEFAULT_PORT : p;
  }
  // In reverse proxy environments where nginx binds to 8080, backend binds to 3000
  if (process.env.PORT && process.env.PORT !== '8080') {
    const p = parseInt(process.env.PORT, 10);
    return isNaN(p) ? DEFAULT_PORT : p;
  }
  return DEFAULT_PORT;
};

const getJwtSecret = () => {
  return process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
};

const getCorsOrigins = () => {
  return parseCorsOrigins(process.env.CORS_ORIGIN);
};

module.exports = {
  getPort,
  getJwtSecret,
  getCorsOrigins,
  parseCorsOrigins
};
