export function exportToCSV(logs, filename = 'calorie-log.csv') {
  const headers = ['Date', 'Time', 'Description', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Fiber (g)']

  const rows = logs.map((log) => [
    log.date,
    new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    `"${log.description.replace(/"/g, '""')}"`,
    log.calories,
    Math.round(log.protein_g),
    Math.round(log.carbs_g),
    Math.round(log.fat_g),
    Math.round(log.fiber_g || 0),
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
