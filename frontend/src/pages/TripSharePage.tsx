import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { auth } from '../lib/firebase'
import toast from 'react-hot-toast'

export default function TripSharePage() {
  const { tripId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [tripData, setTripData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDay, setSelectedDay] = useState<number | 'overview' | null>(null)
  const [totalDays, setTotalDays] = useState(0)

  useEffect(() => {
    if (!tripId) {
      setError('Invalid trip ID')
      setIsLoading(false)
      return
    }

    fetchTripData()
  }, [tripId])

  useEffect(() => {
    if (tripData?.itinerary) {
      const dayMatches = tripData.itinerary.match(/Day \d+/gi)
      if (dayMatches) {
        const days = dayMatches.map((d: string) => parseInt(d.replace(/Day /i, '')))
        const maxDay = Math.max(...days)
        setTotalDays(maxDay)
      }
    }
  }, [tripData])

  const filterByDays = (text: string): string => {
    if (selectedDay === null) return text
    
    if (selectedDay === 'overview') {
      const sections = text.split(/(?=Day \d+)/i)
      const overviewSections: string[] = []
      
      if (sections[0] && !sections[0].match(/^Day \d+/i)) {
        overviewSections.push(sections[0])
      }
      
      const dayHighlights: string[] = []
      sections.forEach(section => {
        const dayMatch = section.match(/Day (\d+)/i)
        if (dayMatch) {
          const dayNum = parseInt(dayMatch[1])
          const lines = section.split('\n').filter(l => l.trim())
          const dayTitle = lines[0] || `Day ${dayNum}`
          const highlight = lines.slice(1, 3).join(' ').slice(0, 150) + '...'
          dayHighlights.push(`**${dayTitle}**\n${highlight}`)
        }
      })
      
      return overviewSections.join('\n\n') + '\n\n' + dayHighlights.join('\n\n')
    }
    
    const sections = text.split(/(?=Day \d+)/i)
    for (const section of sections) {
      const dayMatch = section.match(/Day (\d+)/i)
      if (dayMatch) {
        const dayNum = parseInt(dayMatch[1])
        if (dayNum === selectedDay) {
          return section
        }
      }
    }
    return text
  }

  const selectDay = (day: number | 'overview') => {
    setSelectedDay(day === selectedDay ? null : day)
  }

  const showAllDays = () => {
    setSelectedDay(null)
  }

  const handleAccessBoard = async () => {
    if (!tripId) return
    
    try {
      // Check if board ID is in query params
      const boardId = searchParams.get('board')
      
      if (boardId) {
        // Board ID provided, navigate directly
        navigate(`/voyage-board/${boardId}`)
        return
      }
      
      // No board ID, need to check if board exists for this trip
      const firebaseUser = auth.currentUser
      
      if (!firebaseUser) {
        toast.error('Please log in to access the collaboration board')
        navigate('/login')
        return
      }

      const token = await firebaseUser.getIdToken()
      
      // Check if board exists for this trip
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const checkResponse = await fetch(`${apiUrl}/api/voyage-board/trip/${tripId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (checkResponse.status === 404) {
        // Board doesn't exist, create it
        toast.error('Collaboration board not yet created for this trip')
        return
      } else if (checkResponse.ok) {
        const boardData = await checkResponse.json()
        navigate(`/voyage-board/${boardData.board.board_id}`)
      } else {
        toast.error('Failed to access collaboration board')
      }
    } catch (error) {
      console.error('Error accessing board:', error)
      toast.error('Failed to access collaboration board')
    }
  }

  const fetchTripData = async () => {
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''

      // Use the public share endpoint
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/trip-plans/share/${tripId}`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      })

      if (response.ok) {
        const data = await response.json()
        setTripData(data)
      } else if (response.status === 404) {
        setError('Trip not found')
      } else if (response.status === 403) {
        setError('This trip is private. Please ask the owner to make it public.')
      } else {
        setError('Failed to load trip')
      }
    } catch (error) {
      console.error('Error fetching trip:', error)
      setError('Failed to load trip')
    } finally {
      setIsLoading(false)
    }
  }

  const formatItinerary = (text: string): string => {
    if (!text) return ''
    
    // First, check if the content already has Day headers
    const hasDayHeaders = /Day \d+/i.test(text)
    
    if (!hasDayHeaders) {
      // If no day headers, wrap the entire content as overview/general information
      let formatted = text
        // Headers with numbers (1., 2., etc.)
        .replace(/^(\d+)\.\s*(.+)$/gm, '<h3 class="text-lg font-bold text-teal-400 mt-6 mb-3">$1. $2</h3>')
        // Bold text
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-teal-500">$1</strong>')
        // Headers with ## 
        .replace(/^##\s*(.+)$/gm, '<h3 class="text-lg font-bold text-teal-400 mt-4 mb-2">$1</h3>')
        // Bullet points with *, -, or • (with optional indentation)
        .replace(/^\s*[*\-•]\s+(.+)$/gm, '<li class="ml-4 mb-2 text-neutral-200">• $1</li>')
        // Lines starting with emoji
        .replace(/^([🏨🍽️✈️🚗🎯💰📍🗓️⏰🌟🌊🏖️🎭🎪🎨🏛️⛪🕌].+)$/gm, '<p class="ml-2 mb-2 text-neutral-300">$1</p>')
      
      // Wrap consecutive list items in <ul>
      formatted = formatted.replace(/(<li.+?<\/li>\n?)+/g, (match) => {
        return '<ul class="list-none space-y-2 mb-4">' + match + '</ul>'
      })
      
      // Handle paragraphs
      const paragraphs = formatted.split(/\n\n+/)
      formatted = paragraphs.map(para => {
        if (para.match(/^<[uh]/)) return para
        if (!para.trim()) return ''
        return '<p class="mb-4 text-neutral-300 leading-relaxed">' + para.replace(/\n/g, '<br>') + '</p>'
      }).filter(p => p).join('\n')
      
      return '<div class="mb-6 p-4 bg-yellow-600/10 border border-yellow-600/30 rounded-lg"><p class="text-yellow-400 text-sm mb-2">📋 This is an overview plan without day-wise breakdown</p></div>' + formatted
    }
    
    // If content has Day headers, format with day sections highlighted
    let formatted = text
      // Day headers - make them prominent
      .replace(/^(Day\s+\d+:?\s*.*)$/gim, '<div class="mt-8 mb-4 p-4 bg-teal-600/20 border-l-4 border-teal-500 rounded-r-lg"><h2 class="text-2xl font-bold text-white">🗓️ $1</h2></div>')
      // Headers with numbers (1., 2., etc.)
      .replace(/^(\d+)\.\s*(.+)$/gm, '<h3 class="text-lg font-bold text-teal-400 mt-6 mb-3">$1. $2</h3>')
      // Bold text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-teal-500">$1</strong>')
      // Headers with ## 
      .replace(/^##\s*(.+)$/gm, '<h3 class="text-lg font-bold text-teal-400 mt-4 mb-2">$1</h3>')
      // Bullet points with *, -, or • (with optional indentation)
      .replace(/^\s*[*\-•]\s+(.+)$/gm, '<li class="ml-4 mb-2 text-neutral-200">• $1</li>')
      // Lines starting with emoji
      .replace(/^([🏨🍽️✈️🚗🎯💰📍🗓️⏰🌟🌊🏖️🎭🎪🎨🏛️⛪🕌].+)$/gm, '<p class="ml-2 mb-2 text-neutral-300">$1</p>')
    
    // Wrap consecutive list items in <ul>
    formatted = formatted.replace(/(<li.+?<\/li>\n?)+/g, (match) => {
      return '<ul class="list-none space-y-2 mb-4">' + match + '</ul>'
    })
    
    // Handle paragraphs
    const paragraphs = formatted.split(/\n\n+/)
    formatted = paragraphs.map(para => {
      if (para.match(/^<[udh]/)) return para
      if (!para.trim()) return ''
      return '<p class="mb-4 text-neutral-300 leading-relaxed">' + para.replace(/\n/g, '<br>') + '</p>'
    }).filter(p => p).join('\n')
    
    return formatted
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-teal-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading trip...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="text-6xl mb-4 block">😔</span>
          <h2 className="text-2xl font-bold mb-3">{error}</h2>
          <p className="text-neutral-400 mb-6">
            This trip may be private or no longer available.
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary px-6 py-3"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✈️</span>
            <div>
              <h1 className="text-xl font-bold">Shared Trip</h1>
              <p className="text-sm text-neutral-400">View-only</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            Close ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Trip Header */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold mb-2">{tripData.destination || 'Trip Plan'}</h2>
              {tripData.dates && (
                <p className="text-neutral-400 text-sm mb-2">📅 {tripData.dates}</p>
              )}
              {tripData.budget && (
                <p className="text-neutral-400 text-sm">💰 Budget: ₹{tripData.budget.toLocaleString()}</p>
              )}
            </div>
          </div>

          {tripData.user_preferences && (
            <div className="flex flex-wrap gap-2 mt-4">
              {tripData.user_preferences.interests?.map((interest: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-teal-600/20 text-teal-400 rounded-full text-xs">
                  {interest}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleAccessBoard}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <span>👥</span> Join Collaboration Board
            </button>
          </div>
        </div>

        {/* Itinerary */}
        {tripData.itinerary && (
          <div className="card p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>📋</span> Itinerary
            </h3>

            {/* Day Filter Buttons */}
            {totalDays > 0 && (
              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-neutral-400">View:</span>
                  <button
                    onClick={showAllDays}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      selectedDay === null
                        ? 'bg-teal-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    📄 Full Plan
                  </button>
                  <button
                    onClick={() => selectDay('overview')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      selectedDay === 'overview'
                        ? 'bg-teal-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    📋 Overview
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
                    <button
                      key={day}
                      onClick={() => selectDay(day)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        selectedDay === day
                          ? 'bg-teal-600 text-white'
                          : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                      }`}
                    >
                      Day {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Itinerary Content */}
            <div 
              className="prose prose-invert max-w-none min-h-[400px]"
              style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
            >
              {selectedDay && (
                <div className="mb-4 p-3 bg-teal-600/20 border border-teal-600/30 rounded-lg text-sm">
                  <span className="text-teal-400">
                    {selectedDay === 'overview' ? '📋 Viewing overview' : `📅 Viewing Day ${selectedDay}`}
                  </span>
                  <button 
                    onClick={showAllDays}
                    className="ml-3 text-teal-300 hover:text-teal-100 underline"
                  >
                    Show full plan
                  </button>
                </div>
              )}
              <div dangerouslySetInnerHTML={{ 
                __html: formatItinerary(filterByDays(tripData.itinerary)) 
              }} />
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-8 text-center card p-8">
          <span className="text-5xl mb-4 block">🚀</span>
          <h3 className="text-2xl font-bold mb-3">Want to plan your own trip?</h3>
          <p className="text-neutral-400 mb-6">
            Create personalized travel itineraries with AI assistance
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="btn-primary px-8 py-3"
          >
            Get Started Free
          </button>
        </div>
      </div>
    </div>
  )
}
