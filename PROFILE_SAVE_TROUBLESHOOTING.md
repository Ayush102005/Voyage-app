# Profile Save - Troubleshooting Guide

## What I've Added for Debugging:

### 1. **Enhanced Console Logging**
The app now logs detailed information at every step:

#### In `firebase.ts`:
- Shows Firebase config status on load
- Confirms Firestore initialization
- Exposes `window.db` and `window.auth` for manual testing

#### In `ProfileQuizPage.tsx`:
- Logs when attempting to save
- Shows user ID and form data
- Logs success or detailed error messages
- Redirects to login if user is not authenticated

#### In `LoginPage.tsx` & `SignUpPage.tsx`:
- Checks if profile exists in Firestore after login
- Redirects to `/profile-quiz` if no profile
- Redirects to `/dashboard` if profile exists

### 2. **Firebase Status Indicator**
A small indicator in the top-right corner shows:
- ✓ Firestore connection status
- ✓ Auth status (loading/ready)
- ✓ Current user email (if logged in)

Auto-hides after 5 seconds if everything is OK.

### 3. **Route Protection**
Both ProfileQuizPage and DashboardPage now:
- Check authentication status
- Show loading state while checking
- Redirect to login if not authenticated
- Log user presence in console

## Testing Steps:

### Step 1: Open Browser DevTools
Press **F12** to open Developer Tools, go to **Console** tab

### Step 2: Clear Everything
```javascript
// Run in console to clear cache
localStorage.clear()
sessionStorage.clear()
location.reload()
```

### Step 3: Sign Up
1. Go to `http://localhost:3001/signup`
2. Create a new account
3. Watch console for these logs:
   ```
   🔥 Initializing Firebase with config: {...}
   ✅ Firebase initialized successfully
   📦 Firestore instance: Ready
   ```

### Step 4: Complete Profile Quiz
1. You should be automatically redirected to `/profile-quiz`
2. Complete all 3 steps
3. Before clicking "Complete Profile", check console shows:
   ```
   ✅ User authenticated: [your-user-id]
   ```
4. Click "Complete Profile" button
5. Watch for these logs:
   ```
   🔍 Attempting to save profile: {travelStyle: '...', interests: [...]}
   👤 User ID: xyz123...
   💾 Saving to Firestore: {...}
   ✅ Successfully saved to Firestore
   ```

### Step 5: Verify on Dashboard
1. Should redirect to `/dashboard`
2. Should see your preferences displayed at top
3. Console should show:
   ```
   ✅ User on dashboard: xyz123...
   📋 User preferences: {travelStyle: '...', ...}
   ```

## Common Issues & Solutions:

### Issue 1: "Missing or insufficient permissions"

**What it means:** Firestore security rules don't allow writes

**How to fix:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: `voyage-5b949`
3. Navigate to: **Firestore Database** → **Rules**
4. Replace with:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /user_profiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /trip_plans/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
5. Click **Publish**

### Issue 2: User is null when trying to save

**What it means:** Authentication state not properly set

**How to fix:**
1. Check console for: `⚠️ No user found, redirecting to login`
2. Make sure you completed sign up/login successfully
3. Try logging out and back in
4. Check if toast shows "Signed in successfully"

### Issue 3: Firebase config errors

**What it means:** Environment variables not loaded

**How to check:**
Look for this in console:
```
🔥 Initializing Firebase with config:
  apiKey: ✓ Present / ✗ Missing
  authDomain: voyage-5b949.firebaseapp.com
  projectId: voyage-5b949
  ...
```

**How to fix:**
1. Verify `.env` file exists in `frontend/` folder
2. Check all variables start with `VITE_`
3. Restart dev server: `npm run dev`

### Issue 4: Data saves but doesn't show on dashboard

**How to check:**
1. Open Firebase Console → Firestore Database
2. Look for collection `users`
3. Find document with your user ID
4. Verify data is there

**If data is in Firestore but not showing:**
- Check browser console for preference loading errors
- Try refreshing the page
- Check `App.tsx` auth listener is loading preferences

## Manual Test in Console:

If automated flow fails, test manually in browser console:

```javascript
// 1. Check current user
console.log('Current user:', auth.currentUser)

// 2. Try manual write
const { doc, setDoc } = await import('firebase/firestore')

const testData = {
  travelStyle: 'adventure',
  interests: ['food', 'photography'],
  budgetPreference: 'moderate',
  profileComplete: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

try {
  await setDoc(doc(db, 'users', auth.currentUser.uid), testData, { merge: true })
  console.log('✅ Manual save successful!')
  
  // 3. Try manual read
  const { getDoc } = await import('firebase/firestore')
  const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid))
  console.log('Data in Firestore:', docSnap.data())
} catch (error) {
  console.error('❌ Error:', error)
}
```

## Still Not Working?

**Share these details:**
1. Full console output (copy from DevTools Console)
2. Any error messages (especially Firebase errors)
3. Screenshot of Firestore rules in Firebase Console
4. Network tab showing any failed requests

The detailed logging will help pinpoint exactly where the issue is!
