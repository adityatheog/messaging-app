# SimpleLink Privacy & Security Architecture

## 1. Executive Summary & Principles
SimpleLink is an open, privacy-centric messaging application engineered from the ground up to prevent data harvesting, surveillance, and corporate tracking. Inspired by the principles of **SimpleX Chat**, **Session**, **Signal**, and **Element**, SimpleLink eliminates centralized social identity providers, phone number requirements, and unnecessary personal data collection.

---

## 2. Information We Never Collect
SimpleLink operates on a strict **zero-personal-data** baseline. The application **does not** require, request, or store:
- No Google, Apple, Facebook, GitHub, or third-party social login.
- No telephone numbers or SMS verification codes.
- No email addresses.
- No legal names.
- No mandatory profile photographs.
- No contact-book or address-book access permissions.
- No GPS or background location access.
- No advertising identifiers (GAID/IDFA) or tracking cookies.
- No proprietary cloud telemetry, crash beacons, or analytics SDKs.

---

## 3. Account & Identity System
### 3.1 Local Cryptographic Identity Generation
- Users can onboard with a single tap via **Create Private Identity**.
- The client application derives an internal random cryptographic identifier (UUIDv4) and a pairwise cryptographic keypair locally.
- A public safety number is computed using SHA-256 of the identity components, rendered in grouped numeric blocks (e.g., `4821 9054 1128 7392`) for out-of-band peer verification.
- Users may optionally choose a human-readable handle (3–30 characters) solely for contact exchange.

### 3.2 Recovery & Limitations
- **Local Key Ownership:** Private cryptographic keys and message databases reside exclusively on the user's client device.
- **No Remote Password Resets:** Because SimpleLink servers do not possess recovery emails or phone numbers, lost credentials cannot be recovered by server administrators.
- **Passphrase Export:** Users can configure a local recovery passphrase or export their safety number to re-derive their local pairwise identities.

---

## 4. Data Storage Architecture
### 4.1 On-Device Storage (Client)
- **Android:** Managed via local SQLite (`AppDatabaseHelper.kt` at schema v2) with encrypted payload tables.
- **Web:** Local session storage and offline message queues (`offlineQueue.ts`) with client-side deduplication.
- **Key Vault:** `CryptoVault.kt` isolates cryptographic keys, AES-256-GCM ciphers, and deterministic HMAC-SHA256 pairwise key derivation functions.

### 4.2 Server-Side Storage & Transport
- **Relay Role:** The backend server (`server/src/index.js`) functions primarily as a real-time WebSocket broker and store-and-forward offline queue.
- **Offline Messages:** Messages destined for offline recipients are stored with an encrypted payload, sender ID, recipient ID, timestamp, and unique `clientMsgId` for idempotent delivery.
- **Database Modularity:** Uses an open, self-hostable JSON/relational storage abstraction (`JsonStore.js` / `fileStorage.js`). No proprietary Firebase or managed cloud locks are required.

---

## 5. Network Metadata & Operator Visibility
In compliance with honest privacy reporting:
- **IP Addresses:** When connecting to the backend via HTTP/REST or Socket.IO WebSockets, the user's IP address is visible to the network infrastructure operator during the active TCP connection.
- **Mitigation:** SimpleLink supports proxying and self-hosting. Users may route traffic through a VPN or Tor reverse-proxy to conceal transport-layer network metadata.
- **Presence:** Active WebSocket connection states inform the server whether a client queue is currently connected or offline.

---

## 6. End-to-End Encryption & Message Security
- **Algorithm:** Authenticated AES-256-GCM (Galois/Counter Mode) with 128-bit authentication tags and 96-bit unique nonces per message.
- **Pairwise Key Derivation:** Channel keys are derived deterministically between participants using `CryptoVault.derivePairwiseKey(id1, id2)` with SHA-256 HKDF-style key expansion.
- **Tampering & Replay Protection:** GCM authentication tags guarantee ciphertext integrity. Messages with duplicate `clientMsgId` identifiers are rejected idempotently by the backend.
- **Disappearing Messages:** Messages configured with an expiration timer are purged automatically from local SQLite upon query and during periodic sync routines (`purgeExpiredMessages`).

---

## 7. Account Deletion & Right to Erasure
- **Local Wipe:** Logging out or wiping the app data clears the local database, private keys, and cached credentials immediately.
- **Server Deletion:** Calling the user deletion endpoint permanently purges user records, queued messages, and invitations from the server store.
