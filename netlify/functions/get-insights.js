import Anthropic from '@anthropic-ai/sdk'
import { buildDietaryContext } from './_dietary.js'
import { requireAuth, fetchProfile, checkRateLimit, unauthorized, rateLimited, SECURITY_HEADERS } from './_auth.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAILY_LIMIT = 5
const HISTORY_LIMIT = 8

function compactHistoricalInsight(row) {
  const analysis = row.analysis || {}
  return {
    period: `${row.period_start} to ${row.period_end}`,
    average: analysis.average,
    onTrack: analysis.onTrack,
    patterns: analysis.patterns || [],
    strengths: analysis.strengths || [],
    improvements: (analysis.improvements || []).map((item) => item.issue),
    weekSummary: analysis.weekSummary,
  }
}

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

  const { weeklyLogs } = body

  if (!Array.isArray(weeklyLogs) || weeklyLogs.length === 0) {
    return { statusCode: 400, headers: SECURITY_HEADERS, body: JSON.stringify({ error: 'Missing required fields' }) }
  }

  const allowed = await checkRateLimit(supabase, 'insights_count', DAILY_LIMIT)
  if (!allowed) return rateLimited(`You've reached the daily insights limit (${DAILY_LIMIT}/day). Try again tomorrow.`)

  // Fetch profile server-side
  const { profile, error: profileError } = await fetchProfile(supabase, user.id)
  if (profileError) return { statusCode: 404, headers: SECURITY_HEADERS, body: JSON.stringify({ error: 'Profile not found' }) }

  const logSummary = weeklyLogs.map((day) => ({
    date: day.date,
    calories: day.calories,
    protein_g: day.protein_g,
    carbs_g: day.carbs_g,
    fat_g: day.fat_g,
    meals: day.descriptions?.join(', ') || 'no data',
  }))

  const dates = logSummary.map((day) => day.date).filter(Boolean).sort()
  const periodStart = dates[0]
  const periodEnd = dates[dates.length - 1]

  // Historical insights are optional so the endpoint still works before the migration is applied.
  const { data: savedHistory, error: historyError } = await supabase
    .from('weekly_insights')
    .select('period_start, period_end, analysis, generated_at')
    .eq('user_id', user.id)
    .order('period_end', { ascending: false })
    .limit(HISTORY_LIMIT + 1)

  if (historyError) console.warn('Could not load weekly insight history:', historyError.message)

  const historicalInsights = (savedHistory || [])
    .filter((row) => row.period_start !== periodStart || row.period_end !== periodEnd)
    .slice(0, HISTORY_LIMIT)
    .map(compactHistoricalInsight)

  const dietaryContext = buildDietaryContext(profile.dietary_options)
  const historyContext = historicalInsights.length
    ? `Previously saved insight periods, newest first:\n${JSON.stringify(historicalInsights, null, 2)}`
    : 'No previous saved insights are available yet. Treat this as the baseline week.'

  const prompt = `You are a nutrition coach analysing a week of eating data to provide personalised insights.

User profile:
- Goal: ${profile.goal} weight (${profile.current_weight_kg}kg → ${profile.goal_weight_kg}kg)
- Daily targets: ${profile.daily_calorie_target} kcal, ${profile.daily_protein_target}g protein, ${profile.daily_carbs_target}g carbs, ${profile.daily_fat_target}g fat
${dietaryContext}

Current period (${periodStart} to ${periodEnd}):
${JSON.stringify(logSummary, null, 2)}

${historyContext}

Analyse the current period, identify recurring patterns, and compare it with previous saved periods when available. Do not claim a trend unless the saved data supports it. Return exactly this JSON (no markdown, no code blocks):
{
  "average": {
    "calories": <avg daily calories as integer>,
    "protein_g": <avg protein>,
    "carbs_g": <avg carbs>,
    "fat_g": <avg fat>
  },
  "patterns": [
    "<pattern observation 1>",
    "<pattern observation 2>",
    "<pattern observation 3>"
  ],
  "strengths": [
    "<something they're doing well>"
  ],
  "improvements": [
    {
      "issue": "<what to improve>",
      "suggestion": "<specific actionable advice>"
    }
  ],
  "trendComparison": "<1-2 sentences comparing this period with saved history, or clearly state this is the baseline if no history exists>",
  "weekSummary": "<2-3 sentence overall assessment and encouragement>",
  "onTrack": <true if making good progress toward goal, false otherwise>
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1700,
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
      else throw new Error('Could not parse insights')
    }

    const generatedAt = new Date().toISOString()
    const { error: saveError } = await supabase
      .from('weekly_insights')
      .upsert({
        user_id: user.id,
        period_start: periodStart,
        period_end: periodEnd,
        analysis: data,
        source_summary: logSummary,
        generated_at: generatedAt,
      }, { onConflict: 'user_id,period_start,period_end' })

    if (saveError) console.warn('Could not save weekly insight:', saveError.message)

    return {
      statusCode: 200,
      headers: SECURITY_HEADERS,
      body: JSON.stringify({
        ...data,
        _meta: {
          saved: !saveError,
          generatedAt,
          periodStart,
          periodEnd,
          historicalPeriodsCompared: historicalInsights.length,
        },
      }),
    }
  } catch (err) {
    console.error('get-insights error:', err)
    return {
      statusCode: 500,
      headers: SECURITY_HEADERS,
      body: JSON.stringify({ error: 'Failed to get insights. Please try again.' }),
    }
  }
}
