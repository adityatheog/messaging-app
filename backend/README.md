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
JWT_SECRET=your_secret_key_here
NODE_ENV=development
```

## API Endpoints

### Auth
- `POST /api/register` - Register new user
- `POST /api/login` - Login user

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

- Passwords are hashed using bcrypt
- JWT tokens expire after 7 days
- CORS enabled for frontend access