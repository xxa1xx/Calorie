export const DIETARY_OPTIONS = [
  {
    id: 'glp1',
    label: 'GLP-1 Medication',
    examples: 'Ozempic, Wegovy, Mounjaro, Victoza',
    icon: '💉',
    aiContext: `User is on a GLP-1 medication. Reduced appetite means eating well below the calorie target is completely normal and healthy — never flag this as a problem. Always celebrate protein intake. Suggest small, nutrient-dense, easy-to-digest portions. Avoid recommending heavy, greasy, or very spicy foods. Emphasise hydration as it is especially important on GLP-1.`,
  },
  {
    id: 'bariatric',
    label: 'Bariatric Surgery',
    examples: 'Gastric sleeve, bypass, band',
    icon: '🏥',
    aiContext: `User has had bariatric surgery. Meal portions are very small (typically 4–6 oz). Protein must always come first in each meal. Avoid high-sugar or high-fat foods due to dumping syndrome risk. The user cannot eat and drink simultaneously. Very low calorie intake (often 600–900 kcal/day) is expected and medically normal. Prioritise protein density above all else.`,
  },
  {
    id: 'keto',
    label: 'Ketogenic / Low Carb',
    examples: 'Under 50g net carbs per day',
    icon: '🥑',
    aiContext: `User follows a ketogenic or low-carb diet. Net carbs should stay under 50g/day (ideally under 20g). Meals should be high fat, moderate protein. Flag when foods are high in carbohydrates and suggest keto-friendly alternatives. Celebrate low-carb choices. Track net carbs (total carbs minus fibre) where possible.`,
  },
  {
    id: 'high_protein',
    label: 'High Protein Focus',
    examples: 'Muscle building, body recomposition',
    icon: '💪',
    aiContext: `User prioritises high protein intake for muscle building or body recomposition. Maximise protein in every suggestion. Flag meals that are low in protein and suggest easy ways to add protein (e.g. Greek yogurt, cottage cheese, chicken, eggs). Celebrate high-protein choices. Aim for 2g+ protein per kg of body weight.`,
  },
  {
    id: 'vegetarian',
    label: 'Vegetarian',
    examples: 'No meat or fish',
    icon: '🥦',
    aiContext: `User is vegetarian (no meat or fish). Only suggest vegetarian foods. Flag any meat or fish in food descriptions. Suggest plant-based and egg/dairy protein sources like eggs, legumes, tofu, tempeh, cottage cheese, and Greek yogurt.`,
  },
  {
    id: 'vegan',
    label: 'Vegan',
    examples: 'No animal products',
    icon: '🌱',
    aiContext: `User is vegan (no animal products at all). Only suggest fully vegan foods. Flag any animal products including meat, fish, dairy, eggs, and honey. Emphasise plant-based protein sources like legumes, tofu, tempeh, seitan, edamame, and nutritional yeast.`,
  },
  {
    id: 'gluten_free',
    label: 'Gluten Free',
    examples: 'Coeliac disease or gluten intolerance',
    icon: '🌾',
    aiContext: `User must avoid gluten (coeliac or intolerance). Flag any foods containing wheat, barley, rye, or regular oats. Only suggest gluten-free alternatives. Note cross-contamination risks where relevant.`,
  },
  {
    id: 'dairy_free',
    label: 'Dairy Free',
    examples: 'Lactose intolerance or dairy allergy',
    icon: '🥛',
    aiContext: `User avoids all dairy products. Flag milk, cheese, yogurt, butter, cream, and whey. Suggest dairy-free alternatives (oat milk, coconut yogurt, vegan cheese, etc.).`,
  },
  {
    id: 'intermittent_fasting',
    label: 'Intermittent Fasting',
    examples: '16:8, 18:6, OMAD',
    icon: '⏰',
    aiContext: `User practices intermittent fasting. Skipping breakfast or eating at unusual times is intentional — do not flag it as a problem. Suggest nutrient-dense, satiating meals that satisfy within a restricted eating window. Acknowledge that larger single meals are normal for this pattern.`,
  },
  {
    id: 'diabetic',
    label: 'Diabetes / Blood Sugar',
    examples: 'Type 1, Type 2, or prediabetes',
    icon: '🩺',
    aiContext: `User has diabetes or blood sugar concerns. Focus on low glycaemic index foods. Flag high-sugar, refined carb, and high-GI foods. Suggest foods that provide steady energy without blood sugar spikes. Celebrate fibre-rich and low-GI choices. Avoid recommending sugary snacks even if they fit within calorie targets.`,
  },
]

export function buildDietaryContext(dietaryOptions = []) {
  if (!dietaryOptions || dietaryOptions.length === 0) return ''
  const active = DIETARY_OPTIONS.filter((o) => dietaryOptions.includes(o.id))
  if (active.length === 0) return ''
  const lines = active.map((o) => `[${o.label}]: ${o.aiContext}`)
  return `\n\nDIETARY & HEALTH CONTEXT — follow these instructions carefully:\n${lines.join('\n')}`
}
