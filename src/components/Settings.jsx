import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calculateDailyTargets } from '../lib/calculations'
import { DIETARY_OPTIONS } from '../lib/dietary'

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
  const [form, setForm] = useState({
    name: profile.name || '',
    age: profile.age || '',
    gender: profile.gender || 'male',
    height_cm: profile.height_cm || '',
    current_weight_kg: profile.current_weight_kg || '',
    goal_weight_kg: profile.goal_weight_kg || '',
    activity_level: profile.activity_level || 'moderate',
    goal: profile.goal || 'lose',
    dietary_options: profile.dietary_options || [],
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

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

  const handleSave = async () => {
    setSaving(true)
    setError('')

    const profileData = {
      ...form,
      age: parseInt(form.age),
      height_cm: parseFloat(form.height_cm),
      current_weight_kg: parseFloat(form.current_weight_kg),
      goal_weight_kg: parseFloat(form.goal_weight_kg),
    }

    const targets = calculateDailyTargets(profileData)

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
          <Field label="Height (cm)">
            <input className="input" type="number" value={form.height_cm} onChange={(e) => set('height_cm', e.target.value)} />
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
          <Field label="Current Weight (kg)">
            <input className="input" type="number" step="0.1" value={form.current_weight_kg} onChange={(e) => set('current_weight_kg', e.target.value)} />
          </Field>
          <Field label="Goal Weight (kg)">
            <input className="input" type="number" step="0.1" value={form.goal_weight_kg} onChange={(e) => set('goal_weight_kg', e.target.value)} />
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
