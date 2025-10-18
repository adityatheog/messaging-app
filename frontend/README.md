# Messaging App - Frontend

Modern React-based chat interface with Tailwind CSS.

## Features

- Beautiful, responsive UI
- User authentication
- Real-time messaging
- User search
- Online status indicators
- Auto-scrolling messages

## Installation

```bash
npm install
```

## Running

### Development
```bash
npm start
```

Runs on `http://localhost:3000`

### Production Build
```bash
npm run build
```

## Environment Variables

Create a `.env` file:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Project Structure

```
src/
├── components/
│   ├── Auth/          # Login & Register
│   ├── Chat/          # Chat window & messages
│   ├── Sidebar/       # User list & search
│   └── Layout/        # Main layout
├── context/           # Auth context
├── services/          # API calls
└── utils/             # Helper functions
```

## Technologies

- React 18
- Tailwind CSS
- Axios
- Lucide React (icons)
- Context API for state management

## Styling

This project uses Tailwind CSS for styling. Configuration is in `tailwind.config.js`.

## Available Scripts

- `npm start` - Development server
- `npm run build` - Production build
- `npm test` - Run tests