import Anthropic from '@anthropic-ai/sdk'
import { buildDietaryContext } from './_dietary.js'

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

  const { description, profile, todayLog, imageBase64, imageType } = body

  if ((!description && !imageBase64) || !profile) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
  }

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nutritionData),
    }
  } catch (err) {
    console.error('log-food error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to analyse food. Please try again.' }),
    }
  }
}
