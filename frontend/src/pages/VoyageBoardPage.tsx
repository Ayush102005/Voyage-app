import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

import { db, auth } from '../lib/firebase.ts'

interface VoyageBoardMember {
  user_id: string
  email: string
  name: string
  role: string
  is_online: boolean
  joined_at: string
}

interface VoyageBoardComment {
  comment_id: string
  user_id: string
  user_name: string
  user_avatar?: string
  content: string
  day_number?: number
  activity_index?: number
  created_at: string
  likes: string[]
  replies: string[]
}

interface VoyageBoardSuggestion {
  suggestion_id: string
  user_id: string
  user_name: string
  suggestion_type: string
  day_number?: number
  activity_index?: number
  current_value?: string
  suggested_value: string
  reason?: string
  created_at: string
  votes: { [key: string]: string }
  status: string
}

interface Poll {
  poll_id: string
  question: string
  options: string[]
  votes: { [userId: string]: number } // userId -> option index
  created_by: string
  creator_name: string
  created_at: string
}

interface VoyageBoard {
  board_id: string
  trip_id: string
  owner_id: string
  board_name: string
  description?: string
  share_link: string
  is_public: boolean
  access_code?: string
  members: VoyageBoardMember[]
  comments: VoyageBoardComment[]
  suggestions: VoyageBoardSuggestion[]
  polls: Poll[]
  activity_log: any[]
  created_at: string
  updated_at: string
  view_count: number
  allow_comments: boolean
  allow_suggestions: boolean
}

