import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function QuickLog({ onLogged }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState([])
  const [logging, setLogging] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('use_count', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) setFavorites(data)
      })
  }, [user.id])

  if (favorites.length === 0) return null

  const handleQuickLog = async (fav) => {
    setLogging(fav.id)
    setError('')
    const today = new Date().toISOString().split('T')[0]

    const { error: logError } = await supabase.from('food_logs').insert({
      user_id: user.id,
      date: today,
      description: fav.description,
      calories: fav.calories,
      protein_g: fav.protein_g,
      carbs_g: fav.carbs_g,
      fat_g: fav.fat_g,
      fiber_g: fav.fiber_g || 0,
      items: fav.items || [],
      feedback: null,
    })

    if (!logError) {
      await supabase
        .from('favorites')
        .update({ use_count: fav.use_count + 1, last_used: new Date().toISOString() })
        .eq('id', fav.id)

      onLogged({
        calories: fav.calories,
        protein_g: fav.protein_g,
        carbs_g: fav.carbs_g,
        fat_g: fav.fat_g,
      })
    } else {
      setError('Could not add that item. Please try again.')
    }
    setLogging(null)
  }

  const handleRemove = async (fav) => {
    const confirmed = window.confirm(`Remove “${fav.description}” from Quick Log?`)
    if (!confirmed) return

    setRemoving(fav.id)
    setError('')

    const { error: removeError } = await supabase
      .from('favorites')
      .delete()
      .eq('id', fav.id)
      .eq('user_id', user.id)

    if (removeError) {
      setError('Could not remove that Quick Log item. Please try again.')
    } else {
      setFavorites((current) => current.filter((item) => item.id !== fav.id))
    }

    setRemoving(null)
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-700">Quick Log</h2>
        <button
          type="button"
          onClick={() => setEditing((current) => !current)}
          className="text-xs font-medium text-gray-500 hover:text-primary-600 px-2 py-1 rounded-md hover:bg-gray-100"
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {favorites.map((fav) => (
          <div
            key={fav.id}
            className="min-w-0 flex items-stretch gap-2"
          >
            <button
              type="button"
              onClick={() => handleQuickLog(fav)}
              disabled={logging === fav.id || removing === fav.id}
              className="min-w-0 flex-1 flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-100 hover:bg-primary-50 hover:border-primary-300 border border-gray-200 rounded-xl text-sm text-gray-700 text-left transition-colors disabled:opacity-50"
              title={`${fav.description} · ${fav.calories} kcal · P:${Math.round(fav.protein_g)}g C:${Math.round(fav.carbs_g)}g F:${Math.round(fav.fat_g)}g`}
            >
              <span className="min-w-0 flex flex-1 items-start gap-2">
                {logging === fav.id ? (
                  <svg className="animate-spin h-4 w-4 mt-0.5 shrink-0 text-primary-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span className="text-sm shrink-0">⚡</span>
                )}
                <span className="min-w-0 whitespace-normal break-words leading-5">{fav.description}</span>
              </span>
              <span className="text-xs text-gray-500 shrink-0">{fav.calories} cal</span>
            </button>

            {editing && (
              <button
                type="button"
                onClick={() => handleRemove(fav)}
                disabled={logging === fav.id || removing === fav.id}
                className="w-11 shrink-0 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                aria-label={`Remove ${fav.description} from Quick Log`}
                title="Remove from Quick Log"
              >
                {removing === fav.id ? (
                  <svg className="animate-spin h-4 w-4 mx-auto" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8" />
                  </svg>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2 mt-3">{error}</p>}
    </div>
  )
}
