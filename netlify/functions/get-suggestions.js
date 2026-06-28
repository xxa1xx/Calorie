import Anthropic from '@anthropic-ai/sdk'
import { buildDietaryContext } from './_dietary.js'
import { requireAuth, fetchProfile, checkRateLimit, unauthorized, rateLimited } from './_auth.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAILY_LIMIT = 10

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const { user, supabase, error: authError } = await requireAuth(event)
  if (authError) return unauthorized()

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { todayLog, recentLogs } = body

  const allowed = await checkRateLimit(supabase, 'suggestions_count', DAILY_LIMIT)
  if (!allowed) return rateLimited(`You've reached the daily suggestions limit (${DAILY_LIMIT}/day). Try again tomorrow.`)

  // Fetch profile server-side
  const { profile, error: profileError } = await fetchProfile(supabase, user.id)
  if (profileError) return { statusCode: 404, body: JSON.stringify({ error: 'Profile not found' }) }

  const remaining = {
    calories: Math.max(0, profile.daily_calorie_target - (todayLog?.calories || 0)),
    protein_g: Math.max(0, profile.daily_protein_target - (todayLog?.protein_g || 0)),
    carbs_g: Math.max(0, profile.daily_carbs_target - (todayLog?.carbs_g || 0)),
    fat_g: Math.max(0, profile.daily_fat_target - (todayLog?.fat_g || 0)),
  }

  const recentFoods = recentLogs && recentLogs.length > 0
    ? recentLogs.slice(0, 10).map((l) => l.description).join(', ')
    : 'No recent history'

  const dietaryContext = buildDietaryContext(profile.dietary_options)

  const prompt = `You are a nutrition coach. Suggest 3 meal or snack options based on remaining daily nutrition needs.

User goal: ${profile.goal} weight
Remaining today: ${remaining.calories} kcal, ${remaining.protein_g}g protein, ${remaining.carbs_g}g carbs, ${remaining.fat_g}g fat
Recent foods eaten: ${recentFoods}
${dietaryContext}

Return exactly this JSON (no markdown, no code blocks):
{
  "suggestions": [
    {
      "name": "<meal/snack name>",
      "description": "<brief description with key ingredients>",
      "calories": <estimated calories>,
      "protein_g": <protein grams>,
      "carbs_g": <carbs grams>,
      "fat_g": <fat grams>,
      "why": "<one sentence on why this fits their remaining needs and dietary preferences>"
    }
  ],
  "summary": "<1-2 sentences of encouragement or tips based on their day so far>"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = message.content.find((b) => b.type === 'text')
    if (!textContent) throw new Error('No text response')

    let data
    try {
      data = JSON.parse(textContent.text)
    } catch {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) data = JSON.parse(jsonMatch[0])
      else throw new Error('Could not parse suggestions')
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  } catch (err) {
    console.error('get-suggestions error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to get suggestions. Please try again.' }),
    }
  }
}
