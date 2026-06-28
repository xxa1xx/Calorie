const BASE = 'https://world.openfoodfacts.org'

export async function searchFoods(query) {
  if (!query || query.length < 2) return []
  try {
    const res = await fetch(
      `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,nutriments,serving_size,image_thumb_url,code`
    )
    const data = await res.json()
    return (data.products || []).filter((p) => p.product_name && p.nutriments)
  } catch {
    return []
  }
}

export async function getByBarcode(barcode) {
  try {
    const res = await fetch(`${BASE}/api/v0/product/${barcode}.json?fields=product_name,brands,nutriments,serving_size,image_thumb_url,code`)
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null
    return data.product
  } catch {
    return null
  }
}

export function extractNutrients(product, amountG = 100) {
  const n = product.nutriments || {}
  const factor = amountG / 100
  return {
    description: [product.product_name, product.brands].filter(Boolean).join(' — '),
    calories: Math.round((n['energy-kcal_100g'] || n['energy_100g'] / 4.184 || 0) * factor),
    protein_g: Math.round(((n.proteins_100g || 0) * factor) * 10) / 10,
    carbs_g: Math.round(((n.carbohydrates_100g || 0) * factor) * 10) / 10,
    fat_g: Math.round(((n.fat_100g || 0) * factor) * 10) / 10,
    fiber_g: Math.round(((n.fiber_100g || 0) * factor) * 10) / 10,
  }
}
