import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../lib/firebase'
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  severity?: string
  trip_id?: string
  created_at: any
  is_read: boolean
}

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const user = auth.currentUser

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    const alertsQuery = query(
      collection(db, 'safety_alerts'),
      where('user_id', '==', user.uid),
      where('is_dismissed', '==', false),
      orderBy('created_at', 'desc')
    )

    const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        type: 'safety_alert',
        title: doc.data().title,
        message: doc.data().message,
        severity: doc.data().severity,
        trip_id: doc.data().trip_id,
        created_at: doc.data().created_at,
        is_read: doc.data().is_read
      }))
      setNotifications(notifs)
    })

    return () => unsubscribe()
  }, [user, navigate])

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'safety_alerts', id), { is_read: true })
  }

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read)
    await Promise.all(unread.map(n => markAsRead(n.id)))
  }

  const dismiss = async (id: string) => {
    await updateDoc(doc(db, 'safety_alerts', id), { is_dismissed: true })
  }

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-900 border-red-500'
      case 'high': return 'bg-orange-900 border-orange-500'
      case 'medium': return 'bg-yellow-900 border-yellow-500'
      case 'low': return 'bg-blue-900 border-blue-500'
      default: return 'bg-gray-800 border-gray-600'
    }
  }

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 text-white">
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="text-gray-400 hover:text-white"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold">🔔 All Notifications</h1>
              {unreadCount > 0 && (
                <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-teal-400 hover:text-teal-300 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-2xl font-bold mb-2">No notifications</h2>
            <p className="text-gray-400">
              {filter === 'unread' ? "You're all caught up!" : "You have no notifications yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-6 rounded-lg border-l-4 ${getSeverityColor(notif.severity)} ${
                  !notif.is_read ? 'opacity-100' : 'opacity-75'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold">{notif.title}</h3>
                      {!notif.is_read && (
                        <span className="bg-teal-600 text-white text-xs px-2 py-0.5 rounded">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-gray-200 mb-3">{notif.message}</p>
                    <p className="text-sm text-gray-500">
                      {notif.created_at?.toDate?.()?.toLocaleString() || 'Just now'}
                    </p>
                  </div>
                  <button
                    onClick={() => dismiss(notif.id)}
                    className="text-gray-400 hover:text-white ml-4"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex gap-3">
                  {!notif.is_read && (
                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="text-sm text-teal-400 hover:text-teal-300"
                    >
                      Mark as read
                    </button>
                  )}
                  {notif.trip_id && (
                    <button
                      onClick={() => navigate(`/safety-alerts/${notif.trip_id}`)}
                      className="text-sm text-teal-400 hover:text-teal-300"
                    >
                      View details →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationsPage
