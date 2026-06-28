import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { notify, requestPermission, getPermission } from '../lib/notifications'

function pad(n) { return n.toString().padStart(2, '0') }

function formatDuration(ms) {
  if (ms <= 0) return '0h 00m'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  return `${h}h ${pad(m)}m`
}

export default function FastingTimer() {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const [fastStart, setFastStart] = useState(null)
  const [targetHours, setTargetHours] = useState(16)
  const [elapsed, setElapsed] = useState(0)
  const [editingTarget, setEditingTarget] = useState(false)
  const [newTarget, setNewTarget] = useState(16)
  const [open, setOpen] = useState(false)
  const notifiedRef = useRef(false)

  useEffect(() => {
    supabase.from('daily_meta')
      .select('fast_started_at,fast_target_hours')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()
      .then(({ data }) => {
        if (data?.fast_started_at) setFastStart(data.fast_started_at)
        if (data?.fast_target_hours) {
          setTargetHours(Number(data.fast_target_hours))
          setNewTarget(Number(data.fast_target_hours))
        }
      })
  }, [user.id, today])

  useEffect(() => {
    if (!fastStart) { setElapsed(0); return }
    const tick = () => setElapsed(Date.now() - new Date(fastStart).getTime())
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [fastStart])

  useEffect(() => {
    if (!fastStart || notifiedRef.current) return
    if (elapsed >= targetHours * 3600000) {
      notifiedRef.current = true
      notify('Eating window open 🎉', `Your ${targetHours}h fast is complete. Time to eat!`)
    }
  }, [elapsed, fastStart, targetHours])

  const saveMeta = async (patch) => {
    await supabase.from('daily_meta').upsert(
      { user_id: user.id, date: today, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    )
  }

  const startFast = async () => {
    if (getPermission() !== 'granted') await requestPermission()
    const now = new Date().toISOString()
    notifiedRef.current = false
    setFastStart(now)
    await saveMeta({ fast_started_at: now, fast_target_hours: targetHours })
  }

  const stopFast = async () => {
    setFastStart(null)
    setElapsed(0)
    notifiedRef.current = false
    await saveMeta({ fast_started_at: null })
  }

  const saveTarget = async () => {
    setTargetHours(newTarget)
    setEditingTarget(false)
    await saveMeta({ fast_target_hours: newTarget })
  }

  const targetMs = targetHours * 3600000
  const isComplete = fastStart && elapsed >= targetMs
  const remaining = Math.max(0, targetMs - elapsed)
  const pct = fastStart ? Math.min(100, (elapsed / targetMs) * 100) : 0

  const windowOpensAt = fastStart
    ? new Date(new Date(fastStart).getTime() + targetMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  const statusLabel = !fastStart
    ? 'Not fasting'
    : isComplete
    ? 'Window open 🎉'
    : `${formatDuration(remaining)} left`

  return (
    <div className="card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Fasting Timer</h2>
          {fastStart && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isComplete ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
              {isComplete ? '✅' : `⏱ ${formatDuration(elapsed)}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{statusLabel}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Fast duration</span>
            {editingTarget ? (
              <div className="flex items-center gap-2">
                <input
                  type="number" min="1" max="48" step="0.5"
                  className="input text-sm w-20 py-1"
                  value={newTarget}
                  onChange={(e) => setNewTarget(parseFloat(e.target.value))}
                />
                <span className="text-sm text-gray-500">h</span>
                <button onClick={saveTarget} className="text-sm text-primary-600 font-medium">Save</button>
                <button onClick={() => setEditingTarget(false)} className="text-sm text-gray-400">✕</button>
              </div>
            ) : (
              <button onClick={() => { setNewTarget(targetHours); setEditingTarget(true) }}
                className="text-sm text-gray-700 font-medium hover:text-primary-600">
                {targetHours}h <span className="text-gray-400">✎</span>
              </button>
            )}
          </div>

          {fastStart ? (
            <>
              <div className="text-center py-3">
                <div className={`text-4xl font-bold tabular-nums ${isComplete ? 'text-green-600' : 'text-gray-900'}`}>
                  {formatDuration(elapsed)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {isComplete ? `Fast complete! Eating window is open.` : `${formatDuration(remaining)} until eating window`}
                </div>
                {!isComplete && windowOpensAt && (
                  <div className="text-xs text-gray-400 mt-0.5">Window opens at {windowOpensAt}</div>
                )}
              </div>

              <div className="space-y-1">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-orange-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0h</span>
                  <span>{targetHours}h</span>
                </div>
              </div>

              <button type="button" onClick={stopFast} className="btn-secondary w-full">End Fast</button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                Tap Start to begin your {targetHours}-hour fast. You'll get a browser notification when your eating window opens.
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                {[12, 14, 16, 18, 20, 24].map((h) => (
                  <button key={h} type="button"
                    onClick={() => { setNewTarget(h); setTargetHours(h); saveMeta({ fast_target_hours: h }) }}
                    className={`py-1.5 rounded-lg border transition-colors ${targetHours === h ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium' : 'border-gray-200 text-gray-500'}`}>
                    {h}h
                  </button>
                ))}
              </div>
              <button type="button" onClick={startFast} className="btn-primary w-full">Start Fast Now</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
