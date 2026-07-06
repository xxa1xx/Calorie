import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function CravingCoach() {
  const [open, setOpen] = useState(false)
  const [craving, setCraving] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!craving.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/craving-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ craving }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }
      setResult(data)
    } catch {
      setError('Could not connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setResult(null)
    setCraving('')
    setError('')
  }

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <div>
            <p className="font-semibold text-gray-900">Craving Coach</p>
            <p className="text-xs text-gray-500">Get healthier alternatives for what you're craving</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                className="input resize-none text-sm"
                rows={2}
                value={craving}
                onChange={(e) => setCraving(e.target.value)}
                placeholder="What are you craving? (e.g. something sweet and chocolatey)"
                maxLength={200}
                disabled={loading}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                className="btn-primary w-full text-sm"
                disabled={loading || !craving.trim()}
              >
                {loading ? 'Finding alternatives...' : 'Get Healthier Options'}
              </button>
              <p className="text-xs text-center text-gray-400">5 uses per day · Powered by AI</p>
            </form>
          ) : (
            <div className="space-y-3">
              {result.encouragement && (
                <p className="text-sm text-primary-700 bg-primary-50 rounded-lg px-3 py-2">
                  {result.encouragement}
                </p>
              )}
              {result.alternatives?.map((alt, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-gray-900">{alt.name}</p>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">~{alt.calories} kcal</span>
                  </div>
                  <p className="text-xs text-gray-600">{alt.why}</p>
                  {alt.tip && <p className="text-xs text-gray-400 italic">{alt.tip}</p>}
                </div>
              ))}
              <button type="button" onClick={handleReset} className="btn-secondary w-full text-sm">
                Try another craving
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
