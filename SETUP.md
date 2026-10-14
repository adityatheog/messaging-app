# Setup & Deployment Guide: Messaging App

## 1. Environment Variable Reference

| Variable | Scope | Default | Description |
|---|---|---|---|
| `PORT` | Server | `3000` | Port for the Express server |
| `JWT_SECRET` | Server (Private) | Generated fallback | Secret used to sign HS256 authentication tokens |
| `CORS_ORIGIN` | Server | Static allow-list | Comma-separated list of trusted web and native origins |
| `DATA_DIR` | Server | `./data` | File storage directory for local JSON persistence |
| `PRESENCE_TIMEOUT_MS` | Server | `15000` | Inactivity threshold (ms) before marking users offline |
| `VITE_API_URL` | Client (Public) | `/api` | Base API URL used by native shells (Capacitor & Electron) |
| `VITE_SOCKET_URL` | Client (Public) | Same-origin | Base URL for Socket.IO connection |

> **Security Note:** Never expose `JWT_SECRET` or service account credentials in client `.env` files or public repositories.

---

## 2. Prerequisites

- Node.js 22.x LTS or higher
- npm 10.x or higher

---

## 3. Quick Start (Web Application)

```bash
# 1. Install dependencies for root, server, and client
npm install --prefix server
npm install --prefix client

# 2. Run automated server test suite
npm test --prefix server

# 3. Build the production client bundle
npm run build --prefix client

# 4. Start the server (serves both API and Argon UI frontend on port 3000)
node server/src/index.js
```

Open `http://localhost:3000/` to view the public Landing Page or `http://localhost:3000/app` for the Messaging App.

---

## 4. Capacitor Setup (Android & iOS)

To initialize Capacitor for native mobile shells:

```bash
# Install Capacitor CLI & Core
npm i -D @capacitor/cli @capacitor/core

# Initialize Capacitor project
npx cap init "Messaging App" "com.aistudio.messagingapp" --web-dir "client/dist"

# Add target mobile platforms
npx cap add android
npx cap add ios

# Synchronize web assets to native containers
npm run build --prefix client
npx cap sync
```

---

## 5. Electron Setup (Windows & macOS)

For the desktop shell using the custom `app://` protocol:

```bash
# Development desktop mode
npm run electron:dev

# Build Windows NSIS installer
npm run electron:build:win

# Build macOS DMG
npm run electron:build:mac
```

---

## 6. Docker & Container Deployment

To run containerized:

```bash
docker build -t messaging-app .
docker run -p 3000:3000 messaging-app
```