const VoyageBoardPage = () => {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [board, setBoard] = useState<VoyageBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'comments' | 'polls' | 'activity'>('comments')
  const [newPoll, setNewPoll] = useState({
    question: '',
    options: ['', '']
  })

  // Check URL parameters for initial tab
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'vote' || tab === 'polls') {
      setActiveTab('polls')
    } else if (tab === 'discuss' || tab === 'comments') {
      setActiveTab('comments')
    } else if (tab === 'activity') {
      setActiveTab('activity')
    }
  }, [searchParams])

  // Verify access and then set up real-time listener
  useEffect(() => {
    if (!boardId) return

    const verifyAccessAndListen = async () => {
      try {
        // First verify access via API
        const firebaseUser = auth.currentUser
        const token = firebaseUser ? await firebaseUser.getIdToken() : ''
        
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        const accessCode = searchParams.get('code')
        
        const verifyUrl = accessCode 
          ? `${apiUrl}/api/voyage-board/${boardId}?access_code=${accessCode}`
          : `${apiUrl}/api/voyage-board/${boardId}`
        
        const response = await fetch(verifyUrl, {
          headers: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: 'Access denied' }))
          toast.error(error.detail || 'Cannot access this board')
          setLoading(false)
          return
        }

        // Access verified, now set up real-time listener
        const boardRef = doc(db, 'voyage_boards', boardId)
        
        const unsubscribe = onSnapshot(boardRef, (doc) => {
          if (doc.exists()) {
            console.log('✅ Board found:', doc.id)
            setBoard(doc.data() as VoyageBoard)
            setLoading(false)
          } else {
            console.warn('⚠️ Board document not found:', boardId)
            setLoading(false)
          }
        }, (error) => {
          console.error('❌ Error listening to board:', error)
          toast.error('Failed to load Voyage Board: ' + error.message)
          setLoading(false)
        })

        return unsubscribe
      } catch (error) {
        console.error('Error verifying board access:', error)
        toast.error('Failed to load board')
        setLoading(false)
      }
    }

    let unsubscribe: (() => void) | undefined
    verifyAccessAndListen().then(unsub => { unsubscribe = unsub })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [boardId, searchParams])

  const handleAddComment = async () => {
    if (!newComment.trim() || !board) return

    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
      toast.error('Please login to add comments')
      return
    }
    
    try {
      const token = await firebaseUser.getIdToken()
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/voyage-board/${boardId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: firebaseUser.uid,
          user_name: firebaseUser.displayName || firebaseUser.email || 'Anonymous',
          content: newComment,
          day_number: selectedDay,
          user_avatar: firebaseUser.photoURL
        })
      })

      if (response.ok) {
        setNewComment('')
        toast.success('Comment added!')
      } else {
        toast.error('Failed to add comment')
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error('Failed to add comment')
    }
  }

  const handleAddPoll = async () => {
    if (!newPoll.question.trim() || !board) {
      toast.error('Please enter a question')
      return
    }

    const validOptions = newPoll.options.filter(opt => opt.trim())
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 options')
      return
    }

    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
      toast.error('Please login to create polls')
      return
    }
    
    try {
      const token = await firebaseUser.getIdToken()
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/voyage-board/${boardId}/poll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: newPoll.question,
          options: validOptions,
          user_id: firebaseUser.uid,
          user_name: firebaseUser.displayName || firebaseUser.email || 'Anonymous'
        })
      })

      if (response.ok) {
        setNewPoll({ question: '', options: ['', ''] })
        toast.success('Poll created!')
      } else {
        toast.error('Failed to create poll')
      }
    } catch (error) {
      console.error('Error creating poll:', error)
      toast.error('Failed to create poll')
    }
  }

  const handleVoteOnPoll = async (pollId: string, optionIndex: number) => {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
      toast.error('Please login to vote')
      return
    }
    
    try {
      const token = await firebaseUser.getIdToken()
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      await fetch(`${apiUrl}/api/voyage-board/${boardId}/poll/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          poll_id: pollId,
          user_id: firebaseUser.uid,
          option_index: optionIndex
        })
      })
      
      toast.success('Vote recorded!')
    } catch (error) {
      console.error('Error voting:', error)
      toast.error('Failed to vote')
    }
  }

  const addPollOption = () => {
    setNewPoll({ ...newPoll, options: [...newPoll.options, ''] })
  }

  const removePollOption = (index: number) => {
    if (newPoll.options.length > 2) {
      setNewPoll({ 
        ...newPoll, 
        options: newPoll.options.filter((_, i) => i !== index) 
      })
    }
  }

  const updatePollOption = (index: number, value: string) => {
    const updated = [...newPoll.options]
    updated[index] = value
    setNewPoll({ ...newPoll, options: updated })
  }

  const handleLikeComment = async (commentId: string) => {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
      toast.error('Please login to like comments')
      return
    }
    
    try {
      const token = await firebaseUser.getIdToken()
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      await fetch(`${apiUrl}/api/voyage-board/${boardId}/comment/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          comment_id: commentId,
          user_id: firebaseUser.uid
        })
      })
    } catch (error) {
      console.error('Error liking comment:', error)
      toast.error('Failed to like comment')
    }
  }

  const copyShareLink = () => {
    if (board) {
      // Create a combined share link that includes both trip and board
      const combinedUrl = `${window.location.origin}/trip/${board.trip_id}?board=${board.board_id}`
      navigator.clipboard.writeText(combinedUrl)
      toast.success('🎉 Share link copied! Recipients can view the trip AND join the discussion board.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading Voyage Board...</div>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Voyage Board not found</div>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">🚀 {board.board_name}</h1>
              <p className="text-neutral-400">{board.description}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => navigate('/dashboard')} 
                className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded-lg text-sm"
              >
                ← Back to Dashboard
              </button>
              <button 
                onClick={copyShareLink} 
                className="bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg font-semibold"
              >
                🔗 Share Board & Trip
              </button>
            </div>
          </div>

          {/* Members */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-neutral-400">
              {board.members.length} member{board.members.length !== 1 ? 's' : ''}
            </div>
            <div className="flex -space-x-2">
              {board.members.slice(0, 5).map((member) => (
                <div
                  key={member.user_id}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center border-2 border-neutral-900 text-xs font-bold"
                  title={member.name}
                >
                  {member.name.charAt(0).toUpperCase()}
                  {member.is_online && (
                    <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-neutral-900"></div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-xs text-green-500">
              {board.members.filter(m => m.is_online).length} online
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-neutral-800">
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-4 py-2 font-semibold border-b-2 ${
              activeTab === 'comments' ? 'border-red-500 text-red-500' : 'border-transparent text-neutral-400'
            }`}
          >
            💬 Discussion ({board.comments.length})
          </button>
          <button
            onClick={() => setActiveTab('polls')}
            className={`px-4 py-2 font-semibold border-b-2 ${
              activeTab === 'polls' ? 'border-red-500 text-red-500' : 'border-transparent text-neutral-400'
            }`}
          >
            🗳️ Vote ({board.polls?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 font-semibold border-b-2 ${
              activeTab === 'activity' ? 'border-red-500 text-red-500' : 'border-transparent text-neutral-400'
            }`}
          >
            📊 Activity ({board.activity_log.length})
          </button>
        </div>

        {/* Comments Tab - Chat Style */}
        {activeTab === 'comments' && (
          <div className="flex flex-col h-[600px]">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-neutral-900/50 rounded-t-lg">
              {board.comments.length === 0 ? (
                <div className="flex items-center justify-center h-full text-neutral-500">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                board.comments.map((comment) => {
                  const firebaseUser = auth.currentUser
                  const isOwnMessage = firebaseUser && comment.user_id === firebaseUser.uid
                  
                  return (
                    <div 
                      key={comment.comment_id} 
                      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {comment.user_name.charAt(0).toUpperCase()}
                      </div>
                      <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-neutral-400">
                            {isOwnMessage ? 'You' : comment.user_name}
                          </span>
                          {comment.day_number && (
                            <span className="text-xs bg-blue-600/30 px-2 py-0.5 rounded">
                              Day {comment.day_number}
                            </span>
                          )}
                          <span className="text-xs text-neutral-600">
                            {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className={`px-4 py-2 rounded-2xl ${
                          isOwnMessage 
                            ? 'bg-red-600 text-white' 
                            : 'bg-neutral-800 text-neutral-200'
                        }`}>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                        <button
                          onClick={() => handleLikeComment(comment.comment_id)}
                          className={`text-xs mt-1 flex items-center gap-1 ${
                            comment.likes.includes(firebaseUser?.uid || '') 
                              ? 'text-red-400' 
                              : 'text-neutral-500 hover:text-red-400'
                          }`}
                        >
                          ❤️ {comment.likes.length}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Message Input */}
            <div className="bg-neutral-900 p-4 rounded-b-lg border-t border-neutral-800">
              <div className="flex gap-2 mb-2">
                <select
                  value={selectedDay || ''}
                  onChange={(e) => setSelectedDay(e.target.value ? parseInt(e.target.value) : null)}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1 text-sm"
                >
                  <option value="">General</option>
                  <option value="1">Day 1</option>
                  <option value="2">Day 2</option>
                  <option value="3">Day 3</option>
                </select>
              </div>
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddComment()
                    }
                  }}
                  placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 resize-none"
                  rows={2}
                />
                <button
                  onClick={handleAddComment}
                  className="bg-red-600 hover:bg-red-700 px-6 rounded-lg font-semibold transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Polls/Vote Tab */}
        {activeTab === 'polls' && (
          <div className="space-y-6">
            {/* Existing Polls */}
            <div className="space-y-4">
              {board.polls && board.polls.map((poll) => {
                const totalVotes = Object.keys(poll.votes).length
                const firebaseUser = auth.currentUser
                const userVote = firebaseUser ? poll.votes[firebaseUser.uid] : undefined
                
                return (
                  <div key={poll.poll_id} className="card p-6">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-neutral-400">{poll.creator_name}</span>
                        <span className="text-xs text-neutral-500">
                          {new Date(poll.created_at).toLocaleString()}
                        </span>
                      </div>
                      <h4 className="text-xl font-bold mb-4">{poll.question}</h4>
                    </div>
                    
                    <div className="space-y-3">
                      {poll.options.map((option, index) => {
                        const optionVotes = Object.values(poll.votes).filter(v => v === index).length
                        const percentage = totalVotes > 0 ? (optionVotes / totalVotes * 100).toFixed(0) : 0
                        const isSelected = userVote === index
                        
                        return (
                          <button
                            key={index}
                            onClick={() => handleVoteOnPoll(poll.poll_id, index)}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${ 
                              isSelected 
                                ? 'border-red-500 bg-red-500/20' 
                                : 'border-neutral-700 hover:border-neutral-600 bg-neutral-800'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-semibold">{option}</span>
                              <span className="text-sm text-neutral-400">{percentage}%</span>
                            </div>
                            <div className="w-full bg-neutral-700 rounded-full h-2">
                              <div 
                                className="bg-red-500 h-2 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <div className="text-xs text-neutral-500 mt-1">
                              {optionVotes} {optionVotes === 1 ? 'vote' : 'votes'}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    
                    <div className="mt-4 text-sm text-neutral-500 text-center">
                      {totalVotes} total {totalVotes === 1 ? 'vote' : 'votes'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Create Poll Section */}
            <div className="card p-6">
              <h3 className="text-xl font-bold mb-4">Create a Poll</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  value={newPoll.question}
                  onChange={(e) => setNewPoll({...newPoll, question: e.target.value})}
                  placeholder="What do you want to ask?"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-lg font-semibold"
                />
                
                <div className="space-y-2">
                  <label className="text-sm text-neutral-400">Options:</label>
                  {newPoll.options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updatePollOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2"
                      />
                      {newPoll.options.length > 2 && (
                        <button
                          onClick={() => removePollOption(index)}
                          className="bg-neutral-700 hover:bg-neutral-600 px-3 py-2 rounded-lg text-red-400"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addPollOption}
                    className="text-sm text-teal-400 hover:text-teal-300"
                  >
                    + Add Option
                  </button>
                </div>
                
                <button
                  onClick={handleAddPoll}
                  className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold w-full"
                >
                  Create Poll
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            {board.activity_log.slice().reverse().map((activity, idx) => (
              <div key={idx} className="card p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {activity.type === 'comment_added' && '💬'}
                    {activity.type === 'suggestion_added' && '💡'}
                    {activity.type === 'member_joined' && '👋'}
                    {activity.type === 'board_created' && '🚀'}
                  </span>
                  <div>
                    <p className="text-neutral-300">
                      <span className="font-semibold">{activity.user_name}</span>{' '}
                      {activity.type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default VoyageBoardPage
