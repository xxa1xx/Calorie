import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calculateDailyTargets } from '../lib/calculations'
import { DIETARY_OPTIONS } from '../lib/dietary'
import { lbsToKg, ftInToCm } from '../lib/units'

const STEPS = ['personal', 'body', 'goals', 'dietary']

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise' },
  { value: 'light', label: 'Lightly Active', desc: '1-3 days/week exercise' },
  { value: 'moderate', label: 'Moderately Active', desc: '3-5 days/week exercise' },
  { value: 'active', label: 'Very Active', desc: '6-7 days/week exercise' },
  { value: 'very_active', label: 'Extra Active', desc: 'Physical job or 2x training/day' },
]

export default function Onboarding({ onComplete }) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: 'male',
    height_ft: '',
    height_in: '',
    current_weight_lbs: '',
    goal_weight_lbs: '',
    activity_level: 'moderate',
    goal: 'lose',
    dietary_options: [],
  })

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const toggleDietary = (id) => {
    setForm((f) => ({
      ...f,
      dietary_options: f.dietary_options.includes(id)
        ? f.dietary_options.filter((d) => d !== id)
        : [...f.dietary_options, id],
    }))
  }

  const handleNext = () => {
    setError('')
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      handleSave()
    }
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
      dietary_options: form.dietary_options,
      weekly_loss_lbs: 1.0,
    }

    const targets = calculateDailyTargets(profileData)

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...profileData, ...targets })

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    onComplete({ ...profileData, ...targets })
  }

  const isStepValid = () => {
    if (step === 0) return form.name && form.age && form.gender
    if (step === 1) return form.height_ft && form.current_weight_lbs && form.goal_weight_lbs
    return true // goals and dietary are always valid
  }

  const stepTitles = ['Personal Info', 'Body Measurements', 'Activity & Goal', 'Dietary Options']

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🥗</div>
          <h1 className="text-2xl font-bold text-gray-900">Let's set up your profile</h1>
          <p className="text-gray-600 text-sm mt-1">Step {step + 1} of {STEPS.length}</p>
        </div>

        <div className="flex gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="card space-y-5">
          <h2 className="text-lg font-semibold">{stepTitles[step]}</h2>

          {step === 0 && (
            <>
              <div>
                <label className="label">Your name</label>
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Alex" />
              </div>
              <div>
                <label className="label">Age</label>
                <input className="input" type="number" value={form.age} onChange={(e) => set('age', e.target.value)} placeholder="25" min="10" max="120" />
              </div>
              <div>
                <label className="label">Gender</label>
                <div className="flex gap-3">
                  {['male', 'female', 'other'].map((g) => (
                    <button key={g} type="button" onClick={() => set('gender', g)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${form.gender === g ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600'}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <label className="label">Height</label>
                <div className="flex gap-2 items-center">
                  <input className="input w-20 text-center" type="number" min="3" max="8" value={form.height_ft}
                    onChange={(e) => set('height_ft', e.target.value)} placeholder="5" />
                  <span className="text-sm text-gray-500">ft</span>
                  <input className="input w-20 text-center" type="number" min="0" max="11" value={form.height_in}
                    onChange={(e) => set('height_in', e.target.value)} placeholder="10" />
                  <span className="text-sm text-gray-500">in</span>
                </div>
              </div>
              <div>
                <label className="label">Current Weight (lbs)</label>
                <input className="input" type="number" step="0.5" value={form.current_weight_lbs}
                  onChange={(e) => set('current_weight_lbs', e.target.value)} placeholder="175" />
              </div>
              <div>
                <label className="label">Goal Weight (lbs)</label>
                <input className="input" type="number" step="0.5" value={form.goal_weight_lbs}
                  onChange={(e) => set('goal_weight_lbs', e.target.value)} placeholder="155" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="label">Activity Level</label>
                <div className="space-y-2">
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => set('activity_level', opt.value)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${form.activity_level === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Your Goal</label>
                <div className="flex gap-3">
                  {[{ value: 'lose', label: 'Lose Weight' }, { value: 'maintain', label: 'Maintain' }, { value: 'gain', label: 'Gain Weight' }].map((g) => (
                    <button key={g.value} type="button" onClick={() => set('goal', g.value)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${form.goal === g.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600'}`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-gray-500 -mt-2">
                Select all that apply. These tune the AI's feedback. You can change these anytime in Settings.
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {DIETARY_OPTIONS.map((opt) => {
                  const active = form.dietary_options.includes(opt.id)
                  return (
                    <button key={opt.id} type="button" onClick={() => toggleDietary(opt.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${active ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{opt.icon}</span>
                          <div>
                            <div className="font-medium text-sm">{opt.label}</div>
                            <div className="text-xs text-gray-400">{opt.examples}</div>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'bg-primary-500 border-primary-500' : 'border-gray-300'}`}>
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
              <p className="text-xs text-gray-400">None of these? No problem — skip and continue.</p>
            </>
          )}

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button className="btn-secondary flex-1" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            )}
            <button className="btn-primary flex-1" onClick={handleNext} disabled={!isStepValid() || saving}>
              {saving ? 'Saving...' : step === STEPS.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
