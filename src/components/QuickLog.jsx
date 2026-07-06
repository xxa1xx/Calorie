import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function QuickLog({ onLogged }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState([])
  const [logging, setLogging] = useState(null)

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
    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('food_logs').insert({
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

    if (!error) {
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
    }
    setLogging(null)
  }

  return (
    <div className="card">
      <h2 className="text-base font-semibold text-gray-700 mb-3">Quick Log</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {favorites.map((fav) => (
          <button
            key={fav.id}
            onClick={() => handleQuickLog(fav)}
            disabled={logging === fav.id}
            className="w-full min-w-0 flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-100 hover:bg-primary-50 hover:border-primary-300 border border-gray-200 rounded-xl text-sm text-gray-700 text-left transition-colors disabled:opacity-50"
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
        ))}
      </div>
    </div>
  )
}
