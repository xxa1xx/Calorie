import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Verifies the Bearer token from the Authorization header and returns { user, supabase, admin, error }
// supabase: anon client scoped to the authenticated user (respects RLS)
// admin: service-role client for privileged reads (profile, rate-limit RPC)
export async function requireAuth(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return { user: null, error: 'Unauthorized' }
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { user: null, error: 'Server misconfigured' }
  }

  // Verify the JWT by calling getUser — this hits Supabase auth and validates the token
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error } = await anonClient.auth.getUser(token)

  if (error || !user) {
    return { user: null, error: 'Unauthorized' }
  }

  // Service-role client for server-side reads (bypasses RLS where needed)
  const admin = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null

  return { user, supabase: anonClient, admin, error: null }
}

// Fetches the user's profile using their scoped client (RLS allows users to read their own row)
export async function fetchProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return { profile: null, error: 'Profile not found' }
  return { profile: data, error: null }
}

// Calls the rate-limiting RPC. Returns true if allowed, false if limit hit.
// p_column: 'log_food_count' | 'suggestions_count' | 'insights_count'
export async function checkRateLimit(supabase, column, limit) {
  const { data, error } = await supabase.rpc('check_and_increment_ai_usage', {
    p_column: column,
    p_limit: limit,
  })

  if (error) {
    console.error('rate-limit rpc error:', error)
    return false
  }

  return data === true
}

export const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
}

export function unauthorized(message = 'Unauthorized') {
  return {
    statusCode: 401,
    headers: SECURITY_HEADERS,
    body: JSON.stringify({ error: message }),
  }
}

export function rateLimited(message = 'Daily limit reached. Try again tomorrow.') {
  return {
    statusCode: 429,
    headers: SECURITY_HEADERS,
    body: JSON.stringify({ error: message }),
  }
}
