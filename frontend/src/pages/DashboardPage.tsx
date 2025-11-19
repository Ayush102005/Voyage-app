import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import toast from 'react-hot-toast'
import NotificationBell from '../components/NotificationBell'

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
  const [currentTripId, setCurrentTripId] = useState<string | null>(null)
  const [viewingSavedTrip, setViewingSavedTrip] = useState(false)
  const [currentTripTitle, setCurrentTripTitle] = useState('')
  // Chat history to show conversation flow
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([])  
  // AI Edit Trip state
  const [showAIEditModal, setShowAIEditModal] = useState(false)
  const [aiEditPrompt, setAiEditPrompt] = useState('')
  const [isReplanning, setIsReplanning] = useState(false)
  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
      // Convert ALL markdown links to open in new tab (external links)
      .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-teal-400 hover:text-teal-300 underline">$1</a>')
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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      
      // Add cache buster to force fresh data
      const cacheBuster = new Date().getTime()
      const response = await fetch(`${apiUrl}/api/for-you?refresh=true&_=${cacheBuster}`, {
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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      
      const response = await fetch(`${apiUrl}/api/trip-plans`, {
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

  // Auto-check for optimization suggestions
  useEffect(() => {
    if (!user || activeView !== 'chat' || !currentTripId) return

    const checkOptimization = async () => {
      try {
        const firebaseUser = auth.currentUser
        const token = firebaseUser ? await firebaseUser.getIdToken() : ''
        
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/api/check-optimization-needed/${currentTripId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          
          if (data.should_optimize && data.reasons && data.reasons.length > 0) {
            // Show notification with auto-optimization suggestion
            toast(
              <div>
                <p className="font-semibold">💡 Optimization Suggestion</p>
                <p className="text-sm">{data.reasons[0]}</p>
                <button 
                  onClick={() => {
                    const optimizePrompt = `Optimize my current day. I want to make the most of the remaining time today.`
                    setInput(optimizePrompt)
                  }}
                  className="mt-2 text-xs bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded"
                >
                  Optimize Now
                </button>
              </div>,
              {
                duration: 8000,
                icon: '✨',
              }
            )
          }
        }
      } catch (error) {
        // Silently fail - this is just a convenience feature
        console.log('Optimization check skipped:', error)
      }
    }

    // Check immediately
    checkOptimization()
    
    // Check every 30 minutes
    const interval = setInterval(checkOptimization, 30 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [user, activeView, currentTripId])

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
    
    // Add user message to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: prompt }])
    
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

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/plan-trip-from-prompt`, {
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
        // Add AI response to chat history
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.trip_plan }])
        toast.success('Trip plan generated!')
        setPreviousExtraction(null)
        setInput('')
      } else if (data.message === 'Need more information') {
        setGeneratedPlan(data.trip_plan)
        // Add AI response to chat history for follow-up questions
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.trip_plan }])
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
    if (!input.trim()) return
    
    // Send directly - let backend AI ask for missing information conversationally
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
    // Validate both dates are provided
    if (!startDate || !endDate) {
      toast.error('Both start and end dates are required')
      return
    }
    
    // Accept flexible input
    const parsedStart = parseDateInput(startDate)
    const parsedEnd = parseDateInput(endDate)
    
    if (!parsedStart || !parsedEnd) {
      toast.error('Please enter valid dates')
      return
    }
    
    // Check if dates are in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (new Date(parsedStart) < today) {
      toast.error('Start date cannot be in the past')
      return
    }
    
    if (new Date(parsedStart) > new Date(parsedEnd)) {
      toast.error('Start date must be before end date')
      return
    }
    
    const promptToSend = pendingPrompt || input
    setShowDateModal(false)
    setPendingPrompt(null)
    setStartDate('')
    setEndDate('')
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
    setChatHistory([]) // Clear chat history for new conversation
    toast.success('Started new chat')
  }

  const handleAIReplan = async () => {
    if (!currentTripId || !aiEditPrompt.trim()) {
      toast.error('Please enter your modification request')
      return
    }

    setIsReplanning(true)
    setShowAIEditModal(false)
    // Add edit request to chat history
    setChatHistory(prev => [...prev, { role: 'user', content: `Edit request: ${aiEditPrompt}` }])

    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''

      toast.loading('AI is replanning your trip...', { id: 'replan' })

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/replan?trip_id=${currentTripId}&user_feedback=${encodeURIComponent(aiEditPrompt)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to replan trip')
      }

      const data = await response.json()

      toast.success('Trip replanned successfully!', { id: 'replan' })
      
      // Update the displayed plan
      setGeneratedPlan(data.trip_plan)
      // Add AI edit response to chat history
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.trip_plan }])
      
      // Refresh trips list
      await fetchMyTrips()
      
      setAiEditPrompt('')
    } catch (error: any) {
      console.error('Error replanning trip:', error)
      toast.error(error.message || 'Failed to replan trip', { id: 'replan' })
    } finally {
      setIsReplanning(false)
    }
  }

  return (
    <div className="h-screen bg-black flex overflow-hidden">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar - Hidden on mobile, slide in when menu open */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-80 bg-neutral-900 border-r border-neutral-800 
        flex flex-col overflow-y-auto
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-neutral-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-3xl">✈️</span>
              <span className="text-2xl font-bold gradient-text">Voyage</span>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden text-neutral-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
        <header className="bg-black/80 backdrop-blur-lg border-b border-neutral-800 px-4 sm:px-6 lg:px-8 py-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            {/* Mobile hamburger menu */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden text-neutral-400 hover:text-white flex-shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold flex-1 min-w-0">
            {activeView === 'chat' && viewingSavedTrip && (
              <><span className="hidden sm:inline">Saved Trip: </span><span className="gradient-text truncate">{currentTripTitle}</span></>
            )}
            {activeView === 'chat' && !viewingSavedTrip && (
              <><span className="hidden sm:inline">Plan Your </span><span className="gradient-text">Journey</span></>
            )}
            {activeView === 'foryou' && (
              <><span className="hidden sm:inline">Personalized </span><span className="gradient-text">For You</span></>
            )}
            {activeView === 'mytrips' && (
              <><span className="hidden sm:inline">My </span><span className="gradient-text">Trips</span></>
            )}
          </h1>
          <NotificationBell />
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 hidden sm:block">
            {activeView === 'chat' && viewingSavedTrip && "Viewing your saved itinerary"}
            {activeView === 'chat' && !viewingSavedTrip && "Tell me your destination, budget, and dates - I'll create your perfect itinerary"}
            {activeView === 'foryou' && "Personalized recommendations based on your travel preferences"}
            {activeView === 'mytrips' && "View and manage all your saved trips"}
          </p>
        </header>

        {activeView === 'chat' && (
          <>
            <div ref={chatAreaRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-6">
                {!generatedPlan && (
                  <div className="text-center py-8 sm:py-12">
                    <span className="text-4xl sm:text-6xl mb-4 block">✨</span>
                    <h2 className="text-xl sm:text-2xl font-bold mb-3">Ready to explore?</h2>
                    <p className="text-neutral-400 mb-8">
                      Start planning your next adventure. I'll consider your preferences and create a personalized itinerary!
                    </p>

                    <div className="grid gap-2 sm:gap-3 max-w-2xl mx-auto">
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
                          className="px-3 sm:px-4 py-2 sm:py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-left hover:border-teal-600/50 transition-colors text-xs sm:text-sm"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {generatedPlan && (
                  <div className="space-y-4 w-full">
                    {/* Display full chat history */}
                    {chatHistory.length > 0 && (
                      <div className="space-y-4 mb-6">
                        {chatHistory.slice(0, -1).map((msg, idx) => (
                          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'user' ? (
                              <div className="bg-teal-600 text-white rounded-2xl rounded-tr-sm px-4 sm:px-6 py-2 sm:py-3 max-w-[85%] sm:max-w-[80%]">
                                <p className="text-xs sm:text-sm font-medium mb-1">You:</p>
                                <p className="text-xs sm:text-sm">{msg.content}</p>
                              </div>
                            ) : (
                              <div className="bg-neutral-800 text-white rounded-2xl rounded-tl-sm px-4 sm:px-6 py-2 sm:py-3 max-w-[85%] sm:max-w-[80%]">
                                <p className="text-xs sm:text-sm font-medium mb-1 text-teal-400">AI Assistant:</p>
                                <div className="text-xs sm:text-sm prose prose-invert max-w-none" 
                                  dangerouslySetInnerHTML={{ __html: msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : '') }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {viewingSavedTrip && (
                      <div className="bg-teal-900/20 border border-teal-600/30 rounded-lg p-3 sm:p-4 mb-4">
                        <p className="text-teal-400 text-xs sm:text-sm flex items-start sm:items-center gap-2">
                          <span className="flex-shrink-0">📋</span>
                          <span>You are viewing a saved trip. Click <strong>Edit</strong> to make changes or <strong>New Chat</strong> to plan a new trip.</span>
                        </p>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                      <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                        <span>✈️</span> {viewingSavedTrip ? 'Saved Itinerary' : 'Your Itinerary'}
                      </h3>
                      <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                        {currentTripId && (
                          <button
                            onClick={() => setShowAIEditModal(true)}
                            className="px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 flex-1 sm:flex-initial justify-center"
                          >
                            <span>✨</span> Edit
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const promptText = `Optimize my current day. I want to make the most of the remaining time today.`
                            setInput(promptText)
                            toast('Optimize your day! Add details like: current location, what you\'ve already done, remaining budget, time available, etc.', { 
                              icon: '✨',
                              duration: 6000 
                            })
                          }}
                          className="px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 flex-1 sm:flex-initial justify-center"
                          title="Get AI-powered suggestions to optimize your current day based on location, time, and interests"
                        >
                          <span>✨</span> <span className="hidden sm:inline">Optimize </span>Today
                        </button>
                        <button
                          onClick={() => {
                            setGeneratedPlan('')
                            setPreviousExtraction(null)
                            setSelectedDay(null)
                          }}
                          className="text-xs sm:text-sm text-neutral-500 hover:text-teal-600 px-2 sm:px-3"
                        >
                          Clear ✕
                        </button>
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
                        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                          {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
                            <button
                              key={day}
                              onClick={() => selectDay(day)}
                              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex-shrink-0 ${
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

            {!viewingSavedTrip && (
              <div className="border-t border-neutral-800 bg-neutral-900/95 backdrop-blur-lg p-3 sm:p-4 lg:p-6 flex-shrink-0">
                <div className="max-w-4xl mx-auto">
                  <div className="flex gap-2 sm:gap-4">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !isGenerating && handleSendMessage()}
                      placeholder="Describe your dream trip..."
                      disabled={isGenerating}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-white placeholder-neutral-500 focus:outline-none focus:border-teal-600 transition-colors disabled:opacity-50"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isGenerating}
                      className="btn-primary px-4 sm:px-6 lg:px-8 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] sm:min-w-[140px] text-sm sm:text-base"
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
              {forYouData && forYouData.suggestions ? (
                <>
                  <div className="text-center py-6 sm:py-8 mb-6 sm:mb-8">
                    <span className="text-4xl sm:text-6xl mb-4 block">🎯</span>
                    <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3">Personalized For You</h2>
                    <p className="text-sm sm:text-base text-neutral-400">
                      Based on your {preferences?.travelStyle} travel style with real-time updates
                    </p>
                  </div>

                  <div className="grid gap-4 sm:gap-6">
                    {forYouData.suggestions.map((rec: any, idx: number) => (
                      <div key={idx} className="card p-4 sm:p-6 hover:border-teal-600/50 transition-colors">
                        <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <span className="text-3xl sm:text-4xl flex-shrink-0">✈️</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                              <h3 className="text-lg sm:text-xl font-bold">{rec.destination}</h3>
                              {rec.urgency && (
                                <span className="px-2 py-1 bg-red-600/20 text-red-400 rounded-full text-xs font-semibold whitespace-nowrap">
                                  ⏰ {rec.urgency}
                                </span>
                              )}
                            </div>
                            <h4 className="text-base sm:text-lg text-teal-400 mb-2">{rec.title}</h4>
                            <p className="text-neutral-400 text-xs sm:text-sm mb-2 sm:mb-3">{rec.description}</p>
                            <p className="text-neutral-300 text-xs sm:text-sm mb-2 sm:mb-3">
                              <span className="text-teal-400 font-semibold">Why for you:</span> {rec.reason}
                            </p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                              {rec.category && (
                                <span className="px-3 py-1 bg-teal-600/20 text-teal-400 rounded-full text-xs font-semibold capitalize">
                                  {rec.category.replace(/_/g, ' ')}
                                </span>
                              )}
                              {rec.tags?.map((tag: string, i: number) => (
                                <span key={i} className="px-3 py-1 bg-neutral-800 text-neutral-300 rounded-full text-xs">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-neutral-400 mb-4">
                              <span>💰 {rec.estimated_budget}</span>
                              <span>📅 {rec.best_time}</span>
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
                                            className="text-xs text-teal-400 hover:text-teal-300 cursor-pointer underline hover:no-underline transition-all"
                                            onClick={(e) => e.stopPropagation()}
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
                                <h4 className="text-sm font-semibold text-teal-400 mb-2">🍽️ Must-Try Foods</h4>
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
                                            className="text-xs text-teal-400 hover:text-teal-300 cursor-pointer underline hover:no-underline transition-all"
                                            onClick={(e) => e.stopPropagation()}
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
                          onClick={() => {
                            setActiveView('chat')
                            const p = `Plan a trip to ${rec.destination}`
                            setInput(p)
                            setPendingPrompt(p)
                            setShowDateModal(true)
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

                  <div className="grid gap-4 sm:gap-6">
                    {myTripsData.map((trip: any, idx: number) => (
                      <div key={idx} className="card p-4 sm:p-6 hover:border-teal-600/50 transition-colors">
                        <div className="flex justify-between items-start mb-3 sm:mb-4">
                          <div className="flex-1 min-w-0 pr-3">
                            <h3 className="text-lg sm:text-xl font-bold mb-2 truncate">{trip.destination || 'Trip Plan'}</h3>
                            <p className="text-neutral-300 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{trip.itinerary?.slice(0, 150)}...</p>
                            {trip.dates && (
                              <p className="text-neutral-500 text-xs mb-1 sm:mb-2">📅 {trip.dates}</p>
                            )}
                            {trip.budget && (
                              <p className="text-neutral-500 text-xs">💰 Budget: ₹{trip.budget.toLocaleString()}</p>
                            )}
                          </div>
                          <span className="text-2xl sm:text-3xl flex-shrink-0">✈️</span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          <button 
                            onClick={() => {
                              // Clear any previous generation state
                              setIsGenerating(false)
                              setCurrentTripId(trip.id)
                              setPreviousExtraction(null)
                              setInput('')
                              setSelectedDay(null) // Reset day filter
                              
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
                              // Show only the final plan (no chat history)
                              setChatHistory([
                                { role: 'assistant', content: planToDisplay }
                              ])
                              // Switch to chat view to display the plan
                              setActiveView('chat')
                            }}
                            className="btn-primary py-2 text-xs sm:text-sm"
                          >
                            📋 View
                          </button>
                          <button 
                            onClick={() => {
                              setActiveView('chat')
                              setGeneratedPlan(trip.itinerary || '')
                              setCurrentTripId(trip.id)
                              setViewingSavedTrip(true)
                              setCurrentTripTitle(trip.destination || 'Trip')
                              // Load full chat history for edit
                              try {
                                const history = trip.chat_history ? JSON.parse(trip.chat_history) : [
                                  { role: 'user', content: `Plan a trip to ${trip.destination}` },
                                  { role: 'assistant', content: trip.itinerary || '' }
                                ]
                                setChatHistory(history)
                              } catch (e) {
                                // Fallback if parsing fails
                                setChatHistory([
                                  { role: 'user', content: `Plan a trip to ${trip.destination}` },
                                  { role: 'assistant', content: trip.itinerary || '' }
                                ])
                              }
                              setShowAIEditModal(true)
                            }}
                            className="bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg text-xs sm:text-sm transition-colors"
                          >
                            🤖 Edit
                          </button>
                          <button 
                            onClick={async () => {
                              try {
                                const firebaseUser = auth.currentUser
                                if (!firebaseUser) {
                                  toast.error('Please login first')
                                  return
                                }
                                
                                const token = await firebaseUser.getIdToken()
                                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
                                
                                toast.loading('Starting your trip...')
                                
                                // Update trip to mark as started
                                const response = await fetch(`${apiUrl}/api/trip-plans/${trip.id}/start`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                  }
                                })
                                
                                if (response.ok) {
                                  toast.dismiss()
                                  toast.success('🎉 Trip started! Safe travels!')
                                  fetchMyTrips() // Refresh trips
                                } else {
                                  toast.dismiss()
                                  toast.error('Failed to start trip')
                                }
                              } catch (error) {
                                console.error('Error starting trip:', error)
                                toast.dismiss()
                                toast.error('Failed to start trip')
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm transition-colors font-semibold"
                          >
                            🚀 Start Trip
                          </button>
                          <button 
                            onClick={async () => {
                              try {
                                const firebaseUser = auth.currentUser
                                const token = firebaseUser ? await firebaseUser.getIdToken() : ''
                                
                                toast.loading('Opening Voyage Board...')
                                
                                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
                                // Check if board exists for this trip
                                const checkResponse = await fetch(`${apiUrl}/api/voyage-board/trip/${trip.id}`, {
                                  headers: {
                                    'Authorization': `Bearer ${token}`
                                  }
                                })
                                
                                if (checkResponse.status === 404) {
                                  // Board doesn't exist, create it
                                  toast.dismiss()
                                  toast.loading('Creating collaboration board...')
                                  
                                  const createResponse = await fetch(`${apiUrl}/api/voyage-board`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                      trip_id: trip.id,
                                      board_name: trip.destination || 'Trip Collaboration Board',
                                      description: `Collaborate on ${trip.destination || 'this trip'}`,
                                      is_public: true
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
                            🔗 Share
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
                                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
                                const response = await fetch(`${apiUrl}/api/calendar/export`, {
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
                                  const downloadResponse = await fetch(`${apiUrl}/api/download-calendar/${trip.id}.ics`, {
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
                                
                                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
                                const response = await fetch(`${apiUrl}/api/trip-plans/${trip.id}`, {
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setShowDateModal(false); setPendingPrompt(null); }} />
            <div className="relative bg-neutral-900 border-2 border-teal-600/50 rounded-xl p-6 w-full max-w-md z-10 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📅</span>
                <h3 className="text-xl font-bold">Travel Dates Required</h3>
              </div>
              <p className="text-sm text-neutral-300 mb-6 leading-relaxed">
                To create a personalized itinerary with accurate availability and pricing, please provide your travel dates.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-sm font-semibold text-neutral-200 mb-2 block">Start Date *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-neutral-200 mb-2 block">End Date *</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || new Date().toISOString().split('T')[0]}
                    required
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>
              {startDate && endDate && new Date(startDate) <= new Date(endDate) && (
                <div className="bg-teal-900/20 border border-teal-600/30 rounded-lg p-3 mb-4">
                  <p className="text-sm text-teal-400">
                    ✓ Trip duration: {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                  </p>
                </div>
              )}
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                <button 
                  onClick={() => { 
                    setShowDateModal(false); 
                    setPendingPrompt(null); 
                    setStartDate('');
                    setEndDate('');
                  }} 
                  className="px-5 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDatesAndSend} 
                  disabled={!startDate || !endDate}
                  className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
                >
                  Create Itinerary →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Edit Modal */}
        {showAIEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => !isReplanning && setShowAIEditModal(false)} />
            <div className="relative bg-neutral-900 border border-neutral-800 rounded-lg p-8 w-full max-w-3xl z-10">
              <div className="text-center mb-8">
                <span className="text-6xl mb-4 block">✨</span>
                <h2 className="text-2xl font-bold mb-3">Ready to modify?</h2>
                <p className="text-neutral-400">
                  Tell me how you'd like to change your trip. I'll regenerate the plan with your modifications!
                </p>
              </div>
              
              <div className="grid gap-3 mb-8">
                {[
                  "Make it more luxurious with 5-star hotels",
                  "Add more adventure activities and water sports",
                  "Focus on authentic local food experiences",
                  "Make it more budget-friendly"
                ].map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => setAiEditPrompt(example)}
                    className="px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-left hover:border-teal-600/50 transition-colors text-sm"
                    disabled={isReplanning}
                  >
                    {example}
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <input
                  type="text"
                  value={aiEditPrompt}
                  onChange={(e) => setAiEditPrompt(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isReplanning && aiEditPrompt.trim() && handleAIReplan()}
                  placeholder="Describe how you want to change your trip..."
                  disabled={isReplanning}
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-6 py-4 text-white placeholder-neutral-500 focus:outline-none focus:border-teal-600 transition-colors disabled:opacity-50"
                />
                <button 
                  onClick={handleAIReplan} 
                  disabled={isReplanning || !aiEditPrompt.trim()}
                  className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                >
                  {isReplanning ? (
                    <span className="flex items-center gap-2 justify-center">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      <span>Replanning...</span>
                    </span>
                  ) : 'Send →'}
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
