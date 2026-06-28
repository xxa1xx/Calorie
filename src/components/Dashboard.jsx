import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { exportToCSV } from '../lib/export'
import { DIETARY_OPTIONS } from '../lib/dietary'
import MacroProgress from './MacroProgress'
import FoodLogger from './FoodLogger'
import FoodEntry from './FoodEntry'
import Recommendations from './Recommendations'
import WeeklyInsights from './WeeklyInsights'
import WaterTracker from './WaterTracker'
import QuickLog from './QuickLog'
import CalorieChart from './CalorieChart'
import WeightTracker from './WeightTracker'
import Settings from './Settings'
import DailyNotes from './DailyNotes'
import RecipeLibrary from './RecipeLibrary'
import FastingTimer from './FastingTimer'
import FoodLogHistory from './FoodLogHistory'

function sumLogs(logs) {
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein_g: acc.protein_g + (l.protein_g || 0),
      carbs_g: acc.carbs_g + (l.carbs_g || 0),
      fat_g: acc.fat_g + (l.fat_g || 0),
      fiber_g: acc.fiber_g + (l.fiber_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  )
}

function calcStreak(allLogs) {
  if (!allLogs.length) return 0
  const loggedDates = new Set(allLogs.map((l) => l.date))
  let streak = 0
  const d = new Date()
  const todayStr = d.toISOString().split('T')[0]
  if (!loggedDates.has(todayStr)) d.setDate(d.getDate() - 1)
  while (streak < 365) {
    const dateStr = d.toISOString().split('T')[0]
    if (!loggedDates.has(dateStr)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function calcRollover(allLogs, targetCalories) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const yLogs = allLogs.filter((l) => l.date === yesterday)
  if (!yLogs.length) return 0
  const yCalories = yLogs.reduce((a, l) => a + (l.calories || 0), 0)
  const deficit = targetCalories - yCalories
  return Math.min(Math.max(0, Math.round(deficit)), 300)
}

export default function Dashboard({ profile, onUpdateProfile }) {
  const { user, signOut } = useAuth()
  const [todayLogs, setTodayLogs] = useState([])
  const [allLogs, setAllLogs] = useState([])
  const [weeklyLogs, setWeeklyLogs] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [activeTab, setActiveTab] = useState('today')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [isWorkoutDay, setIsWorkoutDay] = useState(false)
  const [streak, setStreak] = useState(0)
  const [copying, setCopying] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const loadData = useCallback(async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', thirtyDaysAgo)
      .order('logged_at', { ascending: false })

    if (!data) return

    setTodayLogs(data.filter((l) => l.date === today))
    setAllLogs(data)
    setRecentLogs(data)
    setStreak(calcStreak(data))

    const byDate = {}
    data.forEach((log) => {
      if (!byDate[log.date]) byDate[log.date] = { date: log.date, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, descriptions: [] }
      byDate[log.date].calories += log.calories || 0
      byDate[log.date].protein_g += log.protein_g || 0
      byDate[log.date].carbs_g += log.carbs_g || 0
      byDate[log.date].fat_g += log.fat_g || 0
      byDate[log.date].descriptions.push(log.description)
    })
    setWeeklyLogs(Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)))
    setLoading(false)
  }, [user.id, today])

  useEffect(() => { loadData() }, [loadData])

  const todayTotals = sumLogs(todayLogs)

  const [currentProfile, setCurrentProfile] = useState(profile)
  const rolloverCalories = calcRollover(allLogs, currentProfile.daily_calorie_target)

  const handleFoodLogged = () => loadData()

  const handleDeleteEntry = (id) => {
    setTodayLogs((prev) => prev.filter((l) => l.id !== id))
    setAllLogs((prev) => prev.filter((l) => l.id !== id))
    setRecentLogs((prev) => prev.filter((l) => l.id !== id))
  }

  const handleCopyYesterday = async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const yesterdayLogs = allLogs.filter((l) => l.date === yesterday)
    if (!yesterdayLogs.length) { setCopyMsg("Nothing logged yesterday"); setTimeout(() => setCopyMsg(''), 3000); return }

    setCopying(true)
    const entries = yesterdayLogs.map(({ id, logged_at, date, ...rest }) => ({
      ...rest,
      date: today,
      logged_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('food_logs').insert(entries)
    if (!error) {
      await loadData()
      setCopyMsg(`Copied ${entries.length} entries from yesterday`)
    } else {
      setCopyMsg('Failed to copy')
    }
    setCopying(false)
    setTimeout(() => setCopyMsg(''), 4000)
  }

  const handleExport = async () => {
    setExporting(true)
    const { data } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    if (data) exportToCSV(data)
    setExporting(false)
  }

  const handleProfileSaved = (updated) => {
    setCurrentProfile(updated)
    onUpdateProfile(updated)
  }

  const activeDietaryOptions = (currentProfile.dietary_options || [])
    .map((id) => DIETARY_OPTIONS.find((o) => o.id === id))
    .filter(Boolean)

  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'history', label: 'History' },
    { id: 'recipes', label: 'Recipes' },
    { id: 'progress', label: 'Progress' },
    { id: 'suggestions', label: 'Suggestions' },
    { id: 'insights', label: 'Insights' },
    { id: 'settings', label: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">🥗</span>
            <h1 className="font-bold text-gray-900">CalorieAI</h1>
            {activeDietaryOptions.slice(0, 2).map((opt) => (
              <span key={opt.id} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium hidden sm:inline">
                {opt.icon} {opt.label}
              </span>
            ))}
            {activeDietaryOptions.length > 2 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full hidden sm:inline">
                +{activeDietaryOptions.length - 2} more
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block">Hi, {profile.name}</span>
            <button onClick={signOut} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pb-3 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-primary-600 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading your data...</div>
        ) : (
          <>
            {activeTab === 'today' && (
              <>
                <MacroProgress
                  profile={currentProfile}
                  todayTotals={todayTotals}
                  isWorkoutDay={isWorkoutDay}
                  streak={streak}
                  rolloverCalories={rolloverCalories}
                />
                <DailyNotes onWorkoutDayChange={setIsWorkoutDay} />
                <FastingTimer />
                <WaterTracker />
                <QuickLog onLogged={handleFoodLogged} />
                <FoodLogger profile={currentProfile} todayTotals={todayTotals} onLogged={handleFoodLogged} />

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCopyYesterday}
                    disabled={copying}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {copying ? 'Copying...' : 'Copy Yesterday'}
                  </button>
                  {copyMsg && <span className="text-sm text-gray-500">{copyMsg}</span>}
                </div>

                {todayLogs.length > 0 && (
                  <div className="card">
                    <h2 className="text-lg font-semibold mb-4">Today's Entries</h2>
                    <div className="space-y-2">
                      {todayLogs.map((entry) => (
                        <FoodEntry key={entry.id} entry={entry} onDelete={handleDeleteEntry} />
                      ))}
                    </div>
                  </div>
                )}

                {todayLogs.length === 0 && (
                  <div className="card text-center py-8 text-gray-500">
                    <div className="text-3xl mb-2">🍽️</div>
                    <p className="text-sm">No food logged yet today.</p>
                    <p className="text-sm">Use the form above to get started!</p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'history' && (
              <FoodLogHistory allLogs={allLogs} profile={currentProfile} />
            )}

            {activeTab === 'recipes' && (
              <RecipeLibrary onLogged={handleFoodLogged} />
            )}

            {activeTab === 'progress' && (
              <>
                <CalorieChart weeklyLogs={weeklyLogs.slice(0, 7)} target={currentProfile.daily_calorie_target} />
                <WeightTracker profile={currentProfile} />
                <div className="card">
                  <h2 className="text-lg font-semibold mb-2">Export Data</h2>
                  <p className="text-sm text-gray-500 mb-4">Download your complete food log as a CSV file — useful for doctors, dietitians, or your own records.</p>
                  <button onClick={handleExport} disabled={exporting} className="btn-secondary flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {exporting ? 'Preparing...' : 'Download CSV'}
                  </button>
                </div>
              </>
            )}

            {activeTab === 'suggestions' && (
              <Recommendations profile={currentProfile} todayTotals={todayTotals} recentLogs={recentLogs} />
            )}

            {activeTab === 'insights' && (
              <WeeklyInsights profile={currentProfile} weeklyLogs={weeklyLogs.slice(0, 7)} />
            )}

            {activeTab === 'settings' && (
              <Settings profile={currentProfile} onSaved={handleProfileSaved} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
