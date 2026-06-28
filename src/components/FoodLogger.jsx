import { useState, useRef, lazy, Suspense } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import FoodSearch from './FoodSearch'

const BarcodeScanner = lazy(() => import('./BarcodeScanner'))

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ base64: reader.result.split(',')[1], type: file.type })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const EMPTY_MACROS = { calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' }

function MacroField({ label, value, onChange, required }) {
  return (
    <div>
      <label className="label text-xs">{label}</label>
      <input
        type="number"
        min="0"
        step="0.1"
        className="input text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder="0"
      />
    </div>
  )
}

const TABS = [
  { id: 'manual', label: 'Manual' },
  { id: 'search', label: '🔍 Search' },
  { id: 'scan', label: '📷 Scan' },
  { id: 'ai', label: '✨ AI' },
]

export default function FoodLogger({ profile, todayTotals, onLogged }) {
  const { user } = useAuth()
  const [mode, setMode] = useState('manual')
  const [description, setDescription] = useState('')
  const [macros, setMacros] = useState(EMPTY_MACROS)
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef()

  const setMacro = (key, val) => setMacros((m) => ({ ...m, [key]: val }))

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }
    const { base64, type } = await fileToBase64(file)
    setImage({ base64, type, preview: URL.createObjectURL(file) })
    setError('')
  }

  const clearImage = () => {
    if (image?.preview) URL.revokeObjectURL(image.preview)
    setImage(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const reset = () => {
    setDescription('')
    setMacros(EMPTY_MACROS)
    clearImage()
    setFeedback('')
    setError('')
  }

  const handleManual = async (e) => {
    e.preventDefault()
    if (!description.trim() || !macros.calories) return
    setLoading(true)
    setError('')

    const entry = {
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      description: description.trim(),
      calories: parseInt(macros.calories),
      protein_g: parseFloat(macros.protein_g) || 0,
      carbs_g: parseFloat(macros.carbs_g) || 0,
      fat_g: parseFloat(macros.fat_g) || 0,
      fiber_g: parseFloat(macros.fiber_g) || 0,
      items: [],
      feedback: null,
    }

    const { error: dbError } = await supabase.from('food_logs').insert(entry)
    if (dbError) { setError(dbError.message); setLoading(false); return }

    await supabase.from('favorites').upsert(
      { user_id: user.id, description: entry.description, calories: entry.calories,
        protein_g: entry.protein_g, carbs_g: entry.carbs_g, fat_g: entry.fat_g,
        fiber_g: entry.fiber_g, items: [], last_used: new Date().toISOString() },
      { onConflict: 'user_id,description' }
    ).catch(() => {})

    reset()
    onLogged(entry)
    setLoading(false)
  }

  const handleAI = async (e) => {
    e.preventDefault()
    if ((!description.trim() && !image) || loading) return
    setLoading(true)
    setFeedback('')
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/log-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: description.trim() || undefined,
          todayLog: todayTotals,
          imageBase64: image?.base64,
          imageType: image?.type,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to analyse food')
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const desc = description.trim() || 'Photo meal'
      const { error: dbError } = await supabase.from('food_logs').insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        description: desc,
        calories: data.calories,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
        fiber_g: data.fiber_g || 0,
        items: data.items || [],
        feedback: data.feedback,
      })
      if (dbError) throw dbError

      if (description.trim()) {
        await supabase.from('favorites').upsert(
          { user_id: user.id, description: desc, calories: data.calories,
            protein_g: data.protein_g, carbs_g: data.carbs_g, fat_g: data.fat_g,
            fiber_g: data.fiber_g || 0, items: data.items || [],
            last_used: new Date().toISOString() },
          { onConflict: 'user_id,description' }
        ).catch(() => {})
      }

      setFeedback(data.feedback || '')
      reset()
      onLogged(data)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next) => { setMode(next); setError(''); setFeedback('') }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Log Food</h2>
      </div>

      <div className="flex rounded-lg bg-gray-100 p-0.5 mb-4 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchMode(tab.id)}
            className={`flex-1 min-w-max px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${mode === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'manual' && (
        <form onSubmit={handleManual} className="space-y-3">
          <div>
            <label className="label text-xs">Description</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. chicken breast, brown rice, broccoli"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MacroField label="Calories (kcal) *" value={macros.calories} onChange={(v) => setMacro('calories', v)} required />
            <MacroField label="Protein (g)" value={macros.protein_g} onChange={(v) => setMacro('protein_g', v)} />
            <MacroField label="Carbs (g)" value={macros.carbs_g} onChange={(v) => setMacro('carbs_g', v)} />
            <MacroField label="Fat (g)" value={macros.fat_g} onChange={(v) => setMacro('fat_g', v)} />
          </div>
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-gray-600">+ Fiber</summary>
            <div className="mt-2 w-1/2">
              <MacroField label="Fiber (g)" value={macros.fiber_g} onChange={(v) => setMacro('fiber_g', v)} />
            </div>
          </details>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={!description.trim() || !macros.calories || loading}>
            {loading ? 'Saving...' : 'Log Food'}
          </button>
          <p className="text-xs text-center text-gray-400">No AI used — free to log</p>
        </form>
      )}

      {mode === 'search' && (
        <FoodSearch onLogged={(entry) => { onLogged(entry) }} />
      )}

      {mode === 'scan' && (
        <Suspense fallback={<div className="text-center py-6 text-gray-400 text-sm">Loading scanner...</div>}>
          <BarcodeScanner onLogged={(entry) => { onLogged(entry) }} />
        </Suspense>
      )}

      {mode === 'ai' && (
        <form onSubmit={handleAI} className="space-y-3">
          {image && (
            <div className="relative rounded-lg overflow-hidden bg-gray-100">
              <img src={image.preview} alt="Food" className="w-full max-h-48 object-cover" />
              <button type="button" onClick={clearImage}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-black/70">
                ×
              </button>
            </div>
          )}
          <div>
            <textarea
              className="input resize-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={image ? 'Add a description (optional)...' : "Describe what you ate — e.g. 'two scrambled eggs on toast with butter'"}
              disabled={loading}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAI(e) } }}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={loading}
              className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm" title="Upload photo">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImage} />
            <button type="submit" className="btn-primary flex-1" disabled={(!description.trim() && !image) || loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analysing...
                </span>
              ) : '✨ Analyse & Log'}
            </button>
          </div>
          <p className="text-xs text-center text-gray-400">Uses AI — ~$0.015 per entry</p>
        </form>
      )}

      {feedback && (
        <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-3">
          <p className="text-sm text-primary-800">{feedback}</p>
        </div>
      )}

      {mode === 'ai' && error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}
