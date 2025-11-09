import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { db } from '../lib/firebase'

export const FirebaseStatusIndicator = () => {
  const { user, loading } = useAuthStore()
  const [show, setShow] = useState(true)

  useEffect(() => {
    // Auto-hide after 5 seconds if everything is OK
    if (!loading && user && db) {
      setTimeout(() => setShow(false), 5000)
    }
  }, [loading, user])

  if (!show) return null

  return (
    <div className="fixed top-4 right-4 z-50 bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-sm max-w-xs">
      <div className="font-bold mb-2 flex items-center gap-2">
        <span>🔥</span> Firebase Status
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Firestore:</span>
          <span className={db ? 'text-green-500' : 'text-red-500'}>
            {db ? '✓ Connected' : '✗ Not initialized'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Auth:</span>
          <span className={!loading ? 'text-green-500' : 'text-yellow-500'}>
            {loading ? '⏳ Loading...' : '✓ Ready'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>User:</span>
          <span className={user ? 'text-green-500' : 'text-neutral-500'}>
            {user ? `✓ ${user.email}` : '- Not logged in'}
          </span>
        </div>
      </div>
      <button
        onClick={() => setShow(false)}
        className="mt-2 text-xs text-neutral-500 hover:text-white"
      >
        Hide
      </button>
    </div>
  )
}
