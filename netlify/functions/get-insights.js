import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { profile, weeklyLogs } = body

  if (!profile || !weeklyLogs) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
  }

  const logSummary = weeklyLogs.map((day) => ({
    date: day.date,
    calories: day.calories,
    protein_g: day.protein_g,
    carbs_g: day.carbs_g,
    fat_g: day.fat_g,
    meals: day.descriptions?.join(', ') || 'no data',
  }))

  const glp1Section = profile.on_glp1 ? `
GLP-1 medication context: This user is on a GLP-1 medication. When analysing:
- Eating consistently below calorie target is NORMAL and expected — do not flag this as a problem
- Focus on whether protein targets are being met (muscle preservation is critical)
- Highlight consistency in logging and eating patterns
- Note if they are making good nutrient-dense food choices
- Celebrate small victories — GLP-1 journeys require patience
- Flag only genuine concerns (e.g. extremely low protein, or almost no food logged for multiple days)` : ''

  const prompt = `You are a nutrition coach analysing a week of eating data to provide personalised insights.

User profile:
- Goal: ${profile.goal} weight (${profile.current_weight_kg}kg → ${profile.goal_weight_kg}kg)${profile.on_glp1 ? '\n- On GLP-1 medication' : ''}
- Daily targets: ${profile.daily_calorie_target} kcal, ${profile.daily_protein_target}g protein, ${profile.daily_carbs_target}g carbs, ${profile.daily_fat_target}g fat
${glp1Section}

Last 7 days of data:
${JSON.stringify(logSummary, null, 2)}

Analyse patterns and provide actionable insights. Return exactly this JSON (no markdown, no code blocks):
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
  "weekSummary": "<2-3 sentence overall assessment and encouragement>",
  "onTrack": <true if making good progress toward goal, false otherwise>
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  } catch (err) {
    console.error('get-insights error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to get insights. Please try again.' }),
    }
  }
}
