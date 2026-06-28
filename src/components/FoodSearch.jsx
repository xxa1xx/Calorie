import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { searchFoods, extractNutrients } from '../lib/openFoodFacts'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function FoodSearch({ onLogged }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [amount, setAmount] = useState('100')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const debouncedQuery = useDebounce(query, 400)
  const inputRef = useRef()

  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults([]); return }
    setSearching(true)
    searchFoods(debouncedQuery).then((r) => {
      setResults(r)
      setSearching(false)
    })
  }, [debouncedQuery])

  const handleSelect = (product) => {
    setSelected(product)
    setResults([])
    setQuery(product.product_name || '')
    setError('')
  }

  const handleLog = async (e) => {
    e.preventDefault()
    if (!selected) return
    const g = parseFloat(amount)
    if (!g || g <= 0) { setError('Enter a valid amount'); return }

    const nutrients = extractNutrients(selected, g)
    if (!nutrients.calories) { setError('No calorie data for this product'); return }

    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const entry = {
      user_id: user.id,
      date: today,
      description: `${nutrients.description} (${g}g)`,
      calories: nutrients.calories,
      protein_g: nutrients.protein_g,
      carbs_g: nutrients.carbs_g,
      fat_g: nutrients.fat_g,
      fiber_g: nutrients.fiber_g,
      items: [],
      feedback: null,
    }

    const { error: dbError } = await supabase.from('food_logs').insert(entry)
    if (dbError) { setError(dbError.message); setSaving(false); return }

    await supabase.from('favorites').upsert(
      { user_id: user.id, description: entry.description, calories: entry.calories,
        protein_g: entry.protein_g, carbs_g: entry.carbs_g, fat_g: entry.fat_g,
        fiber_g: entry.fiber_g, items: [], last_used: new Date().toISOString() },
      { onConflict: 'user_id,description' }
    ).catch(() => {})

    setSelected(null)
    setQuery('')
    setAmount('100')
    setSaving(false)
    onLogged(entry)
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            className="input pl-9"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
            placeholder="Search food database (e.g. banana, chicken breast)"
          />
          {searching && (
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>

        {results.length > 0 && !selected && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {results.map((p, i) => {
              const kcal = p.nutriments?.['energy-kcal_100g'] || Math.round((p.nutriments?.energy_100g || 0) / 4.184)
              return (
                <button
                  key={p.code || i}
                  type="button"
                  onClick={() => handleSelect(p)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center gap-3"
                >
                  {p.image_thumb_url && (
                    <img src={p.image_thumb_url} alt="" className="w-10 h-10 rounded object-cover shrink-0 bg-gray-100" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{p.product_name}</div>
                    <div className="text-xs text-gray-400">{p.brands || ''} {kcal ? `· ${kcal} kcal/100g` : ''}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <form onSubmit={handleLog} className="bg-primary-50 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            {selected.image_thumb_url && (
              <img src={selected.image_thumb_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-100" />
            )}
            <div>
              <p className="font-medium text-sm text-gray-900">{selected.product_name}</p>
              {selected.brands && <p className="text-xs text-gray-500">{selected.brands}</p>}
            </div>
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="label text-xs">Amount (grams)</label>
              <input
                type="number"
                className="input text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="1"
                required
              />
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500 mb-1">Estimated</p>
              <p className="font-bold text-gray-900">{extractNutrients(selected, parseFloat(amount) || 0).calories} kcal</p>
            </div>
          </div>

          {(() => {
            const n = extractNutrients(selected, parseFloat(amount) || 0)
            return (
              <div className="flex gap-3 text-xs text-gray-600">
                <span>P: {n.protein_g}g</span>
                <span>C: {n.carbs_g}g</span>
                <span>F: {n.fat_g}g</span>
                {n.fiber_g > 0 && <span>Fiber: {n.fiber_g}g</span>}
              </div>
            )
          })()}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={() => { setSelected(null); setQuery('') }} className="btn-secondary flex-1 text-sm">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 text-sm" disabled={saving}>
              {saving ? 'Logging...' : 'Log Food'}
            </button>
          </div>
        </form>
      )}

      {!selected && query.length >= 2 && !searching && results.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">No results found — try a different term</p>
      )}
      <p className="text-xs text-center text-gray-400">Data from Open Food Facts — free, no API key</p>
    </div>
  )
}
