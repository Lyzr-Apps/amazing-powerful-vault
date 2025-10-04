import React, { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import parseLLMJson from './utils/jsonParser'

interface Transaction {
  id: string
  amount: number
  category: string
  date: string
  type: 'income' | 'expense'
  description: string
  notes?: string
}

interface CategoryTotal {
  category: string
  total: number
  type: 'income' | 'expense'
}

interface Insight {
  type: 'insight' | 'recommendation'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

const CATEGORIES = [
  { name: 'Food & Dining', icon: '🍽️' },
  { name: 'Transportation', icon: '🚗' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Bills & Utilities', icon: '💡' },
  { name: 'Healthcare', icon: '⚕️' },
  { name: 'Education', icon: '📚' },
  { name: 'Travel', icon: '✈️' },
  { name: 'Salary', icon: '💰' },
  { name: 'Freelance', icon: '💻' },
  { name: 'Investment', icon: '📈' },
  { name: 'Other', icon: '📋' }
]

const COLORS = {
  primary: '#2979FF',
  secondary: '#00BFAE',
  success: '#43A047',
  warning: '#FFC107',
  error: '#E53935',
  info: '#0288D1',
  background: '#F7FAFC',
  surface: '#FFFFFF',
  text: '#23272F'
}

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [insights, setInsights] = useState<Insight[]>([])
  const [darkMode, setDarkMode] = useState(false)
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly')
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    type: 'expense' as 'income' | 'expense',
    description: '',
    notes: ''
  })

  useEffect(() => {
    const savedTransactions = localStorage.getItem('budgetTrackerTransactions')
    const savedDarkMode = localStorage.getItem('budgetTrackerDarkMode')

    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions))
    }

    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('budgetTrackerTransactions', JSON.stringify(transactions))
    if (transactions.length > 0) {
      generateInsights()
    }
  }, [transactions, viewMode])

  useEffect(() => {
    localStorage.setItem('budgetTrackerDarkMode', JSON.stringify(darkMode))
  }, [darkMode])

  const generateInsights = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('https://agent-prod.studio.lyzr.ai/v3/inference/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-default-obhGvAo6gG9YT9tu6ChjyXLqnw7TxSGY'
        },
        body: JSON.stringify({
          user_id: `user${Date.now()}@test.com`,
          agent_id: '68e16e5d3637bc8ddc9fff03',
          session_id: `session-${Date.now()}`,
          message: `Analyze these transactions for ${viewMode} insights and recommendations: ${JSON.stringify(transactions)}`
        })
      })

      const data = await response.json()
      const parsedResponse = parseLLMJson(data.response || '{}')

      if (parsedResponse.result) {
        const newInsights: Insight[] = [
          ...parsedResponse.result.insights.map((insight: any) => ({
            type: 'insight' as const,
            title: insight.title || 'Financial Insight',
            description: insight.description || insight,
            severity: insight.severity || 'medium'
          })),
          ...parsedResponse.result.recommendations.map((rec: any) => ({
            type: 'recommendation' as const,
            title: rec.title || 'Recommendation',
            description: rec.description || rec,
            severity: rec.severity || 'medium'
          }))
        ]
        setInsights(newInsights)
      }
    } catch (error) {
      console.error('Error generating insights:', error)
      // Fallback to basic insights
      setInsights([
        {
          type: 'insight',
          title: 'Spending Overview',
          description: `Your total ${viewMode === 'weekly' ? 'weekly' : 'monthly'} spending is $${getTotalExpenses().toFixed(2)}`,
          severity: 'medium'
        }
      ])
    }
    setIsLoading(false)
  }

  const suggestCategory = async (description: string) => {
    try {
      const response = await fetch('https://agent-prod.studio.lyzr.ai/v3/inference/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-default-obhGvAo6gG9YT9tu6ChjyXLqnw7TxSGY'
        },
        body: JSON.stringify({
          user_id: `user${Date.now()}@test.com`,
          agent_id: '68e16e75f21978807e7e9e8d',
          session_id: `session-${Date.now()}`,
          message: `Suggest the best category for this transaction description: "${description}"`
        })
      })

      const data = await response.json()
      const parsedResponse = parseLLMJson(data.response || '{}')

      if (parsedResponse.result && parsedResponse.result.primary_suggestion) {
        setFormData(prev => ({
          ...prev,
          category: parsedResponse.result.primary_suggestion
        }))
      }
    } catch (error) {
      console.error('Error getting category suggestion:', error)
    }
  }

  const addTransaction = () => {
    if (!formData.amount || !formData.category || !formData.description) return

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      amount: parseFloat(formData.amount),
      category: formData.category,
      date: formData.date,
      type: formData.type,
      description: formData.description,
      notes: formData.notes
    }

    setTransactions(prev => [...prev, newTransaction])
    resetForm()
  }

  const updateTransaction = () => {
    if (!editingTransaction || !formData.amount || !formData.category || !formData.description) return

    const updatedTransaction: Transaction = {
      ...editingTransaction,
      amount: parseFloat(formData.amount),
      category: formData.category,
      date: formData.date,
      type: formData.type,
      description: formData.description,
      notes: formData.notes
    }

    setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? updatedTransaction : t))
    resetForm()
  }

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const resetForm = () => {
    setFormData({
      amount: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      description: '',
      notes: ''
    })
    setShowModal(false)
    setEditingTransaction(null)
  }

  const openEditModal = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setFormData({
      amount: transaction.amount.toString(),
      category: transaction.category,
      date: transaction.date,
      type: transaction.type,
      description: transaction.description,
      notes: transaction.notes || ''
    })
    setShowModal(true)
  }

  const getTotalIncome = () => {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  }

  const getTotalExpenses = () => {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  }

  const getBalance = () => {
    return getTotalIncome() - getTotalExpenses()
  }

  const getCategoryTotals = (): CategoryTotal[] => {
    const categoryMap = new Map<string, { income: number; expense: number }>()

    transactions.forEach(transaction => {
      const current = categoryMap.get(transaction.category) || { income: 0, expense: 0 }
      if (transaction.type === 'income') {
        current.income += transaction.amount
      } else {
        current.expense += transaction.amount
      }
      categoryMap.set(transaction.category, current)
    })

    const categoryTotals: CategoryTotal[] = []
    categoryMap.forEach((totals, category) => {
      if (totals.income > 0) {
        categoryTotals.push({ category, total: totals.income, type: 'income' })
      }
      if (totals.expense > 0) {
        categoryTotals.push({ category, total: totals.expense, type: 'expense' })
      }
    })

    return categoryTotals
  }

  const getFilteredTransactions = () => {
    return transactions.filter(transaction => {
      const categoryMatch = !filterCategory || transaction.category === filterCategory
      const typeMatch = filterType === 'all' || transaction.type === filterType
      return categoryMatch && typeMatch
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  const themeClasses = darkMode
    ? 'bg-gray-900 text-white'
    : 'bg-gray-50 text-gray-900'

  return (
    <div className={`min-h-screen ${themeClasses} transition-colors duration-300`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold" style={{ color: COLORS.primary }}>
                💰 Budget Tracker
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setViewMode(viewMode === 'weekly' ? 'monthly' : 'weekly')}
                className="px-3 py-1 rounded-md text-sm font-medium"
                style={{ backgroundColor: COLORS.secondary, color: 'white' }}
              >
                {viewMode === 'weekly' ? '📅 Weekly' : '📊 Monthly'}
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-md"
                style={{ backgroundColor: darkMode ? COLORS.surface : COLORS.background }}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="text-sm font-medium text-gray-500 mb-2">Total Income</div>
            <div className="text-3xl font-bold" style={{ color: COLORS.success }}>
              ${getTotalIncome().toFixed(2)}
            </div>
          </div>
          <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="text-sm font-medium text-gray-500 mb-2">Total Expenses</div>
            <div className="text-3xl font-bold" style={{ color: COLORS.error }}>
              ${getTotalExpenses().toFixed(2)}
            </div>
          </div>
          <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="text-sm font-medium text-gray-500 mb-2">Balance</div>
            <div className={`text-3xl font-bold ${getBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${getBalance().toFixed(2)}
            </div>
          </div>
          <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="text-sm font-medium text-gray-500 mb-2">Transactions</div>
            <div className="text-3xl font-bold" style={{ color: COLORS.primary }}>
              {transactions.length}
            </div>
          </div>
        </div>

        {/* Charts and Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Category Chart */}
          <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className="text-xl font-semibold mb-4">Spending by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getCategoryTotals().filter(c => c.type === 'expense')}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="total"
                  nameKey="category"
                >
                  {getCategoryTotals().filter(c => c.type === 'expense').map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.primary} fillOpacity={0.6 + (index * 0.1)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* AI Insights Panel */}
          <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">AI Insights</h3>
              {isLoading && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: COLORS.primary }}></div>
              )}
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {insights.length === 0 ? (
                <p className="text-gray-500">No insights available yet. Add some transactions to get started!</p>
              ) : (
                insights.map((insight, index) => (
                  <div key={index} className={`p-4 rounded-lg border-l-4 ${
                    insight.severity === 'high' ? 'border-red-400 bg-red-50' :
                    insight.severity === 'medium' ? 'border-yellow-400 bg-yellow-50' :
                    'border-blue-400 bg-blue-50'
                  }`}>
                    <h4 className="font-medium text-sm">{insight.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} mb-8`}>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(category => (
                  <option key={category.name} value={category.name}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-2 rounded-md text-white font-medium"
              style={{ backgroundColor: COLORS.primary }}
            >
              + Add Transaction
            </button>
          </div>
        </div>

        {/* Transactions List */}
        <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className="text-xl font-semibold mb-4">Transactions</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {getFilteredTransactions().length === 0 ? (
              <p className="text-gray-500 text-center py-8">No transactions found. Add your first transaction!</p>
            ) : (
              getFilteredTransactions().map(transaction => (
                <div key={transaction.id} className="flex justify-between items-center p-4 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}
                    </div>
                    <div>
                      <h4 className="font-medium">{transaction.description}</h4>
                      <p className="text-sm text-gray-500">{transaction.category} • {transaction.date}</p>
                      {transaction.notes && (
                        <p className="text-xs text-gray-400 mt-1">{transaction.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`font-semibold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${transaction.amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => openEditModal(transaction)}
                      className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteTransaction(transaction.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`max-w-md w-full rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-6`}>
            <h3 className="text-xl font-semibold mb-4">
              {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'income' | 'expense' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  onBlur={(e) => {
                    if (e.target.value && !formData.category) {
                      suggestCategory(e.target.value)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="eg. Grocery shopping"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  {CATEGORIES.map(category => (
                    <option key={category.name} value={category.name}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editingTransaction ? updateTransaction : addTransaction}
                className="px-4 py-2 rounded-md text-white font-medium"
                style={{ backgroundColor: COLORS.primary }}
              >
                {editingTransaction ? 'Update' : 'Add'} Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
