import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { auth } from '../lib/firebase'

const PhoneVerificationPage = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [loading, setLoading] = useState(false)

  const sendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number')
      return
    }

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
        body: JSON.stringify({ phone_number: phoneNumber })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('OTP sent to your phone')
        setShowOtpModal(true)
      } else {
        throw new Error(data.detail || 'Failed to send OTP')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP')
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
          phone_number: phoneNumber,
          otp: otp
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('Phone number verified successfully!')
        setShowOtpModal(false)
        // Navigate to dashboard after successful verification
        navigate('/dashboard')
      } else {
        throw new Error(data.detail || 'Invalid OTP')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify OTP')
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await sendOTP()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#23424A]/30 via-black to-black" />
      <div className="absolute top-20 right-0 w-96 h-96 bg-[#57A5B8]/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-2xl shadow-[#57A5B8]/10 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#57A5B8]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">📱</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Verify Your Phone</h1>
            <p className="text-neutral-400">
              We need to verify your phone number for security purposes
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-[#57A5B8] transition-colors"
                placeholder="+1234567890"
                maxLength={15}
              />
              <p className="text-sm text-neutral-400 mt-2">
                We'll send a 6-digit OTP to verify your number
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otpLoading || !phoneNumber || phoneNumber.length < 10}
              className="w-full btn-primary disabled:opacity-50"
            >
              {loading || otpLoading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-neutral-400 hover:text-white text-sm transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-2">Verify Phone Number</h2>
            <p className="text-neutral-400 mb-6">
              Enter the 6-digit OTP sent to {phoneNumber}
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
                  onClick={sendOTP}
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

export default PhoneVerificationPage
