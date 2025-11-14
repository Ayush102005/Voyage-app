import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import React, { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Search, Plus, Calendar, MapPin, Users, DollarSign, Edit2, Trash2, User, Settings, LogOut, Bell } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'comments' | 'suggestions' | 'activity'>('comments')
  const [newSuggestion, setNewSuggestion] = useState({
    type: 'activity',
    suggested_value: '',
    reason: '',
    day_number: null as number | null
  })

  // Check URL parameters for initial tab
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'vote' || tab === 'suggestions') {
      setActiveTab('suggestions')
    } else if (tab === 'discuss' || tab === 'comments') {
      setActiveTab('comments')
    } else if (tab === 'activity') {
      setActiveTab('activity')
    }
  }, [searchParams])

  // Real-time listener for board updates
  useEffect(() => {
    if (!boardId) return

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

    return () => unsubscribe()
  }, [boardId])

  const handleAddComment = async () => {
    if (!newComment.trim() || !board) return

    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
      toast.error('Please login to add comments')
      return
    }
    
    try {
      const token = await firebaseUser.getIdToken()
      
      const response = await fetch('http://localhost:8000/api/voyage-board/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          board_id: boardId,
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

  const handleAddSuggestion = async () => {
    if (!newSuggestion.suggested_value.trim() || !board) return

    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
      toast.error('Please login to add suggestions')
      return
    }
    
    try {
      const token = await firebaseUser.getIdToken()
      
      const response = await fetch('http://localhost:8000/api/voyage-board/suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          board_id: boardId,
          user_id: firebaseUser.uid,
          user_name: firebaseUser.displayName || firebaseUser.email || 'Anonymous',
          suggestion_type: newSuggestion.type,
          suggested_value: newSuggestion.suggested_value,
          reason: newSuggestion.reason,
          day_number: newSuggestion.day_number
        })
      })

      if (response.ok) {
        setNewSuggestion({
          type: 'activity',
          suggested_value: '',
          reason: '',
          day_number: null
        })
        toast.success('Suggestion added!')
      } else {
        toast.error('Failed to add suggestion')
      }
    } catch (error) {
      console.error('Error adding suggestion:', error)
      toast.error('Failed to add suggestion')
    }
  }

  const handleVote = async (suggestionId: string, vote: 'up' | 'down') => {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
      toast.error('Please login to vote')
      return
    }
    
    try {
      const token = await firebaseUser.getIdToken()
      
      await fetch('http://localhost:8000/api/voyage-board/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          board_id: boardId,
          suggestion_id: suggestionId,
          user_id: firebaseUser.uid,
          vote
        })
      })
      
      toast.success(`Vote ${vote === 'up' ? '👍' : '👎'} recorded!`)
    } catch (error) {
      console.error('Error voting:', error)
      toast.error('Failed to vote')
    }
  }

  const handleLikeComment = async (commentId: string) => {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
      toast.error('Please login to like comments')
      return
    }
    
    try {
      const token = await firebaseUser.getIdToken()
      
      await fetch('http://localhost:8000/api/voyage-board/like-comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          board_id: boardId,
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

  const getVoteCount = (suggestion: VoyageBoardSuggestion) => {
    const upvotes = Object.values(suggestion.votes).filter(v => v === 'up').length
    const downvotes = Object.values(suggestion.votes).filter(v => v === 'down').length
    return { upvotes, downvotes, score: upvotes - downvotes }
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
            💬 Comments ({board.comments.length})
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`px-4 py-2 font-semibold border-b-2 ${
              activeTab === 'suggestions' ? 'border-red-500 text-red-500' : 'border-transparent text-neutral-400'
            }`}
          >
            💡 Suggestions ({board.suggestions.filter(s => s.status === 'pending').length})
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

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div className="space-y-6">
            {/* Add Comment */}
            <div className="card p-6">
              <h3 className="text-xl font-bold mb-4">Add Comment</h3>
              <div className="space-y-4">
                <select
                  value={selectedDay || ''}
                  onChange={(e) => setSelectedDay(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2"
                >
                  <option value="">General Comment</option>
                  <option value="1">Day 1</option>
                  <option value="2">Day 2</option>
                  <option value="3">Day 3</option>
                </select>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 min-h-[100px]"
                />
                <button
                  onClick={handleAddComment}
                  className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold"
                >
                  Post Comment
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {board.comments.map((comment) => (
                <div key={comment.comment_id} className="card p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm font-bold">
                      {comment.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">{comment.user_name}</span>
                        {comment.day_number && (
                          <span className="text-xs bg-neutral-800 px-2 py-1 rounded">
                            Day {comment.day_number}
                          </span>
                        )}
                        <span className="text-xs text-neutral-500">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-neutral-300 mb-2">{comment.content}</p>
                      <button
                        onClick={() => handleLikeComment(comment.comment_id)}
                        className="text-sm text-neutral-400 hover:text-red-500"
                      >
                        ❤️ {comment.likes.length}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div className="space-y-6">
            {/* Add Suggestion */}
            <div className="card p-6">
              <h3 className="text-xl font-bold mb-4">Suggest a Change</h3>
              <div className="space-y-4">
                <select
                  value={newSuggestion.type}
                  onChange={(e) => setNewSuggestion({...newSuggestion, type: e.target.value})}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2"
                >
                  <option value="activity">Activity Change</option>
                  <option value="accommodation">Accommodation</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="timing">Timing</option>
                </select>
                <input
                  type="text"
                  value={newSuggestion.suggested_value}
                  onChange={(e) => setNewSuggestion({...newSuggestion, suggested_value: e.target.value})}
                  placeholder="Your suggestion..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2"
                />
                <textarea
                  value={newSuggestion.reason}
                  onChange={(e) => setNewSuggestion({...newSuggestion, reason: e.target.value})}
                  placeholder="Why this change? (optional)"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3"
                />
                <button
                  onClick={handleAddSuggestion}
                  className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold"
                >
                  Submit Suggestion
                </button>
              </div>
            </div>

            {/* Suggestions List */}
            <div className="space-y-4">
              {board.suggestions.filter(s => s.status === 'pending').map((suggestion) => {
                const votes = getVoteCount(suggestion)
                return (
                  <div key={suggestion.suggestion_id} className="card p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => handleVote(suggestion.suggestion_id, 'up')}
                          className="text-neutral-400 hover:text-green-500"
                        >
                          ▲
                        </button>
                        <span className="font-bold text-lg">{votes.score}</span>
                        <button
                          onClick={() => handleVote(suggestion.suggestion_id, 'down')}
                          className="text-neutral-400 hover:text-red-500"
                        >
                          ▼
                        </button>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">{suggestion.user_name}</span>
                          <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                            {suggestion.suggestion_type}
                          </span>
                        </div>
                        <p className="text-lg mb-2">{suggestion.suggested_value}</p>
                        {suggestion.reason && (
                          <p className="text-sm text-neutral-400 mb-2">"{suggestion.reason}"</p>
                        )}
                        <div className="text-xs text-neutral-500">
                          {votes.upvotes} 👍 • {votes.downvotes} 👎
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
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
