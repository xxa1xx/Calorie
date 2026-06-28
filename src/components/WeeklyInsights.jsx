import { useState } from 'react'

export default function WeeklyInsights({ profile, weeklyLogs }) {
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState(null)
  const [error, setError] = useState('')

  const fetchInsights = async () => {
    if (!weeklyLogs || weeklyLogs.length === 0) {
      setError('Log at least a few days of food to get weekly insights.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/get-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, weeklyLogs }),
      })

      if (!res.ok) throw new Error('Failed to get insights')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setInsights(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Weekly Insights</h2>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="text-sm btn-secondary py-1.5 px-3"
        >
          {loading ? 'Analyzing...' : insights ? 'Refresh' : 'Analyze Week'}
        </button>
      </div>

      {!insights && !loading && (
        <div className="text-center py-6 text-gray-500">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm">Get AI analysis of your weekly eating patterns, trends, and personalized recommendations.</p>
          <p className="text-sm text-gray-400 mt-1">{weeklyLogs?.length || 0} days of data available</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {insights && (
        <div className="space-y-5">
          <div className={`flex items-center gap-2 p-3 rounded-lg ${insights.onTrack ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
            <span className="text-xl">{insights.onTrack ? '✅' : '⚠️'}</span>
            <p className="text-sm font-medium">{insights.weekSummary}</p>
          </div>

          {insights.average && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Weekly Averages</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Calories', val: insights.average.calories, target: profile.daily_calorie_target, unit: 'kcal' },
                  { label: 'Protein', val: insights.average.protein_g, target: profile.daily_protein_target, unit: 'g' },
                  { label: 'Carbs', val: insights.average.carbs_g, target: profile.daily_carbs_target, unit: 'g' },
                  { label: 'Fat', val: insights.average.fat_g, target: profile.daily_fat_target, unit: 'g' },
                ].map((m) => (
                  <div key={m.label} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{m.label}</div>
                    <div className="text-lg font-bold text-gray-900">{Math.round(m.val)}<span className="text-xs font-normal text-gray-500 ml-1">{m.unit}</span></div>
                    <div className="text-xs text-gray-400">target: {m.target}{m.unit}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.patterns && insights.patterns.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Patterns Noticed</h3>
              <ul className="space-y-1">
                {insights.patterns.map((p, i) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-gray-400 shrink-0">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.strengths && insights.strengths.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Doing Well</h3>
              <ul className="space-y-1">
                {insights.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-green-700 flex gap-2">
                    <span className="shrink-0">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.improvements && insights.improvements.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Areas to Improve</h3>
              <div className="space-y-2">
                {insights.improvements.map((imp, i) => (
                  <div key={i} className="bg-amber-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800">{imp.issue}</p>
                    <p className="text-xs text-amber-700 mt-1">{imp.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
