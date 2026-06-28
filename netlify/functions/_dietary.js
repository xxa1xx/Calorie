const DIETARY_AI_CONTEXT = {
  glp1: `[GLP-1 Medication]: Reduced appetite means eating well below the calorie target is completely normal and healthy — never flag this as a problem. Always celebrate protein intake. Suggest small, nutrient-dense, easy-to-digest portions. Avoid heavy, greasy, or very spicy foods. Emphasise hydration.`,
  bariatric: `[Bariatric Surgery]: Portions are very small (4–6 oz). Protein must come first in every meal. Avoid high-sugar or high-fat foods (dumping syndrome risk). Cannot eat and drink simultaneously. Very low calorie intake (600–900 kcal/day) is medically normal. Prioritise protein density above all else.`,
  keto: `[Keto / Low Carb]: Net carbs must stay under 50g/day (ideally under 20g). High fat, moderate protein. Flag high-carb foods and suggest keto-friendly alternatives. Track net carbs (total carbs minus fibre).`,
  high_protein: `[High Protein Focus]: Maximise protein in every suggestion. Flag low-protein meals. Suggest easy protein additions. Aim for 2g+ protein per kg of body weight.`,
  vegetarian: `[Vegetarian]: Only suggest vegetarian foods. Flag any meat or fish. Suggest plant-based and egg/dairy protein sources.`,
  vegan: `[Vegan]: Only suggest fully vegan foods. Flag any animal products including meat, fish, dairy, eggs, and honey. Emphasise plant-based proteins.`,
  gluten_free: `[Gluten Free]: Flag all gluten-containing foods (wheat, barley, rye, regular oats). Only suggest gluten-free alternatives.`,
  dairy_free: `[Dairy Free]: Flag all dairy (milk, cheese, yogurt, butter, cream, whey). Suggest dairy-free alternatives.`,
  intermittent_fasting: `[Intermittent Fasting]: Skipping meals or eating at unusual times is intentional. Suggest nutrient-dense satiating meals. Larger single meals are normal for this pattern.`,
  diabetic: `[Diabetes / Blood Sugar]: Focus on low-GI foods. Flag high-sugar, refined carb, and high-GI foods. Celebrate fibre-rich and low-GI choices. Never suggest sugary snacks even if within calorie targets.`,
}

export function buildDietaryContext(dietaryOptions = []) {
  if (!dietaryOptions || dietaryOptions.length === 0) return ''
  const lines = dietaryOptions
    .filter((id) => DIETARY_AI_CONTEXT[id])
    .map((id) => DIETARY_AI_CONTEXT[id])
  if (lines.length === 0) return ''
  return `\n\nDIETARY & HEALTH CONTEXT — follow these strictly:\n${lines.join('\n')}`
}
