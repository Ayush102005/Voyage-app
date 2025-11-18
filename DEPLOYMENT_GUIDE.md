# 🚀 Voyage App - Deployment Guide

## Quick Deploy (5 Minutes)

### Backend → Render
### Frontend → Vercel

---

## 📋 Pre-Deployment Checklist

✅ Git repository created and pushed to GitHub
✅ Firebase credentials ready
✅ Google Gemini API key
✅ Tavily API key
✅ Backend tested locally
✅ Frontend tested locally

---

## 🔧 Backend Deployment (Render)

### Step 1: Prepare Backend

Ensure `render.yaml` exists in backend folder:

```yaml
services:
  - type: web
    name: voyage-backend
    env: python
    region: oregon
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn server:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    envVars:
      - key: GOOGLE_API_KEY
        sync: false
      - key: TAVILY_API_KEY
        sync: false
      - key: FIREBASE_WEB_API_KEY
        sync: false
      - key: PYTHON_VERSION
        value: 3.11.8
```

### Step 2: Deploy to Render

1. Go to https://render.com
2. Sign up / Log in with GitHub
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repository
5. **Configure:**
   - **Name:** `voyage-backend`
   - **Region:** Oregon (US West)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`

### Step 3: Add Environment Variables

In Render dashboard, add these variables:

```
GOOGLE_API_KEY=your_gemini_api_key
TAVILY_API_KEY=your_tavily_key
FIREBASE_WEB_API_KEY=your_firebase_web_key
```

### Step 4: Add Firebase Credentials

**Option A: Environment Variable (Recommended)**
1. Copy contents of `firebase-credentials.json`
2. In Render, add env var: `FIREBASE_CREDENTIALS`
3. Paste the entire JSON as value
4. Update `firebase_config.py`:

```python
import os
import json

# Load from environment variable
creds_json = os.getenv('FIREBASE_CREDENTIALS')
if creds_json:
    cred = credentials.Certificate(json.loads(creds_json))
else:
    cred = credentials.Certificate("firebase-credentials.json")
```

**Option B: Secret File (Alternative)**
1. In Render, go to **Environment** → **Secret Files**
2. Add file: `firebase-credentials.json`
3. Upload your credentials file

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait 3-5 minutes for build
3. Check logs for errors
4. Test: `https://your-app.onrender.com/health`

**Backend URL:** `https://voyage-backend-xxxx.onrender.com`

---

## 🌐 Frontend Deployment (Vercel)

### Step 1: Update API URL

Edit `frontend/src/services/api.ts`:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'https://voyage-backend-xxxx.onrender.com';
```

### Step 2: Create Vercel Config

Ensure `vercel.json` exists in frontend folder:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Step 3: Deploy to Vercel

**Option A: Vercel CLI**

```bash
cd frontend
npm install -g vercel
vercel login
vercel
```

**Option B: Vercel Dashboard**

1. Go to https://vercel.com
2. Sign up / Log in with GitHub
3. Click **"Add New..."** → **"Project"**
4. Import your GitHub repository
5. **Configure:**
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Step 4: Add Environment Variable

In Vercel dashboard:

```
VITE_API_URL=https://voyage-backend-xxxx.onrender.com
```

### Step 5: Deploy

1. Click **"Deploy"**
2. Wait 1-2 minutes
3. Get your URL: `https://voyage-app-xxxx.vercel.app`

---

## 🔒 Update CORS (Backend)

After deploying frontend, update CORS in `backend/server.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://voyage-app-xxxx.vercel.app",  # Add your Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Commit and push - Render will auto-redeploy.

---

## 🔥 Update Firebase Auth Domain

1. Go to Firebase Console
2. **Authentication** → **Settings** → **Authorized domains**
3. Add:
   - `voyage-app-xxxx.vercel.app`
   - `voyage-backend-xxxx.onrender.com`

---

## ✅ Verify Deployment

### Backend Health Check
```bash
curl https://voyage-backend-xxxx.onrender.com/health
```

Expected: `{"status":"healthy"}`

### API Docs
Visit: `https://voyage-backend-xxxx.onrender.com/docs`

### Frontend
Visit: `https://voyage-app-xxxx.vercel.app`

