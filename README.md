# SimpleLink

SimpleLink is a self-hosted real-time messaging application with a React and TypeScript web client (`client/`), a Node.js, Express, and Socket.IO backend (`server/`), a local SQLite persistence engine with local disk file storage, and a Jetpack Compose Android app (`app/`). It supports direct messages, media and voice notes, contact management, offline queueing, and local AES-256-GCM payload encryption on Android, without requiring Firebase or any third-party managed database.

## Setup

Prerequisites:
- Node.js 22.20+ and npm 10+ (uses Node's built-in `node:sqlite` engine on Node 22.5+, with an automatic `sqlite3` fallback on older runtimes)
- JDK 21 and Android SDK (optional, only for building the Android app)

Install dependencies from the project root:

```bash
npm ci
```

Or install both workspaces explicitly:

```bash
npm run install:all
```

Generate a strong `JWT_SECRET` and create `.env`:

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Configuration

Copy `.env.example` to `.env` in the project root (or `server/.env`) and adjust values for your environment:

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime environment (`development`, `test`, or `production`) |
| `PORT` | `3000` | HTTP and Socket.IO server port |
| `JWT_SECRET` | dev fallback | HS256 signing secret (required in production; placeholder values are rejected) |
| `CORS_ORIGIN` | localhost list | Comma-separated list of allowed origins |
| `STORAGE_BACKEND` | `sqlite` | Storage engine (`sqlite` by default, or `json` for legacy JSON file storage) |
| `DATA_DIR` | `./data` | Base directory for persistent database, uploads, and backups |
| `SQLITE_DB_PATH` | `./data/simplelink.db` | Path to the SQLite database file |
| `UPLOADS_DIR` | `./data/uploads` | Directory for validated local file attachments |
| `MAX_UPLOAD_BYTES` | `5242880` | Maximum allowed file upload size in bytes (default 5 MB) |
| `PRESENCE_TIMEOUT_MS` | `15000` | Milliseconds before an idle disconnected user is marked offline |
| `VITE_API_URL` | `/api` | Base URL for REST API requests from the web client |
| `VITE_SOCKET_URL` | window origin | Base URL for Socket.IO connections from the web client |

## How to Run

Build the web client and start the backend server:

```bash
npm run build
npm start
```

- Landing page: `http://localhost:3000/`
- Web client: `http://localhost:3000/app`
- Health check: `http://localhost:3000/health`

For local development with Vite hot reload, run `npm start` in one terminal and `npm run dev --workspace=client` (`http://localhost:5173`) in another.

## Commands

| Command | Action |
| --- | --- |
| `npm ci` | Install root, server, and client workspace dependencies from lockfile |
| `npm run install:all` | Install server and client dependencies explicitly |
| `npm start` | Start the Express and Socket.IO server on port 3000 |
| `npm run build` | Type-check and build the React client into `client/dist` |
| `npm run migrate` | Migrate legacy `users.json` and `messages.json` records into SQLite |
| `npm run db:backup` | Create an online backup snapshot of the SQLite database |
| `npm run db:restore` | Restore the SQLite database from a backup snapshot |
| `npm test` | Run the backend Jest and Supertest suite |
| `npm test --workspace=client` | Run the frontend Vitest unit tests |
| `./gradlew test` | Run the Android JVM unit tests |
| `docker compose up --build` | Build and run the full stack in Docker on port 3000 |

## Database, Migrations, Backup, and Restore

On startup, `SqliteStore` initializes the SQLite database (`WAL` mode, `foreign_keys = ON`) and applies versioned schema migrations recorded in `schema_migrations` (`users`, `sessions`, `contacts`, `conversations`, `conversation_members`, `messages`, `attachments`). If legacy `users.json` or `messages.json` files exist in `DATA_DIR`, their records are imported automatically inside a transaction without deleting the original JSON files.

Manual migration, backup, and restore commands:

```bash
npm run migrate
npm run db:backup -- ./data/backups/manual-backup.db
npm run db:restore -- ./data/backups/manual-backup.db
```

## API Routes

Protected routes require an `Authorization: Bearer <token>` header. Auth routes are mounted at both `/api` and `/api/auth`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Server health, storage mode, and uptime |
| `POST` | `/api/register` | No | Register a user (`username`, `password`, optional `fullName`) |
| `POST` | `/api/login` | No | Authenticate with `username` and `password` and create a session token |
| `POST` | `/api/logout` | Yes | Revoke the current session token and clear presence |
| `GET` | `/api/me` | Yes | Return the authenticated user profile |
| `PATCH` | `/api/auth/profile` | Yes | Update `fullName` or hex `avatarColor` (`#rgb` or `#rrggbb`) |
| `DELETE` | `/api/auth/account` | Yes | Permanently delete the authenticated user and owned attachments |
| `GET` | `/api/users` | Yes | List or search (`?q=`) registered users |
| `GET` | `/api/users/:id` | Yes | Fetch a single user profile by ID |
| `GET` | `/api/users/contacts` | Yes | List saved contacts for the current user |
| `POST` | `/api/users/contacts` | Yes | Add a contact (`{ contactId }`) |
| `DELETE` | `/api/users/contacts/:contactId` | Yes | Remove a saved contact |
| `GET` | `/api/conversations` | Yes | List active conversations with last message and unread count |
| `GET` | `/api/messages/:userId` | Yes | Fetch messages with `:userId` (`limit`, `before`, `after`) |
| `POST` | `/api/messages` | Yes | Send a text or media message (`receiverId`, `content`, `messageType`, `mediaUrl`, optional `clientMsgId`) |
| `PATCH` | `/api/messages/read/:senderId` | Yes | Mark messages from `:senderId` as read |
| `POST` | `/api/uploads` | Yes | Validate and store an attachment (`fileName`, `mimeType`, `dataBase64`) |
| `GET` | `/api/uploads/:id` | Yes | Download a stored attachment with `nosniff` and CSP headers |

Socket.IO events (authenticated via `auth.token`):
- Client to server: `message:send`, `message:read`, `typing`
- Server to client: `message:new`, `message:delivered`, `message:read`, `typing`, `presence`

## Testing

```bash
npm test
npm test --workspace=client
./gradlew test
```

## Deployment

- **Docker (Full Stack, Recommended)**: Set `JWT_SECRET` in `.env` and run `docker compose up --build`. The container serves both the compiled React frontend and the Express and Socket.IO backend on port `3000` and persists `simplelink.db` and `uploads/` in the `app-data` Docker volume (`/app/server/data`).
- **Railway (Backend)**: Set the root directory to `server` (configured via `server/railway.json` with health check `/health`), attach a persistent volume mounted at `DATA_DIR` so SQLite and local uploads survive restarts, and set `NODE_ENV=production`, `JWT_SECRET`, `CORS_ORIGIN`, and `DATA_DIR`.
- **Vercel (Frontend)**: Set the root directory to `client`, build command to `npm run build`, output directory to `dist`, and configure `VITE_API_URL` and `VITE_SOCKET_URL` to point to the backend URL. `client/vercel.json` rewrites SPA routes to `/index.html`.

## License

MIT. See `LICENSE` for details.
