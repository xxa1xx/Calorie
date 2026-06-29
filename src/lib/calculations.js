// Mifflin-St Jeor BMR equation
function calculateBMR(weightKg, heightCm, age, gender) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return gender === 'male' ? base + 5 : base - 161
}

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const GOAL_ADJUSTMENTS = {
  lose: -500,
  maintain: 0,
  gain: 300,
}

export function calculateDailyTargets(profile) {
  const bmr = calculateBMR(
    profile.current_weight_kg,
    profile.height_cm,
    profile.age,
    profile.gender
  )

  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[profile.activity_level])
  // Gender-aware minimum: 1500 kcal for males, 1200 for females/other
  // (NHS/Mayo Clinic guidance: don't go below these without medical supervision)
  const minCalories = profile.gender === 'male' ? 1500 : 1200
  // If weekly_loss_lbs is set, use it to compute the deficit (0.5 lbs/wk ≈ 250 kcal/day)
  let goalAdj = GOAL_ADJUSTMENTS[profile.goal] ?? 0
  if (profile.goal === 'lose' && profile.weekly_loss_lbs) {
    goalAdj = -Math.round(parseFloat(profile.weekly_loss_lbs) * 500)
  }
  const dailyCalories = Math.max(minCalories, tdee + goalAdj)

  // Protein: 1.8g/kg supports muscle retention during a deficit (ISSN position stand 1.6–2.2g/kg)
  // Capped at 35% of calories so it can't crowd out fat and carbs at low calorie targets
  let proteinG = Math.round(1.8 * profile.current_weight_kg)
  let proteinCal = proteinG * 4
  if (proteinCal > dailyCalories * 0.35) {
    proteinCal = Math.round(dailyCalories * 0.35)
    proteinG = Math.round(proteinCal / 4)
  }

  // Fat: 27% of calories (within the 20–35% AMDR; 27% is a solid midpoint)
  const fatCal = Math.round(dailyCalories * 0.27)
  const fatG = Math.round(fatCal / 9)

  // Carbs: remainder, floored at 0
  const carbsCal = Math.max(0, dailyCalories - proteinCal - fatCal)
  const carbsG = Math.round(carbsCal / 4)

  return {
    daily_calorie_target: dailyCalories,
    daily_protein_target: proteinG,
    daily_carbs_target: carbsG,
    daily_fat_target: fatG,
  }
}

export function getActivityLabel(level) {
  const labels = {
    sedentary: 'Sedentary (desk job, little exercise)',
    light: 'Light (1-3 days/week exercise)',
    moderate: 'Moderate (3-5 days/week exercise)',
    active: 'Active (6-7 days/week exercise)',
    very_active: 'Very Active (physical job or 2x training)',
  }
  return labels[level] || level
}

export function getGoalLabel(goal) {
  const labels = {
    lose: 'Lose Weight',
    maintain: 'Maintain Weight',
    gain: 'Gain Weight',
  }
  return labels[goal] || goal
}

export function formatMacro(value, unit = 'g') {
  return `${Math.round(value)}${unit}`
}

export function getProgressColor(percentage) {
  if (percentage >= 100) return 'bg-red-500'
  if (percentage >= 85) return 'bg-yellow-500'
  return 'bg-primary-500'
}
