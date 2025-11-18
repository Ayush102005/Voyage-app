import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase.ts'
import { useAuthStore } from '../store/authStore.ts'

const SignUpPage = () => {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '',
    phoneNumber: ''
  })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [tempUser, setTempUser] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (!formData.phoneNumber || formData.phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number')
      return
    }

    setLoading(true)
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password)
      
      // Update profile with display name
      await updateProfile(userCredential.user, {
        displayName: formData.name
      })
      
      // Store user temporarily until phone is verified
      setTempUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: formData.name,
      })
      
      // Send OTP
      await sendOTP()
      
      toast.success('Account created! Please verify your phone number')
      setShowOtpModal(true)
    } catch (error: any) {
      console.error('Signup error:', error)
      toast.error(error.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  const sendOTP = async () => {
    setOtpLoading(true)
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phone_number: formData.phoneNumber })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('OTP sent to your phone')
      } else {
        throw new Error(data.detail || 'Failed to send OTP')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP')
      throw error
    } finally {
      setOtpLoading(false)
    }
  }

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP')
      return
    }

    setVerifyLoading(true)
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          phone_number: formData.phoneNumber,
          otp: otp
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setUser(tempUser)
        toast.success('Phone number verified successfully!')
        setShowOtpModal(false)
        navigate('/profile-quiz')
      } else {
        throw new Error(data.detail || 'Invalid OTP')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify OTP')
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true)
    
    try {
      const result = await signInWithPopup(auth, googleProvider)
      
      // Store user temporarily until phone is verified
      setTempUser({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
      })
      
      toast.success('Account created with Google! Please verify your phone number')
      // Show phone number input modal first
      setShowPhoneModal(true)
    } catch (error: any) {
      console.error('Google sign-up error:', error)
      toast.error(error.message || 'Failed to sign up with Google')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handlePhoneSubmit = async () => {
    if (!formData.phoneNumber || formData.phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number')
      return
    }

    try {
      await sendOTP()
      setShowPhoneModal(false)
      setShowOtpModal(true)
    } catch (error) {
      // Error already handled in sendOTP
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#23424A]/30 via-black to-black" />
      <div className="absolute top-20 right-0 w-96 h-96 bg-[#57A5B8]/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-neutral-400 hover:text-white mb-8 transition-colors">
          ← Back to Home
        </button>

        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-2xl shadow-[#57A5B8]/10 p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-3xl">✈️</span>
              <span className="text-2xl font-bold gradient-text">Voyage</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Create Account</h1>
            <p className="text-neutral-400">Start your journey with AI-powered travel planning</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">Phone Number</label>
              <input
                type="tel"
                required
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors"
                placeholder="+91 1234567890"
                maxLength={15}
              />
              <p className="text-xs text-neutral-500 mt-1">We'll send an OTP to verify your number</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">Password</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">Confirm Password</label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-neutral-900 text-neutral-500">Or continue with</span>
            </div>
          </div>

          {/* Google Sign Up */}
          <button
            onClick={handleGoogleSignUp}
            disabled={googleLoading}
            className="w-full bg-white hover:bg-neutral-100 text-black font-semibold px-6 py-3 rounded-lg transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? 'Creating account...' : 'Sign up with Google'}
          </button>

          <div className="mt-6 text-center">
            <p className="text-neutral-400">
              Already have an account?{' '}
              <Link to="/login" className="text-[#57A5B8] hover:text-[#57A5B8] font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Phone Number Modal for Google Users */}
      {showPhoneModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-2">Verify Your Phone</h2>
            <p className="text-neutral-400 mb-6">
              Please enter your phone number to complete registration
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors"
                  placeholder="+1234567890"
                  maxLength={15}
                  autoFocus
                  required
                />
                <p className="text-sm text-neutral-400 mt-1">
                  We'll send an OTP to verify your number
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPhoneModal(false)
                    setFormData({ ...formData, phoneNumber: '' })
                  }}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePhoneSubmit}
                  disabled={!formData.phoneNumber || formData.phoneNumber.length < 10}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-2">Verify Phone Number</h2>
            <p className="text-neutral-400 mb-6">
              Enter the 6-digit OTP sent to {formData.phoneNumber}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">OTP Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => sendOTP()}
                  disabled={otpLoading}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {otpLoading ? 'Sending...' : 'Resend OTP'}
                </button>
                <button
                  onClick={verifyOTP}
                  disabled={verifyLoading || otp.length !== 6}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {verifyLoading ? 'Verifying...' : 'Verify'}
                </button>
              </div>

              <button
                onClick={() => {
                  setShowOtpModal(false)
                  setOtp('')
                }}
                className="w-full text-neutral-400 hover:text-white py-2 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SignUpPage

