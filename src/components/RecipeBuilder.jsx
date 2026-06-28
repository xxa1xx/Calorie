import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { searchFoods, extractNutrients } from '../lib/openFoodFacts'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useState(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  })
  return debounced
}

function IngredientSearch({ onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [amount, setAmount] = useState('100')

  const handleSearch = async (q) => {
    setQuery(q)
    setSelected(null)
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    const r = await searchFoods(q)
    setResults(r)
    setSearching(false)
  }

  const handleAdd = () => {
    if (!selected) return
    const g = parseFloat(amount)
    if (!g) return
    const n = extractNutrients(selected, g)
    onAdd({ name: selected.product_name, amountG: g, ...n })
    setSelected(null)
    setQuery('')
    setResults([])
    setAmount('100')
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          className="input text-sm"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search ingredient..."
        />
        {results.length > 0 && !selected && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {results.map((p, i) => {
              const kcal = p.nutriments?.['energy-kcal_100g'] || Math.round((p.nutriments?.energy_100g || 0) / 4.184)
              return (
                <button key={p.code || i} type="button"
                  onClick={() => { setSelected(p); setResults([]); setQuery(p.product_name) }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm">
                  <span className="font-medium">{p.product_name}</span>
                  {kcal ? <span className="text-xs text-gray-400 ml-2">· {kcal} kcal/100g</span> : null}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {selected && (
        <div className="flex gap-2 items-center">
          <input
            type="number" min="1" step="1"
            className="input text-sm w-28"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="grams"
          />
          <span className="text-xs text-gray-500">g</span>
          <button type="button" onClick={handleAdd} className="btn-primary text-sm px-3 py-1.5">Add</button>
          <button type="button" onClick={() => { setSelected(null); setQuery('') }} className="text-gray-400 hover:text-gray-600 text-sm">×</button>
        </div>
      )}
    </div>
  )
}

export default function RecipeBuilder({ recipe: editRecipe, onSaved, onCancel }) {
  const { user } = useAuth()
  const [name, setName] = useState(editRecipe?.name || '')
  const [servings, setServings] = useState(editRecipe?.servings || 1)
  const [ingredients, setIngredients] = useState(editRecipe?.ingredients || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addIngredient = (ing) => setIngredients((prev) => [...prev, { ...ing, id: Date.now() }])
  const removeIngredient = (id) => setIngredients((prev) => prev.filter((i) => i.id !== id))

  const totals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + (ing.calories || 0),
      protein_g: acc.protein_g + (ing.protein_g || 0),
      carbs_g: acc.carbs_g + (ing.carbs_g || 0),
      fat_g: acc.fat_g + (ing.fat_g || 0),
      fiber_g: acc.fiber_g + (ing.fiber_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  )

  const perServing = (val) => Math.round((val / Math.max(1, servings)) * 10) / 10

  const handleSave = async () => {
    if (!name.trim() || ingredients.length === 0) { setError('Add a name and at least one ingredient'); return }
    setSaving(true)
    setError('')

    const payload = {
      user_id: user.id,
      name: name.trim(),
      servings: parseFloat(servings) || 1,
      ingredients,
      calories_per_serving: Math.round(totals.calories / Math.max(1, servings)),
      protein_per_serving: perServing(totals.protein_g),
      carbs_per_serving: perServing(totals.carbs_g),
      fat_per_serving: perServing(totals.fat_g),
      fiber_per_serving: perServing(totals.fiber_g),
    }

    let dbError
    if (editRecipe?.id) {
      ({ error: dbError } = await supabase.from('recipes').update(payload).eq('id', editRecipe.id))
    } else {
      ({ error: dbError } = await supabase.from('recipes').insert(payload))
    }

    if (dbError) { setError(dbError.message); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{editRecipe ? 'Edit Recipe' : 'New Recipe'}</h2>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
      </div>

      <div>
        <label className="label text-xs">Recipe Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Protein Pancakes" />
      </div>

      <div>
        <label className="label text-xs">Number of Servings</label>
        <input type="number" min="0.5" step="0.5" className="input w-32" value={servings} onChange={(e) => setServings(e.target.value)} />
      </div>

      <div>
        <label className="label text-xs">Ingredients</label>
        <IngredientSearch onAdd={addIngredient} />
      </div>

      {ingredients.length > 0 && (
        <div className="space-y-1.5">
          {ingredients.map((ing) => (
            <div key={ing.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <span className="text-sm font-medium text-gray-800">{ing.name}</span>
                <span className="text-xs text-gray-500 ml-2">{ing.amountG}g · {ing.calories} kcal</span>
              </div>
              <button type="button" onClick={() => removeIngredient(ing.id)} className="text-gray-400 hover:text-red-500 text-sm font-medium">×</button>
            </div>
          ))}
        </div>
      )}

      {ingredients.length > 0 && (
        <div className="bg-primary-50 rounded-xl p-3 space-y-1">
          <p className="text-xs font-semibold text-primary-800">Per Serving ({servings} total)</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-primary-700">
            <span>Calories: {Math.round(totals.calories / Math.max(1, servings))} kcal</span>
            <span>Protein: {perServing(totals.protein_g)}g</span>
            <span>Carbs: {perServing(totals.carbs_g)}g</span>
            <span>Fat: {perServing(totals.fat_g)}g</span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}

      <button onClick={handleSave} disabled={saving || !name.trim() || ingredients.length === 0} className="btn-primary w-full">
        {saving ? 'Saving...' : editRecipe ? 'Update Recipe' : 'Save Recipe'}
      </button>
    </div>
  )
}
