# Quick Start Guide: Messaging App

Get the **Messaging App (Argon UI)** running locally in under 2 minutes.

---

## 1. Install Dependencies
```bash
npm install --prefix server
npm install --prefix client
```

---

## 2. Run Tests
```bash
npm test --prefix server
```

---

## 3. Build & Run
```bash
# Build the client production bundle
npm run build --prefix client

# Launch the Express & Socket.IO server
node server/src/index.js
```

- **Landing Page**: Open `http://localhost:3000/`
- **Messaging App**: Open `http://localhost:3000/app`
- **Health Check**: Open `http://localhost:3000/health`

**Pre-seeded Demo Accounts**:
- `@sarah_j` (password: `password123`)
- `@alex_r` (password: `password123`)
- `@emily_w` (password: `password123`)
