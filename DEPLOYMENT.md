# 🚀 Voyage - Production Deployment Guide

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Firebase account
- Google Cloud account (for Gemini AI API)
- Tavily API account
- Twilio account (for OTP)

## Environment Setup

### 1. Backend Configuration

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
```

Edit `.env` with your actual credentials:
- `GOOGLE_API_KEY` - Get from Google AI Studio
- `TAVILY_API_KEY` - Get from Tavily.com
- `TWILIO_*` - Get from Twilio console
- Place `firebase-credentials.json` in backend directory

### 2. Frontend Configuration

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

Edit `.env` with your Firebase config:
- Get Firebase config from Firebase Console > Project Settings > Web App

## Development

### Start Backend Server
```bash
cd backend
python server.py --reload
```
Server runs on: http://localhost:8000

### Start Frontend Dev Server
```bash
cd frontend
npm run dev
```
Frontend runs on: http://localhost:5173

## Production Build

### Build Frontend
```bash
cd frontend
npm run build
```
This creates optimized files in `frontend/dist`

### Deploy Backend

1. **Using Render/Railway/Heroku:**
   - Set environment variables in platform dashboard
   - Deploy from GitHub repository
   - Set start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

2. **Using Docker:**
   ```bash
   docker build -t voyage-backend .
   docker run -p 8000:8000 voyage-backend
   ```

### Deploy Frontend

1. **Using Vercel:**
   ```bash
   npm install -g vercel
   cd frontend
   vercel --prod
   ```

2. **Using Netlify:**
   ```bash
   npm install -g netlify-cli
   cd frontend
   netlify deploy --prod --dir=dist
   ```

3. **Using Firebase Hosting:**
   ```bash
   cd frontend
   npm run build
   firebase deploy --only hosting
   ```

## Environment Variables Reference

### Backend (.env)
```
GOOGLE_API_KEY=          # Google Gemini AI API key
TAVILY_API_KEY=          # Tavily search API key
TWILIO_ACCOUNT_SID=      # Twilio account SID
TWILIO_AUTH_TOKEN=       # Twilio auth token
TWILIO_PHONE_NUMBER=     # Twilio phone number
PORT=8000                # Server port
ENVIRONMENT=production   # Environment mode
```

### Frontend (.env)
```
VITE_FIREBASE_API_KEY=              # Firebase API key
VITE_FIREBASE_AUTH_DOMAIN=          # Firebase auth domain
VITE_FIREBASE_PROJECT_ID=           # Firebase project ID
VITE_FIREBASE_STORAGE_BUCKET=       # Firebase storage bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=  # Firebase messaging sender ID
VITE_FIREBASE_APP_ID=               # Firebase app ID
VITE_API_URL=                       # Backend API URL (production)
```

## Security Checklist

- [ ] All API keys stored in environment variables
- [ ] Firebase rules configured for production
- [ ] CORS configured for production domains only
- [ ] Rate limiting enabled on backend
- [ ] HTTPS enabled on all endpoints
- [ ] `.env` files added to `.gitignore`
- [ ] Firebase credentials file secured
- [ ] Database backup configured
- [ ] Error logging configured (Sentry, LogRocket, etc.)

## Post-Deployment

1. Test all features in production
2. Monitor error logs
3. Set up analytics (Google Analytics, Mixpanel)
4. Configure CDN for static assets
5. Set up automated backups
6. Monitor API usage and costs

## Troubleshooting

### Backend Issues
- Check logs: `tail -f backend/logs/error.log`
- Verify environment variables are set
- Check Firebase credentials are valid
- Ensure all required services are running

### Frontend Issues
- Clear browser cache
- Check Network tab for API errors
- Verify environment variables in build
- Check CORS configuration

## Support

For issues, contact: support@voyage.com
Documentation: https://docs.voyage.com
