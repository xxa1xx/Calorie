const DIETARY_AI_CONTEXT = {
  glp1: `[GLP-1 Medication]: Appetite suppression from GLP-1 medications (e.g. semaglutide, tirzepatide) is a well-documented effect — eating somewhat below the calorie target is expected and shouldn't be treated as alarming. Always prioritise protein intake, which helps preserve lean muscle during rapid weight loss. Suggest small, nutrient-dense, easy-to-digest portions. Avoid heavy, greasy, or very spicy foods, which are commonly poorly tolerated on these medications. Emphasise hydration. If intake looks extremely low (well under 800 kcal/day) or there are signs of inability to keep down food/fluids, gently note that's worth mentioning to their prescriber.`,
  bariatric: `[Bariatric Surgery]: Calorie needs and portion sizes vary a lot by how long ago surgery was and the recovery stage. Very small portions (a few ounces) and low calorie intake (often 600–900 kcal/day) are typical and expected in the early months while progressing through liquid/puree/soft-food stages, with intake usually increasing over the first year. Protein must come first in every meal. Avoid high-sugar or high-fat foods (dumping syndrome risk). Avoid drinking liquids within about 30 minutes of meals. Prioritise protein density above all else. If someone is well past the early recovery period and still eating very little, gently note that's worth discussing with their bariatric team.`,
  keto: `[Keto / Low Carb]: Net carbs must stay under 50g/day (ideally under 20g). High fat, moderate protein. Flag high-carb foods and suggest keto-friendly alternatives. Track net carbs (total carbs minus fibre).`,
  high_protein: `[High Protein Focus]: Maximise protein in every suggestion. Flag low-protein meals. Suggest easy protein additions. Aim for roughly 1.6–2.2g protein per kg of body weight, the range supported by sports-nutrition research for preserving and building lean mass.`,
  vegetarian: `[Vegetarian]: Only suggest vegetarian foods. Flag any meat or fish. Suggest plant-based and egg/dairy protein sources.`,
  vegan: `[Vegan]: Only suggest fully vegan foods. Flag any animal products including meat, fish, dairy, eggs, and honey. Emphasise plant-based proteins.`,
  gluten_free: `[Gluten Free]: Flag all gluten-containing foods (wheat, barley, rye, regular oats). Only suggest gluten-free alternatives.`,
  dairy_free: `[Dairy Free]: Flag all dairy (milk, cheese, yogurt, butter, cream, whey). Suggest dairy-free alternatives.`,
  intermittent_fasting: `[Intermittent Fasting]: Skipping meals or eating at unusual times is intentional. Suggest nutrient-dense satiating meals. Larger single meals are normal for this pattern.`,
  diabetic: `[Diabetes / Blood Sugar]: Focus on low-GI, fibre-rich, minimally-refined carbs, and note when pairing carbs with protein/fat/fibre would help blunt blood sugar spikes. Flag high-sugar, refined-carb, and high-GI foods — but don't treat occasional sweets as forbidden; frame them as something to count toward the day's carbs, consistent with standard diabetes meal-planning guidance rather than a strict ban. Celebrate fibre-rich and low-GI choices.`,
}

export function buildDietaryContext(dietaryOptions = []) {
  if (!dietaryOptions || dietaryOptions.length === 0) return ''
  const lines = dietaryOptions
    .filter((id) => DIETARY_AI_CONTEXT[id])
    .map((id) => DIETARY_AI_CONTEXT[id])
  if (lines.length === 0) return ''
  return `\n\nDIETARY & HEALTH CONTEXT — follow these strictly:\n${lines.join('\n')}`
}
