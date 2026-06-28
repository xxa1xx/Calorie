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

  const { profile, todayLog, recentLogs } = body

  if (!profile) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing profile' }) }
  }

  const remaining = {
    calories: Math.max(0, profile.daily_calorie_target - (todayLog?.calories || 0)),
    protein_g: Math.max(0, profile.daily_protein_target - (todayLog?.protein_g || 0)),
    carbs_g: Math.max(0, profile.daily_carbs_target - (todayLog?.carbs_g || 0)),
    fat_g: Math.max(0, profile.daily_fat_target - (todayLog?.fat_g || 0)),
  }

  const recentFoods = recentLogs && recentLogs.length > 0
    ? recentLogs.slice(0, 10).map((l) => l.description).join(', ')
    : 'No recent history'

  const glp1Section = profile.on_glp1 ? `
GLP-1 medication context: This user is on a GLP-1 medication. Prioritise:
- Small, protein-dense portions (aim for maximum protein per calorie)
- Easy-to-digest foods that are gentle on the stomach
- High nutrient density to compensate for lower overall volume
- Good hydration (suggest water-rich foods or remind about fluids)
- Avoid heavy, greasy, or very spicy foods that may worsen nausea
- It is normal and expected that they may not hit their full calorie target` : ''

  const prompt = `You are a nutrition coach. Suggest 3 meal or snack options based on remaining daily nutrition needs.

User goal: ${profile.goal} weight${profile.on_glp1 ? ' (on GLP-1 medication)' : ''}
Remaining today: ${remaining.calories} kcal, ${remaining.protein_g}g protein, ${remaining.carbs_g}g carbs, ${remaining.fat_g}g fat
Recent foods eaten: ${recentFoods}
${glp1Section}

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
      "why": "<one sentence on why this fits their remaining needs>"
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
