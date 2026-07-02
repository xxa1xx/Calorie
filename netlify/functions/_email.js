export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function safeHttpsOrigin(value, fallback = 'https://your-app.netlify.app') {
  try {
    const url = new URL(value || fallback)
    if (url.protocol !== 'https:' || url.username || url.password) return fallback
    return url.origin
  } catch {
    return fallback
  }
}
