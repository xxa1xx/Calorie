import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import RecipeBuilder from './RecipeBuilder'

function RecipeCard({ recipe, onLog, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-sm text-gray-900 truncate">{recipe.name}</p>
        <p className="text-xs text-gray-500">
          {recipe.calories_per_serving} kcal · P:{recipe.protein_per_serving}g C:{recipe.carbs_per_serving}g F:{recipe.fat_per_serving}g
          {recipe.servings > 1 ? ` · ${recipe.servings} servings` : ''}
        </p>
      </div>
      <div className="flex gap-2 ml-3 shrink-0">
        <button type="button" onClick={() => onEdit(recipe)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">
          Edit
        </button>
        <button type="button" onClick={() => onLog(recipe)} className="btn-primary text-xs px-3 py-1">
          Log
        </button>
      </div>
    </div>
  )
}

export default function RecipeLibrary({ onLogged }) {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editRecipe, setEditRecipe] = useState(null)
  const [servingsInput, setServingsInput] = useState({})

  const load = async () => {
    const { data } = await supabase.from('recipes').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setRecipes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  const handleLog = async (recipe) => {
    const qty = parseFloat(servingsInput[recipe.id] || 1)
    const today = new Date().toISOString().split('T')[0]
    const entry = {
      user_id: user.id,
      date: today,
      description: `${recipe.name}${qty !== 1 ? ` (×${qty} servings)` : ''}`,
      calories: Math.round(recipe.calories_per_serving * qty),
      protein_g: Math.round(recipe.protein_per_serving * qty * 10) / 10,
      carbs_g: Math.round(recipe.carbs_per_serving * qty * 10) / 10,
      fat_g: Math.round(recipe.fat_per_serving * qty * 10) / 10,
      fiber_g: Math.round((recipe.fiber_per_serving || 0) * qty * 10) / 10,
      items: [],
      feedback: null,
    }
    const { error } = await supabase.from('food_logs').insert(entry)
    if (!error) onLogged(entry)
  }

  const handleDelete = async (recipe) => {
    if (!confirm(`Delete recipe "${recipe.name}"?`)) return
    await supabase.from('recipes').delete().eq('id', recipe.id)
    setRecipes((prev) => prev.filter((r) => r.id !== recipe.id))
  }

  const handleEdit = (recipe) => { setEditRecipe(recipe); setShowBuilder(true) }

  const handleSaved = () => { setShowBuilder(false); setEditRecipe(null); load() }

  if (showBuilder) {
    return (
      <RecipeBuilder
        recipe={editRecipe}
        onSaved={handleSaved}
        onCancel={() => { setShowBuilder(false); setEditRecipe(null) }}
      />
    )
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recipes</h2>
        <button type="button" onClick={() => setShowBuilder(true)} className="btn-primary text-sm px-3 py-1.5">
          + New Recipe
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-gray-400 text-sm">Loading...</div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">📖</div>
          <p className="text-sm">No recipes yet.</p>
          <p className="text-xs mt-1">Build a recipe from food database ingredients and log it in one tap.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="space-y-1.5">
              <RecipeCard recipe={recipe} onLog={handleLog} onEdit={handleEdit} onDelete={handleDelete} />
              {recipe.servings > 1 && (
                <div className="flex items-center gap-2 px-1">
                  <label className="text-xs text-gray-500">Servings to log:</label>
                  <input
                    type="number" min="0.5" step="0.5" max={recipe.servings * 4}
                    className="input text-xs w-20 py-1"
                    value={servingsInput[recipe.id] || 1}
                    onChange={(e) => setServingsInput((p) => ({ ...p, [recipe.id]: e.target.value }))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
