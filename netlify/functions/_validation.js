import { SECURITY_HEADERS } from './_auth.js'

export function badRequest(message) {
  return {
    statusCode: 400,
    headers: SECURITY_HEADERS,
    body: JSON.stringify({ error: message }),
  }
}

export function parseJsonBody(event, maxChars = 100_000) {
  const raw = event.body || ''
  if (typeof raw !== 'string' || raw.length > maxChars) {
    return { error: 'Request body is too large' }
  }

  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { error: 'Request body must be a JSON object' }
    }
    return { value }
  } catch {
    return { error: 'Invalid JSON' }
  }
}

export function hasOnlyKeys(value, allowedKeys) {
  const allowed = new Set(allowedKeys)
  return Object.keys(value).every((key) => allowed.has(key))
}

export function cleanOptionalText(value, maxLength) {
  if (value == null || value === '') return ''
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (text.length > maxLength) return null
  return text
}

export function cleanNumber(value, { min = 0, max = 100_000 } = {}) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) return null
  return number
}

export function cleanMacroTotals(value) {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) return undefined

  const calories = cleanNumber(value.calories ?? 0)
  const protein_g = cleanNumber(value.protein_g ?? 0)
  const carbs_g = cleanNumber(value.carbs_g ?? 0)
  const fat_g = cleanNumber(value.fat_g ?? 0)
  const fiber_g = cleanNumber(value.fiber_g ?? 0)

  if ([calories, protein_g, carbs_g, fat_g, fiber_g].includes(null)) return undefined
  return { calories, protein_g, carbs_g, fat_g, fiber_g }
}

export function cleanRecentLogs(value, maxItems = 10) {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > maxItems) return null

  const logs = []
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null
    const description = cleanOptionalText(row.description, 300)
    if (description == null) return null
    logs.push({ description })
  }
  return logs
}

export function cleanWeeklyLogs(value, maxDays = 14) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxDays) return null

  const logs = []
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null
    if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return null

    const calories = cleanNumber(row.calories ?? 0)
    const protein_g = cleanNumber(row.protein_g ?? 0)
    const carbs_g = cleanNumber(row.carbs_g ?? 0)
    const fat_g = cleanNumber(row.fat_g ?? 0)
    if ([calories, protein_g, carbs_g, fat_g].includes(null)) return null

    if (row.descriptions != null && !Array.isArray(row.descriptions)) return null
    const rawDescriptions = row.descriptions || []
    if (rawDescriptions.length > 20) return null

    const descriptions = []
    for (const item of rawDescriptions) {
      const description = cleanOptionalText(item, 300)
      if (description == null) return null
      if (description) descriptions.push(description)
    }

    logs.push({ date: row.date, calories, protein_g, carbs_g, fat_g, descriptions })
  }

  return logs
}
