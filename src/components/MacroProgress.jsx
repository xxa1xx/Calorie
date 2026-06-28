import { getProgressColor } from '../lib/calculations'

function MacroBar({ label, current, target, color, unit = 'g' }) {
  const pct = Math.min(100, Math.round((current / target) * 100))
  const barColor = pct >= 100 ? 'bg-red-500' : color

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{Math.round(current)}{unit} / {target}{unit}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function MacroProgress({ profile, todayTotals }) {
  const { calories = 0, protein_g = 0, carbs_g = 0, fat_g = 0 } = todayTotals || {}
  const calPct = Math.round((calories / profile.daily_calorie_target) * 100)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Today's Progress</h2>
        <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${calPct >= 100 ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700'}`}>
          {calPct}% of goal
        </span>
      </div>

      <div className="text-center py-4 mb-5 bg-gray-50 rounded-xl">
        <div className="text-4xl font-bold text-gray-900">{Math.round(calories)}</div>
        <div className="text-sm text-gray-500 mt-1">of {profile.daily_calorie_target} kcal</div>
        <div className="text-sm text-gray-600 mt-1">
          {Math.max(0, profile.daily_calorie_target - calories)} kcal remaining
        </div>
      </div>

      <div className="space-y-4">
        <MacroBar label="Protein" current={protein_g} target={profile.daily_protein_target} color="bg-blue-500" />
        <MacroBar label="Carbs" current={carbs_g} target={profile.daily_carbs_target} color="bg-yellow-500" />
        <MacroBar label="Fat" current={fat_g} target={profile.daily_fat_target} color="bg-purple-500" />
      </div>
    </div>
  )
}
