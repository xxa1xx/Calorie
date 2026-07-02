import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import FoodSearch from './FoodSearch'

const BarcodeScanner = lazy(() => import('./BarcodeScanner'))
const EMPTY_MACROS = { calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' }
const TABS = [
  { id: 'manual', label: 'Manual' },
  { id: 'search', label: '🔍 Search' },
  { id: 'scan', label: '📷 Scan' },
  { id: 'ai', label: '✨ AI' },
]

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ base64: reader.result.split(',')[1], type: file.type })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function MacroField({ label, value, onChange, required }) {
  return <div><label className="label text-xs">{label}</label><input type="number" min="0" step="0.1" className="input text-sm" value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder="0" /></div>
}

function savedPending(userId) {
  if (!userId) return null
  try { return JSON.parse(localStorage.getItem(`calorieai:pending-food:${userId}`)) || null } catch { return null }
}

export default function FoodLogger({ profile, todayTotals, onLogged }) {
  const { user } = useAuth()
  const [mode, setMode] = useState('manual')
  const [description, setDescription] = useState('')
  const [macros, setMacros] = useState(EMPTY_MACROS)
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingEntry, setPendingEntry] = useState(() => savedPending(user?.id))
  const fileRef = useRef()
  const pendingKey = user?.id ? `calorieai:pending-food:${user.id}` : null

  useEffect(() => {
    if (!pendingKey) return
    try {
      if (pendingEntry) localStorage.setItem(pendingKey, JSON.stringify(pendingEntry))
      else localStorage.removeItem(pendingKey)
    } catch (_) {}
  }, [pendingEntry, pendingKey])

  const clearImage = () => {
    if (image?.preview) URL.revokeObjectURL(image.preview)
    setImage(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const reset = () => {
    setDescription('')
    setMacros(EMPTY_MACROS)
    clearImage()
    setError('')
    setPendingEntry(null)
  }

  const handleManual = async (e) => {
    e.preventDefault()
    if (!description.trim() || !macros.calories) return
    setLoading(true)
    const entry = {
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      description: description.trim(),
      calories: parseInt(macros.calories),
      protein_g: parseFloat(macros.protein_g) || 0,
      carbs_g: parseFloat(macros.carbs_g) || 0,
      fat_g: parseFloat(macros.fat_g) || 0,
      fiber_g: parseFloat(macros.fiber_g) || 0,
      items: [], feedback: null,
    }
    const { error: dbError } = await supabase.from('food_logs').insert(entry)
    if (dbError) { setError(dbError.message); setLoading(false); return }
    reset(); onLogged(entry); setLoading(false)
  }

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }
    const { base64, type } = await fileToBase64(file)
    setImage({ base64, type, preview: URL.createObjectURL(file) })
    setError('')
  }

  const handleAI = async (e) => {
    e.preventDefault()
    if ((!description.trim() && !image) || loading) return
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not signed in')
      const res = await fetch('/api/log-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ description: description.trim() || undefined, todayLog: todayTotals, imageBase64: image?.base64, imageType: image?.type }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to analyse food') }
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPendingEntry({
        description: description.trim() || data.items?.map((i) => i.name).join(', ') || 'Photo meal',
        calories: data.calories,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
        fiber_g: data.fiber_g || 0,
        items: data.items || [],
        feedback: data.feedback || '',
      })
    } catch (err) { setError(err.message || 'Something went wrong') }
    finally { setLoading(false) }
  }

  const handleConfirmLog = async () => {
    if (!pendingEntry) return
    setLoading(true); setError('')
    try {
      const now = new Date().toISOString()
      const date = now.split('T')[0]
      const detected = Array.isArray(pendingEntry.items) ? pendingEntry.items.filter((i) => i?.name) : []
      const entries = detected.length > 1
        ? detected.map((item, index) => ({
            user_id: user.id, date,
            description: item.amount ? `${item.name} — ${item.amount}` : item.name,
            calories: parseInt(item.calories) || 0,
            protein_g: parseFloat(item.protein_g) || 0,
            carbs_g: parseFloat(item.carbs_g) || 0,
            fat_g: parseFloat(item.fat_g) || 0,
            fiber_g: parseFloat(item.fiber_g) || 0,
            items: [item],
            feedback: index === 0 ? pendingEntry.feedback : null,
            logged_at: now,
          }))
        : [{
            user_id: user.id, date, description: pendingEntry.description,
            calories: parseInt(pendingEntry.calories) || 0,
            protein_g: parseFloat(pendingEntry.protein_g) || 0,
            carbs_g: parseFloat(pendingEntry.carbs_g) || 0,
            fat_g: parseFloat(pendingEntry.fat_g) || 0,
            fiber_g: parseFloat(pendingEntry.fiber_g) || 0,
            items: pendingEntry.items, feedback: pendingEntry.feedback, logged_at: now,
          }]
      const { error: dbError } = await supabase.from('food_logs').insert(entries)
      if (dbError) throw dbError
      try {
        await supabase.from('favorites').upsert(entries.map((entry) => ({
          user_id: user.id, description: entry.description, calories: entry.calories,
          protein_g: entry.protein_g, carbs_g: entry.carbs_g, fat_g: entry.fat_g,
          fiber_g: entry.fiber_g, items: entry.items, last_used: now,
        })), { onConflict: 'user_id,description' })
      } catch (_) {}
      reset(); onLogged(entries)
    } catch (err) { setError(err.message || 'Failed to log entry') }
    finally { setLoading(false) }
  }

  const switchMode = (next) => { setMode(next); setError(''); if (next !== 'ai') setPendingEntry(null) }

  return <div className="card">
    <h2 className="text-lg font-semibold mb-4">Log Food</h2>
    <div className="flex rounded-lg bg-gray-100 p-0.5 mb-4 overflow-x-auto">{TABS.map((tab) => <button key={tab.id} type="button" onClick={() => switchMode(tab.id)} className={`flex-1 min-w-max px-2.5 py-1.5 text-xs font-medium rounded-md ${mode === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>{tab.label}</button>)}</div>

    {mode === 'manual' && <form onSubmit={handleManual} className="space-y-3">
      <div><label className="label text-xs">Description</label><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. chicken breast, brown rice, broccoli" required /></div>
      <div className="grid grid-cols-2 gap-2">
        <MacroField label="Calories (kcal) *" value={macros.calories} onChange={(v) => setMacros((m) => ({ ...m, calories: v }))} required />
        <MacroField label="Protein (g)" value={macros.protein_g} onChange={(v) => setMacros((m) => ({ ...m, protein_g: v }))} />
        <MacroField label="Carbs (g)" value={macros.carbs_g} onChange={(v) => setMacros((m) => ({ ...m, carbs_g: v }))} />
        <MacroField label="Fat (g)" value={macros.fat_g} onChange={(v) => setMacros((m) => ({ ...m, fat_g: v }))} />
        <MacroField label="Fiber (g)" value={macros.fiber_g} onChange={(v) => setMacros((m) => ({ ...m, fiber_g: v }))} />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={!description.trim() || !macros.calories || loading}>{loading ? 'Saving...' : 'Log Food'}</button>
      <p className="text-xs text-center text-gray-400">No AI used — free to log</p>
    </form>}

    {mode === 'search' && <FoodSearch onLogged={onLogged} />}
    {mode === 'scan' && <Suspense fallback={<div className="text-center py-6 text-gray-400 text-sm">Loading scanner...</div>}><BarcodeScanner onLogged={onLogged} /></Suspense>}

    {mode === 'ai' && !pendingEntry && <form onSubmit={handleAI} className="space-y-3">
      {image && <div className="relative rounded-lg overflow-hidden bg-gray-100"><img src={image.preview} alt="Food" className="w-full max-h-48 object-cover" /><button type="button" onClick={clearImage} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7">×</button></div>}
      <textarea className="input resize-none" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={image ? 'Add a description (optional)...' : "Describe what you ate — e.g. 'two scrambled eggs on toast with butter'"} disabled={loading} />
      <div className="flex gap-2"><button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary">📷 Photo</button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} /><button type="submit" className="btn-primary flex-1" disabled={(!description.trim() && !image) || loading}>{loading ? 'Analysing...' : '✨ Analyse'}</button></div>
      <p className="text-xs text-center text-gray-400">Uses AI — ~$0.015 per analysis</p>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
    </form>}

    {mode === 'ai' && pendingEntry && <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800 font-medium">AI analysis saved while you review it. {pendingEntry.items?.length > 1 ? `${pendingEntry.items.length} foods will be logged separately.` : ''}</div>
      {pendingEntry.items?.length > 0 && <div className="bg-gray-50 rounded-lg p-3 space-y-1"><p className="text-xs font-medium text-gray-500 mb-2">Items detected</p>{pendingEntry.items.map((item, i) => <div key={i} className="flex justify-between text-sm"><span>{item.name} <span className="text-gray-400">{item.amount}</span></span><span className="text-gray-500">{item.calories} kcal</span></div>)}</div>}
      <div><label className="label text-xs">Description</label><input className="input" value={pendingEntry.description} onChange={(e) => setPendingEntry((p) => ({ ...p, description: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-2">{[
        ['calories','Calories (kcal)'],['protein_g','Protein (g)'],['carbs_g','Carbs (g)'],['fat_g','Fat (g)'],['fiber_g','Fiber (g)']
      ].map(([key,label]) => <div key={key}><label className="label text-xs">{label}</label><input type="number" min="0" step="0.1" className="input text-sm" value={pendingEntry[key]} onChange={(e) => setPendingEntry((p) => ({ ...p, [key]: e.target.value }))} /></div>)}</div>
      {pendingEntry.feedback && <p className="text-xs text-primary-700 bg-primary-50 rounded-lg p-3">{pendingEntry.feedback}</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
      <div className="flex gap-2"><button type="button" onClick={() => setPendingEntry(null)} className="btn-secondary flex-1">Re-analyse</button><button type="button" onClick={handleConfirmLog} disabled={loading || !pendingEntry.description || !pendingEntry.calories} className="btn-primary flex-1">{loading ? 'Logging...' : pendingEntry.items?.length > 1 ? `Log ${pendingEntry.items.length} Items` : 'Confirm & Log'}</button></div>
    </div>}
  </div>
}
