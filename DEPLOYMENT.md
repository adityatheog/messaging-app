# 🚀 Production Deployment Guide

Complete guide to deploy your messaging app to production.

## 📋 Pre-Deployment Checklist

### Security
- [ ] Change JWT_SECRET to a strong random string
- [ ] Update all default passwords
- [ ] Enable HTTPS/SSL
- [ ] Set NODE_ENV=production
- [ ] Review and restrict CORS origins
- [ ] Add rate limiting middleware
- [ ] Implement input validation
- [ ] Add CSP headers

### Performance
- [ ] Enable gzip compression
- [ ] Minify frontend assets
- [ ] Optimize images
- [ ] Add caching headers
- [ ] Use a CDN for static assets

### Monitoring
- [ ] Set up error logging (e.g., Sentry)
- [ ] Add application monitoring
- [ ] Configure health check endpoints
- [ ] Set up uptime monitoring

---

## 🐳 Docker Deployment (Recommended)

### 1. Update Environment Variables

**backend/.env**
```env
PORT=5000
JWT_SECRET=GENERATE_STRONG_RANDOM_STRING_HERE_MIN_32_CHARS
NODE_ENV=production
```

**frontend/.env**
```env
REACT_APP_API_URL=https://your-domain.com/api
```

### 2. Build and Deploy

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 3. Set Up Reverse Proxy (Nginx)

Create `/etc/nginx/sites-available/messaging-app`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/messaging-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## ☁️ Cloud Platform Deployments

### AWS (EC2)

1. **Launch EC2 Instance**
   - Ubuntu Server 22.04 LTS
   - t2.medium or larger
   - Configure security groups (ports 80, 443, 22)

2. **Install Dependencies**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Install Nginx
sudo apt install nginx -y
```

3. **Deploy Application**
```bash
# Clone or upload your code
git clone your-repo-url
cd messaging-app

# Set up environment variables
# Edit .env files with production values

# Start with Docker
docker-compose up -d
```

4. **Set Up SSL with Let's Encrypt**
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

### DigitalOcean (Droplet)

Similar to AWS EC2 setup above. DigitalOcean also offers:
- One-click Docker droplet
- Managed databases
- Load balancers

### Heroku

**Backend (separate dyno):**

```bash
cd backend
heroku create your-app-backend
heroku config:set JWT_SECRET=your-secret
heroku config:set NODE_ENV=production
git push heroku main
```

**Frontend (separate dyno):**

```bash
cd frontend
heroku create your-app-frontend
heroku config:set REACT_APP_API_URL=https://your-app-backend.herokuapp.com/api
heroku buildpacks:set mars/create-react-app
git push heroku main
```

### Vercel (Frontend) + Railway (Backend)

**Frontend on Vercel:**
```bash
cd frontend
vercel --prod
```

**Backend on Railway:**
1. Connect GitHub repo
2. Select backend folder
3. Add environment variables
4. Deploy

---

## 💾 Database Migration (Recommended for Production)

Replace file-based storage with MongoDB:

### 1. Install MongoDB Driver
```bash
cd backend
npm install mongodb mongoose
```

### 2. Update `backend/src/config/db.js`
```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
```

### 3. Create Models
Convert JSON storage to Mongoose models (User.js, Message.js)

### 4. Update Environment
```env
MONGODB_URI=mongodb://localhost:27017/messaging-app
# Or use MongoDB Atlas for cloud hosting
```

---

## 🔒 Security Enhancements

### Rate Limiting

Install express-rate-limit:
```bash
npm install express-rate-limit
```

Add to server.js:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### Helmet for Security Headers

```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet());
```

### Input Validation

```bash
npm install express-validator
```

---

## 📊 Monitoring & Logging

### PM2 (Process Manager)

```bash
npm install -g pm2

# Start app
pm2 start src/server.js --name messaging-backend

# Monitor
pm2 monit

# Logs
pm2 logs

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Application Monitoring

**Sentry for Error Tracking:**
```bash
npm install @sentry/node
```

**Add to server.js:**
```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: process.env.NODE_ENV,
});

app.use(Sentry.Handlers.errorHandler());
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy to Server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /path/to/messaging-app
          git pull
          docker-compose down
          docker-compose up -d --build
```

---

## 🧪 Health Checks

Add to backend/src/server.js:

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});
```

Set up monitoring with UptimeRobot or similar service.

---

## 📦 Backup Strategy

### Automated Backups

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup data directory
tar -czf $BACKUP_DIR/data_$DATE.tar.gz backend/data/

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/data_$DATE.tar.gz s3://your-bucket/backups/
```

Add to crontab:
```bash
0 2 * * * /path/to/backup.sh
```

---

## 🚨 Rollback Plan

```bash
# Tag current version
git tag -a v1.0.0 -m "Production release"

# If issues occur, rollback
git checkout v1.0.0
docker-compose down
docker-compose up -d --build
```

---

## ✅ Post-Deployment

1. Test all features in production
2. Monitor logs for errors
3. Check performance metrics
4. Verify SSL certificate
5. Test from different locations
6. Run security audit
7. Document any issues

---

## 📞 Support Resources

- [Docker Documentation](https://docs.docker.com/)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [PM2 Guide](https://pm2.keymetrics.io/)

---

**Remember:** Always test deployment in a staging environment first!

Good luck! 🚀