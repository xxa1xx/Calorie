export const supported = typeof window !== 'undefined' && 'Notification' in window

export function getPermission() {
  return supported ? Notification.permission : 'denied'
}

export async function requestPermission() {
  if (!supported) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function notify(title, body, options = {}) {
  if (!supported || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/favicon.svg', ...options })
  } catch {}
}

let reminderTimeout = null

export function scheduleDailyReminder(enabled, checkHasLoggedToday) {
  if (reminderTimeout) { clearTimeout(reminderTimeout); reminderTimeout = null }
  if (!enabled || !supported || Notification.permission !== 'granted') return

  const now = new Date()
  const target = new Date()
  target.setHours(19, 0, 0, 0) // 7pm
  if (target <= now) target.setDate(target.getDate() + 1)

  const delay = target - now
  reminderTimeout = setTimeout(async () => {
    const hasLogged = await checkHasLoggedToday()
    if (!hasLogged) notify('Log your meals 🥗', "You haven't logged any food yet today. Keep your streak going!")
    scheduleDailyReminder(enabled, checkHasLoggedToday)
  }, delay)
}