### Test Full Flow
1. Sign up new user
2. Plan a trip
3. Check "My Trips"
4. Create Voyage Board
5. Track expenses

---

## 🐛 Troubleshooting

### Backend Issues

**"Application failed to start"**
- Check Render logs
- Verify all environment variables are set
- Check requirements.txt has all dependencies

**"Module not found"**
- Add missing package to requirements.txt
- Commit and push

**"Firebase credentials error"**
- Verify FIREBASE_CREDENTIALS env var
- Check JSON format
- Ensure credentials are valid

### Frontend Issues

**"Failed to fetch"**
- Check VITE_API_URL is correct
- Verify backend is running
- Check CORS settings

**Blank page**
- Check browser console
- Verify build succeeded in Vercel logs
- Check routing configuration

**Firebase auth not working**
- Verify Firebase config in firebase.ts
- Check authorized domains in Firebase Console
- Clear browser cache

---

## 🔄 Auto-Deploy Setup

### Backend (Render)
- Automatically deploys on push to `main` branch
- Check **"Auto-Deploy"** is enabled in Render settings

### Frontend (Vercel)
- Automatically deploys on push to `main` branch
- Production branch: `main`
- Preview branches: All other branches

---

## 💰 Free Tier Limits

### Render (Backend)
- ✅ 750 hours/month (enough for 1 app 24/7)
- ✅ Auto-sleep after 15 min inactivity
- ⚠️ First request after sleep takes 30-60 seconds
- ✅ 512 MB RAM
- ✅ 0.1 CPU

### Vercel (Frontend)
- ✅ Unlimited deployments
- ✅ 100 GB bandwidth/month
- ✅ 6000 build minutes/month
- ✅ Serverless functions (100 GB-hours)

---

## 🚀 Performance Tips

### Backend
1. **Keep backend awake:**
   - Use UptimeRobot to ping /health every 5 minutes
   - Or upgrade to paid plan ($7/month)

2. **Optimize imports:**
   - Only import what you need
   - Reduces cold start time

3. **Use caching:**
   - Cache AI responses for common queries
   - Use Redis for session storage (paid)

### Frontend
1. **Code splitting:**
   - Already configured in Vite
   - Lazy load routes

2. **Image optimization:**
   - Use WebP format
   - Compress images

3. **Bundle analysis:**
   ```bash
   npm run build -- --analyze
   ```

---

## 🎯 Custom Domain (Optional)

### Frontend (Vercel)
1. Buy domain (Namecheap, GoDaddy, etc.)
2. Vercel dashboard → **Settings** → **Domains**
3. Add domain: `yourdomain.com`
4. Update DNS records (Vercel provides instructions)
5. SSL certificate auto-configured

### Backend (Render)
1. Render dashboard → **Settings** → **Custom Domains**
2. Add domain: `api.yourdomain.com`
3. Update DNS CNAME record
4. SSL certificate auto-configured

---

## 📊 Monitoring

### Render
- View logs: Dashboard → **Logs**
- Monitor metrics: **Metrics** tab
- Set up health check alerts

### Vercel
- Analytics: Dashboard → **Analytics**
- Real-time logs: **Deployments** → **Logs**
- Performance insights available

---

## 🔐 Security Best Practices

1. **Environment Variables:**
   - Never commit API keys to Git
   - Use .env files locally
   - Set in platform dashboards

2. **Firebase Rules:**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /trip_plans/{plan} {
         allow read, write: if request.auth != null && request.auth.uid == resource.data.user_id;
       }
       match /voyage_boards/{board} {
         allow read: if request.auth != null;
         allow write: if request.auth != null;
       }
     }
   }
   ```

3. **Rate Limiting:**
   - Add rate limiting middleware (slowapi)
   - Prevent API abuse

4. **HTTPS Only:**
   - Both platforms provide free SSL
   - Redirect HTTP to HTTPS

---

## 🎉 Done!

Your app is now live:
- **Frontend:** https://voyage-app-xxxx.vercel.app
- **Backend:** https://voyage-backend-xxxx.onrender.com
- **API Docs:** https://voyage-backend-xxxx.onrender.com/docs

Share with friends and start planning trips! ✈️🌍
