# 🚀 Deploy Your Voyage App - Step by Step

## 🎯 Recommended: Vercel (Frontend) + Render (Backend)

This is the **easiest and free** deployment option!

---

## 📦 **STEP 1: Prepare Your Code**

### A. Create GitHub Repository (if not already done)

```powershell
# In your project root
git init
git add .
git commit -m "Initial commit - ready for deployment"
git branch -M main
```

Then go to GitHub.com:
1. Click "New Repository"
2. Name it: `voyage-app`
3. Don't initialize with README (you already have code)
4. Copy the commands and run:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/voyage-app.git
git push -u origin main
```

---

## 🌐 **STEP 2: Deploy Frontend to Vercel**

### Option A: Using Vercel Dashboard (Easiest)

1. **Go to [vercel.com](https://vercel.com)** and sign up with GitHub

2. **Click "Add New Project"**

3. **Import your GitHub repository** (`voyage-app`)

4. **Configure the build:**
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

5. **Add Environment Variables** (click "Environment Variables"):
   ```
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123:web:abc123
   VITE_API_URL=https://your-backend-url.render.com
   ```
   ⚠️ **Note:** You'll update `VITE_API_URL` after deploying the backend!

6. **Click "Deploy"** ✅

7. **Your frontend will be live at:** `https://voyage-app.vercel.app`

### Option B: Using Vercel CLI

```powershell
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend
cd frontend

# Deploy
vercel --prod

# Follow the prompts:
# - Link to existing project? No
# - Project name: voyage-frontend
# - Directory: ./ (current)
# - Build settings: detected automatically
```

---

## 🔧 **STEP 3: Deploy Backend to Render**

### Using Render Dashboard (Recommended)

1. **Go to [render.com](https://render.com)** and sign up with GitHub

2. **Click "New +" → "Web Service"**

3. **Connect your GitHub repository** (`voyage-app`)

4. **Configure the service:**
   - Name: `voyage-backend`
   - Root Directory: `backend`
   - Environment: `Python 3`
   - Region: Choose closest to your users
   - Branch: `main`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - Instance Type: `Free` (to start)

5. **Add Environment Variables:**
   Click "Environment" tab and add:
   ```
   GOOGLE_API_KEY=your_google_gemini_api_key
   TAVILY_API_KEY=your_tavily_api_key
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   TWILIO_PHONE_NUMBER=+1234567890
   PORT=8000
   ENVIRONMENT=production
   PYTHON_VERSION=3.11.0
   ```

6. **Add Firebase Credentials:**
   - In Render dashboard, go to "Environment" tab
   - Click "Add Secret File"
   - Name: `firebase-credentials.json`
   - Paste your Firebase Admin SDK JSON content
   - File path: `/etc/secrets/firebase-credentials.json`

7. **Click "Create Web Service"** ✅

8. **Your backend will be live at:** `https://voyage-backend.onrender.com`

9. **Copy this URL!** You'll need it for the next step.

---

## 🔄 **STEP 4: Update Frontend with Backend URL**

1. **Go back to Vercel Dashboard**

2. **Select your frontend project** → **Settings** → **Environment Variables**

3. **Update `VITE_API_URL`:**
   ```
   VITE_API_URL=https://voyage-backend.onrender.com
   ```

4. **Redeploy:** Go to **Deployments** tab → Click "..." on latest deployment → **Redeploy**

---

## 🔐 **STEP 5: Configure Firebase**

1. **Go to [Firebase Console](https://console.firebase.google.com)**

2. **Select your project** → **Authentication** → **Settings**

3. **Add Authorized Domains:**
   - Click "Authorized domains"
   - Add: `voyage-app.vercel.app` (or your custom domain)

4. **Set up Firestore Security Rules:**
   - Go to **Firestore Database** → **Rules**
   - Update with production rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Trips collection
    match /trips/{tripId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Boards collection
    match /boards/{boardId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (request.auth.uid == resource.data.createdBy ||
         request.auth.uid in resource.data.members);
    }
    
    // Expenses collection
    match /expenses/{expenseId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## ✅ **STEP 6: Test Your Deployment**

1. **Open your frontend URL:** `https://voyage-app.vercel.app`

2. **Test signup/login** with email

3. **Test Google login**

4. **Create a trip** and verify it works

5. **Check all features:**
   - Profile quiz
   - Trip planning
   - Expense tracker
   - Voyage board
   - Calendar integration

---

## 🎨 **BONUS: Add Custom Domain (Optional)**

### On Vercel (Frontend):
1. Go to project **Settings** → **Domains**
2. Add your domain (e.g., `voyage.app`)
3. Follow DNS configuration instructions

### On Render (Backend):
1. Go to service **Settings** → **Custom Domain**
2. Add your API domain (e.g., `api.voyage.app`)
3. Update DNS records as instructed

---

## 🚨 **Common Issues & Solutions**

### ❌ CORS Error
**Problem:** Frontend can't connect to backend

**Solution:**
```python
# In backend/server.py, update CORS origins:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://voyage-app.vercel.app"],  # Your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### ❌ Firebase Auth Not Working
**Problem:** "Auth domain not authorized"

**Solution:**
- Add your Vercel domain to Firebase Authorized Domains (see Step 5)

### ❌ Backend Build Fails
**Problem:** Missing dependencies

**Solution:**
- Check `requirements.txt` is complete
- Verify Python version is set to 3.11

### ❌ Environment Variables Not Loading
**Problem:** API keys not found

**Solution:**
- Double-check all env vars are set in Render/Vercel dashboard
- Redeploy after adding env vars

---

## 📊 **Monitor Your Deployment**

### Vercel Dashboard:
- **Deployments:** See build logs
- **Analytics:** Track visitors (upgrade to Pro)
- **Logs:** Real-time function logs

### Render Dashboard:
- **Logs:** Live application logs
- **Metrics:** CPU, memory usage
- **Events:** Deployment history

---

## 🔄 **Continuous Deployment**

Both Vercel and Render auto-deploy when you push to GitHub!

```powershell
# Make changes locally
git add .
git commit -m "Added new feature"
git push

# Wait 2-3 minutes - your app auto-updates! 🎉
```

---

## 💰 **Cost Breakdown**

| Service | Free Tier | Paid Plan |
|---------|-----------|-----------|
| **Vercel** | 100 GB bandwidth/month | $20/month (Pro) |
| **Render** | 750 hours/month | $7/month (Starter) |
| **Firebase** | 50K reads/day | Pay as you go |
| **Google AI** | Free tier available | Pay per request |
| **Tavily** | 1000 searches/month | $50/month |
| **Twilio** | Trial credits | Pay per SMS |

**Total for free tier:** $0/month ✅  
**Recommended paid:** ~$27/month for better performance

---

## 🎯 **Alternative Deployment Options**

### Option 2: Netlify + Railway
```powershell
# Frontend on Netlify
cd frontend
npm install -g netlify-cli
netlify deploy --prod

# Backend on Railway
# Go to railway.app, connect GitHub, deploy
```

### Option 3: Firebase Hosting (Both)
```powershell
# Deploy everything to Firebase
firebase init
firebase deploy
```

---

## 📞 **Need Help?**

1. Check logs in Vercel/Render dashboard
2. Review `DEPLOYMENT.md` for detailed troubleshooting
3. Test locally first: `npm run dev` and `python server.py`
4. Verify all environment variables are set correctly

---

## 🎉 **You're Live!**

Congratulations! Your Voyage app is now deployed and accessible worldwide! 🌍

**Frontend:** https://voyage-app.vercel.app  
**Backend:** https://voyage-backend.onrender.com  

Share your app and start planning amazing trips! ✈️
