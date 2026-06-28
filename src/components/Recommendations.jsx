import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Recommendations({ profile, todayTotals, recentLogs }) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [error, setError] = useState('')

  const fetchSuggestions = async () => {
    setLoading(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/get-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ todayLog: todayTotals, recentLogs }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to get suggestions')
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuggestions(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const remaining = {
    calories: Math.max(0, profile.daily_calorie_target - (todayTotals?.calories || 0)),
    protein_g: Math.max(0, profile.daily_protein_target - (todayTotals?.protein_g || 0)),
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Meal Suggestions</h2>
        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="text-sm btn-secondary py-1.5 px-3"
        >
          {loading ? 'Loading...' : suggestions ? 'Refresh' : 'Get Ideas'}
        </button>
      </div>

      {!suggestions && !loading && (
        <div className="text-center py-6 text-gray-500">
          <div className="text-3xl mb-2">💡</div>
          <p className="text-sm">
            You have {remaining.calories} kcal and {Math.round(remaining.protein_g)}g protein remaining today.
          </p>
          <p className="text-sm mt-1">Get AI-powered meal suggestions tailored to your needs.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {suggestions && (
        <div className="space-y-4">
          {suggestions.summary && (
            <p className="text-sm text-primary-700 bg-primary-50 rounded-lg p-3">{suggestions.summary}</p>
          )}
          {suggestions.suggestions?.map((s, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-4 hover:border-primary-200 transition-colors">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-medium text-gray-900">{s.name}</h3>
                <span className="text-sm font-semibold text-gray-700 ml-2 shrink-0">{s.calories} kcal</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{s.description}</p>
              <div className="flex gap-3 text-xs text-gray-500 mb-2">
                <span>P: {Math.round(s.protein_g)}g</span>
                <span>C: {Math.round(s.carbs_g)}g</span>
                <span>F: {Math.round(s.fat_g)}g</span>
              </div>
              {s.why && (
                <p className="text-xs text-primary-600 italic">{s.why}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
