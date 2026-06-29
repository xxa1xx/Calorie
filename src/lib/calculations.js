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

  const dietary = profile.dietary_options || []
  const isBariatric = dietary.includes('bariatric')
  const isGLP1 = dietary.includes('glp1')
  const isKeto = dietary.includes('keto')
  const isDiabetic = dietary.includes('diabetic')
  const isHighProtein = dietary.includes('high_protein')

  // Calorie floor by medical context
  // Bariatric: 600 kcal (ASMBS post-op early-stage guidance)
  // GLP-1: 800 kcal (clinically monitored appetite suppression)
  // Standard: 1500 male / 1200 female (NHS/Mayo Clinic minimum without medical supervision)
  let minCalories = profile.gender === 'male' ? 1500 : 1200
  if (isBariatric) minCalories = 600
  else if (isGLP1) minCalories = 800

  let goalAdj = GOAL_ADJUSTMENTS[profile.goal] ?? 0
  if (profile.goal === 'lose' && profile.weekly_loss_lbs) {
    goalAdj = -Math.round(parseFloat(profile.weekly_loss_lbs) * 500)
  }
  const dailyCalories = Math.max(minCalories, tdee + goalAdj)

  let proteinG, fatG, carbsG

  if (isKeto) {
    // Therapeutic ketosis: ~70% fat, ~25% protein, net carbs hard-capped at 50g
    proteinG = Math.round((dailyCalories * 0.25) / 4)
    fatG = Math.round((dailyCalories * 0.70) / 9)
    carbsG = Math.min(50, Math.round((dailyCalories * 0.05) / 4))

  } else if (isBariatric) {
    // ASMBS/SAGES guidelines: protein-first, ≥60–80g/day minimum post-op
    // Protein allowed up to 50% of calories since total intake is very low
    const minProteinG = 70
    proteinG = Math.max(minProteinG, Math.round(1.6 * profile.current_weight_kg))
    let proteinCal = proteinG * 4
    if (proteinCal > dailyCalories * 0.50) {
      proteinCal = Math.round(dailyCalories * 0.50)
      proteinG = Math.round(proteinCal / 4)
    }
    const fatCal = Math.round(dailyCalories * 0.25)
    fatG = Math.round(fatCal / 9)
    carbsG = Math.round(Math.max(0, dailyCalories - proteinG * 4 - fatCal) / 4)

  } else if (isDiabetic) {
    // ADA 2024 Standards of Care: individualized carb reduction for glycaemic management
    // ~30% carbs / 30% protein / 40% fat is consistent with a moderate low-carb approach
    proteinG = Math.round((dailyCalories * 0.30) / 4)
    fatG = Math.round((dailyCalories * 0.40) / 9)
    carbsG = Math.round(Math.max(0, dailyCalories - proteinG * 4 - fatG * 9) / 4)

  } else {
    // Standard / GLP-1 / high-protein path
    // Protein: 1.8g/kg (ISSN 1.6–2.2g/kg for muscle retention during deficit)
    // High-protein flag: 2.0g/kg, up to 40% of calories
    let targetProteinG = Math.round(1.8 * profile.current_weight_kg)
    if (isHighProtein) targetProteinG = Math.max(targetProteinG, Math.round(2.0 * profile.current_weight_kg))
    let proteinCal = targetProteinG * 4
    const maxProteinPct = isHighProtein ? 0.40 : 0.35
    if (proteinCal > dailyCalories * maxProteinPct) {
      proteinCal = Math.round(dailyCalories * maxProteinPct)
      targetProteinG = Math.round(proteinCal / 4)
    }
    proteinG = targetProteinG
    const fatCal = Math.round(dailyCalories * 0.27)
    fatG = Math.round(fatCal / 9)
    carbsG = Math.round(Math.max(0, dailyCalories - proteinG * 4 - fatCal) / 4)
  }

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
