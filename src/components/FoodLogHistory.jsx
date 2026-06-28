import { useState } from 'react'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateStr === today.toISOString().split('T')[0]) return 'Today'
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function sumLogs(logs) {
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein_g: acc.protein_g + (l.protein_g || 0),
      carbs_g: acc.carbs_g + (l.carbs_g || 0),
      fat_g: acc.fat_g + (l.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}

export default function FoodLogHistory({ allLogs, profile }) {
  const [expandedDate, setExpandedDate] = useState(null)

  const byDate = {}
  allLogs.forEach((log) => {
    if (!byDate[log.date]) byDate[log.date] = []
    byDate[log.date].push(log)
  })

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))
  const target = profile.daily_calorie_target

  if (dates.length === 0) {
    return (
      <div className="card text-center py-12 text-gray-400">
        <div className="text-3xl mb-2">📋</div>
        <p className="text-sm">No food logs yet. Start logging to see your history here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {dates.map((date) => {
        const logs = byDate[date].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at))
        const totals = sumLogs(logs)
        const pct = Math.round((totals.calories / target) * 100)
        const isExpanded = expandedDate === date
        const deficit = target - totals.calories
        const netCarbs = Math.max(0, Math.round(totals.carbs_g - (logs.reduce((a, l) => a + (l.fiber_g || 0), 0))))

        return (
          <div key={date} className="card p-0 overflow-hidden">
            <button
              onClick={() => setExpandedDate(isExpanded ? null : date)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-medium text-sm text-gray-900 shrink-0">{formatDate(date)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  pct >= 100 ? 'bg-red-100 text-red-700' : pct >= 80 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {Math.round(totals.calories)} kcal
                </span>
              </div>
              <div className="flex items-center gap-3 ml-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-gray-500">
                    {deficit > 0 ? `–${deficit} under` : `+${Math.abs(deficit)} over`}
                  </div>
                  <div className="text-xs text-gray-400">{logs.length} {logs.length === 1 ? 'entry' : 'entries'}</div>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100">
                <div className="px-4 py-2 bg-gray-50 flex gap-4 text-xs text-gray-600">
                  <span>P: {Math.round(totals.protein_g)}g</span>
                  <span>C: {Math.round(totals.carbs_g)}g</span>
                  <span>F: {Math.round(totals.fat_g)}g</span>
                  {netCarbs > 0 && <span className="text-gray-400">Net C: {netCarbs}g</span>}
                  <span className="ml-auto text-gray-400">{pct}% of goal</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {logs.map((entry) => (
                    <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">{entry.description}</p>
                        {entry.protein_g > 0 && (
                          <p className="text-xs text-gray-400">
                            P:{entry.protein_g}g C:{entry.carbs_g}g F:{entry.fat_g}g
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-700 ml-3 shrink-0">{entry.calories} kcal</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
