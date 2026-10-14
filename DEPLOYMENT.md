# Deployment & Hosting Guide: Messaging App

This guide documents the production deployment of the **Messaging App (Argon UI)** across **GitHub**, **Vercel** (frontend), and **Railway** (backend).

---

## 1. Overview Architecture

```text
Changes to source code
        │
        ▼
GitHub repository (main branch)
        │
        ├─────────────────────────────┐
        ▼                             ▼
Vercel Frontend Deploy        Railway Backend Deploy
(Root: /client)               (Root: /server)
        │                             │
        ▼                             ▼
https://your-app.vercel.app    https://your-api.up.railway.app
        └──────────────┬──────────────┘
                       ▼
          Working real-time app
```

---

## 2. GitHub Repository Setup

- **Repository**: `https://github.com/adityatheog/messaging-app`
- **Default Branch**: `main`
- Ensure `.gitignore` ignores `node_modules/`, `.env`, `.env.local`, and build artifacts while tracking `.env.example`.

---

## 3. Vercel Frontend Deployment

1. **Connect Repository:**
   - Log into [Vercel](https://vercel.com) and click **Add New > Project**.
   - Import `adityatheog/messaging-app`.

2. **Project Settings:**
   - **Framework Preset**: `Vite` (or `Other`)
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Environment Variables:**
   - `VITE_API_URL`: `https://<your-railway-domain>.up.railway.app` (Backend URL)
   - `VITE_SOCKET_URL`: `https://<your-railway-domain>.up.railway.app` (Socket.IO URL)

4. **SPA Rewrites**:
   - `client/vercel.json` contains SPA URL rewriting so routing (`/`, `/app`) works on refresh.

---

## 4. Railway Backend Deployment

1. **Deploy from GitHub:**
   - Log into [Railway](https://railway.app) and create a **New Project > Deploy from GitHub repo**.
   - Select `adityatheog/messaging-app`.

2. **Service Configuration:**
   - In Service Settings > General:
     - **Root Directory**: `server`
   - In Service Settings > Build & Deploy:
     - **Start Command**: `node src/index.js`
     - **Healthcheck Path**: `/health`

3. **Persistent Volume (For JSON storage)**:
   - In Railway Service Settings, click **Volumes > Add Volume**.
   - Mount path: `/app/server/data`
   - Set environment variable: `DATA_DIR=/app/server/data`
   *(Or configure `FIREBASE_SERVICE_ACCOUNT_JSON` for cloud Firestore storage).*

4. **Environment Variables (Railway Variables panel):**
   - `PORT`: (Provided dynamically by Railway, default `3000`)
   - `JWT_SECRET`: Generate a secure random 32+ character string
   - `CORS_ORIGIN`: `https://<your-vercel-domain>.vercel.app` (Add custom domains if used)
   - `DATA_DIR`: `./data` (or mounted volume path)
   - `NODE_ENV`: `production`

---

## 5. Automatic CI/CD & Synchronization

Once both Vercel and Railway are linked to the GitHub repository:
1. Every commit pushed to `main` triggers:
   - Vercel automatic build and zero-downtime deployment.
   - Railway automatic build and healthchecked rollout.
2. If any deployment fails, roll back with one click in the Vercel Deployments or Railway Deployments dashboard.

---

## 6. Verification Checklist

- [x] Run backend test suite: `npm test --prefix server`
- [x] Build frontend production bundle: `npm run build --prefix client`
- [x] Healthcheck endpoint responds at `GET /health`
- [x] CORS rejects unauthorized origins and permits configured Vercel origin
