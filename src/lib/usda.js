// USDA FoodData Central — free, DEMO_KEY allows 30 req/hour / 50 req/day
// Register at https://api.nal.usda.gov/signup/ for a free unlimited key
// and set VITE_USDA_API_KEY in Netlify env vars.
const BASE = 'https://api.nal.usda.gov/fdc/v1'
const API_KEY = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY'

const NUTRIENT = { energy: 1008, protein: 1003, carbs: 1005, fat: 1004, fiber: 1079 }

function get(nutrients, id) {
  return nutrients.find((n) => n.nutrientId === id)?.value || 0
}

function normalize(food) {
  const fn = food.foodNutrients || []
  // Branded foods report values per serving; Foundation/SR Legacy report per 100g
  const servG = food.dataType === 'Branded' && food.servingSizeUnit === 'g' ? food.servingSize : null
  const scale = servG ? 100 / servG : 1
  const r = (v) => Math.round(v * scale * 10) / 10
  return {
    code: `usda-${food.fdcId}`,
    product_name: food.description || '',
    brands: food.brandOwner || food.brandName || '',
    nutriments: {
      'energy-kcal_100g': Math.round(get(fn, NUTRIENT.energy) * scale),
      proteins_100g: r(get(fn, NUTRIENT.protein)),
      carbohydrates_100g: r(get(fn, NUTRIENT.carbs)),
      fat_100g: r(get(fn, NUTRIENT.fat)),
      fiber_100g: r(get(fn, NUTRIENT.fiber)),
    },
    image_thumb_url: null,
    _source: 'usda',
  }
}

export async function searchUSDA(query) {
  try {
    const params = new URLSearchParams({
      query,
      dataType: 'Foundation,SR Legacy,Branded',
      pageSize: '12',
      api_key: API_KEY,
    })
    const res = await fetch(`${BASE}/foods/search?${params}`)
    if (!res.ok) return []
    const { foods = [] } = await res.json()
    return foods.map(normalize).filter((f) => f.product_name && f.nutriments['energy-kcal_100g'] > 0)
  } catch {
    return []
  }
}
