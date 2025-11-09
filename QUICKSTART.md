# 🚀 Quick Production Deployment Guide

## Prerequisites Check
- [ ] Node.js 18+ installed
- [ ] Python 3.11+ installed
- [ ] Firebase project created
- [ ] Google Cloud API key obtained
- [ ] Tavily API key obtained
- [ ] Twilio account setup

## 5-Minute Setup

### 1. Backend Setup (2 minutes)
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
python server.py
```

### 2. Frontend Setup (2 minutes)
```powershell
cd frontend
npm install
cp .env.example .env
# Edit .env with your Firebase config
npm run dev
```

### 3. Verify (1 minute)
- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- Test login/signup

## Production Build

### Frontend Production Build
```powershell
cd frontend
npm run build
npm run preview  # Test production build locally
```

### Backend Production
```powershell
cd backend
# Set ENVIRONMENT=production in .env
python server.py
```

## Quick Deploy Options

### Option 1: Vercel (Frontend) + Render (Backend)

**Frontend on Vercel:**
```powershell
npm install -g vercel
cd frontend
vercel --prod
```

**Backend on Render:**
1. Go to render.com
2. New > Web Service
3. Connect GitHub repo
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
6. Add environment variables

### Option 2: Firebase Hosting + Cloud Run

**Frontend:**
```powershell
cd frontend
npm run build
firebase deploy --only hosting
```

**Backend:**
```powershell
cd backend
gcloud run deploy voyage-backend --source .
```

### Option 3: Netlify + Railway

**Frontend on Netlify:**
```powershell
npm install -g netlify-cli
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

**Backend on Railway:**
1. Go to railway.app
2. New Project
3. Deploy from GitHub
4. Add environment variables

## Environment Variables

### Backend .env
```bash
GOOGLE_API_KEY=your_google_api_key
TAVILY_API_KEY=your_tavily_api_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
PORT=8000
ENVIRONMENT=production
```

### Frontend .env
```bash
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc123
VITE_API_URL=https://your-backend-url.com
```

## Critical Post-Deployment Steps

1. **Update VITE_API_URL** in frontend .env to your production backend URL
2. **Configure CORS** in backend to allow only your frontend domain
3. **Set up Firebase Security Rules**
4. **Enable HTTPS** on both frontend and backend
5. **Test all features** in production environment

## Common Issues

### CORS Error
- Update backend CORS settings to include frontend URL
- Ensure HTTPS is used in production

### Firebase Auth Error
- Check Firebase Auth domain in console
- Verify all environment variables are set
- Add production domain to Firebase authorized domains

### Build Fails
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run build`
- Verify all import paths have extensions

### API Not Working
- Check backend logs for errors
- Verify environment variables are set on hosting platform
- Test API endpoints with Postman/Thunder Client

## Performance Optimization

### Frontend
- [ ] Enable Gzip compression
- [ ] Configure CDN
- [ ] Add service worker caching
- [ ] Optimize images (use WebP)
- [ ] Enable tree shaking

### Backend
- [ ] Add Redis caching
- [ ] Enable response compression
- [ ] Set up connection pooling
- [ ] Configure rate limiting
- [ ] Add database indexes

## Monitoring Setup

### Quick Monitoring Stack
1. **Sentry** for error tracking
   ```bash
   npm install @sentry/react @sentry/vite-plugin
   ```

2. **Google Analytics** for user analytics
   ```html
   <!-- Add to index.html -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
   ```

3. **UptimeRobot** for uptime monitoring
   - Add your production URL
   - Set up alert emails

## Security Checklist
- [ ] All API keys in environment variables
- [ ] Firebase rules configured
- [ ] HTTPS enabled
- [ ] CORS restricted to production domain
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection protection
- [ ] XSS protection headers

## Rollback Plan
1. Keep previous working version tagged in Git
2. Document rollback steps for hosting platform
3. Have database backup before major updates
4. Test in staging environment first

## Support & Resources
- **Firebase Console**: https://console.firebase.google.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Render Dashboard**: https://dashboard.render.com
- **Documentation**: See DEPLOYMENT.md for detailed instructions

---

🎉 **Your app is now production-ready!**

For detailed instructions, see `DEPLOYMENT.md`  
For complete checklist, see `PRODUCTION_CHECKLIST.md`
