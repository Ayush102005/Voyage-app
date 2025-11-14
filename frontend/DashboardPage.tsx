import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { auth } from '../lib/firebase'
import { signOut } from 'firebase/auth'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  
  useEffect(() => {
    if (!user) navigate('/login')
  }, [user])

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/login')
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold"> Dashboard</h1>
          <button onClick={handleLogout} className="btn-primary">Logout</button>
        </div>
        <div className="card p-6">
          <p className="text-xl">Welcome to your Voyage Dashboard!</p>
          <p className="text-neutral-400 mt-4">Full dashboard coming soon...</p>
        </div>
      </div>
    </div>
  )
}
