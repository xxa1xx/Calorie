import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-600' }
  if (bmi < 25) return { label: 'Healthy', color: 'text-green-600' }
  if (bmi < 30) return { label: 'Overweight', color: 'text-yellow-600' }
  return { label: 'Obese', color: 'text-red-600' }
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-sm">
      <p className="text-gray-500">{payload[0].payload.label}</p>
      <p className="font-semibold text-gray-900">{payload[0].value} kg</p>
    </div>
  )
}

export default function WeightTracker({ profile, onWeightLogged }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const todayLog = logs.find((l) => l.date === today)

  useEffect(() => {
    supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .limit(30)
      .then(({ data }) => { if (data) setLogs(data) })
  }, [user.id])

  const handleLog = async (e) => {
    e.preventDefault()
    const weight = parseFloat(input)
    if (!weight || weight < 20 || weight > 500) return

    setSaving(true)
    const { data, error } = await supabase
      .from('weight_logs')
      .upsert({ user_id: user.id, date: today, weight_kg: weight, logged_at: new Date().toISOString() },
               { onConflict: 'user_id,date' })
      .select()
      .single()

    if (!error && data) {
      setLogs((prev) => {
        const without = prev.filter((l) => l.date !== today)
        return [...without, data].sort((a, b) => a.date.localeCompare(b.date))
      })
      onWeightLogged?.(weight)
    }
    setInput('')
    setSaving(false)
  }

  const chartData = logs.map((l) => ({ label: formatDate(l.date), weight: l.weight_kg }))

  const latest = logs[logs.length - 1]
  const first = logs[0]
  const change = latest && first && latest.date !== first.date
    ? (latest.weight_kg - first.weight_kg).toFixed(1)
    : null

  const yMin = logs.length > 0
    ? Math.floor(Math.min(...logs.map((l) => l.weight_kg), profile.goal_weight_kg) - 1)
    : undefined
  const yMax = logs.length > 0
    ? Math.ceil(Math.max(...logs.map((l) => l.weight_kg), profile.current_weight_kg) + 1)
    : undefined

  const currentWeight = latest?.weight_kg || profile.current_weight_kg
  const heightM = (profile.height_cm || 170) / 100
  const bmi = currentWeight / (heightM * heightM)
  const bmiRounded = Math.round(bmi * 10) / 10
  const { label: bmiLabel, color: bmiColor } = bmiCategory(bmi)

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Weight</h2>
        {latest && (
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">{latest.weight_kg} kg</div>
            {change !== null && (
              <div className={`text-xs font-medium ${parseFloat(change) < 0 ? 'text-primary-600' : 'text-red-500'}`}>
                {parseFloat(change) > 0 ? '+' : ''}{change} kg overall
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-wrap text-sm text-gray-500">
        <span>Start: {profile.current_weight_kg} kg</span>
        <span className="text-gray-300">·</span>
        <span>Goal: {profile.goal_weight_kg} kg</span>
        {latest && (
          <>
            <span className="text-gray-300">·</span>
            <span>{Math.abs(latest.weight_kg - profile.goal_weight_kg).toFixed(1)} kg to go</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
        <div>
          <p className="text-xs text-gray-500">BMI</p>
          <p className="text-2xl font-bold text-gray-900">{bmiRounded}</p>
        </div>
        <div className="h-10 w-px bg-gray-200" />
        <div>
          <p className={`text-sm font-semibold ${bmiColor}`}>{bmiLabel}</p>
          <p className="text-xs text-gray-400">
            {bmi < 18.5 ? '< 18.5' : bmi < 25 ? '18.5–24.9' : bmi < 30 ? '25–29.9' : '≥ 30'}
          </p>
        </div>
        <div className="flex-1" />
        <div className="text-xs text-gray-400 text-right">
          <div>Height: {profile.height_cm} cm</div>
          <div>Weight: {currentWeight} kg</div>
        </div>
      </div>

      {logs.length >= 2 ? (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={profile.goal_weight_kg} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1.5}
              label={{ value: 'Goal', position: 'right', fontSize: 10, fill: '#22c55e' }} />
            <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center py-4 text-gray-400 text-sm">Log a few weigh-ins to see your trend</div>
      )}

      <form onSubmit={handleLog} className="flex gap-2">
        <input
          type="number"
          step="0.1"
          className="input flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={todayLog ? `Today: ${todayLog.weight_kg} kg` : "Today's weight (kg)"}
        />
        <button type="submit" className="btn-primary px-4" disabled={!input || saving}>
          {saving ? '...' : 'Log'}
        </button>
      </form>
    </div>
  )
}
