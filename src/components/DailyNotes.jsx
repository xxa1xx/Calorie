import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const MOODS = [
  { score: 1, emoji: '😞', label: 'Low' },
  { score: 2, emoji: '😕', label: 'Meh' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 5, emoji: '😄', label: 'Great' },
]

export default function DailyNotes({ onWorkoutDayChange }) {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const [meta, setMeta] = useState({ is_workout_day: false, mood: null, notes: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.from('daily_meta').select('*').eq('user_id', user.id).eq('date', today).single()
      .then(({ data }) => {
        if (data) {
          setMeta({ is_workout_day: data.is_workout_day, mood: data.mood, notes: data.notes || '' })
          onWorkoutDayChange?.(data.is_workout_day)
        }
      })
  }, [user.id, today])

  const save = async (patch) => {
    const updated = { ...meta, ...patch }
    setMeta(updated)
    setSaved(false)
    setSaving(true)

    await supabase.from('daily_meta').upsert(
      {
        user_id: user.id,
        date: today,
        is_workout_day: updated.is_workout_day,
        mood: updated.mood,
        notes: updated.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    )

    if ('is_workout_day' in patch) onWorkoutDayChange?.(patch.is_workout_day)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Daily Notes</h2>
          <div className="flex gap-2 items-center">
            {meta.is_workout_day && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">💪 Workout Day</span>
            )}
            {meta.mood && (
              <span className="text-base">{MOODS.find((m) => m.score === meta.mood)?.emoji}</span>
            )}
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Workout Day</span>
            <button
              type="button"
              onClick={() => save({ is_workout_day: !meta.is_workout_day })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${meta.is_workout_day ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${meta.is_workout_day ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Mood</p>
            <div className="flex gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.score}
                  type="button"
                  onClick={() => save({ mood: meta.mood === m.score ? null : m.score })}
                  className={`flex-1 flex flex-col items-center py-2 rounded-xl border-2 transition-all text-xl ${meta.mood === m.score ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                  title={m.label}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Notes</label>
            <textarea
              className="input resize-none text-sm"
              rows={3}
              value={meta.notes}
              onChange={(e) => setMeta((m) => ({ ...m, notes: e.target.value }))}
              onBlur={() => save({ notes: meta.notes })}
              placeholder="How are you feeling today? Any observations about your diet or energy..."
            />
          </div>

          <div className="flex items-center justify-between">
            {saved && <span className="text-xs text-primary-600">✓ Saved</span>}
            {saving && <span className="text-xs text-gray-400">Saving...</span>}
          </div>
        </div>
      )}
    </div>
  )
}
