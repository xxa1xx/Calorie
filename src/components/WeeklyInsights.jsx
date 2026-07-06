import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function InsightBody({ insights, profile }) {
  return (
    <div className="space-y-5">
      <div className={`flex items-center gap-2 p-3 rounded-lg ${insights.onTrack ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
        <span className="text-xl">{insights.onTrack ? '✅' : '⚠️'}</span>
        <p className="text-sm font-medium">{insights.weekSummary}</p>
      </div>

      {insights.trendComparison && (
        <div className="bg-blue-50 rounded-lg p-3">
          <h3 className="text-sm font-semibold text-blue-800 mb-1">Compared with Past Insights</h3>
          <p className="text-sm text-blue-700">{insights.trendComparison}</p>
        </div>
      )}

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
                <div className="text-lg font-bold text-gray-900">
                  {Math.round(m.val)}<span className="text-xs font-normal text-gray-500 ml-1">{m.unit}</span>
                </div>
                <div className="text-xs text-gray-400">target: {m.target}{m.unit}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.patterns?.length > 0 && (
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

      {insights.strengths?.length > 0 && (
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

      {insights.improvements?.length > 0 && (
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
  )
}

export default function WeeklyInsights({ profile, weeklyLogs }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [history, setHistory] = useState([])    // all rows, newest first
  const [selectedId, setSelectedId] = useState(null)  // null = show history[0]
  const [historyOpen, setHistoryOpen] = useState(false)
  const [error, setError] = useState('')
  const [saveWarning, setSaveWarning] = useState('')

  const displayed = selectedId ? history.find((r) => r.id === selectedId) : history[0]
  const isViewingOld = selectedId !== null

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('weekly_insights')
      .select('id, analysis, generated_at, period_start, period_end')
      .eq('user_id', user.id)
      .order('generated_at', { ascending: false })
      .limit(30)
    if (data) setHistory(data)
  }, [user.id])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    const init = async () => {
      // Show localStorage cache immediately while DB loads
      const storageKey = `calorieai:last-insight:${user.id}`
      try {
        const cached = localStorage.getItem(storageKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (!cancelled && parsed?.insight) {
            setHistory([{
              id: '__cache__',
              analysis: parsed.insight,
              generated_at: parsed.generatedAt,
              period_start: parsed.periodStart,
              period_end: parsed.periodEnd,
            }])
          }
        }
      } catch (_) {}

      await loadHistory()
      if (!cancelled) setLoadingSaved(false)
    }

    init()
    return () => { cancelled = true }
  }, [user?.id, loadHistory])

  const fetchInsights = async () => {
    if (!weeklyLogs || weeklyLogs.length === 0) {
      setError('Log at least a few days of food to get weekly insights.')
      return
    }
    setLoading(true)
    setError('')
    setSaveWarning('')
    setSelectedId(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not signed in')

      const res = await fetch('/api/get-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ weeklyLogs }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to get insights')
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const { _meta, ...analysis } = data

      try {
        localStorage.setItem(`calorieai:last-insight:${user.id}`, JSON.stringify({
          insight: analysis,
          generatedAt: _meta?.generatedAt,
          periodStart: _meta?.periodStart,
          periodEnd: _meta?.periodEnd,
        }))
      } catch (_) {}

      if (_meta?.saved === false) setSaveWarning('Generated but could not be saved to history.')

      await loadHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingSaved(false)
    }
  }

  const pastHistory = history.slice(1) // everything except the current newest

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Weekly Insights</h2>
          {displayed?.generated_at && (
            <p className="text-xs text-gray-400 mt-0.5">
              {isViewingOld ? 'Viewing past · ' : 'Latest · '}
              {formatDate(displayed.generated_at)}
              {displayed.period_start ? ` · ${displayed.period_start} to ${displayed.period_end}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isViewingOld && (
            <button type="button" onClick={() => setSelectedId(null)} className="text-sm text-primary-600 font-medium whitespace-nowrap">
              ← Latest
            </button>
          )}
          <button
            onClick={fetchInsights}
            disabled={loading || loadingSaved}
            className="text-sm btn-secondary py-1.5 px-3"
          >
            {loading ? 'Analyzing...' : displayed ? 'New Analysis' : 'Analyze Week'}
          </button>
        </div>
      </div>

      {loadingSaved && history.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm">Loading saved insights...</div>
      )}

      {!displayed && !loading && !loadingSaved && (
        <div className="text-center py-6 text-gray-500">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm">Get AI analysis of your weekly eating patterns, trends, and personalized recommendations.</p>
          <p className="text-sm text-gray-400 mt-1">{weeklyLogs?.length || 0} days of data available</p>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>}
      {saveWarning && <div className="bg-amber-50 text-amber-800 text-xs rounded-lg p-3 mb-4">{saveWarning}</div>}

      {displayed?.analysis && (
        <InsightBody insights={displayed.analysis} profile={profile} />
      )}

      {pastHistory.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between text-sm text-gray-600 font-medium"
          >
            <span>Past Analyses ({pastHistory.length})</span>
            <svg className={`w-4 h-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {historyOpen && (
            <div className="mt-3 space-y-2">
              {pastHistory.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => { setSelectedId(row.id); setHistoryOpen(false) }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${selectedId === row.id ? 'border-primary-400 bg-primary-50' : 'border-gray-100 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-700">
                      {row.period_start} → {row.period_end}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${row.analysis?.onTrack ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {row.analysis?.onTrack ? 'On track' : 'Needs work'}
                    </span>
                  </div>
                  {row.analysis?.weekSummary && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{row.analysis.weekSummary}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatDate(row.generated_at)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
