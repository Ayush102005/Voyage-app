import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { auth } from '../lib/firebase'
import toast from 'react-hot-toast'

interface Transaction {
  id: string
  category: string
  amount: number
  description: string
  date: string
  paidBy: string
  splitWith: string[]
}

export default function ExpenseTrackerPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budget, setBudget] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  
  // New transaction form
  const [newTransaction, setNewTransaction] = useState({
    category: 'Food',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    paidBy: user?.uid || '',
    splitWith: [] as string[]
  })

  useEffect(() => {
    if (!user) {
      toast.error('Please log in')
      navigate('/login')
      return
    }
    fetchExpenseData()
  }, [user, tripId])

  const fetchExpenseData = async () => {
    setIsLoading(true)
    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const response = await fetch(`http://localhost:8000/api/expense-tracker/${tripId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions || [])
        setBudget(data.budget || 0)
      }
    } catch (error) {
      console.error('Error fetching expense data:', error)
      toast.error('Failed to load expenses')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTransaction = async () => {
    if (!newTransaction.amount || !newTransaction.description) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const response = await fetch(`http://localhost:8000/api/expense-tracker/${tripId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newTransaction,
          amount: parseFloat(newTransaction.amount)
        })
      })
      
      if (response.ok) {
        toast.success('Transaction added!')
        setShowAddModal(false)
        setNewTransaction({
          category: 'Food',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
          paidBy: user?.uid || '',
          splitWith: []
        })
        fetchExpenseData()
      } else {
        throw new Error('Failed to add transaction')
      }
    } catch (error) {
      console.error('Error adding transaction:', error)
      toast.error('Failed to add transaction')
    }
  }

  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0)
  const remainingBudget = budget - totalSpent
  const budgetPercentage = budget > 0 ? (totalSpent / budget) * 100 : 0

  const categoryTotals = transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount
    return acc
  }, {} as Record<string, number>)

  const categoryIcons: Record<string, string> = {
    'Food': '🍽️',
    'Transport': '🚗',
    'Accommodation': '🏨',
    'Activities': '🎯',
    'Shopping': '🛍️',
    'Other': '📦'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">💰</div>
          <p className="text-neutral-400">Loading expenses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-neutral-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">💰 Expense Tracker</h1>
              <p className="text-neutral-400">Track and split expenses for your trip</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary px-6 py-3 flex items-center gap-2"
            >
              <span>➕</span> Add Expense
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8">
        {/* Budget Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6">
            <div className="text-neutral-400 text-sm mb-2">Total Budget</div>
            <div className="text-3xl font-bold text-white">₹{budget.toLocaleString()}</div>
          </div>
          <div className="card p-6">
            <div className="text-neutral-400 text-sm mb-2">Total Spent</div>
            <div className="text-3xl font-bold text-teal-500">₹{totalSpent.toLocaleString()}</div>
          </div>
          <div className="card p-6">
            <div className="text-neutral-400 text-sm mb-2">Remaining</div>
            <div className={`text-3xl font-bold ${remainingBudget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ₹{Math.abs(remainingBudget).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Budget Progress Bar */}
        <div className="card p-6 mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold">Budget Progress</span>
            <span className="text-sm text-neutral-400">{budgetPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-4 overflow-hidden">
            <div 
              className={`h-full transition-all ${
                budgetPercentage < 75 ? 'bg-teal-600' : 
                budgetPercentage < 90 ? 'bg-yellow-600' : 
                'bg-red-600'
              }`}
              style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
            />
          </div>
          {budgetPercentage >= 90 && (
            <p className="text-yellow-500 text-sm mt-2">⚠️ Warning: You've used {budgetPercentage.toFixed(0)}% of your budget!</p>
          )}
          {budgetPercentage >= 100 && (
            <p className="text-red-500 text-sm mt-2">🚨 Budget exceeded by ₹{(totalSpent - budget).toLocaleString()}!</p>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="card p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Category Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(categoryTotals).map(([category, amount]) => (
              <div key={category} className="bg-neutral-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{categoryIcons[category] || '📦'}</span>
                  <span className="font-semibold">{category}</span>
                </div>
                <div className="text-2xl font-bold text-teal-500">₹{amount.toLocaleString()}</div>
                <div className="text-xs text-neutral-400 mt-1">
                  {((amount / totalSpent) * 100).toFixed(1)}% of total
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">💸</span>
              <p className="text-neutral-400">No transactions yet</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary px-6 py-3 mt-4"
              >
                Add Your First Expense
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div 
                  key={transaction.id}
                  className="bg-neutral-800/50 rounded-lg p-4 flex justify-between items-center hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{categoryIcons[transaction.category] || '📦'}</div>
                    <div>
                      <div className="font-semibold">{transaction.description}</div>
                      <div className="text-sm text-neutral-400">
                        {transaction.category} • {new Date(transaction.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-teal-500">₹{transaction.amount.toLocaleString()}</div>
                    {transaction.splitWith.length > 0 && (
                      <div className="text-xs text-neutral-400">Split with {transaction.splitWith.length} others</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Add Expense</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Category</label>
                <select
                  value={newTransaction.category}
                  onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-teal-600"
                >
                  <option>Food</option>
                  <option>Transport</option>
                  <option>Accommodation</option>
                  <option>Activities</option>
                  <option>Shopping</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Amount (₹)</label>
                <input
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-teal-600"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Description</label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-teal-600"
                  placeholder="What did you buy?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Date</label>
                <input
                  type="date"
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 btn-secondary py-3"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTransaction}
                className="flex-1 btn-primary py-3"
              >
                Add Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
