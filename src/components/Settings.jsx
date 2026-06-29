import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calculateDailyTargets } from '../lib/calculations'
import { DIETARY_OPTIONS } from '../lib/dietary'
import { requestPermission, getPermission, scheduleDailyReminder } from '../lib/notifications'
import { kgToLbs, lbsToKg, cmToFtIn, ftInToCm } from '../lib/units'

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise' },
  { value: 'light', label: 'Lightly Active', desc: '1–3 days/week' },
  { value: 'moderate', label: 'Moderate', desc: '3–5 days/week' },
  { value: 'active', label: 'Very Active', desc: '6–7 days/week' },
  { value: 'very_active', label: 'Extra Active', desc: 'Physical job or 2× training' },
]

function Section({ title, children }) {
  return (
    <div className="card space-y-4">
      <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

export default function Settings({ profile, onSaved }) {
  const { user } = useAuth()

  const { ft: initFt, inches: initIn } = profile.height_cm ? cmToFtIn(profile.height_cm) : { ft: '', inches: '' }

  const [form, setForm] = useState({
    name: profile.name || '',
    age: profile.age || '',
    gender: profile.gender || 'male',
    height_ft: profile.height_cm ? String(initFt) : '',
    height_in: profile.height_cm ? String(initIn) : '',
    current_weight_lbs: profile.current_weight_kg ? String(kgToLbs(profile.current_weight_kg)) : '',
    goal_weight_lbs: profile.goal_weight_kg ? String(kgToLbs(profile.goal_weight_kg)) : '',
    activity_level: profile.activity_level || 'moderate',
    goal: profile.goal || 'lose',
    weekly_loss_lbs: profile.weekly_loss_lbs || 1,
    calorie_target: profile.daily_calorie_target ? String(profile.daily_calorie_target) : '',
    dietary_options: profile.dietary_options || [],
    workout_calorie_bonus: profile.workout_calorie_bonus ?? 200,
    email_summary: profile.email_summary ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [notifPermission, setNotifPermission] = useState(getPermission())
  const [reminderEnabled, setReminderEnabled] = useState(
    () => localStorage.getItem('calorieai-reminder') === 'true'
  )

  const set = (key, val) => { setForm((f) => ({ ...f, [key]: val })); setSaved(false) }

  const toggleDietary = (id) => {
    setSaved(false)
    setForm((f) => ({
      ...f,
      dietary_options: f.dietary_options.includes(id)
        ? f.dietary_options.filter((d) => d !== id)
        : [...f.dietary_options, id],
    }))
  }

  const handleEnableReminder = async () => {
    const granted = await requestPermission()
    setNotifPermission(getPermission())
    if (granted) {
      setReminderEnabled(true)
      localStorage.setItem('calorieai-reminder', 'true')
      scheduleDailyReminder(true, async () => {
        const today = new Date().toISOString().split('T')[0]
        const { data } = await supabase.from('food_logs').select('id').eq('user_id', user.id).eq('date', today).limit(1)
        return !!data?.length
      })
    }
  }

  const handleDisableReminder = () => {
    setReminderEnabled(false)
    localStorage.removeItem('calorieai-reminder')
    scheduleDailyReminder(false, null)
  }

  const recalcCalories = () => {
    const weightLbs = parseFloat(form.current_weight_lbs)
    const goalLbs = parseFloat(form.goal_weight_lbs)
    if (!form.height_ft || !weightLbs || !goalLbs || !form.age) return
    const pd = {
      gender: form.gender,
      age: parseInt(form.age),
      height_cm: ftInToCm(form.height_ft, form.height_in),
      current_weight_kg: lbsToKg(weightLbs),
      goal_weight_kg: lbsToKg(goalLbs),
      activity_level: form.activity_level,
      goal: form.goal,
      weekly_loss_lbs: parseFloat(form.weekly_loss_lbs) || 1,
      dietary_options: form.dietary_options,
    }
    const t = calculateDailyTargets(pd)
    set('calorie_target', String(t.daily_calorie_target))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    const profileData = {
      name: form.name,
      age: parseInt(form.age),
      gender: form.gender,
      height_cm: ftInToCm(form.height_ft, form.height_in),
      current_weight_kg: lbsToKg(parseFloat(form.current_weight_lbs)),
      goal_weight_kg: lbsToKg(parseFloat(form.goal_weight_lbs)),
      activity_level: form.activity_level,
      goal: form.goal,
      weekly_loss_lbs: parseFloat(form.weekly_loss_lbs) || 1,
      dietary_options: form.dietary_options,
      workout_calorie_bonus: parseInt(form.workout_calorie_bonus) || 0,
      email_summary: form.email_summary,
    }

    const targets = calculateDailyTargets(profileData)

    // Apply manual calorie override and re-split macros proportionally
    const customCal = parseInt(form.calorie_target)
    if (customCal > 0 && customCal !== targets.daily_calorie_target) {
      targets.daily_calorie_target = customCal
      let proteinG = Math.round(1.8 * profileData.current_weight_kg)
      let proteinCal = proteinG * 4
      if (proteinCal > customCal * 0.35) {
        proteinCal = Math.round(customCal * 0.35)
        proteinG = Math.round(proteinCal / 4)
      }
      const fatCal = Math.round(customCal * 0.27)
      targets.daily_protein_target = proteinG
      targets.daily_fat_target = Math.round(fatCal / 9)
      targets.daily_carbs_target = Math.round(Math.max(0, customCal - proteinCal - fatCal) / 4)
    }

    const { error: dbError } = await supabase
      .from('profiles')
      .update({ ...profileData, ...targets, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (dbError) {
      setError(dbError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    onSaved({ ...profile, ...profileData, ...targets })
  }

  return (
    <div className="space-y-4">
      <Section title="Profile">
        <Field label="Name">
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age">
            <input className="input" type="number" value={form.age} onChange={(e) => set('age', e.target.value)} min="10" max="120" />
          </Field>
          <Field label="Height">
            <div className="flex gap-1.5 items-center">
              <input className="input w-16 text-center" type="number" min="3" max="8" value={form.height_ft}
                onChange={(e) => set('height_ft', e.target.value)} placeholder="5" />
              <span className="text-sm text-gray-500">ft</span>
              <input className="input w-16 text-center" type="number" min="0" max="11" value={form.height_in}
                onChange={(e) => set('height_in', e.target.value)} placeholder="10" />
              <span className="text-sm text-gray-500">in</span>
            </div>
          </Field>
        </div>
        <Field label="Gender">
          <div className="flex gap-2">
            {['male', 'female', 'other'].map((g) => (
              <button key={g} type="button" onClick={() => set('gender', g)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${form.gender === g ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600'}`}>
                {g}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Weight & Goal">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current Weight (lbs)">
            <input className="input" type="number" step="0.5" value={form.current_weight_lbs}
              onChange={(e) => set('current_weight_lbs', e.target.value)} />
          </Field>
          <Field label="Goal Weight (lbs)">
            <input className="input" type="number" step="0.5" value={form.goal_weight_lbs}
              onChange={(e) => set('goal_weight_lbs', e.target.value)} />
          </Field>
        </div>
        <Field label="Goal">
          <div className="flex gap-2">
            {[{ value: 'lose', label: 'Lose' }, { value: 'maintain', label: 'Maintain' }, { value: 'gain', label: 'Gain' }].map((g) => (
              <button key={g.value} type="button" onClick={() => set('goal', g.value)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${form.goal === g.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600'}`}>
                {g.label}
              </button>
            ))}
          </div>
        </Field>
        {form.goal === 'lose' && (
          <Field label="Weekly loss goal">
            <div className="grid grid-cols-4 gap-2">
              {[0.5, 1, 1.5, 2].map((rate) => (
                <button key={rate} type="button" onClick={() => set('weekly_loss_lbs', rate)}
                  className={`py-2 rounded-lg border text-sm font-medium transition-colors ${form.weekly_loss_lbs === rate ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600'}`}>
                  {rate} lb/wk
                </button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Activity Level">
          <div className="space-y-1.5">
            {ACTIVITY_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => set('activity_level', opt.value)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${form.activity_level === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <span className="font-medium">{opt.label}</span>
                <span className="text-gray-400 ml-2">{opt.desc}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Daily Calorie Target (kcal)">
          <div className="flex gap-2">
            <input className="input flex-1" type="number" min="800" max="9999" step="50"
              value={form.calorie_target}
              onChange={(e) => set('calorie_target', e.target.value)} />
            <button type="button" onClick={recalcCalories}
              className="btn-secondary text-xs px-3 whitespace-nowrap">
              ↺ Recalculate
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Edit to set a custom target, or tap Recalculate to compute from your stats.</p>
        </Field>
      </Section>

      <Section title="Workout Settings">
        <Field label="Extra calories on workout days (kcal)">
          <div className="flex items-center gap-3">
            <input
              className="input w-32"
              type="number"
              min="0"
              max="1000"
              step="50"
              value={form.workout_calorie_bonus}
              onChange={(e) => set('workout_calorie_bonus', parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-gray-500">Added to your daily target when you mark a workout day</p>
          </div>
        </Field>
      </Section>

      <Section title="Dietary & Health Options">
        <p className="text-sm text-gray-500 -mt-1">
          Select everything that applies. The AI will tailor all feedback, suggestions, and insights accordingly.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {DIETARY_OPTIONS.map((opt) => {
            const active = form.dietary_options.includes(opt.id)
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleDietary(opt.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${active ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{opt.icon}</span>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.examples}</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-primary-500 border-primary-500' : 'border-gray-300'}`}>
                    {active && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {form.dietary_options.length > 0 && (
          <div className="bg-primary-50 rounded-lg p-3">
            <p className="text-xs text-primary-700 font-medium mb-1">Active preferences:</p>
            <div className="flex flex-wrap gap-1.5">
              {form.dietary_options.map((id) => {
                const opt = DIETARY_OPTIONS.find((o) => o.id === id)
                return opt ? (
                  <span key={id} className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">
                    {opt.icon} {opt.label}
                  </span>
                ) : null
              })}
            </div>
          </div>
        )}
      </Section>

      <Section title="Notifications">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Browser reminders</p>
              <p className="text-xs text-gray-500 mt-0.5">Get a notification at 7pm if you haven't logged today</p>
            </div>
            {notifPermission === 'denied' ? (
              <span className="text-xs text-red-600 shrink-0">Blocked in browser settings</span>
            ) : reminderEnabled ? (
              <button onClick={handleDisableReminder} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg border border-gray-200 shrink-0">
                Turn off
              </button>
            ) : (
              <button onClick={handleEnableReminder} className="btn-primary text-xs px-3 py-1.5 shrink-0">
                Enable
              </button>
            )}
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Daily email summary</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Receive a daily summary email at 8pm with your totals for the day.
              </p>
            </div>
            <button
              type="button"
              onClick={() => set('email_summary', !form.email_summary)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${form.email_summary ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.email_summary ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {form.email_summary && (
            <p className="text-xs text-primary-700 bg-primary-50 rounded-lg p-2">
              Summary will be sent to your account email each evening.
            </p>
          )}
        </div>
      </Section>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full"
      >
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
      </button>
    </div>
  )
}
