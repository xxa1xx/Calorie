// Netlify Scheduled Function — sends daily food log summary emails via Resend
// Schedule: 8pm UTC daily (configure in netlify.toml)
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, PUBLIC_APP_URL

import { escapeHtml, safeHttpsOrigin } from './_email.js'

export default async () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, PUBLIC_APP_URL } = process.env

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    console.log('daily-summary: missing env vars, skipping')
    return new Response('missing config', { status: 200 })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  const today = new Date().toISOString().split('T')[0]

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, name, daily_calorie_target, daily_protein_target')
    .eq('email_summary', true)

  if (!profiles?.length) return new Response('no subscribers', { status: 200 })

  for (const profile of profiles) {
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
    const email = authUser?.user?.email
    if (!email) continue

    const { data: logs } = await admin
      .from('food_logs')
      .select('calories, protein_g, carbs_g, fat_g, description')
      .eq('user_id', profile.id)
      .eq('date', today)

    const totals = (logs || []).reduce(
      (acc, l) => ({
        calories: acc.calories + (l.calories || 0),
        protein_g: acc.protein_g + (l.protein_g || 0),
        carbs_g: acc.carbs_g + (l.carbs_g || 0),
        fat_g: acc.fat_g + (l.fat_g || 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    )

    const pct = Math.round((totals.calories / Math.max(1, profile.daily_calorie_target)) * 100)
    const remaining = Math.max(0, profile.daily_calorie_target - totals.calories)
    const appUrl = safeHttpsOrigin(PUBLIC_APP_URL)
    const dateFormatted = new Date(today + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

    const entries = (logs || []).map((l) => `
      <tr>
        <td style="padding:6px 0;color:#374151;font-size:14px">${escapeHtml(l.description)}</td>
        <td style="padding:6px 0;color:#6b7280;font-size:14px;text-align:right">${Math.round(Number(l.calories) || 0)} kcal</td>
      </tr>`).join('')

    const statusColor = pct >= 100 ? '#ef4444' : pct >= 70 ? '#22c55e' : '#6366f1'
    const message = pct >= 100
      ? 'You hit your calorie goal today!'
      : pct === 0
      ? "Looks like you haven't logged anything yet today."
      : remaining > 0
      ? `You have ${remaining} kcal remaining today.`
      : 'Great tracking today!'

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#6366f1;padding:24px;text-align:center">
      <div style="font-size:36px">🥗</div>
      <h1 style="color:#fff;margin:8px 0 0;font-size:20px">CalorieAI Daily Summary</h1>
      <p style="color:#c7d2fe;margin:4px 0 0;font-size:14px">${escapeHtml(dateFormatted)}</p>
    </div>

    <div style="padding:24px">
      <p style="margin:0 0 16px;color:#374151">Hi ${escapeHtml(profile.name)},</p>

      <div style="background:#f3f4f6;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px">
        <div style="font-size:42px;font-weight:700;color:${statusColor}">${Math.round(totals.calories)}</div>
        <div style="color:#6b7280;font-size:14px">of ${profile.daily_calorie_target} kcal — ${pct}%</div>
        <div style="color:#374151;font-size:14px;margin-top:8px">${escapeHtml(message)}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;text-align:center">
        <div style="background:#eff6ff;border-radius:8px;padding:12px">
          <div style="font-size:18px;font-weight:600;color:#2563eb">${Math.round(totals.protein_g)}g</div>
          <div style="font-size:12px;color:#6b7280">Protein</div>
        </div>
        <div style="background:#fefce8;border-radius:8px;padding:12px">
          <div style="font-size:18px;font-weight:600;color:#d97706">${Math.round(totals.carbs_g)}g</div>
          <div style="font-size:12px;color:#6b7280">Carbs</div>
        </div>
        <div style="background:#faf5ff;border-radius:8px;padding:12px">
          <div style="font-size:18px;font-weight:600;color:#7c3aed">${Math.round(totals.fat_g)}g</div>
          <div style="font-size:12px;color:#6b7280">Fat</div>
        </div>
      </div>

      ${logs?.length ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr><th style="text-align:left;font-size:12px;color:#9ca3af;padding-bottom:6px;border-bottom:1px solid #f3f4f6">MEALS</th><th style="text-align:right;font-size:12px;color:#9ca3af;padding-bottom:6px;border-bottom:1px solid #f3f4f6">KCAL</th></tr>
        ${entries}
      </table>` : ''}

      <a href="${escapeHtml(appUrl)}" style="display:block;background:#6366f1;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:600;font-size:15px">
        Open CalorieAI →
      </a>

      <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;text-align:center">
        To stop these emails, go to Settings → turn off Daily email summary.
      </p>
    </div>
  </div>
</body>
</html>`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CalorieAI <noreply@yourdomain.com>',
        to: email,
        subject: `Your daily summary — ${Math.round(totals.calories)} kcal logged`,
        html,
      }),
    })
  }

  return new Response('ok', { status: 200 })
}
