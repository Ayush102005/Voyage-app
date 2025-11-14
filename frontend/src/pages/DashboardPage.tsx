import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import toast from 'react-hot-toast'

const DashboardPage = () => {
  const navigate = useNavigate()
  const { user, preferences, loading } = useAuthStore()
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPlan, setGeneratedPlan] = useState('')
  const [previousExtraction, setPreviousExtraction] = useState<any>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const [activeView, setActiveView] = useState<'chat' | 'foryou' | 'mytrips'>('chat')
  const [selectedDay, setSelectedDay] = useState<number | 'overview' | null>(null)
  const [totalDays, setTotalDays] = useState(0)
  const [forYouData, setForYouData] = useState<any>(null)
  const [myTripsData, setMyTripsData] = useState<any[]>([])
  // Date prompting states for planning
  const [showDateModal, setShowDateModal] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editedPlan, setEditedPlan] = useState('')
  const [currentTripId, setCurrentTripId] = useState<string | null>(null)
  const [viewingSavedTrip, setViewingSavedTrip] = useState(false)
  const [currentTripTitle, setCurrentTripTitle] = useState('')
  const [userPrompt, setUserPrompt] = useState<string>('')

  useEffect(() => {
    if (!loading && !user) {
      console.log('⚠️ No user found on dashboard, redirecting to login')
      toast.error('Please log in first')
      navigate('/login')
    } else if (user) {
      console.log('✅ User on dashboard:', user.uid)
      console.log('📋 User preferences:', preferences)
      fetchMyTrips()
    }
  }, [user, loading, navigate, preferences])

  useEffect(() => {
    if (chatAreaRef.current && generatedPlan) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight
    }
  }, [generatedPlan])

  useEffect(() => {
    if (generatedPlan) {
      const dayMatches = generatedPlan.match(/Day \d+/gi)
      if (dayMatches) {
        const days = dayMatches.map(d => parseInt(d.replace(/Day /i, '')))
        const maxDay = Math.max(...days)
        setTotalDays(maxDay)
        setSelectedDay(null)
      }
    }
  }, [generatedPlan])

  const formatItinerary = (text: string): string => {
    if (!text) return ''
    
    let formatted = text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-teal-500">$1</strong>')
      .replace(/^(Day \d+:.+)$/gm, '<h3 class="text-xl font-bold text-white mt-6 mb-3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h3 class="text-lg font-bold text-teal-400 mt-4 mb-2">$1</h3>')
      .replace(/^[-•] (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
      .replace(/^([🏨🍽️✈️🚗🎯💰📍🗓️⏰🌟].+)$/gm, '<p class="ml-2 mb-2">$1</p>')
      .replace(/\n\n/g, '</p><p class="mb-3">')
      .replace(/\n/g, '<br>')
    
    formatted = '<p class="mb-3">' + formatted + '</p>'
    
    formatted = formatted.replace(/(<li.+?<\/li>(?:<br>)?)+/gs, (match) => {
      return '<ul class="list-disc list-inside space-y-1 mb-4">' + match.replace(/<br>/g, '') + '</ul>'
    })
    
    return formatted
  }

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
      
      if (dayHighlights.length > 0) {
        overviewSections.push('\n## 📋 Daily Highlights\n\n' + dayHighlights.join('\n\n'))
      }
      
      return overviewSections.join('\n\n')
    }

    const sections = text.split(/(?=Day \d+)/i)
    const filteredSections: string[] = []

    sections.forEach(section => {
      const dayMatch = section.match(/Day (\d+)/i)
      if (dayMatch) {
        const dayNum = parseInt(dayMatch[1])
        if (dayNum === selectedDay) {
          filteredSections.push(section)
        }
      }
    })

    return filteredSections.length > 0 ? filteredSections.join('\n\n') : 'No content for this day.'
  }

  const selectDay = (day: number | 'overview') => {
    setSelectedDay(day === selectedDay ? null : day)
  }

  const showAllDays = () => {
    setSelectedDay(null)
  }

  const fetchForYouData = async () => {
    if (!user) return
    
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const response = await fetch('http://localhost:8000/api/for-you', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setForYouData(data)
      }
    } catch (error) {
      console.error('Error fetching For You data:', error)
      toast.error('Failed to load recommendations')
    }
  }

  const fetchMyTrips = async () => {
    if (!user) return
    
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const response = await fetch('http://localhost:8000/api/trip-plans', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        // Backend returns array directly, not wrapped in {trips: [...]}
        setMyTripsData(Array.isArray(data) ? data : (data.trips || []))
      }
    } catch (error) {
      console.error('Error fetching trips:', error)
      toast.error('Failed to load trips')
    }
  }

  useEffect(() => {
    if (activeView === 'foryou' && !forYouData) {
      fetchForYouData()
    } else if (activeView === 'mytrips') {
      fetchMyTrips()
    }
  }, [activeView])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      toast.success('Logged out successfully')
      navigate('/')
    } catch (error) {
      toast.error('Failed to logout')
    }
  }

  // send the prompt to the backend (expects optional start_date/end_date)
  const sendPrompt = async (prompt: string, start_date?: string, end_date?: string) => {
    if (!prompt.trim() || !user) return

    // Clear viewing saved trip state when generating new plan
    setViewingSavedTrip(false)
    setCurrentTripTitle('')
    
    // Save the user's prompt to display
    setUserPrompt(prompt)
    
    setIsGenerating(true)
    setGeneratedPlan('Generating your personalized itinerary...')

    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''

      const payload: any = {
        prompt,
        previous_extraction: previousExtraction
      }
      if (start_date) payload.start_date = start_date
      if (end_date) payload.end_date = end_date

      const response = await fetch('http://localhost:8000/api/plan-trip-from-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error('Failed to generate trip plan')
      }

      const data = await response.json()

      if (data.success) {
        setGeneratedPlan(data.trip_plan)
        toast.success('Trip plan generated!')
        setPreviousExtraction(null)
        setInput('')
      } else if (data.message === 'Need more information') {
        setGeneratedPlan(data.trip_plan)
        toast('Please provide more details', { icon: '💬' })
        setPreviousExtraction(data.extracted_details)
        setInput('')
      } else {
        throw new Error(data.message || 'Failed to generate plan')
      }
    } catch (error: any) {
      console.error('Error generating plan:', error)
      toast.error(error.message || 'Failed to generate trip plan')
      setGeneratedPlan('')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSendMessage = async () => {
    // Send prompt directly - backend will extract dates from the prompt
    if (!input.trim()) return
    
    await sendPrompt(input, undefined, undefined)
  }

  // Accepts dates in formats like '15 nov', '15/11', '2025-11-15', etc.
  function parseDateInput(dateStr: string): string | null {
    if (!dateStr) return null
    // Try ISO first
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
    // Try DD/MM or D/M
    const slash = dateStr.match(/^(\d{1,2})[\/](\d{1,2})$/)
    if (slash) {
      const day = parseInt(slash[1], 10)
      const month = parseInt(slash[2], 10)
      // Use current year
      const year = new Date().getFullYear()
      // Pad
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    }
    // Try DD mon or D mon (e.g., 15 nov)
    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    const word = dateStr.match(/^(\d{1,2})\s*([a-zA-Z]{3,})$/)
    if (word) {
      const day = parseInt(word[1], 10)
      let month = monthNames.findIndex(m => word[2].toLowerCase().startsWith(m))
      if (month !== -1) {
        month += 1 // 1-based
        const year = new Date().getFullYear()
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
      }
    }
    // Fallback: try Date.parse
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0,10)
    }
    return null
  }

  const confirmDatesAndSend = async () => {
    // Accept flexible input
    const parsedStart = parseDateInput(startDate)
    const parsedEnd = parseDateInput(endDate)
    if (!parsedStart || !parsedEnd) {
      toast.error('Please enter valid dates (e.g., 15 nov, 15/11, or 2025-11-15)')
      return
    }
    if (new Date(parsedStart) > new Date(parsedEnd)) {
      toast.error('Start date must be before end date')
      return
    }
    const promptToSend = pendingPrompt || input
    setShowDateModal(false)
    setPendingPrompt(null)
    await sendPrompt(promptToSend, parsedStart, parsedEnd)
    setStartDate('')
    setEndDate('')
  }

  const handleNewChat = () => {
    setGeneratedPlan('')
    setPreviousExtraction(null)
    setInput('')
    setActiveView('chat')
    setViewingSavedTrip(false)
    setCurrentTripTitle('')
    setCurrentTripId(null)
    setIsEditMode(false)
    setUserPrompt('')
    toast.success('Started new chat')
  }

  const handleSaveTrip = async () => {
    if (!user || !generatedPlan) return
    
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const firstLine = generatedPlan.split('\n')[0]
      const destinationMatch = firstLine.match(/to (.+?)(?:\s|$|,)/i)
      const destination = destinationMatch ? destinationMatch[1] : 'Trip Plan'
      
      const response = await fetch('http://localhost:8000/api/trip-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          destination,
          itinerary: generatedPlan,
          status: 'planned'
        })
      })
      
      if (response.ok) {
        toast.success('Trip saved successfully!')
        if (activeView === 'mytrips') {
          fetchMyTrips()
        }
      } else {
        throw new Error('Failed to save trip')
      }
    } catch (error) {
      console.error('Error saving trip:', error)
      toast.error('Failed to save trip')
    }
  }

  return (
    <div className="h-screen bg-black flex overflow-hidden">
      <aside className="w-80 bg-neutral-900 border-r border-neutral-800 flex flex-col overflow-y-auto">
        <div className="p-6 border-b border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-3xl">✈️</span>
            <span className="text-2xl font-bold gradient-text">Voyage</span>
          </div>
        </div>

        <div className="p-4 border-b border-neutral-800 flex-shrink-0">
          <button 
            onClick={handleNewChat}
            className="w-full btn-primary py-3 flex items-center justify-center gap-2"
          >
            <span>✨</span>
            <span>New Chat</span>
          </button>
        </div>

        <div className="p-4 border-b border-neutral-800 flex-shrink-0">
          <nav className="space-y-2">
            <button 
              onClick={() => setActiveView('foryou')}
              className={`w-full px-4 py-3 rounded-lg font-semibold flex items-center gap-3 transition-colors ${
                activeView === 'foryou' 
                  ? 'bg-teal-600/10 border border-teal-600/30 text-teal-500' 
                  : 'bg-neutral-800/50 border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <span className="text-xl">🎯</span>
              <span>For You</span>
            </button>
            <button 
              onClick={() => setActiveView('mytrips')}
              className={`w-full px-4 py-3 rounded-lg font-semibold flex items-center gap-3 transition-colors ${
                activeView === 'mytrips' 
                  ? 'bg-teal-600/10 border border-teal-600/30 text-teal-500' 
                  : 'bg-neutral-800/50 border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <span className="text-xl">🗺️</span>
              <span>My Trips</span>
            </button>
          </nav>
        </div>

        {preferences && (
          <div className="p-6 border-b border-neutral-800 flex-shrink-0">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-neutral-300">
              <span>👤</span> Travel Profile
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-neutral-500 text-xs">Style</span>
                <p className="text-white font-semibold capitalize">{preferences.travelStyle}</p>
              </div>
              <div>
                <span className="text-neutral-500 text-xs">Interests</span>
                <p className="text-white font-semibold capitalize">{preferences.interests?.join(', ')}</p>
              </div>
              <div>
                <span className="text-neutral-500 text-xs">Budget</span>
                <p className="text-white font-semibold capitalize">{preferences.budgetPreference}</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/profile-quiz')}
              className="mt-4 w-full text-teal-600 hover:text-teal-500 text-xs font-semibold"
            >
              Update Profile →
            </button>
          </div>
        )}

        <div className="flex-1"></div>

        <div className="p-6 border-t border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center text-xl font-bold">
              {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-semibold text-white truncate">{user?.displayName || 'Traveler'}</p>
              <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex-shrink-0">
          <button onClick={handleLogout} className="w-full btn-secondary py-3 text-sm font-semibold">
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-black/80 backdrop-blur-lg border-b border-neutral-800 px-8 py-4 flex-shrink-0">
          <h1 className="text-2xl font-bold">
            {activeView === 'chat' && viewingSavedTrip && (
              <>Saved Trip: <span className="gradient-text">{currentTripTitle}</span></>
            )}
            {activeView === 'chat' && !viewingSavedTrip && (
              <>Plan Your <span className="gradient-text">Journey</span></>
            )}
            {activeView === 'foryou' && (
              <>Personalized <span className="gradient-text">For You</span></>
            )}
            {activeView === 'mytrips' && (
              <>My <span className="gradient-text">Trips</span></>
            )}
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            {activeView === 'chat' && viewingSavedTrip && "Viewing your saved itinerary"}
            {activeView === 'chat' && !viewingSavedTrip && "Tell me your destination, budget, and dates - I'll create your perfect itinerary"}
            {activeView === 'foryou' && "Personalized recommendations based on your travel preferences"}
            {activeView === 'mytrips' && "View and manage all your saved trips"}
          </p>
        </header>

        {activeView === 'chat' && (
          <>
            <div ref={chatAreaRef} className="flex-1 overflow-y-auto p-8" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              <div className="max-w-4xl mx-auto space-y-6 pb-6">
                {!generatedPlan && (
                  <div className="text-center py-12">
                    <span className="text-6xl mb-4 block">✨</span>
                    <h2 className="text-2xl font-bold mb-3">Ready to explore?</h2>
                    <p className="text-neutral-400 mb-8">
                      Start planning your next adventure. I'll consider your preferences and create a personalized itinerary!
                    </p>

                    <div className="grid gap-3 max-w-2xl mx-auto">
                      {[
                        "Plan a 5-day trip to Goa from Mumbai under ₹30,000",
                        "Weekend getaway to Manali for adventure activities",
                        "Cultural tour of Rajasthan for 7 days"
                      ].map((example, idx) => (
                        <button
                          key={idx}
                          onClick={async () => {
                            setInput(example)
                            await sendPrompt(example, undefined, undefined)
                          }}
                          className="px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-left hover:border-teal-600/50 transition-colors text-sm"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {generatedPlan && (
                  <div className="space-y-4 w-full">
                    {/* Display user's message */}
                    {userPrompt && (
                      <div className="flex justify-end mb-4">
                        <div className="bg-teal-600 text-white rounded-2xl rounded-tr-sm px-6 py-3 max-w-[80%]">
                          <p className="text-sm font-medium mb-1">You asked:</p>
                          <p>{userPrompt}</p>
                        </div>
                      </div>
                    )}
                    
                    {viewingSavedTrip && (
                      <div className="bg-teal-900/20 border border-teal-600/30 rounded-lg p-4 mb-4">
                        <p className="text-teal-400 text-sm flex items-center gap-2">
                          <span>📋</span>
                          <span>You are viewing a saved trip. Click <strong>Edit</strong> to make changes or <strong>New Chat</strong> to plan a new trip.</span>
                        </p>
                      </div>
                    )}
                    <div className="flex justify-between items-center flex-wrap gap-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <span>✈️</span> {viewingSavedTrip ? 'Saved Itinerary' : 'Your Itinerary'}
                      </h3>
                      <div className="flex gap-2 flex-wrap">
                        {isEditMode ? (
                          <>
                            <button
                              onClick={async () => {
                                if (!currentTripId) {
                                  toast.error('No trip selected for editing')
                                  return
                                }
                                
                                try {
                                  const firebaseUser = auth.currentUser
                                  const token = firebaseUser ? await firebaseUser.getIdToken() : ''
                                  
                                  const response = await fetch(`http://localhost:8000/api/trip-plans/${currentTripId}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                      itinerary: editedPlan
                                    })
                                  })
                                  
                                  if (response.ok) {
                                    setGeneratedPlan(editedPlan)
                                    setIsEditMode(false)
                                    setCurrentTripId(null)
                                    toast.success('Trip updated successfully!')
                                    fetchMyTrips() // Refresh the trips list
                                  } else {
                                    toast.error('Failed to update trip')
                                  }
                                } catch (error) {
                                  console.error('Error updating trip:', error)
                                  toast.error('Failed to update trip')
                                }
                              }}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                            >
                              <span>💾</span> Save Changes
                            </button>
                            <button
                              onClick={() => {
                                setIsEditMode(false)
                                setEditedPlan('')
                                setCurrentTripId(null)
                                toast('Edit mode cancelled', { icon: '❌' })
                              }}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                            >
                              <span>❌</span> Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={handleSaveTrip}
                              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                            >
                              <span>💾</span> Save Trip
                            </button>
                            <button
                              onClick={() => {
                                const promptText = `Optimize my current day. I want to make the most of the remaining time today.`
                                setInput(promptText)
                                toast('Optimize your day! Add details like: current location, what you\'ve already done, remaining budget, time available, etc.', { 
                                  icon: '✨',
                                  duration: 6000 
                                })
                              }}
                              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                              title="Get AI-powered suggestions to optimize your current day based on location, time, and interests"
                            >
                              <span>✨</span> Optimize Today
                            </button>
                            <button
                              onClick={() => {
                                setGeneratedPlan('')
                                setPreviousExtraction(null)
                                setSelectedDay(null)
                                setIsEditMode(false)
                              }}
                              className="text-sm text-neutral-500 hover:text-teal-600 px-3"
                            >
                              Clear ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {totalDays > 0 && (
                      <div className="space-y-2">
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
                          {selectedDay && selectedDay !== 'overview' && (
                            <button
                              onClick={() => {
                                const promptText = `Optimize day ${selectedDay} of my current trip. I want to make the most of the remaining time today with activities that match my interests.`
                                setInput(promptText)
                                toast('Ready to optimize! Add any specific details (e.g., current location, what you\'ve already done, budget constraints) and hit Send.', { 
                                  icon: '✨',
                                  duration: 5000 
                                })
                              }}
                              className="px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all"
                            >
                              ✨ Optimize My Day
                            </button>
                          )}
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
                    
                    <div className="card p-6 w-full">
                      {isEditMode ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 p-3 rounded-lg">
                            <span>✏️</span>
                            <span className="text-sm font-medium">Edit Mode Active - Make your changes below</span>
                          </div>
                          <textarea
                            value={editedPlan}
                            onChange={(e) => setEditedPlan(e.target.value)}
                            className="w-full min-h-[500px] bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-teal-600 transition-colors resize-y"
                            placeholder="Edit your trip itinerary..."
                            style={{ 
                              lineHeight: '1.6',
                              fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace'
                            }}
                          />
                          <div className="text-xs text-neutral-500">
                            💡 Tip: You can edit the text directly. Changes will be saved when you click "Save Changes".
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="prose prose-invert max-w-none w-full"
                          style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                          dangerouslySetInnerHTML={{ 
                            __html: formatItinerary(filterByDays(generatedPlan)) 
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!viewingSavedTrip && (
              <div className="border-t border-neutral-800 bg-neutral-900/95 backdrop-blur-lg p-6 flex-shrink-0">
                <div className="max-w-4xl mx-auto">
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !isGenerating && handleSendMessage()}
                      placeholder="Describe your dream trip..."
                      disabled={isGenerating}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-6 py-4 text-white placeholder-neutral-500 focus:outline-none focus:border-teal-600 transition-colors disabled:opacity-50"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isGenerating}
                      className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                    >
                      {isGenerating ? (
                        <span className="flex items-center gap-2 justify-center">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                          <span>Generating...</span>
                        </span>
                      ) : 'Send →'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeView === 'foryou' && (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto">
              {forYouData && forYouData.recommendations ? (
                <>
                  <div className="text-center py-8 mb-8">
                    <span className="text-6xl mb-4 block">🎯</span>
                    <h2 className="text-2xl font-bold mb-3">Personalized For You</h2>
                    <p className="text-neutral-400">
                      Based on your {preferences?.travelStyle} travel style
                    </p>
                  </div>

                  <div className="grid gap-6">
                    {forYouData.recommendations.map((rec: any, idx: number) => (
                      <div key={idx} className="card p-6 hover:border-teal-600/50 transition-colors">
                        <div className="flex items-start gap-4 mb-4">
                          <span className="text-4xl">{rec.emoji || '✈️'}</span>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold mb-2">{rec.title || rec.destination}</h3>
                            <p className="text-neutral-400 text-sm mb-3">{rec.description}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {rec.category && (
                                <span className="px-3 py-1 bg-teal-600/20 text-teal-400 rounded-full text-xs">
                                  {rec.category}
                                </span>
                              )}
                              {rec.tags?.map((tag: string, i: number) => (
                                <span key={i} className="px-3 py-1 bg-teal-600/20 text-teal-400 rounded-full text-xs">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-neutral-500 mb-4">
                              <span>💰 {rec.price || rec.budget}</span>
                              {rec.location && <span>📍 {rec.location}</span>}
                              <span>⭐ {rec.rating}/5</span>
                            </div>

                            {/* Events Section */}
                            {rec.events && rec.events.length > 0 && (
                              <div className="mb-4">
                                <h4 className="text-sm font-semibold text-teal-400 mb-2">🎉 Upcoming Events</h4>
                                <div className="space-y-2">
                                  {rec.events.map((event: any, i: number) => (
                                    <div key={i} className="bg-neutral-800/50 p-3 rounded-lg">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="text-sm font-medium text-white">{event.name}</p>
                                          {event.date && <p className="text-xs text-neutral-400 mt-1">📅 {event.date}</p>}
                                        </div>
                                        {event.link && (
                                          <a 
                                            href={event.link} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-teal-400 hover:text-teal-300"
                                          >
                                            Details →
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Foods Section */}
                            {rec.foods && rec.foods.length > 0 && (
                              <div className="mb-4">
                                <h4 className="text-sm font-semibold text-teal-400 mb-2">🍽️ Special Foods</h4>
                                <div className="space-y-2">
                                  {rec.foods.map((food: any, i: number) => (
                                    <div key={i} className="bg-neutral-800/50 p-3 rounded-lg">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="text-sm font-medium text-white">
                                            {food.emoji || '🍴'} {food.name}
                                          </p>
                                        </div>
                                        {food.recipeLink && (
                                          <a 
                                            href={food.recipeLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-teal-400 hover:text-teal-300"
                                          >
                                            Recipe →
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            setActiveView('chat')
                            const p = `Plan a trip to ${rec.title || rec.destination}`
                            setInput(p)
                            // Send directly without date modal
                            await sendPrompt(p, undefined, undefined)
                          }}
                          className="btn-primary w-full py-2"
                        >
                          Plan This Trip →
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <span className="text-6xl mb-4 block">🎯</span>
                  <h2 className="text-2xl font-bold mb-3">Personalized For You</h2>
                  <p className="text-neutral-400 mb-8">
                    Loading personalized recommendations...
                  </p>
                  <button
                    onClick={fetchForYouData}
                    className="btn-primary px-6 py-3"
                  >
                    Load Recommendations
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === 'mytrips' && (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto">
              {myTripsData.length > 0 ? (
                <>
                  <div className="text-center py-8 mb-8">
                    <span className="text-6xl mb-4 block">🗺️</span>
                    <h2 className="text-2xl font-bold mb-3">Your Travel Collection</h2>
                    <p className="text-neutral-400">
                      {myTripsData.length} saved {myTripsData.length === 1 ? 'trip' : 'trips'}
                    </p>
                  </div>

                  <div className="grid gap-6">
                    {myTripsData.map((trip: any, idx: number) => (
                      <div key={idx} className="card p-6 hover:border-teal-600/50 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold mb-2">{trip.destination || 'Trip Plan'}</h3>
                            <p className="text-neutral-300 text-sm mb-4">{trip.itinerary?.slice(0, 150)}...</p>
                            {trip.dates && (
                              <p className="text-neutral-500 text-xs mb-2">📅 {trip.dates}</p>
                            )}
                            {trip.budget && (
                              <p className="text-neutral-500 text-xs">💰 Budget: ₹{trip.budget.toLocaleString()}</p>
                            )}
                          </div>
                          <span className="text-3xl ml-4">✈️</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <button 
                            onClick={() => {
                              // Clear any previous generation state
                              setIsGenerating(false)
                              setIsEditMode(false)
                              setCurrentTripId(trip.id)
                              setPreviousExtraction(null)
                              setInput('')
                              setSelectedDay(null) // Reset day filter
                              setUserPrompt('') // Clear user message when viewing saved trip
                              
                              // Get the itinerary and filter out any generation messages
                              let planToDisplay = trip.itinerary || ''
                              
                              // If the plan is just a generation message, don't display it
                              if (planToDisplay.includes('Generating your personalized itinerary') ||
                                  planToDisplay.includes('Need more information') ||
                                  planToDisplay.length < 50) {
                                toast.error('This trip has no saved itinerary')
                                return
                              }
                              
                              // Mark that we're viewing a saved trip
                              setViewingSavedTrip(true)
                              setCurrentTripTitle(trip.destination || 'Trip Plan')
                              
                              // Set the saved plan
                              setGeneratedPlan(planToDisplay)
                              // Switch to chat view to display the plan
                              setActiveView('chat')
                            }}
                            className="btn-primary py-2 text-sm"
                          >
                            📋 View
                          </button>
                          <button 
                            onClick={() => {
                              setActiveView('chat')
                              setGeneratedPlan(trip.itinerary || '')
                              setEditedPlan(trip.itinerary || '')
                              setCurrentTripId(trip.id)
                              setIsEditMode(true)
                              toast('Edit mode activated! Make changes and click "Save Changes"', { 
                                icon: '✏️',
                                duration: 4000 
                              })
                            }}
                            className="bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded-lg text-sm transition-colors"
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            onClick={async () => {
                              try {
                                const firebaseUser = auth.currentUser
                                const token = firebaseUser ? await firebaseUser.getIdToken() : ''
                                
                                toast.loading('Opening Voyage Board...')
                                
                                // Check if board exists for this trip
                                const checkResponse = await fetch(`http://localhost:8000/api/voyage-board/trip/${trip.id}`, {
                                  headers: {
                                    'Authorization': `Bearer ${token}`
                                  }
                                })
                                
                                if (checkResponse.status === 404) {
                                  // Board doesn't exist, create it
                                  toast.dismiss()
                                  toast.loading('Creating collaboration board...')
                                  
                                  const createResponse = await fetch('http://localhost:8000/api/voyage-board', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                      trip_id: trip.id,
                                      board_name: trip.destination || 'Trip Collaboration Board',
                                      description: `Collaborate on ${trip.destination || 'this trip'}`,
                                      is_public: false
                                    })
                                  })
                                  
                                  if (createResponse.ok) {
                                    const data = await createResponse.json()
                                    toast.dismiss()
                                    toast.success('Board created! Opening...')
                                    
                                    // Navigate immediately - the board should exist now
                                    setTimeout(() => {
                                      navigate(`/voyage-board/${data.board.board_id}`)
                                    }, 1500)
                                  } else {
                                    toast.dismiss()
                                    const errorData = await createResponse.json().catch(() => ({}))
                                    console.error('Board creation failed:', errorData)
                                    toast.error(errorData.detail || 'Failed to create board')
                                  }
                                } else if (checkResponse.ok) {
                                  // Board exists, navigate to it
                                  const boardData = await checkResponse.json()
                                  toast.dismiss()
                                  toast.success('Opening board...')
                                  navigate(`/voyage-board/${boardData.board.board_id}`)
                                } else {
                                  toast.dismiss()
                                  toast.error('Failed to access board')
                                }
                              } catch (error) {
                                console.error('Error accessing board:', error)
                                toast.dismiss()
                                toast.error('Failed to access board')
                              }
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm transition-colors font-semibold"
                          >
                            💬 Discuss
                          </button>
                          <button 
                            onClick={async () => {
                              try {
                                const firebaseUser = auth.currentUser
                                const token = firebaseUser ? await firebaseUser.getIdToken() : ''
                                
                                toast.loading('Opening Voyage Board...')
                                
                                // Check if board exists for this trip
                                const checkResponse = await fetch(`http://localhost:8000/api/voyage-board/trip/${trip.id}`, {
                                  headers: {
                                    'Authorization': `Bearer ${token}`
                                  }
                                })
                                
                                if (checkResponse.status === 404) {
                                  // Board doesn't exist, create it
                                  toast.dismiss()
                                  toast.loading('Creating collaboration board...')
                                  
                                  const createResponse = await fetch('http://localhost:8000/api/voyage-board', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                      trip_id: trip.id,
                                      board_name: trip.destination || 'Trip Collaboration Board',
                                      description: `Collaborate on ${trip.destination || 'this trip'}`,
                                      is_public: false
                                    })
                                  })
                                  
                                  if (createResponse.ok) {
                                    const data = await createResponse.json()
                                    toast.dismiss()
                                    toast.success('Board created! Opening...')
                                    
                                    // Navigate immediately - the board should exist now
                                    setTimeout(() => {
                                      navigate(`/voyage-board/${data.board.board_id}`)
                                    }, 1500)
                                  } else {
                                    toast.dismiss()
                                    const errorData = await createResponse.json().catch(() => ({}))
                                    console.error('Board creation failed:', errorData)
                                    toast.error(errorData.detail || 'Failed to create board')
                                  }
                                } else if (checkResponse.ok) {
                                  // Board exists, navigate to it
                                  const boardData = await checkResponse.json()
                                  toast.dismiss()
                                  toast.success('Opening board...')
                                  navigate(`/voyage-board/${boardData.board.board_id}`)
                                } else {
                                  toast.dismiss()
                                  toast.error('Failed to access board')
                                }
                              } catch (error) {
                                console.error('Error accessing board:', error)
                                toast.dismiss()
                                toast.error('Failed to access board')
                              }
                            }}
                            className="bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-sm transition-colors font-semibold"
                          >
                            🗳️ Vote
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                          {(() => {
                            // Check if trip has started
                            const isTripStarted = trip.start_date ? new Date(trip.start_date) <= new Date() : false
                            return isTripStarted ? (
                              <button 
                                onClick={() => navigate(`/expense-tracker/${trip.id}`)}
                                className="bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded-lg text-sm transition-colors"
                              >
                                💰 Expenses
                              </button>
                            ) : (
                              <button 
                                disabled
                                className="bg-neutral-800/50 text-neutral-500 py-2 rounded-lg text-sm cursor-not-allowed"
                                title="Available after trip starts"
                              >
                                💰 Expenses
                              </button>
                            )
                          })()}
                          <button 
                            onClick={async () => {
                              try {
                                const firebaseUser = auth.currentUser
                                const token = firebaseUser ? await firebaseUser.getIdToken() : ''
                                
                                toast.loading('Generating calendar file...')
                                
                                // Create calendar event and download ICS file
                                const response = await fetch('http://localhost:8000/api/calendar/export', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                  },
                                  body: JSON.stringify({
                                    trip_id: trip.id,
                                    destination: trip.destination,
                                    start_date: trip.start_date || new Date().toISOString().split('T')[0],
                                    end_date: trip.end_date,
                                    itinerary: trip.itinerary
                                  })
                                })
                                
                                if (response.ok) {
                                  // Fetch the ICS file as blob
                                  const downloadResponse = await fetch(`http://localhost:8000/api/download-calendar/${trip.id}.ics`, {
                                    headers: {
                                      'Authorization': `Bearer ${token}`
                                    }
                                  })
                                  
                                  if (downloadResponse.ok) {
                                    const blob = await downloadResponse.blob()
                                    const url = window.URL.createObjectURL(blob)
                                    const link = document.createElement('a')
                                    link.href = url
                                    link.download = `voyage-trip-${trip.destination || 'itinerary'}.ics`
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                    window.URL.revokeObjectURL(url)
                                    
                                    toast.dismiss()
                                    toast.success('Calendar file downloaded! Check your downloads folder.')
                                  } else {
                                    toast.dismiss()
                                    toast.error('Failed to download calendar file')
                                  }
                                } else {
                                  toast.dismiss()
                                  toast.error('Failed to export calendar')
                                }
                              } catch (error) {
                                console.error('Calendar export error:', error)
                                toast.dismiss()
                                toast.error('Failed to export calendar')
                              }
                            }}
                            className="bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded-lg text-sm transition-colors"
                          >
                            📅 Calendar
                          </button>
                        </div>
                        <button 
                          onClick={async () => {
                            if (confirm('Are you sure you want to delete this trip?')) {
                              try {
                                const firebaseUser = auth.currentUser
                                const token = firebaseUser ? await firebaseUser.getIdToken() : ''
                                
                                const response = await fetch(`http://localhost:8000/api/trip-plans/${trip.id}`, {
                                  method: 'DELETE',
                                  headers: {
                                    'Authorization': `Bearer ${token}`
                                  }
                                })
                                
                                if (response.ok) {
                                  toast.success('Trip deleted')
                                  fetchMyTrips()
                                } else {
                                  toast.error('Failed to delete trip')
                                }
                              } catch (error) {
                                toast.error('Failed to delete trip')
                              }
                            }
                          }}
                          className="mt-3 w-full text-red-500 hover:text-red-400 text-xs font-semibold"
                        >
                          🗑️ Delete Trip
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <span className="text-6xl mb-4 block">🗺️</span>
                  <h2 className="text-2xl font-bold mb-3">Your Travel Collection</h2>
                  <p className="text-neutral-400 mb-8">
                    No saved trips yet. Start planning to see them here!
                  </p>
                  <button 
                    onClick={() => setActiveView('chat')}
                    className="btn-primary px-6 py-3"
                  >
                    Plan Your First Trip →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Date modal for planning */}
        {showDateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowDateModal(false)} />
            <div className="relative bg-neutral-900 border border-neutral-800 rounded-lg p-6 w-full max-w-md z-10">
              <h3 className="text-lg font-bold mb-3">When are you traveling?</h3>
              <p className="text-sm text-neutral-400 mb-4">Please pick start and end dates for your trip so I can build a date-aware itinerary.</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-neutral-400">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400">End date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowDateModal(false); setPendingPrompt(null); }} className="px-4 py-2 text-sm text-neutral-300 hover:text-white">
                  Cancel
                </button>
                <button onClick={confirmDatesAndSend} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm text-white">
                  Confirm & Plan
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

export default DashboardPage
