import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './lib/firebase.ts'
import { useAuthStore } from './store/authStore.ts'
import { FirebaseStatusIndicator } from './components/FirebaseStatusIndicator.tsx'
import HomePage from './pages/HomePage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import SignUpPage from './pages/SignUpPage.tsx'
import ProfileQuizPage from './pages/ProfileQuizPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import ExpenseTrackerPage from './pages/ExpenseTrackerPage.tsx'
import VoyageBoardPage from './pages/VoyageBoardPage.tsx'

function App() {
  const { setUser, setLoading, setPreferences } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        })

        // Load user preferences from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            setPreferences(userDoc.data())
          }
        } catch (error) {
          console.error('Error loading preferences:', error)
        }
      } else {
        setUser(null)
        setPreferences(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [setUser, setLoading, setPreferences])
  return (
    <Router>
      <div className="min-h-screen bg-black">
        <FirebaseStatusIndicator />
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: '#171717',
              color: '#fff',
              border: '1px solid #dc2626',
            },
            success: {
              iconTheme: {
                primary: '#dc2626',
                secondary: '#fff',
              },
            },
          }}
        />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/profile-quiz" element={<ProfileQuizPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/trip/:tripId/expenses" element={<ExpenseTrackerPage />} />
          <Route path="/board/:boardId" element={<VoyageBoardPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
