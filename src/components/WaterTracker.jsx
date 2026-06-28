import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const DAILY_TARGET = 8

export default function WaterTracker() {
  const { user } = useAuth()
  const [glasses, setGlasses] = useState(0)
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    supabase
      .from('water_logs')
      .select('glasses')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setGlasses(data.glasses)
      })
  }, [user.id, today])

  const update = async (next) => {
    const clamped = Math.max(0, Math.min(20, next))
    setGlasses(clamped)
    setSaving(true)
    await supabase
      .from('water_logs')
      .upsert({ user_id: user.id, date: today, glasses: clamped, updated_at: new Date().toISOString() },
               { onConflict: 'user_id,date' })
    setSaving(false)
  }

  const pct = Math.min(100, Math.round((glasses / DAILY_TARGET) * 100))

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Water</h2>
        <span className="text-sm text-gray-500">{glasses} / {DAILY_TARGET} glasses</span>
      </div>

      <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 bg-blue-400"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {Array.from({ length: DAILY_TARGET }).map((_, i) => (
            <button
              key={i}
              onClick={() => update(i < glasses ? i : i + 1)}
              className={`text-lg transition-transform hover:scale-110 ${i < glasses ? 'opacity-100' : 'opacity-25'}`}
              title={`${i + 1} glass${i + 1 > 1 ? 'es' : ''}`}
            >
              💧
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => update(glasses - 1)}
            disabled={glasses === 0}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 disabled:opacity-30 transition-colors font-bold"
          >
            −
          </button>
          <button
            onClick={() => update(glasses + 1)}
            disabled={glasses >= 20}
            className="w-7 h-7 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-700 disabled:opacity-30 transition-colors font-bold"
          >
            +
          </button>
        </div>
      </div>

      {glasses >= DAILY_TARGET && (
        <p className="text-xs text-blue-600 mt-2">Great hydration today!</p>
      )}
    </div>
  )
}
