import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.ts'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase.ts'
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
  const [isLoadingForYou, setIsLoadingForYou] = useState(false)
  const [isLoadingTrips, setIsLoadingTrips] = useState(false)

  // Protect route - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      console.log('⚠️ No user found on dashboard, redirecting to login')
      toast.error('Please log in first')
      navigate('/login')
    } else if (user) {
      console.log('✅ User on dashboard:', user.uid)
      console.log('📋 User preferences:', preferences)
      
      // Load trips from localStorage
      const savedTrips = JSON.parse(localStorage.getItem('myTrips') || '[]')
      setMyTripsData(savedTrips)
    }
  }, [user, loading, navigate, preferences])

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (chatAreaRef.current && generatedPlan) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight
    }
  }, [generatedPlan])

  // Detect number of days in the itinerary
  useEffect(() => {
    if (generatedPlan) {
      const dayMatches = generatedPlan.match(/Day \d+/gi)
      if (dayMatches) {
        const days = dayMatches.map(d => parseInt(d.replace(/Day /i, '')))
        const maxDay = Math.max(...days)
        setTotalDays(maxDay)
        setSelectedDay(null) // Reset selection when new plan is generated
      }
    }
  }, [generatedPlan])

  // Format itinerary with HTML for better display
  const formatItinerary = (text: string): string => {
    if (!text) return ''
    
    // Convert markdown-style formatting to HTML
    let formatted = text
      // Headers with **text**
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-red-500">$1</strong>')
      // Day headers (Day 1, Day 2, etc.)
      .replace(/^(Day \d+:.+)$/gm, '<h3 class="text-xl font-bold text-white mt-6 mb-3">$1</h3>')
      // Section headers (##)
      .replace(/^## (.+)$/gm, '<h3 class="text-lg font-bold text-red-400 mt-4 mb-2">$1</h3>')
      // Bullet points with - or •
      .replace(/^[-•] (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
      // Numbered lists
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
      // Emoji bullets
      .replace(/^([🏨🍽️✈️🚗🎯💰📍🗓️⏰🌟].+)$/gm, '<p class="ml-2 mb-2">$1</p>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p class="mb-3">')
      // Line breaks
      .replace(/\n/g, '<br>')
    
    // Wrap in paragraph tags
    formatted = '<p class="mb-3">' + formatted + '</p>'
    
    // Wrap consecutive <li> in <ul>
    formatted = formatted.replace(/(<li.+?<\/li>(?:<br>)?)+/gs, (match) => {
      return '<ul class="list-disc list-inside space-y-1 mb-4">' + match.replace(/<br>/g, '') + '</ul>'
    })
    
    return formatted
  }

  // Filter itinerary content based on selected filter
  const filterItinerary = (text: string, filter: string): string => {
    if (filter === 'all') return text

    const lines = text.split('\n')
    const filteredLines: string[] = []
    let includeSection = false
    let currentDay = ''

    for (const line of lines) {
      // Check for day headers
      if (line.match(/^Day \d+:/i)) {
        currentDay = line
        filteredLines.push(line)
        continue
      }

      // Check section headers and content
      if (filter === 'accommodation' && (
        line.match(/🏨|accommodation|hotel|resort|stay/i)
      )) {
        includeSection = true
        filteredLines.push(line)
      } else if (filter === 'food' && (
        line.match(/🍽️|food|breakfast|lunch|dinner|restaurant|cafe|meal/i)
      )) {
        includeSection = true
        filteredLines.push(line)
      } else if (filter === 'transport' && (
        line.match(/✈️|🚗|transport|flight|taxi|bus|train|travel|getting/i)
      )) {
        includeSection = true
        filteredLines.push(line)
      } else if (filter === 'activities' && (
        line.match(/🎯|activity|activities|visit|explore|experience|attraction|adventure/i)
      )) {
        includeSection = true
        filteredLines.push(line)
      } else if (includeSection && line.trim() !== '' && !line.match(/^(Day \d+|🏨|🍽️|✈️|🚗)/)) {
        // Include following lines until next section
        filteredLines.push(line)
      } else if (line.match(/^(Day \d+|🏨|🍽️|✈️|🚗)/)) {
        includeSection = false
      }
    }

    return filteredLines.join('\n') || `No ${filter} information found in the itinerary.`
  }

  // Filter by selected day
  const filterByDays = (text: string): string => {
    if (selectedDay === null) return text // Show all if no day selected
    
    if (selectedDay === 'overview') {
      // Extract overview/summary information ONLY
      const sections = text.split(/(?=Day \d+)/i)
      const overviewSections: string[] = []
      
      // Get intro/overview section (before first Day)
      if (sections[0] && !sections[0].match(/^Day \d+/i)) {
        overviewSections.push(sections[0])
      }
      
      // Extract key highlights from each day
      const dayHighlights: string[] = []
      sections.forEach(section => {
        const dayMatch = section.match(/Day (\d+)/i)
        if (dayMatch) {
          const dayNum = parseInt(dayMatch[1])
          // Extract first line or two from each day as summary
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

    // For specific day selection - ONLY show that day (no intro)
    const sections = text.split(/(?=Day \d+)/i)
    const filteredSections: string[] = []

    // Find and show ONLY the selected day
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

  // Select a specific day (one at a time)
  const selectDay = (day: number | 'overview') => {
    setSelectedDay(day === selectedDay ? null : day) // Toggle off if clicking same day
  }

  // Show all days
  const showAllDays = () => {
    setSelectedDay(null)
  }

  // Fetch For You recommendations
  const fetchForYouData = async () => {
    if (!user) return
    
    setIsLoadingForYou(true)
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const response = await fetch('/api/for-you', {
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
    } finally {
      setIsLoadingForYou(false)
    }
  }

  // Fetch My Trips
  const fetchMyTrips = async () => {
    if (!user) return
    
    setIsLoadingTrips(true)
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const response = await fetch('/api/trip-plans', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setMyTripsData(data)
      }
    } catch (error) {
      console.error('Error fetching trips:', error)
      toast.error('Failed to load trips')
    } finally {
      setIsLoadingTrips(false)
    }
  }

  // Load data when switching views
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

  const handleSendMessage = async () => {
    if (!input.trim() || !user) return
    
    setIsGenerating(true)
    setGeneratedPlan('Generating your personalized itinerary...')
    
    try {
      // Get Firebase ID token for authentication
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const response = await fetch('/api/plan-trip-from-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: input,
          previous_extraction: previousExtraction
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate trip plan')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setGeneratedPlan(data.trip_plan)
        toast.success('Trip plan generated!')
        setPreviousExtraction(null) // Reset for next trip
        setInput('') // Clear input
      } else if (data.message === 'Need more information') {
        // Backend needs more info - display the follow-up questions
        setGeneratedPlan(data.trip_plan)
        toast('Please provide more details', { icon: '💬' })
        // Save the extraction for the next request
        setPreviousExtraction(data.extracted_details)
        setInput('') // Clear input so user can type their answer
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

  const handleNewChat = () => {
    setGeneratedPlan('')
    setPreviousExtraction(null)
    setInput('')
    setActiveView('chat')
    toast.success('Started new chat')
  }

  const handleSaveTrip = async () => {
    if (!user || !generatedPlan) return
    
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      // Extract destination from the plan (simple extraction from first line)
      const firstLine = generatedPlan.split('\n')[0]
      const destinationMatch = firstLine.match(/to (.+?)(?:\s|$|,)/i)
      const destination = destinationMatch ? destinationMatch[1] : 'Trip Plan'
      
      const response = await fetch('/api/trip-plans', {
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
        // Refresh trips if on My Trips view
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
      {/* Sidebar */}
      <aside className="w-80 bg-neutral-900 border-r border-neutral-800 flex flex-col overflow-y-auto">
        {/* Logo */}
        <div className="p-6 border-b border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-3xl">✈️</span>
            <span className="text-2xl font-bold gradient-text">Voyage</span>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-b border-neutral-800 flex-shrink-0">
          <button 
            onClick={handleNewChat}
            className="w-full btn-primary py-3 flex items-center justify-center gap-2"
          >
            <span>✨</span>
            <span>New Chat</span>
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="p-4 border-b border-neutral-800 flex-shrink-0">
          <nav className="space-y-2">
            <button 
              onClick={() => setActiveView('foryou')}
              className={`w-full px-4 py-3 rounded-lg font-semibold flex items-center gap-3 transition-colors ${
                activeView === 'foryou' 
                  ? 'bg-red-600/10 border border-red-600/30 text-red-500' 
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
                  ? 'bg-red-600/10 border border-red-600/30 text-red-500' 
                  : 'bg-neutral-800/50 border border-neutral-700 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <span className="text-xl">🗺️</span>
              <span>My Trips</span>
            </button>
          </nav>
        </div>

        {/* User Preferences */}
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
              className="mt-4 w-full text-red-600 hover:text-red-500 text-xs font-semibold"
            >
              Update Profile →
            </button>
          </div>
        )}

        {/* Spacer to push user profile and logout to bottom */}
        <div className="flex-1"></div>

        {/* User Profile */}
        <div className="p-6 border-t border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-xl font-bold">
              {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-semibold text-white truncate">{user?.displayName || 'Traveler'}</p>
              <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Logout Button at Bottom */}
        <div className="px-6 pb-6 flex-shrink-0">
          <button onClick={handleLogout} className="w-full btn-secondary py-3 text-sm font-semibold">
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-black/80 backdrop-blur-lg border-b border-neutral-800 px-8 py-4 flex-shrink-0">
          <h1 className="text-2xl font-bold">
            {activeView === 'chat' && (
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
            {activeView === 'chat' && "Tell me your destination, budget, and dates - I'll create your perfect itinerary"}
            {activeView === 'foryou' && "Personalized recommendations based on your travel preferences"}
            {activeView === 'mytrips' && "View and manage all your saved trips"}
          </p>
        </header>

        {/* Chat View */}
        {activeView === 'chat' && (
          <>
            {/* Chat Area - Scrollable */}
            <div ref={chatAreaRef} className="flex-1 overflow-y-auto p-8" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              <div className="max-w-4xl mx-auto space-y-6 pb-6">
                {/* Welcome Message */}
                {!generatedPlan && (
                  <div className="text-center py-12">
                    <span className="text-6xl mb-4 block">✨</span>
                    <h2 className="text-2xl font-bold mb-3">Ready to explore?</h2>
                    <p className="text-neutral-400 mb-8">
                      Start planning your next adventure. I'll consider your preferences and create a personalized itinerary!
                    </p>

                    {/* Example Prompts */}
                    <div className="grid gap-3 max-w-2xl mx-auto">
                      {[
                        "Plan a 5-day trip to Goa from Mumbai under ₹30,000",
                        "Weekend getaway to Manali for adventure activities",
                        "Cultural tour of Rajasthan for 7 days"
                      ].map((example, idx) => (
                        <button
                          key={idx}
                          onClick={() => setInput(example)}
                          className="px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-left hover:border-red-600/50 transition-colors text-sm"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generated Plan Display */}
                {generatedPlan && (
                  <div className="space-y-4 w-full">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <span>✈️</span> Your Itinerary
                      </h3>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={handleSaveTrip}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                          <span>💾</span> Save Trip
                        </button>
                        <button
                          onClick={() => {
                            // Add to Google Calendar
                            const title = `Trip Itinerary - ${generatedPlan.split('\n')[0].replace(/[#*]/g, '').trim()}`
                            const details = generatedPlan.slice(0, 500) + '...'
                            const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}`
                            window.open(calendarUrl, '_blank')
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                          <span>📅</span> Add to Calendar
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              // Create Voyage Board for collaborative planning
                              const user = JSON.parse(localStorage.getItem('user') || '{}')
                              const tripName = `${user.displayName || user.email}'s Trip`
                              
                              const response = await fetch('http://localhost:8000/api/voyage-board/create', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                                },
                                body: JSON.stringify({
                                  trip_id: `trip_${Date.now()}`,
                                  owner_id: user.uid,
                                  owner_email: user.email,
                                  owner_name: user.displayName || user.email,
                                  board_name: tripName,
                                  description: generatedPlan.slice(0, 200) + '...',
                                  is_public: false
                                })
                              })

                              if (response.ok) {
                                const data = await response.json()
                                const shareLink = `${window.location.origin}/board/${data.board_id}`
                                
                                // Copy share link
                                navigator.clipboard.writeText(shareLink)
                                toast.success('🎉 Voyage Board created! Share link copied to clipboard.')
                                
                                // Open the board
                                window.open(shareLink, '_blank')
                              } else {
                                toast.error('Failed to create Voyage Board')
                              }
                            } catch (error) {
                              console.error('Error creating Voyage Board:', error)
                              toast.error('Error creating Voyage Board')
                            }
                          }}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                          <span>🔗</span> Share Voyage Board
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              // Mark trip as started with current date
                              const tripData = {
                                trip_id: `trip_${Date.now()}`,
                                user_id: user?.uid,
                                destination: generatedPlan.split('\n')[0] || 'My Trip',
                                itinerary: generatedPlan,
                                start_date: new Date().toISOString(),
                                created_at: new Date().toISOString()
                              }
                              
                              // Add to myTripsData
                              setMyTripsData(prev => [...prev, tripData])
                              
                              // Save to localStorage
                              const existingTrips = JSON.parse(localStorage.getItem('myTrips') || '[]')
                              existingTrips.push(tripData)
                              localStorage.setItem('myTrips', JSON.stringify(existingTrips))
                              
                              toast.success('🚀 Trip started! Optimize My Day and Expense Tracker are now available.')
                            } catch (error) {
                              console.error('Error starting trip:', error)
                              toast.error('Failed to start trip')
                            }
                          }}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                          <span>🚀</span> Start Trip
                        </button>
                        <button
                          onClick={() => {
                            setGeneratedPlan('')
                            setPreviousExtraction(null)
                            setSelectedDay(null)
                          }}
                          className="text-sm text-neutral-500 hover:text-red-600 px-3"
                        >
                          Clear ✕
                        </button>
                      </div>
                    </div>

                    {/* Day Filter Buttons */}
                    {totalDays > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-neutral-400">View:</span>
                          <button
                            onClick={showAllDays}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              selectedDay === null
                                ? 'bg-red-600 text-white'
                                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                            }`}
                          >
                            📄 Full Plan
                          </button>
                          <button
                            onClick={() => selectDay('overview')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              selectedDay === 'overview'
                                ? 'bg-red-600 text-white'
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
                                  ? 'bg-red-600 text-white'
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
                      <div 
                        className="prose prose-invert max-w-none w-full"
                        style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                        dangerouslySetInnerHTML={{ 
                          __html: formatItinerary(filterByDays(generatedPlan)) 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area - Fixed at Bottom */}
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
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-6 py-4 text-white placeholder-neutral-500 focus:outline-none focus:border-red-600 transition-colors disabled:opacity-50"
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
          </>
        )}

        {/* For You View */}
        {activeView === 'foryou' && (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto">
              {isLoadingForYou ? (
                <div className="text-center py-12">
                  <svg className="animate-spin h-12 w-12 mx-auto mb-4 text-red-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <p className="text-neutral-400">Loading recommendations...</p>
                </div>
              ) : forYouData ? (
                <>
                  <div className="text-center py-8">
                    <span className="text-6xl mb-4 block">🎯</span>
                    <h2 className="text-2xl font-bold mb-3">Personalized For You</h2>
                    <p className="text-neutral-400 mb-8">
                      {forYouData.message || 'Discover destinations tailored to your preferences'}
                    </p>
                  </div>

                  {/* Recommendations */}
                  {forYouData.suggestions && forYouData.suggestions.length > 0 ? (
                    <div className="space-y-8">
                      {forYouData.suggestions.map((rec: any, idx: number) => (
                        <div key={idx} className="card overflow-hidden hover:border-red-600/50 transition-all group">
                          {/* Content */}
                          <div className="p-6">
                            {/* Large Emoji Header */}
                            <div className="flex flex-col items-center text-center mb-4">
                              <div className="text-8xl mb-4 group-hover:scale-110 transition-transform duration-300">
                                {rec.emoji || '✈️'}
                              </div>
                              {rec.category && (
                                <div className="bg-red-600/20 border border-red-600/30 px-3 py-1 rounded-full text-sm font-semibold mb-2">
                                  {rec.category}
                                </div>
                              )}
                              {rec.rating && (
                                <div className="bg-neutral-800 px-3 py-1 rounded-full text-sm">
                                  ⭐ {rec.rating}
                                </div>
                              )}
                            </div>
                            <h3 className="text-3xl font-bold mb-2 text-center">{rec.title || rec.destination}</h3>
                            <p className="text-neutral-400 text-sm mb-4 text-center">{rec.description}</p>
                            
                            {/* Price */}
                            {rec.price && (
                              <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800">
                                <span className="text-neutral-400 text-sm">Starting from</span>
                                <span className="text-2xl font-bold text-red-500">₹{rec.price.toLocaleString()}</span>
                              </div>
                            )}

                            {/* Events Section */}
                            {rec.events && rec.events.length > 0 && (
                              <div className="mb-6">
                                <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                  <span>🎉</span> Upcoming Events
                                </h4>
                                <div className="space-y-3">
                                  {rec.events.map((event: any, eventIdx: number) => (
                                    <div key={eventIdx} className="bg-neutral-900/50 rounded-lg p-3 border border-neutral-800 hover:border-red-600/50 transition-colors">
                                      <div className="flex justify-between items-start mb-1">
                                        <h5 className="font-semibold text-white">{event.name}</h5>
                                        <span className="text-xs text-red-400 font-medium">{event.date}</span>
                                      </div>
                                      <p className="text-sm text-neutral-400 mb-2">{event.description}</p>
                                      {event.link && (
                                        <a 
                                          href={event.link} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1"
                                        >
                                          View Event Details →
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Foods Section */}
                            {rec.foods && rec.foods.length > 0 && (
                              <div className="mb-6">
                                <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                  <span>🍽️</span> Must-Try Foods
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                  {rec.foods.map((food: any, foodIdx: number) => (
                                    <div key={foodIdx} className="group/food relative overflow-hidden rounded-lg border border-neutral-800 hover:border-red-600/50 transition-colors p-4">
                                      <div className="text-center mb-2">
                                        <div className="text-5xl mb-2 group-hover/food:scale-110 transition-transform duration-300">
                                          {food.emoji || '🍽️'}
                                        </div>
                                      </div>
                                      <h5 className="font-semibold text-sm mb-1 text-center">{food.name}</h5>
                                      <p className="text-xs text-neutral-400 mb-2 text-center">{food.description}</p>
                                      {food.recipeLink && (
                                        <a 
                                          href={food.recipeLink} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 justify-center"
                                        >
                                          Recipe/Info →
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="space-y-3">
                              {/* Plan Trip Button */}
                              <button 
                                onClick={() => {
                                  setActiveView('chat')
                                  setInput(`Plan a trip to ${rec.location || rec.destination || rec.title}`)
                                }}
                                className="btn-primary w-full py-3 text-lg font-semibold"
                              >
                                Plan Your Trip →
                              </button>

                              {/* Secondary Actions Row */}
                              <div className="grid grid-cols-2 gap-2">
                                {/* Add to Calendar */}
                                <button 
                                  onClick={() => {
                                    // Create calendar event
                                    const title = `Trip to ${rec.location || rec.title}`
                                    const details = rec.description || ''
                                    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}`
                                    window.open(calendarUrl, '_blank')
                                  }}
                                  className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-sm border border-neutral-700 hover:border-red-600/50"
                                >
                                  <span>📅</span>
                                  <span className="hidden sm:inline">Calendar</span>
                                </button>

                                {/* Share */}
                                <button 
                                  onClick={() => {
                                    const shareText = `Check out this amazing destination: ${rec.title || rec.destination}\n${rec.description}\nPrice: ₹${rec.price?.toLocaleString()}`
                                    if (navigator.share) {
                                      navigator.share({
                                        title: rec.title || rec.destination,
                                        text: shareText,
                                      }).catch(() => {})
                                    } else {
                                      navigator.clipboard.writeText(shareText)
                                      alert('Copied to clipboard!')
                                    }
                                  }}
                                  className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-sm border border-neutral-700 hover:border-red-600/50"
                                >
                                  <span>🔗</span>
                                  <span className="hidden sm:inline">Share</span>
                                </button>
                              </div>

                              {/* Trip Started Features - Only show if trip has started */}
                              {(() => {
                                // Check if this destination matches a planned trip that has started
                                const matchingTrip = myTripsData.find((trip: any) => 
                                  trip.destination?.toLowerCase().includes(rec.location?.toLowerCase()) ||
                                  rec.location?.toLowerCase().includes(trip.destination?.toLowerCase())
                                )
                                
                                if (matchingTrip && matchingTrip.start_date) {
                                  const tripStartDate = new Date(matchingTrip.start_date)
                                  const today = new Date()
                                  today.setHours(0, 0, 0, 0)
                                  tripStartDate.setHours(0, 0, 0, 0)
                                  
                                  const tripHasStarted = today >= tripStartDate
                                  
                                  if (tripHasStarted) {
                                    return (
                                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800">
                                        {/* Optimize My Day */}
                                        <button 
                                          onClick={() => {
                                            setActiveView('chat')
                                            setInput(`Optimize my day for ${rec.location || rec.title} trip`)
                                          }}
                                          className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-900/20 hover:bg-blue-900/30 rounded-lg transition-colors text-sm border border-blue-600/50 hover:border-blue-500 text-blue-400"
                                        >
                                          <span>⚡</span>
                                          <span className="hidden sm:inline">Optimize Day</span>
                                        </button>

                                        {/* Expense Tracker */}
                                        <button 
                                          onClick={() => {
                                            // Navigate to dedicated expense tracker page
                                            if (matchingTrip?.trip_id) {
                                              navigate(`/trip/${matchingTrip.trip_id}/expenses`)
                                            } else {
                                              toast.error('Trip ID not found. Please plan this trip first.')
                                            }
                                          }}
                                          className="flex items-center justify-center gap-2 px-3 py-2 bg-green-900/20 hover:bg-green-900/30 rounded-lg transition-colors text-sm border border-green-600/50 hover:border-green-500 text-green-400"
                                        >
                                          <span>💰</span>
                                          <span className="hidden sm:inline">Expenses</span>
                                        </button>
                                      </div>
                                    )
                                  }
                                }
                                return null
                              })()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-neutral-400 mb-4">
                        No recommendations available yet. Plan some trips to get personalized suggestions!
                      </p>
                      <button 
                        onClick={() => setActiveView('chat')}
                        className="btn-primary px-6 py-3"
                      >
                        Start Planning →
                      </button>
                    </div>
                  )}

                  {/* Trending Section */}
                  {forYouData.trending && forYouData.trending.length > 0 && (
                    <div className="mt-12">
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span>🔥</span> Trending Now
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {forYouData.trending.map((trend: any, idx: number) => (
                          <div key={idx} className="card p-4">
                            <h4 className="font-bold mb-1">{trend.name}</h4>
                            <p className="text-sm text-neutral-400 mb-3">{trend.description}</p>
                            <button 
                              onClick={() => {
                                setActiveView('chat')
                                setInput(`Tell me about ${trend.name}`)
                              }}
                              className="text-sm text-red-500 hover:text-red-400"
                            >
                              Learn More →
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <span className="text-6xl mb-4 block">🎯</span>
                  <h2 className="text-2xl font-bold mb-3">Personalized Recommendations</h2>
                  <p className="text-neutral-400 mb-8">
                    {preferences 
                      ? 'Loading your personalized recommendations...'
                      : 'Complete your profile to get personalized recommendations'}
                  </p>
                  {!preferences && (
                    <button onClick={() => navigate('/profile-quiz')} className="btn-primary px-6 py-3">
                      Complete Profile →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* My Trips View */}
        {activeView === 'mytrips' && (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto">
              {isLoadingTrips ? (
                <div className="text-center py-12">
                  <svg className="animate-spin h-12 w-12 mx-auto mb-4 text-red-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <p className="text-neutral-400">Loading your trips...</p>
                </div>
              ) : myTripsData.length > 0 ? (
                <>
                  <div className="text-center py-8 mb-8">
                    <span className="text-6xl mb-4 block">🗺️</span>
                    <h2 className="text-2xl font-bold mb-3">Your Travel Collection</h2>
                    <p className="text-neutral-400">
                      {myTripsData.length} saved {myTripsData.length === 1 ? 'trip' : 'trips'}
                    </p>
                  </div>

                  {/* Trip Cards */}
                  <div className="grid gap-6">
                    {myTripsData.map((trip: any) => (
                      <div key={trip.id} className="card p-6 hover:border-red-600/50 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold mb-2">{trip.destination || 'Trip Plan'}</h3>
                            <div className="flex flex-wrap gap-3 text-sm text-neutral-400 mb-3">
                              {trip.start_date && (
                                <span className="flex items-center gap-1">
                                  <span>📅</span>
                                  {new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}
                                </span>
                              )}
                              {trip.budget && (
                                <span className="flex items-center gap-1">
                                  <span>💰</span>
                                  ₹{trip.budget.toLocaleString()}
                                </span>
                              )}
                              {trip.duration && (
                                <span className="flex items-center gap-1">
                                  <span>⏰</span>
                                  {trip.duration} days
                                </span>
                              )}
                            </div>
                            {trip.description && (
                              <p className="text-neutral-300 text-sm mb-4">{trip.description.slice(0, 150)}...</p>
                            )}
                            {trip.status && (
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                trip.status === 'completed' ? 'bg-green-600/20 text-green-500' :
                                trip.status === 'upcoming' ? 'bg-blue-600/20 text-blue-500' :
                                'bg-neutral-800 text-neutral-400'
                              }`}>
                                {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                              </span>
                            )}
                          </div>
                          <span className="text-3xl ml-4">
                            {trip.emoji || '✈️'}
                          </span>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => {
                              setActiveView('chat')
                              setGeneratedPlan(trip.itinerary || trip.plan || '')
                            }}
                            className="btn-primary flex-1 py-2"
                          >
                            View Details
                          </button>
                          <button className="btn-secondary px-6 py-2">
                            Edit
                          </button>
                          <button className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm transition-colors">
                            🗑️
                          </button>
                        </div>
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
      </main>
    </div>
  )
}

export default DashboardPage
