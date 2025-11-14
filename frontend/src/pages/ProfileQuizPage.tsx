import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase.ts'
import { useAuthStore } from '../store/authStore.ts'

const ProfileQuizPage = () => {
  const navigate = useNavigate()
  const { user, setPreferences, loading } = useAuthStore()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    travelStyle: '',
    interests: [] as string[],
    budgetPreference: '',
  })

  // Check if user is authenticated
  useEffect(() => {
    if (!loading && !user) {
      console.log('⚠️ No user found, redirecting to login')
      toast.error('Please log in first')
      navigate('/login')
    } else if (user) {
      console.log('✅ User authenticated:', user.uid)
    }
  }, [user, loading, navigate])

  const travelStyles = [
    { id: 'adventure', emoji: '🏔️', label: 'Adventure Seeker', desc: 'Trekking, hiking, extreme sports' },
    { id: 'relaxation', emoji: '🏖️', label: 'Beach & Relax', desc: 'Peaceful beaches, spa, chill vibes' },
    { id: 'cultural', emoji: '🏛️', label: 'Cultural Explorer', desc: 'Museums, heritage sites, local culture' },
    { id: 'luxury', emoji: '💎', label: 'Luxury Traveler', desc: 'Premium stays, fine dining, comfort' },
  ]

  const interestOptions = [
    { id: 'food', emoji: '🍽️', label: 'Food & Cuisine' },
    { id: 'photography', emoji: '📸', label: 'Photography' },
    { id: 'nightlife', emoji: '🎵', label: 'Nightlife & Music' },
    { id: 'nature', emoji: '🌿', label: 'Nature & Wildlife' },
    { id: 'history', emoji: '🏺', label: 'History & Heritage' },
    { id: 'adventure', emoji: '⛰️', label: 'Adventure Sports' },
  ]

  const budgetRanges = [
    { id: 'budget', label: 'Budget-Friendly', range: '₹10,000 - ₹25,000' },
    { id: 'moderate', label: 'Moderate', range: '₹25,000 - ₹50,000' },
    { id: 'premium', label: 'Premium', range: '₹50,000 - ₹1,00,000' },
    { id: 'luxury', label: 'Luxury', range: '₹1,00,000+' },
  ]

  const toggleInterest = (interestId: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interestId)
        ? prev.interests.filter(i => i !== interestId)
        : [...prev.interests, interestId]
    }))
  }

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please log in first')
      navigate('/login')
      return
    }

    console.log('🔍 Attempting to save profile:', formData)
    console.log('👤 User ID:', user.uid)

    try {
      const userPreferences = {
        travelStyle: formData.travelStyle,
        interests: formData.interests,
        budgetPreference: formData.budgetPreference,
        profileComplete: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      console.log('💾 Saving to Firestore:', userPreferences)
      
      // Save to Firestore
      const userDocRef = doc(db, 'users', user.uid)
      await setDoc(userDocRef, userPreferences, { merge: true })
      
      console.log('✅ Successfully saved to Firestore')

      // Update local state
      setPreferences(userPreferences)

      toast.success('Profile complete! Let\'s start planning!')
      navigate('/dashboard')
    } catch (error: any) {
      console.error('❌ Error saving profile:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      toast.error(`Failed to save profile: ${error.message}`)
    }
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">✈️</span>
          <p className="text-neutral-400 text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render the quiz if user is not authenticated
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-4xl mx-auto py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-5xl mb-4 block">✈️</span>
          <h1 className="text-4xl font-bold mb-3">
            Let's Personalize Your <span className="gradient-text">Journey</span>
          </h1>
          <p className="text-neutral-400 text-lg">Help us understand your travel preferences</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  step >= s ? 'bg-[#57A5B8] text-white' : 'bg-neutral-800 text-neutral-500'
                }`}>
                  {s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 mx-2 transition-all ${
                    step > s ? 'bg-[#57A5B8]' : 'bg-neutral-800'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Travel Style */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center mb-8">What's your travel style?</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {travelStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setFormData({ ...formData, travelStyle: style.id })}
                  className={`p-6 rounded-xl border-2 transition-all text-left ${
                    formData.travelStyle === style.id
                      ? 'border-[#57A5B8] bg-[#57A5B8]/10 scale-105 shadow-xl shadow-[#57A5B8]/50'
                      : 'border-neutral-800 bg-neutral-900 hover:border-[#57A5B8]/50'
                  }`}
                >
                  <div className="text-5xl mb-4">{style.emoji}</div>
                  <h3 className="text-xl font-bold mb-2">{style.label}</h3>
                  <p className="text-neutral-400 text-sm">{style.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-8">
              <button
                onClick={() => setStep(2)}
                disabled={!formData.travelStyle}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Step →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Interests */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center mb-8">What interests you most?</h2>
            <p className="text-center text-neutral-400 mb-8">Select all that apply</p>
            <div className="grid md:grid-cols-3 gap-4">
              {interestOptions.map((interest) => {
                const isSelected = formData.interests.includes(interest.id)
                return (
                  <button
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-[#57A5B8] bg-[#57A5B8]/10'
                        : 'border-neutral-800 bg-neutral-900 hover:border-[#57A5B8]/50'
                    }`}
                  >
                    <div className="text-4xl mb-3">{interest.emoji}</div>
                    <p className="font-semibold">{interest.label}</p>
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between mt-8">
              <button onClick={() => setStep(1)} className="btn-secondary">
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={formData.interests.length === 0}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Step →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Budget */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center mb-8">What's your typical budget?</h2>
            <p className="text-center text-neutral-400 mb-8">Per trip estimate</p>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {budgetRanges.map((budget) => (
                <button
                  key={budget.id}
                  onClick={() => setFormData({ ...formData, budgetPreference: budget.id })}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    formData.budgetPreference === budget.id
                      ? 'border-[#57A5B8] bg-[#57A5B8]/10 scale-105'
                      : 'border-neutral-800 bg-neutral-900 hover:border-[#57A5B8]/50'
                  }`}
                >
                  <h3 className="text-xl font-bold mb-2">{budget.label}</h3>
                  <p className="text-neutral-400">{budget.range}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-8">
              <button onClick={() => setStep(2)} className="btn-secondary">
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.budgetPreference}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Profile ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfileQuizPage
