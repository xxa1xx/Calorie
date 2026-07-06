import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, fetchProfile, checkRateLimit, unauthorized, rateLimited, SECURITY_HEADERS } from './_auth.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const DAILY_LIMIT = 5

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

  const { craving } = body
  if (!craving || typeof craving !== 'string' || !craving.trim()) {
    return { statusCode: 400, headers: SECURITY_HEADERS, body: JSON.stringify({ error: 'Please describe your craving' }) }
  }

  const allowed = await checkRateLimit(supabase, 'craving_count', DAILY_LIMIT)
  if (!allowed) return rateLimited(`You've used all ${DAILY_LIMIT} craving coach sessions today. Try again tomorrow.`)

  const { profile } = await fetchProfile(supabase, user.id)

  const goalLine = profile ? `Their goal: ${profile.goal} weight. Daily calorie target: ${profile.daily_calorie_target} kcal.` : ''

  const prompt = `You are a supportive nutrition coach. The user is craving: "${craving.trim().slice(0, 200)}"
${goalLine}

Give 3 healthier alternatives that satisfy a similar craving. Be friendly and non-judgmental.

Return only this JSON (no markdown, no code blocks):
{
  "alternatives": [
    {
      "name": "<food name>",
      "why": "<one sentence: how it satisfies the craving>",
      "calories": <approximate calories for a typical serving as a number>,
      "tip": "<brief prep or serving tip>"
    }
  ],
  "encouragement": "<one warm, supportive sentence>"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
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
      else throw new Error('Could not parse response')
    }

    return { statusCode: 200, headers: SECURITY_HEADERS, body: JSON.stringify(data) }
  } catch (err) {
    console.error('craving-coach error:', err)
    return { statusCode: 500, headers: SECURITY_HEADERS, body: JSON.stringify({ error: 'Could not get suggestions. Please try again.' }) }
  }
}
