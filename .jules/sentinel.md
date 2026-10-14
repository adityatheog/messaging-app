## Hardcoded Fallback Secrets
- **Vulnerability**: The application was using a hardcoded fallback string for the `JWT_SECRET` in `server/src/config/env.js`.
- **Impact**: If the `JWT_SECRET` environment variable was accidentally omitted during deployment, the application would silently use the hardcoded secret. This allows anyone with access to the source code to forge JWT tokens and gain unauthorized access.
- **Fix**: Modified `getJwtSecret` to explicitly check if `process.env.NODE_ENV === 'production'` and `!process.env.JWT_SECRET`, throwing a critical error instead of using the fallback.
