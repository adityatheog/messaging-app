const getJwtSecret = () => {
  // SECURITY FIX: Never use a hardcoded fallback for secrets in production.
  // Using a fallback makes the application vulnerable if the environment variable
  // is accidentally omitted during deployment.
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production.');
  }
  return process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
};