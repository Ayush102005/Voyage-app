import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { auth } from '../lib/firebase'
import toast from 'react-hot-toast'

interface Expense {
  expense_id: string
  category: string
  amount: number
  description: string
  date: string
  created_at: string
}

interface CategoryBreakdown {
  name: string
  budgeted_amount: number
  spent_amount: number
  remaining_amount: number
  percentage_used: number
  expense_count: number
}

interface ExpenseSummary {
  total_budget: number
  total_spent: number
  total_remaining: number
  percentage_used: number
  categories: CategoryBreakdown[]
  recent_expenses: Expense[]
  warnings: string[]
  daily_average: number
  projected_total: number
  budget_status: string
  days_elapsed: number
  days_remaining: number
}

export default function ExpenseTrackerPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  
  const [newExpense, setNewExpense] = useState({
    category: 'Food',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  })

  const categories = [
    { name: 'Food', icon: '🍽️', color: 'bg-orange-500' },
    { name: 'Transport', icon: '🚗', color: 'bg-blue-500' },
    { name: 'Accommodation', icon: '🏨', color: 'bg-purple-500' },
    { name: 'Activities', icon: '🎯', color: 'bg-green-500' },
    { name: 'Shopping', icon: '🛍️', color: 'bg-pink-500' },
    { name: 'Other', icon: '💰', color: 'bg-gray-500' }
  ]

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
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/expense-tracker/${tripId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data: ExpenseSummary = await response.json()
        setSummary(data)
      } else {
        throw new Error('Failed to fetch expense data')
      }
    } catch (error) {
      console.error('Error fetching expenses:', error)
      toast.error('Failed to load expenses')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddExpense = async () => {
    if (!newExpense.amount || !newExpense.description) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      const firebaseUser = auth.currentUser
      const token = firebaseUser ? await firebaseUser.getIdToken() : ''
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/expense-tracker/${tripId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newExpense,
          amount: parseFloat(newExpense.amount)
        })
      })
      
      if (response.ok) {
        toast.success('Expense added!')
        setShowAddModal(false)
        setNewExpense({
          category: 'Food',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
          notes: ''
        })
        fetchExpenseData()
      } else {
        throw new Error('Failed to add expense')
      }
    } catch (error) {
      console.error('Error adding expense:', error)
      toast.error('Failed to add expense')
    }
  }

  const getCategoryIcon = (category: string) => {
    return categories.find(c => c.name === category)?.icon || '💰'
  }

  const getCategoryColor = (category: string) => {
    return categories.find(c => c.name === category)?.color || 'bg-gray-500'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 flex items-center justify-center">
        <div className="text-white text-xl">No expense data found</div>
      </div>
    )
  }

  const percentageUsed = summary.percentage_used
  const getProgressColor = () => {
    if (percentageUsed >= 90) return 'bg-red-500'
    if (percentageUsed >= 75) return 'bg-orange-500'
    if (percentageUsed >= 50) return 'bg-yellow-500'
    return 'bg-teal-500'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 text-white pb-20">
      {/* Header */}
      <div className="bg-gray-900/90 backdrop-blur-lg border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Dashboard
              </button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  💰 Expense Tracker
                </h1>
                <p className="text-sm text-gray-400 mt-1">Track and manage your trip expenses</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-teal-600 hover:bg-teal-700 px-6 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <span>➕</span>
              Add Expense
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Budget Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Budget */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <p className="text-gray-400 text-sm font-medium mb-2">Total Budget</p>
            <p className="text-3xl font-bold text-white">₹{summary.total_budget.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">From trip plan</p>
          </div>

          {/* Total Spent */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <p className="text-gray-400 text-sm font-medium mb-2">Total Spent</p>
            <p className="text-3xl font-bold text-orange-400">₹{summary.total_spent.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">{percentageUsed.toFixed(1)}% of budget</p>
          </div>

          {/* Remaining */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <p className="text-gray-400 text-sm font-medium mb-2">Remaining</p>
            <p className={`text-3xl font-bold ${summary.total_remaining >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
              ₹{Math.abs(summary.total_remaining).toLocaleString()}
            </p>
            {summary.total_remaining < 0 && (
              <p className="text-sm text-red-400 mt-1">Over budget!</p>
            )}
          </div>
        </div>

        {/* Budget Progress Bar */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">Budget Progress</h3>
            <span className="text-sm text-gray-400">{percentageUsed.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
              style={{ width: `${Math.min(percentageUsed, 100)}%` }}
            />
          </div>
          {summary.warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {summary.warnings.map((warning, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-orange-400">
                  <span>⚠️</span>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Category Breakdown */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h3 className="font-semibold text-lg mb-6">Category Breakdown</h3>
            {summary.categories.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No expenses yet</p>
            ) : (
              <div className="space-y-4">
                {summary.categories.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getCategoryIcon(cat.name)}</span>
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-sm text-gray-400">({cat.expense_count})</span>
                      </div>
                      <span className="font-semibold">₹{cat.spent_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${getCategoryColor(cat.name)} transition-all duration-500`}
                          style={{ width: `${cat.percentage_used}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-400 w-12 text-right">
                        {cat.percentage_used.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Insights */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h3 className="font-semibold text-lg mb-6">Spending Insights</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-400">Daily Average</p>
                  <p className="text-xl font-bold text-teal-400">₹{summary.daily_average.toLocaleString()}</p>
                </div>
                <span className="text-3xl">📊</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-400">Projected Total</p>
                  <p className="text-xl font-bold text-yellow-400">₹{summary.projected_total.toLocaleString()}</p>
                </div>
                <span className="text-3xl">📈</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-400">Total Expenses</p>
                  <p className="text-xl font-bold text-white">{summary.recent_expenses.length}</p>
                </div>
                <span className="text-3xl">🧾</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 mt-8">
          <h3 className="font-semibold text-lg mb-6">Recent Expenses</h3>
          {summary.recent_expenses.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💸</div>
              <p className="text-gray-400">No expenses recorded yet</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 text-teal-400 hover:text-teal-300 font-medium"
              >
                Add your first expense →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.recent_expenses.map((expense) => (
                <div
                  key={expense.expense_id}
                  className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full ${getCategoryColor(expense.category)} flex items-center justify-center text-2xl`}>
                      {getCategoryIcon(expense.category)}
                    </div>
                    <div>
                      <p className="font-medium">{expense.description}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                        <span>{expense.category}</span>
                        <span>•</span>
                        <span>{new Date(expense.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">₹{expense.amount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-gray-700">
            <h2 className="text-2xl font-bold mb-6">Add New Expense</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                <select
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {categories.map(cat => (
                    <option key={cat.name} value={cat.name}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Amount (₹)</label>
                <input
                  type="number"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  placeholder="0"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  placeholder="What did you spend on?"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={newExpense.notes}
                  onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExpense}
                className="flex-1 bg-teal-600 hover:bg-teal-700 py-3 rounded-lg font-semibold transition-colors"
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
