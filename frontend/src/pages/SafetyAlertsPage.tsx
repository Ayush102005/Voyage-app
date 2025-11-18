import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { auth } from '../lib/firebase'
import toast from 'react-hot-toast'

interface SafetyAlert {
  alert_id: string
  trip_id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  title: string
  message: string
  location: string
  source: string
  action_required?: string
  expires_at?: string
  created_at: string
  is_read: boolean
}

interface SafetyAlertResponse {
  alerts: SafetyAlert[]
  unread_count: number
  critical_count: number
}

const SafetyAlertsPage: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<SafetyAlert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [criticalCount, setCriticalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (tripId) {
      fetchAlerts()
    }
  }, [tripId])

  const fetchAlerts = async () => {
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/safety-alerts/${tripId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data: SafetyAlertResponse = await response.json()
        setAlerts(data.alerts)
        setUnreadCount(data.unread_count)
        setCriticalCount(data.critical_count)
      } else {
        throw new Error('Failed to fetch alerts')
      }
    } catch (error) {
      console.error('Error fetching alerts:', error)
      toast.error('Failed to load safety alerts')
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (alertId: string) => {
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      await fetch(`${apiUrl}/api/safety-alerts/${alertId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      fetchAlerts()
    } catch (error) {
      console.error('Error marking alert as read:', error)
    }
  }

  const dismissAlert = async (alertId: string) => {
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      await fetch(`${apiUrl}/api/safety-alerts/${alertId}/dismiss`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      toast.success('Alert dismissed')
      fetchAlerts()
    } catch (error) {
      console.error('Error dismissing alert:', error)
      toast.error('Failed to dismiss alert')
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-900 border-red-500'
      case 'high': return 'bg-orange-900 border-orange-500'
      case 'medium': return 'bg-yellow-900 border-yellow-500'
      case 'low': return 'bg-blue-900 border-blue-500'
      default: return 'bg-gray-800 border-gray-600'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🚨'
      case 'high': return '⚠️'
      case 'medium': return '⚡'
      case 'low': return 'ℹ️'
      default: return '📢'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'weather': return '🌦️'
      case 'health': return '🏥'
      case 'security': return '🔒'
      case 'natural_disaster': return '🌪️'
      case 'political': return '🏛️'
      case 'advisory': return '📋'
      default: return '📢'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading alerts...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-white flex items-center gap-2"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🛡️ Safety Alerts
            </h1>
            <div className="flex gap-4">
              {criticalCount > 0 && (
                <div className="bg-red-900 text-red-200 px-3 py-1 rounded-full text-sm font-medium">
                  {criticalCount} Critical
                </div>
              )}
              {unreadCount > 0 && (
                <div className="bg-teal-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                  {unreadCount} Unread
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {alerts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold mb-2">All Clear!</h2>
            <p className="text-gray-400">No active safety alerts for this trip.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.alert_id}
                className={`border-l-4 p-6 rounded-lg ${getSeverityColor(alert.severity)} ${
                  !alert.is_read ? 'opacity-100' : 'opacity-75'
                }`}
                onClick={() => !alert.is_read && markAsRead(alert.alert_id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getSeverityIcon(alert.severity)}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{getCategoryIcon(alert.category)}</span>
                        <span className="text-xs uppercase tracking-wider text-gray-400">
                          {alert.category}
                        </span>
                        {!alert.is_read && (
                          <span className="bg-teal-600 text-white text-xs px-2 py-0.5 rounded">
                            NEW
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold">{alert.title}</h3>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      dismissAlert(alert.alert_id)
                    }}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 mb-4">
                  <p className="text-gray-200 leading-relaxed">{alert.message}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>📍 {alert.location}</span>
                    <span>📰 {alert.source}</span>
                  </div>

                  {alert.action_required && (
                    <div className="bg-black bg-opacity-30 p-4 rounded-lg border border-gray-700">
                      <div className="font-semibold mb-2 text-teal-400">⚡ Action Required:</div>
                      <p className="text-gray-200">{alert.action_required}</p>
                    </div>
                  )}

                  {alert.expires_at && (
                    <div className="text-xs text-gray-500">
                      Expires: {new Date(alert.expires_at).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500">
                  {new Date(alert.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SafetyAlertsPage
