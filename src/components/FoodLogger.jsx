import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve({ base64, type: file.type })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function FoodLogger({ profile, todayTotals, onLogged }) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [image, setImage] = useState(null) // { base64, type, preview }
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef()

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }
    const { base64, type } = await fileToBase64(file)
    setImage({ base64, type, preview: URL.createObjectURL(file) })
    setError('')
  }

  const clearImage = () => {
    if (image?.preview) URL.revokeObjectURL(image.preview)
    setImage(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleLog = async (e) => {
    e.preventDefault()
    if ((!input.trim() && !image) || loading) return

    setLoading(true)
    setFeedback('')
    setError('')

    try {
      const body = {
        description: input.trim() || undefined,
        profile,
        todayLog: todayTotals,
        imageBase64: image?.base64,
        imageType: image?.type,
      }

      const res = await fetch('/api/log-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('Failed to analyze food')
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const description = input.trim() || 'Photo meal'
      const today = new Date().toISOString().split('T')[0]

      const { error: dbError } = await supabase.from('food_logs').insert({
        user_id: user.id,
        date: today,
        description,
        calories: data.calories,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
        fiber_g: data.fiber_g || 0,
        items: data.items || [],
        feedback: data.feedback,
      })

      if (dbError) throw dbError

      // Save/update in favourites (upsert by description)
      if (input.trim()) {
        await supabase.from('favorites').upsert(
          {
            user_id: user.id,
            description,
            calories: data.calories,
            protein_g: data.protein_g,
            carbs_g: data.carbs_g,
            fat_g: data.fat_g,
            fiber_g: data.fiber_g || 0,
            items: data.items || [],
            last_used: new Date().toISOString(),
          },
          { onConflict: 'user_id,description', ignoreDuplicates: false }
        ).then(async ({ data: existing }) => {
          // Increment use_count if it already existed
          if (!existing) {
            await supabase.rpc('increment_favorite_count', { p_user_id: user.id, p_description: description })
              .catch(() => {}) // best-effort
          }
        }).catch(() => {})
      }

      setFeedback(data.feedback || '')
      setInput('')
      clearImage()
      onLogged(data)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = (input.trim() || image) && !loading

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Log Food</h2>
      <form onSubmit={handleLog} className="space-y-3">
        {image && (
          <div className="relative rounded-lg overflow-hidden bg-gray-100">
            <img src={image.preview} alt="Food" className="w-full max-h-48 object-cover" />
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              ×
            </button>
          </div>
        )}

        <div>
          <textarea
            className="input resize-none"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={image ? 'Add a description (optional)...' : "What did you eat? E.g. 'two scrambled eggs with toast' or upload a photo →"}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleLog(e)
              }
            }}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
            title="Upload photo of food"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImage}
          />
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={!canSubmit}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analysing...
              </span>
            ) : 'Log Food'}
          </button>
        </div>
      </form>

      {feedback && (
        <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-3">
          <p className="text-sm text-primary-800">{feedback}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}
