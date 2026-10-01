# Messaging App - Backend

Node.js + Express backend for the messaging application.

## Features

- JWT-based authentication
- User registration and login
- Message sending and retrieval
- File-based storage (JSON)
- RESTful API design

## Installation

```bash
npm install
```

## Running

### Development
```bash
npm start
```

### With nodemon (auto-restart)
```bash
npm run dev
```

## Environment Variables

Create a `.env` file:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=<required: long random string; 32+ chars and non-placeholder in production>
CORS_ORIGIN=<required in production: exact frontend origin(s), comma-separated>
DATA_DIR=<optional: directory for users.json/messages.json; use a persistent volume in production>
```

The server exits at startup with a clear message if this configuration is unsafe or incomplete.

## API Endpoints

### Auth
- `POST /api/register` - Register new user
- `POST /api/login` - Login user
- `POST /api/logout` - Mark the user offline (Bearer token required)
- `GET /api/me` - Validate the token and return the current user (Bearer token required)

### Users (Protected)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID

### Messages (Protected)
- `POST /api/messages` - Send message
- `GET /api/messages/:userId` - Get conversation

## Data Storage

Messages and users are stored in JSON files in the `data/` directory:
- `data/users.json` - User accounts
- `data/messages.json` - All messages

## Security

- Passwords are hashed using bcrypt (bcryptjs)
- The message sender is always taken from the verified token, never from the request body
- JWT tokens expire after 7 days
- CORS enabled for frontend access