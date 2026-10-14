# Messaging App (Argon UI)

A production-ready cross-platform real-time messaging application delivered with the classic **Argon Dashboard** visual design system (Bootstrap 4 generation) with one unified React client and Node.js Express backend.

---

## Architecture Overview

```
messaging-app/
├── client/              # React 18 + Vite + strict TypeScript (Argon UI, Bootstrap 4.6.2 CSS)
│   ├── src/
│   │   ├── components/  # Auth, Sidebar, Chat, Profile components
│   │   ├── pages/       # LandingPage (/), ChatApp (/app)
│   │   ├── context/     # AuthContext (JWT session management)
│   │   ├── services/    # Axios REST client with interceptors
│   │   ├── constants/   # APP_NAME, download URLs, Argon color palette
│   │   └── styles/      # argon-theme.scss (Argon gradients, card styling, inputs)
│   └── package.json
├── server/              # Node.js 22+ & Express REST API (fileStorage JSON cache & atomic writes)
│   ├── src/
│   │   ├── config/      # env.js (CORS allow-list, JWT secret), db.js
│   │   ├── middleware/  # auth.js (JWT verification & presence tracking)
│   │   ├── routes/      # auth.js, users.js, messages.js
│   │   ├── storage/     # fileStorage.js (persistence, presence, atomic file lock)
│   │   └── index.js     # Express server & static asset host
│   └── tests/           # Jest + Supertest REST contract test suite
├── package.json         # Unified monorepo scripts
├── .env.example         # Environment template
├── SETUP.md             # In-depth platform setup instructions
├── Dockerfile           # Multi-stage container build
└── docker-compose.yml   # Container orchestration
```

---

## Quick Start (Phase 1)

### 1. Install Dependencies
```bash
npm install --prefix server
npm install --prefix client
```

### 2. Run REST API Contract Tests
```bash
npm test --prefix server
```

### 3. Build Client Bundle
```bash
npm run build --prefix client
```

### 4. Start the Application
```bash
node server/src/index.js
```

- Open `http://localhost:3000/` for the public **Landing Page** with OS auto-detection.
- Open `http://localhost:3000/app` for the **Messaging App** (supports quick 1-click login with `@sarah_j`, `@alex_r`, or new user registration).

---

## REST API Specification

- `POST /api/register`: `{ username, password, fullName }`
- `POST /api/login`: `{ username, password }`
- `POST /api/logout`: Clears session
- `GET /api/me`: Returns current authenticated user
- `GET /api/users`: Returns directory list of teammates
- `GET /api/users/:id`: Returns single user details
- `POST /api/messages`: `{ receiverId, content, clientMsgId }`
- `GET /api/messages/:userId`: Returns conversation timeline (`limit`, `before`, `after`)
- `GET /api/conversations`: Returns conversation summary list with unread counts
- `PATCH /api/messages/read/:senderId`: Marks incoming messages as read
- `GET /health`: Health check (`{ status: "ok" }`)
