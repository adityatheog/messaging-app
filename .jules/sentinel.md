# CRITICAL Security Learnings

## Hardcoded Fallback JWT Secrets
**Vulnerability:** The backend `server/src/config/env.js` contained a hardcoded fallback for `process.env.JWT_SECRET` (`DEFAULT_JWT_SECRET`).
**Risk:** If `JWT_SECRET` is missing in production environments, the system would silently fall back to this known/hardcoded string. Attackers could forge valid JWTs to impersonate users, leading to full authentication bypass and unauthorized access.
**Fix:** Modified `getJwtSecret` to explicitly check if `process.env.NODE_ENV === 'production'` and throw a fatal error if `JWT_SECRET` is not set, preventing the fallback in production while allowing it in local dev/test environments.