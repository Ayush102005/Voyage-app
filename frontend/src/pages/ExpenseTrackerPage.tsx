import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.ts'
import { auth } from '../lib/firebase.ts'
import toast from 'react-hot-toast'

interface Expense {
  id: string
  category: string
  amount: number
  description: string
  date: string
  created_at: string
  split_among?: number
}

interface ExpenseSummary {
  trip_id: string
  total_budget: number
  total_spent: number
  total_remaining: number
  expenses: Expense[]
  category_breakdown: Record<string, number>
  days_remaining: number
  daily_budget_remaining: number
  budget_utilization_percentage: number
}

const EXPENSE_CATEGORIES = [
  { value: 'food', label: '🍽️ Food & Dining', icon: '🍽️' },
  { value: 'transport', label: '🚗 Transport', icon: '🚗' },
  { value: 'accommodation', label: '🏨 Accommodation', icon: '🏨' },
  { value: 'activities', label: '🎯 Activities', icon: '🎯' },
  { value: 'shopping', label: '🛍️ Shopping', icon: '🛍️' },
  { value: 'other', label: '💰 Other', icon: '💰' },
]

export default function ExpenseTrackerPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  
  // Form state
  const [category, setCategory] = useState('food')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [splitAmong, setSplitAmong] = useState(1)
  
  // Fetch expense summary
  const fetchExpenses = async () => {
    if (!user || !tripId) return
    
    try {
      const firebaseUser = auth.currentUser
      if (!firebaseUser) throw new Error('Not authenticated')
      
      const token = await firebaseUser.getIdToken()
      const response = await fetch(`http://localhost:8000/api/trips/${tripId}/expenses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) throw new Error('Failed to fetch expenses')
      
      const data = await response.json()
      setSummary(data)
    } catch (error) {
      console.error('Error fetching expenses:', error)
      toast.error('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchExpenses()
  }, [tripId, user])
  
  // Add expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !tripId || !amount) return
    
    setAdding(true)
    try {
      const firebaseUser = auth.currentUser
      if (!firebaseUser) throw new Error('Not authenticated')
      
      const token = await firebaseUser.getIdToken()
      const response = await fetch(`http://localhost:8000/api/trips/${tripId}/expenses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          amount: parseFloat(amount),
          description,
          split_among: splitAmong,
        }),
      })
      
      if (!response.ok) throw new Error('Failed to add expense')
      
      toast.success('Expense added successfully!')
      setAmount('')
      setDescription('')
      setSplitAmong(1)
      fetchExpenses()
    } catch (error) {
      console.error('Error adding expense:', error)
      toast.error('Failed to add expense')
    } finally {
      setAdding(false)
    }
  }
  
  // Delete expense
  const handleDeleteExpense = async (expenseId: string) => {
    if (!user || !tripId) return
    if (!confirm('Are you sure you want to delete this expense?')) return
    
    try {
      const firebaseUser = auth.currentUser
      if (!firebaseUser) throw new Error('Not authenticated')
      
      const token = await firebaseUser.getIdToken()
      const response = await fetch(`http://localhost:8000/api/trips/${tripId}/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) throw new Error('Failed to delete expense')
      
      toast.success('Expense deleted')
      fetchExpenses()
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error('Failed to delete expense')
    }
  }
  
  // Optimize day (replan)
  const handleOptimizeDay = async () => {
    if (!user || !tripId) return
    
    try {
      const firebaseUser = auth.currentUser
      if (!firebaseUser) throw new Error('Not authenticated')
      
      const token = await firebaseUser.getIdToken()
      const response = await fetch(`http://localhost:8000/api/optimize-day`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trip_id: tripId,
          current_location: summary?.trip_id || '',
          current_time: new Date().toISOString(),
        }),
      })
      
      if (!response.ok) throw new Error('Failed to optimize day')
      
      await response.json()
      toast.success('Day optimized! Check your chat for the new plan.')
      navigate('/dashboard')
    } catch (error) {
      console.error('Error optimizing day:', error)
      toast.error('Failed to optimize day')
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading expenses...</p>
        </div>
      </div>
    )
  }
  
  if (!summary) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400 mb-4">No expense data found</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }
  
  const budgetPercentage = (summary.total_spent / summary.total_budget) * 100
  const isOverBudget = summary.total_spent > summary.total_budget
  const isNearLimit = budgetPercentage > 80 && !isOverBudget
  
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-2xl font-bold">💰 Expense Tracker</h1>
              <p className="text-sm text-neutral-400">Trip ID: {tripId}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Budget Overview */}
        <div className="card p-6 mb-6">
          <div className="mb-6">
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-sm text-neutral-400 mb-1">Total Budget</p>
                <p className="text-3xl font-bold">₹{summary.total_budget.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-neutral-400 mb-1">Spent</p>
                <p className={`text-2xl font-bold ${isOverBudget ? 'text-red-500' : 'text-white'}`}>
                  ₹{summary.total_spent.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-neutral-400 mb-1">Remaining</p>
                <p className={`text-2xl font-bold ${isOverBudget ? 'text-red-500' : 'text-green-500'}`}>
                  ₹{summary.total_remaining.toLocaleString()}
                </p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="relative h-4 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isOverBudget ? 'bg-red-600' : isNearLimit ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
              />
            </div>
            <p className="text-sm text-neutral-400 mt-2">
              {budgetPercentage.toFixed(1)}% of budget used
            </p>
          </div>
          
          {/* Smart Warning */}
          {isOverBudget && (
            <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-500 mb-1">Budget Exceeded!</h3>
                  <p className="text-sm text-neutral-300 mb-3">
                    You've exceeded your budget by ₹{Math.abs(summary.total_remaining).toLocaleString()}. 
                    Consider adjusting your remaining plans to stay within budget.
                  </p>
                  <button
                    onClick={handleOptimizeDay}
                    className="btn-primary bg-red-600 hover:bg-red-700 text-sm"
                  >
                    🔄 Auto-Replan My Day
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {isNearLimit && (
            <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-500 mb-1">Approaching Budget Limit</h3>
                  <p className="text-sm text-neutral-300">
                    You've used {budgetPercentage.toFixed(1)}% of your budget. 
                    Daily budget for remaining {summary.days_remaining} days: ₹{summary.daily_budget_remaining.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Category Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {Object.entries(summary.category_breakdown).map(([cat, amt]) => {
              const category = EXPENSE_CATEGORIES.find(c => c.value === cat)
              return (
                <div key={cat} className="bg-neutral-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{category?.icon}</span>
                    <span className="text-sm text-neutral-400 capitalize">{cat}</span>
                  </div>
                  <p className="text-lg font-semibold">₹{amt.toLocaleString()}</p>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Add Expense Form */}
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">➕ Add New Expense</h2>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Amount (₹)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  required
                  min="0"
                  step="0.01"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Lunch at beach shack"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Split Among (people)</label>
              <input
                type="number"
                value={splitAmong}
                onChange={(e) => setSplitAmong(parseInt(e.target.value) || 1)}
                min="1"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white"
              />
            </div>
            
            <button
              type="submit"
              disabled={adding || !amount}
              className="btn-primary w-full"
            >
              {adding ? 'Adding...' : 'Add Expense'}
            </button>
          </form>
        </div>
        
        {/* Expenses List */}
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">📋 Transaction History</h2>
          
          {summary.expenses.length === 0 ? (
            <p className="text-center text-neutral-400 py-8">No expenses yet. Add your first expense above!</p>
          ) : (
            <div className="space-y-3">
              {summary.expenses.map(expense => {
                const category = EXPENSE_CATEGORIES.find(c => c.value === expense.category)
                return (
                  <div
                    key={expense.id}
                    className="bg-neutral-800/50 rounded-lg p-4 flex items-center justify-between hover:bg-neutral-800 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-2xl">{category?.icon || '💰'}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold capitalize">{expense.category}</span>
                          {expense.split_among && expense.split_among > 1 && (
                            <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded">
                              Split {expense.split_among}x
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-400">{expense.description || 'No description'}</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {new Date(expense.date).toLocaleDateString('en-IN', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold">₹{expense.amount.toLocaleString()}</span>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-red-500 hover:text-red-400 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
