# 💬 Messaging App - Full-Stack Chat Application

A modern, real-time messaging application built with React and Node.js featuring user authentication, real-time messaging, and a beautiful responsive UI.

## 🚀 Features

- ✅ User registration and authentication with JWT
- ✅ Real-time messaging between users
- ✅ Modern, responsive chat interface
- ✅ User search functionality
- ✅ Online/offline status indicators
- ✅ Message timestamps
- ✅ Auto-scrolling chat window
- ✅ Mobile-responsive design
- ✅ Docker support for easy deployment

## 🛠️ Tech Stack

**Frontend:**
- React 18
- Tailwind CSS
- Axios
- Lucide React (icons)

**Backend:**
- Node.js
- Express.js
- JWT authentication
- bcrypt for password hashing
- File-based storage (JSON)

## 📁 Project Structure

```
messaging-app/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── middleware/     # Auth middleware
│   │   ├── models/         # Data models
│   │   ├── routes/         # API routes
│   │   └── server.js       # Entry point
│   ├── data/               # JSON storage
│   ├── Dockerfile
│   └── package.json
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── context/       # Auth context
│   │   ├── services/      # API services
│   │   ├── utils/         # Helper functions
│   │   └── App.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
└── docker-compose.yml     # Docker orchestration
```

## 🚀 Quick Start

### Option 1: Using npm (Development)

#### Prerequisites
- Node.js 16+ and npm installed
- Two terminal windows

#### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start the server
npm start
```

The backend will run on `http://localhost:5000`

#### Frontend Setup
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the React app
npm start
```

The frontend will run on `http://localhost:3000`

### Option 2: Using Docker (Recommended for Production)

#### Prerequisites
- Docker and Docker Compose installed

#### Run with Docker
```bash
# From the root directory, build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

Access the application:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`

To stop the containers:
```bash
docker-compose down
```

## 📖 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/register
Content-Type: application/json

{
  "username": "johndoe",
  "password": "password123",
  "fullName": "John Doe"
}
```

#### Login
```http
POST /api/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "password123"
}
```

### User Endpoints (Requires Authentication)

#### Get All Users
```http
GET /api/users
Authorization: Bearer <token>
```

#### Get User by ID
```http
GET /api/users/:id
Authorization: Bearer <token>
```

### Message Endpoints (Requires Authentication)

#### Send Message
```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "receiverId": "user-id",
  "content": "Hello!"
}
```

#### Get Conversation
```http
GET /api/messages/:userId
Authorization: Bearer <token>
```

## 🎨 Features Walkthrough

### 1. Authentication
- Users can register with username, password, and full name
- Secure password hashing with bcrypt
- JWT token-based authentication
- Tokens stored in localStorage

### 2. User Interface
- **Login/Register Screen**: Clean, gradient design with form validation
- **Sidebar**: Shows all registered users with search functionality
- **Chat Window**: Modern message bubbles with timestamps
- **Responsive**: Works perfectly on mobile, tablet, and desktop

### 3. Messaging
- Real-time message updates (polling every 3 seconds)
- Message history persistence
- Auto-scroll to latest messages
- Visual distinction between sent and received messages

### 4. User Status
- Online/offline indicators
- Avatar placeholders with colored backgrounds
- User initials display

## 🔧 Configuration

### Backend Configuration (.env)
```env
PORT=5000
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
NODE_ENV=development
```

### Frontend Configuration (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 📱 Screenshots & Usage

1. **Register**: Create a new account with username and password
2. **Login**: Sign in with your credentials
3. **Select User**: Click on any user from the sidebar
4. **Chat**: Start sending messages!
5. **Search**: Use the search bar to find specific users

## 🐛 Troubleshooting

### Port Already in Use
If you get a port conflict:
```bash
# For backend (port 5000)
lsof -ti:5000 | xargs kill -9

# For frontend (port 3000)
lsof -ti:3000 | xargs kill -9
```

### Docker Issues
```bash
# Clean up Docker containers and images
docker-compose down -v
docker system prune -a

# Rebuild from scratch
docker-compose up --build --force-recreate
```

### Backend Not Connecting
- Ensure backend is running on port 5000
- Check CORS configuration in server.js
- Verify JWT_SECRET is set in .env

### Frontend API Errors
- Check proxy configuration in package.json (dev)
- Verify nginx.conf (Docker)
- Check browser console for specific errors

## 🔐 Security Notes

⚠️ **Important for Production:**
1. Change the JWT_SECRET to a strong, random string
2. Use HTTPS for all communications
3. Implement rate limiting
4. Add input validation and sanitization
5. Use a proper database (PostgreSQL, MongoDB)
6. Implement proper session management
7. Add CSRF protection

## 🚀 Deployment

### Deploy to Production

1. **Update Environment Variables**
   - Set strong JWT_SECRET
   - Configure proper API URLs
   - Set NODE_ENV=production

2. **Build Frontend**
```bash
cd frontend
npm run build
```

3. **Use Docker Compose**
```bash
docker-compose -f docker-compose.yml up -d
```

4. **Use a Reverse Proxy** (Nginx/Apache)
   - Configure SSL certificates
   - Set up domain routing
   - Enable gzip compression

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available under the MIT License.

## 👤 Author

Built with ❤️ using React and Node.js

## 🙏 Acknowledgments

- React team for the amazing framework
- Express.js for the backend framework
- Tailwind CSS for the utility-first CSS
- Lucide React for beautiful icons

---

**Need Help?** Open an issue or check the troubleshooting section above.

**Happy Chatting! 💬**