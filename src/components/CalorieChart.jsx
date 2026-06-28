import {
  BarChart, Bar, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const { calories, target } = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      <p className="text-gray-900">{calories} <span className="text-gray-400">kcal eaten</span></p>
      <p className="text-gray-500">{target} <span className="text-gray-400">kcal target</span></p>
      {calories > 0 && (
        <p className={`mt-1 font-medium ${calories > target ? 'text-red-500' : 'text-primary-600'}`}>
          {calories > target ? `+${calories - target} over` : `${target - calories} remaining`}
        </p>
      )}
    </div>
  )
}

export default function CalorieChart({ weeklyLogs, target }) {
  if (!weeklyLogs || weeklyLogs.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Calorie History</h2>
        <div className="text-center py-8 text-gray-400 text-sm">
          <div className="text-3xl mb-2">📊</div>
          Start logging food to see your history
        </div>
      </div>
    )
  }

  // Fill in missing days in the last 7 days
  const last7 = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const found = weeklyLogs.find((l) => l.date === dateStr)
    last7.push({
      date: dateStr,
      label: formatDate(dateStr),
      calories: found ? Math.round(found.calories) : 0,
      target,
    })
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Calorie History</h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={last7} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
          <ReferenceLine y={target} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1.5} />
          <Bar
            dataKey="calories"
            fill="#4ade80"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Green dashed line = daily target ({target} kcal)
      </p>
    </div>
  )
}
