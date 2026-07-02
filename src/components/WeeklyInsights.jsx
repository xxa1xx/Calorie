import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function formatSavedDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function WeeklyInsights({ profile, weeklyLogs }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [insights, setInsights] = useState(null)
  const [error, setError] = useState('')
  const [saveWarning, setSaveWarning] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [period, setPeriod] = useState(null)

  const storageKey = user?.id ? `calorieai:last-insight:${user.id}` : null

  useEffect(() => {
    if (!user?.id || !storageKey) return
    let cancelled = false

    const loadSavedInsight = async () => {
      let hadCachedInsight = false
      try {
        const cached = localStorage.getItem(storageKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (!cancelled && parsed?.insight) {
            hadCachedInsight = true
            setInsights(parsed.insight)
            setSavedAt(parsed.generatedAt || null)
            setPeriod(parsed.periodStart && parsed.periodEnd
              ? { start: parsed.periodStart, end: parsed.periodEnd }
              : null)
          }
        }
      } catch (_) {
        try { localStorage.removeItem(storageKey) } catch (_) {}
      }

      const { data, error: loadError } = await supabase
        .from('weekly_insights')
        .select('analysis, generated_at, period_start, period_end')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (data?.analysis) {
        setInsights(data.analysis)
        setSavedAt(data.generated_at)
        setPeriod({ start: data.period_start, end: data.period_end })
        setSaveWarning('')
        try {
          localStorage.setItem(storageKey, JSON.stringify({
            insight: data.analysis,
            generatedAt: data.generated_at,
            periodStart: data.period_start,
            periodEnd: data.period_end,
          }))
        } catch (_) {}
      } else if (loadError && hadCachedInsight) {
        setSaveWarning('The latest insight is saved on this device, but long-term insight history is not available yet.')
      }

      setLoadingSaved(false)
    }

    loadSavedInsight()
    return () => { cancelled = true }
  }, [storageKey, user?.id])

  const fetchInsights = async () => {
    if (!weeklyLogs || weeklyLogs.length === 0) {
      setError('Log at least a few days of food to get weekly insights.')
      return
    }

    setLoading(true)
    setError('')
    setSaveWarning('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/get-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ weeklyLogs }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to get insights')
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const { _meta, ...analysis } = data
      const generatedAt = _meta?.generatedAt || new Date().toISOString()
      const nextPeriod = _meta?.periodStart && _meta?.periodEnd
        ? { start: _meta.periodStart, end: _meta.periodEnd }
        : null

      setInsights(analysis)
      setSavedAt(generatedAt)
      setPeriod(nextPeriod)

      try {
        localStorage.setItem(storageKey, JSON.stringify({
          insight: analysis,
          generatedAt,
          periodStart: nextPeriod?.start,
          periodEnd: nextPeriod?.end,
        }))
      } catch (_) {}

      if (_meta?.saved === false) {
        setSaveWarning('This insight is saved on this device, but it could not be added to long-term history.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingSaved(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Weekly Insights</h2>
          {savedAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last saved {formatSavedDate(savedAt)}
              {period ? ` · ${period.start} to ${period.end}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading || loadingSaved}
          className="text-sm btn-secondary py-1.5 px-3 shrink-0"
        >
          {loading ? 'Analyzing...' : insights ? 'Refresh' : 'Analyze Week'}
        </button>
      </div>

      {loadingSaved && !insights && (
        <div className="text-center py-6 text-gray-400 text-sm">Loading your last saved insight...</div>
      )}

      {!insights && !loading && !loadingSaved && (
        <div className="text-center py-6 text-gray-500">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm">Get AI analysis of your weekly eating patterns, trends, and personalized recommendations.</p>
          <p className="text-sm text-gray-400 mt-1">{weeklyLogs?.length || 0} days of data available</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {saveWarning && (
        <div className="bg-amber-50 text-amber-800 text-xs rounded-lg p-3 mb-4">{saveWarning}</div>
      )}

      {insights && (
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
