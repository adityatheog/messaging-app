/**
 * Environment validation.
 *
 * validateEnv() is called once at startup (server.js). If the configuration is
 * unsafe or incomplete the process exits with a clear message instead of
 * starting in a state where every auth request fails with a confusing 500/401.
 */

const MIN_PRODUCTION_SECRET_LENGTH = 32;

// Placeholder values that have been committed to this repo (docker-compose.yml,
// README, .env.example). A production server must never sign tokens with them.
const PLACEHOLDER_FRAGMENTS = [
  'your_super_secret',
  'your_secret',
  'replace-with',
  'change_this',
  'changeme',
  'secret_key_here'
];

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Returns the JWT secret or throws. Used by every sign/verify call so an unset
 * secret can never silently produce "invalid token" or half-completed requests.
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
};

const parseCorsOrigins = (raw) => {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      let parsed;
      try {
        parsed = new URL(entry);
      } catch {
        throw new Error(
          `CORS_ORIGIN entry "${entry}" is not a valid origin. ` +
            'Use full origins such as https://your-app.vercel.app (comma-separated for several).'
        );
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`CORS_ORIGIN entry "${entry}" must start with http:// or https://`);
      }
      // URL#origin drops any trailing slash or path, which would otherwise
      // never match the browser's Origin header.
      return parsed.origin;
    });
};

const validateEnv = () => {
  const production = isProduction();

  // --- JWT secret -----------------------------------------------------------
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error(
      'JWT_SECRET is not set. Set it in backend/.env (development) or in your hosting ' +
        'provider\'s environment variables (production).'
    );
  }
  if (production) {
    if (secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production.`
      );
    }
    const lowered = secret.toLowerCase();
    if (PLACEHOLDER_FRAGMENTS.some((fragment) => lowered.includes(fragment))) {
      throw new Error(
        'JWT_SECRET is still a placeholder value from the repository. ' +
          'Generate a real one, e.g. `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`.'
      );
    }
  }

  // --- CORS -----------------------------------------------------------------
  let corsOrigins;
  if (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.trim()) {
    corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
    if (corsOrigins.length === 0) {
      throw new Error('CORS_ORIGIN is set but contains no usable origins.');
    }
  } else if (production) {
    throw new Error(
      'CORS_ORIGIN is not set. In production it must be the exact origin of the deployed ' +
        'frontend (e.g. https://your-app.vercel.app). Without it the browser blocks every API call.'
    );
  } else {
    corsOrigins = ['http://localhost:3000'];
  }

  // --- Storage --------------------------------------------------------------
  const warnings = [];
  if (production && !process.env.DATA_DIR) {
    warnings.push(
      'DATA_DIR is not set: users and messages are stored inside the application directory. ' +
        'On Railway/Heroku/Render/Vercel-style hosts that filesystem is ephemeral and ALL DATA ' +
        'IS LOST on every deploy/restart. Mount a persistent volume and point DATA_DIR at it.'
    );
  }

  return { production, corsOrigins, warnings };
};

module.exports = { validateEnv, getJwtSecret, isProduction };
