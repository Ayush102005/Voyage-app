import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/firebase'

interface Notification {
  id: string
  type: 'safety_alert' | 'budget_alert' | 'voyage_board' | 'expense' | 'trip_update'
  title: string
  message: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  trip_id?: string
  created_at: any
  is_read: boolean
  link?: string
}

const NotificationBell: React.FC = () => {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const user = auth.currentUser

  useEffect(() => {
    if (!user) return

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Fetch safety alerts from API
    const fetchAlerts = async () => {
      try {
        const token = await user.getIdToken()
        const response = await fetch('http://localhost:8000/api/safety-alerts', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.alerts) {
            const notifs = data.alerts.map((alert: any) => ({
              id: alert.id,
              type: 'safety_alert' as const,
              title: alert.title,
              message: alert.message,
              severity: alert.severity,
              trip_id: alert.trip_id,
              created_at: alert.created_at,
              is_read: alert.is_read || false,
              link: alert.trip_id ? `/trip/${alert.trip_id}` : undefined
            }))

            setNotifications(notifs)
            setUnreadCount(notifs.filter((n: Notification) => !n.is_read).length)

            // Show browser notification for critical/high severity unread alerts
            notifs.forEach((notif: Notification) => {
              if (!notif.is_read && (notif.severity === 'critical' || notif.severity === 'high')) {
                if (Notification.permission === 'granted') {
                  const notification = new window.Notification(notif.title, {
                    body: notif.message,
                    icon: '/voyage-icon.png',
                    badge: '/voyage-icon.png',
                    tag: notif.id,
                    requireInteraction: notif.severity === 'critical'
                  })

                  notification.onclick = () => {
                    window.focus()
                    if (notif.link) {
                      navigate(notif.link)
                    }
                    notification.close()
                  }
                }
              }
            })
          }
        }
      } catch (error) {
        console.error('Error fetching safety alerts:', error)
      }
    }

    // Fetch immediately
    fetchAlerts()

    // Poll every 2 minutes for new alerts
    const interval = setInterval(fetchAlerts, 2 * 60 * 1000)

    return () => {
      clearInterval(interval)
    }
  }, [user, navigate])

  const markAsRead = async (notificationId: string, link?: string) => {
    try {
      // Mark as read via API
      const token = await user?.getIdToken()
      if (!token) return

      await fetch(`http://localhost:8000/api/safety-alerts/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )

      // Navigate if link provided
      if (link) {
        navigate(link)
        setShowDropdown(false)
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const token = await user?.getIdToken()
      if (!token) return

      const unreadNotifs = notifications.filter(n => !n.is_read)
      
      await Promise.all(
        unreadNotifs.map(n => 
          fetch(`http://localhost:8000/api/safety-alerts/${n.id}/read`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
        )
      )

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      )
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400'
      case 'high': return 'text-orange-400'
      case 'medium': return 'text-yellow-400'
      case 'low': return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical': return '🚨'
      case 'high': return '⚠️'
      case 'medium': return '⚡'
      case 'low': return 'ℹ️'
      default: return '📢'
    }
  }

  const formatTime = (timestamp: any) => {
    if (!timestamp) return ''
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (!user) return null

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-300 hover:text-white transition-colors"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                🔔 Notifications
                {unreadCount > 0 && (
                  <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-teal-400 hover:text-teal-300"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="text-4xl mb-2">🔕</div>
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => markAsRead(notif.id, notif.link)}
                      className={`w-full p-4 text-left hover:bg-gray-700 transition-colors ${
                        !notif.is_read ? 'bg-gray-750' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">
                          {getSeverityIcon(notif.severity)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`font-semibold ${getSeverityColor(notif.severity)} ${
                              !notif.is_read ? 'font-bold' : ''
                            }`}>
                              {notif.title}
                            </h4>
                            {!notif.is_read && (
                              <span className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-sm text-gray-300 line-clamp-2 mb-2">
                            {notif.message}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{formatTime(notif.created_at)}</span>
                            {notif.severity && (
                              <span className="uppercase">{notif.severity}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-700">
                <button
                  onClick={() => {
                    navigate('/notifications')
                    setShowDropdown(false)
                  }}
                  className="w-full text-center text-sm text-teal-400 hover:text-teal-300 font-medium"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationBell
