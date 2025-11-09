# Debugging Profile Save Issue

## Quick Checks:

### 1. Open Browser Console (F12)
Look for these logs when you complete the profile quiz:
- `🔥 Initializing Firebase with config:` - Should show all config values as "✓ Present"
- `✅ Firebase initialized successfully`
- `✅ User authenticated: [user-id]`
- `🔍 Attempting to save profile:` - Shows the form data
- `💾 Saving to Firestore:` - Shows what's being saved
- `✅ Successfully saved to Firestore` - Success message

### 2. Check for Error Messages
If you see any of these errors:
- **Missing/Insufficient permissions**: Firestore rules need to be updated
- **ApiKey not valid**: Check .env file
- **No user is authenticated**: Login didn't work properly

## Fix Firestore Security Rules

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project: `voyage-5b949`
3. Go to **Firestore Database** → **Rules** tab
4. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own document in the users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow users to read/write their own profile
    match /user_profiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow users to read/write their own trips
    match /trip_plans/{tripId} {
      allow read, write: if request.auth != null;
    }
    
    // Allow users to read/write their own taste graphs
    match /taste_graphs/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

5. Click **Publish**

## Test in Browser Console

After logging in, run this in the browser console:

```javascript
// Check if Firebase is initialized
console.log('Firebase DB:', window.db)
console.log('Firebase Auth:', window.auth)
console.log('Current User:', window.auth?.currentUser)

// If user exists, test write
if (window.auth?.currentUser) {
  const { doc, setDoc } = await import('firebase/firestore')
  const testDoc = doc(window.db, 'users', window.auth.currentUser.uid)
  
  try {
    await setDoc(testDoc, { test: 'manual test', timestamp: new Date().toISOString() }, { merge: true })
    console.log('✅ Manual write successful!')
  } catch (error) {
    console.error('❌ Manual write failed:', error)
  }
}
```

## Common Issues & Fixes:

### Issue 1: "Missing or insufficient permissions"
**Fix**: Update Firestore rules (see above)

### Issue 2: User is null when submitting quiz
**Fix**: Ensure you're logged in before accessing /profile-quiz
- The page should redirect to /login automatically if not authenticated

### Issue 3: Firebase config not loading
**Fix**: Check .env file has all VITE_FIREBASE_* variables
```bash
# In frontend folder, verify .env exists
cat .env
```

### Issue 4: Data saves but doesn't show in dashboard
**Fix**: Check if preferences are being loaded in App.tsx auth listener

## Manual Test Steps:

1. **Clear browser cache and reload** (Ctrl + Shift + R)
2. **Sign up/Login** → Should redirect to /profile-quiz
3. **Complete all 3 steps** of the quiz
4. **Open DevTools Console** (F12) before clicking "Complete Profile"
5. **Click "Complete Profile"** and watch the console logs
6. Should navigate to /dashboard with preferences displayed

## If Still Not Working:

Share the console logs from browser DevTools (F12 → Console tab) and I'll help debug further!
