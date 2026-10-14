## 2024-10-14 - Fix Overly Permissive CORS Configuration
**Vulnerability:** The application was allowing all origins by default by unconditionally returning `callback(null, true)` at the end of the custom CORS validation functions in both Express (`server/src/index.js`) and Socket.IO (`server/src/sockets/index.js`). This completely defeated the purpose of the CORS whitelist.
**Learning:** Even when a whitelist is defined, the fallback mechanism in custom CORS functions must explicitly reject unrecognized origins, otherwise the security boundary is compromised.
**Prevention:** Always ensure the default case in custom validation logic is to deny access (`return callback(new Error('Not allowed by CORS'))`) rather than allow it.
