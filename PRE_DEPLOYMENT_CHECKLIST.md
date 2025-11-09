# ✅ Pre-Deployment Checklist

## Before You Deploy - Complete These Steps!

### 🔐 1. Get Your API Keys Ready

- [ ] **Google Gemini AI API Key**
  - Go to: https://makersuite.google.com/app/apikey
  - Create API key
  - Copy and save it

- [ ] **Tavily API Key** 
  - Go to: https://tavily.com
  - Sign up and get API key
  - Copy and save it

- [ ] **Twilio Account** (for OTP)
  - Go to: https://www.twilio.com/try-twilio
  - Sign up for free trial
  - Get: Account SID, Auth Token, Phone Number
  - Copy all three

- [ ] **Firebase Project Setup**
  - Go to: https://console.firebase.google.com
  - Create new project or select existing
  - Enable: Authentication (Email/Password + Google)
  - Enable: Firestore Database
  - Get: All Firebase config values (API key, project ID, etc.)
  - Download: Firebase Admin SDK JSON (for backend)

### 📁 2. Organize Your Credentials

Create a temporary note with all your credentials:

```
GOOGLE_API_KEY=AIza...
TAVILY_API_KEY=tvly-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc123
```

### 🧪 3. Test Locally First

```powershell
# Backend
cd backend
cp .env.example .env
# Edit .env with your credentials
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python server.py

# Frontend (new terminal)
cd frontend
cp .env.example .env
# Edit .env with your Firebase credentials
npm install
npm run dev
```

- [ ] Backend running at http://localhost:8000
- [ ] Frontend running at http://localhost:5173
- [ ] Can sign up with email
- [ ] Can login with Google
- [ ] Can create a trip
- [ ] All features work

### 📤 4. Push to GitHub

```powershell
# Initialize git if not already
git init
git add .
git commit -m "Ready for deployment"
git branch -M main

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/voyage-app.git
git push -u origin main
```

- [ ] Code pushed to GitHub
- [ ] Repository is accessible
- [ ] `.env` files are NOT in the repo (check .gitignore)

### 🚀 5. Deploy!

Follow the steps in **DEPLOY_NOW.md**:

1. [ ] Deploy frontend to Vercel
2. [ ] Deploy backend to Render  
3. [ ] Update frontend with backend URL
4. [ ] Configure Firebase authorized domains
5. [ ] Test live deployment

### 🔒 6. Security Check

- [ ] All API keys are in environment variables (not in code)
- [ ] `.env` files are in `.gitignore`
- [ ] Firebase security rules are configured
- [ ] CORS is restricted to your frontend domain
- [ ] HTTPS is enabled on both frontend and backend

### 📊 7. Post-Deployment Testing

- [ ] Visit your live frontend URL
- [ ] Sign up with a new account
- [ ] Login works
- [ ] Google auth works
- [ ] Can create a trip
- [ ] AI trip planner responds
- [ ] Expense tracker works
- [ ] Voyage board works
- [ ] No console errors in browser
- [ ] Backend logs show no errors

### 📈 8. Optional Enhancements

- [ ] Add custom domain
- [ ] Set up error tracking (Sentry)
- [ ] Add analytics (Google Analytics)
- [ ] Set up monitoring alerts
- [ ] Configure CDN
- [ ] Enable caching
- [ ] Add rate limiting

---

## 🆘 Troubleshooting Before Deploy

### "Module not found" errors
```powershell
# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install

# Backend  
cd backend
pip install -r requirements.txt --upgrade
```

### "Firebase not configured" error
- Check all VITE_FIREBASE_* variables are set
- Verify Firebase project is created
- Enable Authentication and Firestore in Firebase console

### "CORS error" in browser
- Backend CORS will auto-configure based on ENVIRONMENT variable
- In production, set ALLOWED_ORIGINS to your Vercel URL

### "API key invalid" error
- Double-check API keys are copied correctly (no spaces)
- Ensure API services are enabled (Google AI, Tavily)
- For Twilio, verify trial account is active

---

## 📞 Ready to Deploy?

If all checkboxes are ✅, proceed to **DEPLOY_NOW.md** for step-by-step deployment instructions!

**Estimated deployment time:** 15-20 minutes

**Cost:** $0 (using free tiers) 🎉
