import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function FoodLogger({ profile, todayTotals, onLogged }) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  const handleLog = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    setLoading(true)
    setFeedback('')
    setError('')

    try {
      const res = await fetch('/api/log-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: input.trim(),
          profile,
          todayLog: todayTotals,
        }),
      })

      if (!res.ok) throw new Error('Failed to analyze food')
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      const today = new Date().toISOString().split('T')[0]

      const { error: dbError } = await supabase.from('food_logs').insert({
        user_id: user.id,
        date: today,
        description: input.trim(),
        calories: data.calories,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
        fiber_g: data.fiber_g || 0,
        items: data.items || [],
        feedback: data.feedback,
      })

      if (dbError) throw dbError

      setFeedback(data.feedback)
      setInput('')
      onLogged(data)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Log Food</h2>
      <form onSubmit={handleLog} className="space-y-3">
        <div>
          <textarea
            className="input resize-none"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What did you eat? Just describe it naturally... e.g. 'two scrambled eggs with toast and butter' or 'a bowl of chicken fried rice'"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleLog(e)
              }
            }}
          />
          <p className="text-xs text-gray-400 mt-1">Press Enter to log, Shift+Enter for new line</p>
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading || !input.trim()}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing with AI...
            </span>
          ) : 'Log Food'}
        </button>
      </form>

      {feedback && (
        <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-3">
          <p className="text-sm text-primary-800">{feedback}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}
