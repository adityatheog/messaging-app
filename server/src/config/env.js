require('dotenv').config();

const DEFAULT_JWT_SECRET = 'simplelink-dev-jwt-secret-key';
const INSECURE_SECRETS = new Set([
  DEFAULT_JWT_SECRET,
  'change_this_secret_in_production',
  'replace-with-a-random-32-byte-secret'
]);

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'app://localhost'
];

const getPort = () => {
  const parsed = parseInt(process.env.PORT, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    return 3000;
  }
  return parsed;
};

const getJwtSecret = () => {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (process.env.NODE_ENV === 'production' && (!secret || INSECURE_SECRETS.has(secret))) {
    throw new Error('A strong JWT_SECRET environment variable is required in production.');
  }
  return secret || DEFAULT_JWT_SECRET;
};

const getCorsOrigins = () => {
  if (!process.env.CORS_ORIGIN) {
    return DEFAULT_CORS_ORIGINS;
  }
  return process.env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const getPresenceTimeout = () => {
  if (process.env.NODE_ENV === 'test') {
    return 50;
  }
  const parsed = parseInt(process.env.PRESENCE_TIMEOUT_MS, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 15000 : parsed;
};

const getMaxUploadBytes = () => {
  const parsed = parseInt(process.env.MAX_UPLOAD_BYTES, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 5 * 1024 * 1024 : parsed;
};

module.exports = {
  getPort,
  getJwtSecret,
  getCorsOrigins,
  getPresenceTimeout,
  getMaxUploadBytes
};
