function MacroBar({ label, current, target, color, unit = 'g' }) {
  const pct = Math.min(100, Math.round((current / Math.max(1, target)) * 100))
  const barColor = pct >= 100 ? 'bg-red-500' : color

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{Math.round(current)}{unit} / {target}{unit}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function MacroProgress({ profile, todayTotals, isWorkoutDay, streak, rolloverCalories, onDismissRollover }) {
  const { calories = 0, protein_g = 0, carbs_g = 0, fat_g = 0, fiber_g = 0 } = todayTotals || {}
  const workoutBonus = isWorkoutDay ? (profile.workout_calorie_bonus || 200) : 0
  const effectiveTarget = profile.daily_calorie_target + workoutBonus + (rolloverCalories || 0)
  const calPct = Math.round((calories / Math.max(1, effectiveTarget)) * 100)
  const remaining = Math.max(0, effectiveTarget - calories)
  const netCarbs = Math.max(0, Math.round(carbs_g - fiber_g))

  // DRI fiber targets: 38g men, 25g women/other (Institute of Medicine)
  const fiberTarget = profile.gender === 'male' ? 38 : 25

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Today's Progress</h2>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">
              🔥 {streak}
            </span>
          )}
          <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${calPct >= 100 ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700'}`}>
            {calPct}%
          </span>
        </div>
      </div>

      <div className="text-center py-4 mb-5 bg-gray-50 rounded-xl">
        <div className="text-4xl font-bold text-gray-900">{Math.round(calories)}</div>
        <div className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-2 flex-wrap">
          <span>of {effectiveTarget} kcal</span>
          {isWorkoutDay && workoutBonus > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">💪 +{workoutBonus}</span>
          )}
          {rolloverCalories > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              +{rolloverCalories} rollover
              {onDismissRollover && (
                <button type="button" onClick={onDismissRollover} className="opacity-60 hover:opacity-100 leading-none" aria-label="Dismiss rollover">×</button>
              )}
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600 mt-1">{remaining} kcal remaining</div>
      </div>

      <div className="space-y-4">
        <MacroBar label="Protein" current={protein_g} target={profile.daily_protein_target} color="bg-blue-500" />
        <MacroBar label="Carbs" current={carbs_g} target={profile.daily_carbs_target} color="bg-yellow-500" />
        {carbs_g > 0 && fiber_g > 0 && (
          <div className="text-xs text-gray-400 -mt-2 pl-1">
            Net carbs: <strong className="text-gray-600">{netCarbs}g</strong>
          </div>
        )}
        <MacroBar label="Fat" current={fat_g} target={profile.daily_fat_target} color="bg-purple-500" />
        <MacroBar label="Fiber" current={fiber_g} target={fiberTarget} color="bg-green-500" />
      </div>
    </div>
  )
}
