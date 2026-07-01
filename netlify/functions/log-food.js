import Anthropic from '@anthropic-ai/sdk'
import { buildDietaryContext } from './_dietary.js'
import { requireAuth, fetchProfile, checkRateLimit, unauthorized, rateLimited, SECURITY_HEADERS } from './_auth.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAILY_LIMIT = 30
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: SECURITY_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }

  const { user, supabase, error: authError } = await requireAuth(event)
  if (authError) return unauthorized()

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, headers: SECURITY_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { description, todayLog, imageBase64, imageType } = body

  if (!description && !imageBase64) {
    return { statusCode: 400, headers: SECURITY_HEADERS, body: JSON.stringify({ error: 'Missing required fields' }) }
  }

  // Validate image size server-side (client check alone is not sufficient)
  if (imageBase64) {
    const approxBytes = Math.ceil(imageBase64.length * 0.75)
    if (approxBytes > MAX_IMAGE_BYTES) {
      return { statusCode: 400, headers: SECURITY_HEADERS, body: JSON.stringify({ error: 'Image must be under 5MB' }) }
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (imageType && !validTypes.includes(imageType)) {
      return { statusCode: 400, headers: SECURITY_HEADERS, body: JSON.stringify({ error: 'Unsupported image type' }) }
    }
  }

  // Rate limit check — uses auth.uid() inside the RPC, so it's tamper-proof
  const allowed = await checkRateLimit(supabase, 'log_food_count', DAILY_LIMIT)
  if (!allowed) return rateLimited(`You've reached the daily AI log limit (${DAILY_LIMIT}/day). Try again tomorrow.`)

  // Fetch profile server-side — never trust client-supplied profile data
  const { profile, error: profileError } = await fetchProfile(supabase, user.id)
  if (profileError) return { statusCode: 404, headers: SECURITY_HEADERS, body: JSON.stringify({ error: 'Profile not found' }) }

  const todayTotals = todayLog
    ? `Calories logged so far today: ${todayLog.calories} / ${profile.daily_calorie_target} kcal, Protein: ${todayLog.protein_g}g / ${profile.daily_protein_target}g, Carbs: ${todayLog.carbs_g}g / ${profile.daily_carbs_target}g, Fat: ${todayLog.fat_g}g / ${profile.daily_fat_target}g`
    : 'No food logged yet today.'

  const dietaryContext = buildDietaryContext(profile.dietary_options)

  const systemPrompt = `You are a nutrition expert AI assistant. Analyse food and estimate calories and macronutrients accurately. When amounts are ambiguous, use standard portion sizes. Always respond with valid JSON only, no markdown.${dietaryContext}`

  const textPrompt = `Analyse this food entry and return nutrition data as JSON.

${description ? `Food description: "${description}"` : 'Identify the food shown in the image.'}

User profile:
- Goal: ${profile.goal} weight (current: ${profile.current_weight_kg}kg, goal: ${profile.goal_weight_kg}kg)
- Daily targets: ${profile.daily_calorie_target} kcal, ${profile.daily_protein_target}g protein, ${profile.daily_carbs_target}g carbs, ${profile.daily_fat_target}g fat
- ${todayTotals}

Return this exact JSON structure (no markdown, no code blocks):
{
  "calories": <total calories as integer>,
  "protein_g": <protein in grams as number>,
  "carbs_g": <carbohydrates in grams as number>,
  "fat_g": <fat in grams as number>,
  "fiber_g": <fiber in grams as number>,
  "items": [
    {
      "name": "<food item name>",
      "amount": "<portion description>",
      "calories": <calories as integer>,
      "protein_g": <protein>,
      "carbs_g": <carbs>,
      "fat_g": <fat>
    }
  ],
  "feedback": "<1-2 sentences of personalised feedback about this meal in context of their daily progress, goal, and dietary preferences>"
}`

  const messageContent = imageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: imageType || 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: textPrompt },
      ]
    : textPrompt

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: messageContent }],
      system: systemPrompt,
    })

    const textContent = message.content.find((b) => b.type === 'text')
    if (!textContent) throw new Error('No text response from Claude')

    let nutritionData
    try {
      nutritionData = JSON.parse(textContent.text)
    } catch {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) nutritionData = JSON.parse(jsonMatch[0])
      else throw new Error('Could not parse nutrition data')
    }

    return {
      statusCode: 200,
      headers: SECURITY_HEADERS,
      body: JSON.stringify(nutritionData),
    }
  } catch (err) {
    console.error('log-food error:', err)
    return {
      statusCode: 500,
      headers: SECURITY_HEADERS,
      body: JSON.stringify({ error: 'Failed to analyse food. Please try again.' }),
    }
  }
}
