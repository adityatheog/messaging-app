# 🚀 Quick Start Guide

Get your messaging app running in minutes!

## 🎯 Choose Your Method

### Method 1: Docker (Easiest - Recommended)

**Prerequisites:** Docker and Docker Compose installed

```bash
# 1. Navigate to project root
cd messaging-app

# 2. Start everything with one command
docker-compose up --build

# 3. Open your browser
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
```

That's it! 🎉

---

### Method 2: npm (Development)

**Prerequisites:** Node.js 16+ and npm installed

#### Terminal 1 - Backend
```bash
cd messaging-app/backend
npm install
npm start
```

#### Terminal 2 - Frontend
```bash
cd messaging-app/frontend
npm install
npm start
```

Your browser should automatically open to `http://localhost:3000`

---

## 📝 First-Time Usage

1. **Register**: Click "Sign Up" and create an account
2. **Create Another User**: Open an incognito window and register another user
3. **Start Chatting**: Select a user from the sidebar and send messages!

---

## 🧪 Testing the App

### Test Users
After starting the app, create these test accounts:

**User 1:**
- Username: `alice`
- Password: `password123`
- Full Name: `Alice Johnson`

**User 2:**
- Username: `bob`
- Password: `password123`
- Full Name: `Bob Smith`

### Test Scenario
1. Login as Alice in one browser
2. Login as Bob in another browser/incognito
3. Alice selects Bob from the sidebar
4. Alice sends: "Hi Bob!"
5. Bob refreshes or waits 3 seconds to see the message
6. Bob replies: "Hey Alice!"

---

## 🛠️ Troubleshooting

### "Port 3000 is already in use"
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or change the port in frontend package.json
# Add: "start": "PORT=3001 react-scripts start"
```

### "Port 5000 is already in use"
```bash
# Kill the process using port 5000
lsof -ti:5000 | xargs kill -9

# Or change PORT in backend/.env
```

### Backend not connecting
1. Check if backend is running: `http://localhost:5000/health`
2. Check the `.env` file exists in backend folder
3. Verify JWT_SECRET is set

### Frontend shows errors
1. Check browser console (F12)
2. Verify backend is running first
3. Clear browser cache and localStorage
4. Check proxy setting in frontend/package.json

---

## 🔄 Stopping the App

### Docker
```bash
docker-compose down
```

### npm
Press `Ctrl + C` in both terminal windows

---

## 📁 Project Structure Overview

```
messaging-app/
├── backend/           # Node.js API
│   ├── src/          # Source code
│   ├── data/         # JSON storage
│   └── package.json
│
├── frontend/         # React UI
│   ├── src/         # Source code
│   ├── public/      # Static files
│   └── package.json
│
└── docker-compose.yml
```

---

## 🎨 Features to Try

✅ Register multiple users  
✅ Search for users in sidebar  
✅ Send messages back and forth  
✅ Check online/offline status  
✅ View message timestamps  
✅ Test responsive design (resize browser)  
✅ Try on mobile device  

---

## 🚀 Next Steps

Once everything is working:

1. **Customize**: Change colors in `tailwind.config.js`
2. **Enhance**: Add new features like file uploads
3. **Deploy**: Use the Docker setup for production
4. **Secure**: Update JWT_SECRET in production

---

## 📚 More Help

- Full documentation: See main `README.md`
- API docs: Check `README.md` in backend/
- Component docs: Check `README.md` in frontend/

---

**Need more help?** Check the troubleshooting section or review the code comments!

Happy chatting! 💬