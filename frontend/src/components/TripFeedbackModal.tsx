import { useState } from 'react'
import toast from 'react-hot-toast'
import { auth } from '../lib/firebase'

interface TripFeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  tripId: string
  tripTitle: string
}

const TripFeedbackModal = ({ isOpen, onClose, tripId, tripTitle }: TripFeedbackModalProps) => {
  const [rating, setRating] = useState(0)
  const [experience, setExperience] = useState('')
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  const [improvements, setImprovements] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const highlightOptions = [
    'Great accommodations',
    'Perfect itinerary',
    'Excellent food recommendations',
    'Good value for money',
    'Smooth booking process',
    'Accurate time estimates',
    'Great activities',
    'Good local insights'
  ]

  const improvementOptions = [
    'More accommodation options',
    'Better transport suggestions',
    'More flexible itinerary',
    'Include more local experiences',
    'Better budget breakdown',
    'More dining options',
    'Earlier booking reminders',
    'More activity choices'
  ]

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating')
      return
    }

    if (!experience) {
      toast.error('Please select your overall experience')
      return
    }

    if (wouldRecommend === null) {
      toast.error('Please let us know if you would recommend')
      return
    }

    setSubmitting(true)

    try {
      const firebaseUser = auth.currentUser
      if (!firebaseUser) {
        toast.error('Please log in')
        return
      }

      const token = await firebaseUser.getIdToken()
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

      const response = await fetch(`${apiUrl}/api/feedback/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          trip_id: tripId,
          rating,
          experience,
          would_recommend: wouldRecommend,
          highlights,
          improvements,
          comment: comment.trim()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit feedback')
      }

      toast.success('Thank you for your feedback! 🎉')
      onClose()
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast.error('Failed to submit feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleHighlight = (item: string) => {
    setHighlights(prev =>
      prev.includes(item)
        ? prev.filter(h => h !== item)
        : [...prev, item]
    )
  }

  const toggleImprovement = (item: string) => {
    setImprovements(prev =>
      prev.includes(item)
        ? prev.filter(i => i !== item)
        : [...prev, item]
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold gradient-text">Trip Feedback</h2>
            <p className="text-neutral-400 text-sm mt-1">{tripTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Rating */}
          <div>
            <label className="block text-sm font-semibold mb-3">Overall Rating *</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="text-4xl transition-all hover:scale-110"
                >
                  {star <= rating ? '⭐' : '☆'}
                </button>
              ))}
            </div>
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm font-semibold mb-3">Overall Experience *</label>
            <div className="grid grid-cols-2 gap-3">
              {['excellent', 'good', 'average', 'poor'].map(exp => (
                <button
                  key={exp}
                  onClick={() => setExperience(exp)}
                  className={`p-3 rounded-lg border-2 transition-all capitalize ${
                    experience === exp
                      ? 'border-red-500 bg-red-500/20'
                      : 'border-neutral-700 hover:border-neutral-600'
                  }`}
                >
                  {exp}
                </button>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <label className="block text-sm font-semibold mb-3">Would you recommend this trip? *</label>
            <div className="flex gap-4">
              <button
                onClick={() => setWouldRecommend(true)}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  wouldRecommend === true
                    ? 'border-green-500 bg-green-500/20'
                    : 'border-neutral-700 hover:border-neutral-600'
                }`}
              >
                👍 Yes
              </button>
              <button
                onClick={() => setWouldRecommend(false)}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  wouldRecommend === false
                    ? 'border-red-500 bg-red-500/20'
                    : 'border-neutral-700 hover:border-neutral-600'
                }`}
              >
                👎 No
              </button>
            </div>
          </div>

          {/* Highlights */}
          <div>
            <label className="block text-sm font-semibold mb-3">What did you love? (Select all that apply)</label>
            <div className="grid grid-cols-2 gap-2">
              {highlightOptions.map(item => (
                <button
                  key={item}
                  onClick={() => toggleHighlight(item)}
                  className={`p-3 rounded-lg border text-sm transition-all text-left ${
                    highlights.includes(item)
                      ? 'border-teal-500 bg-teal-500/20'
                      : 'border-neutral-700 hover:border-neutral-600'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Improvements */}
          <div>
            <label className="block text-sm font-semibold mb-3">What could be better? (Select all that apply)</label>
            <div className="grid grid-cols-2 gap-2">
              {improvementOptions.map(item => (
                <button
                  key={item}
                  onClick={() => toggleImprovement(item)}
                  className={`p-3 rounded-lg border text-sm transition-all text-left ${
                    improvements.includes(item)
                      ? 'border-orange-500 bg-orange-500/20'
                      : 'border-neutral-700 hover:border-neutral-600'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Comments */}
          <div>
            <label className="block text-sm font-semibold mb-3">Additional Comments (Optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share any other thoughts about your trip..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 min-h-[100px] resize-none focus:border-teal-500 focus:outline-none"
              maxLength={500}
            />
            <div className="text-xs text-neutral-500 mt-1">
              {comment.length}/500 characters
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-neutral-800 hover:bg-neutral-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TripFeedbackModal
