import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

const MIN_PASSWORD_LENGTH = 8

function getPasswordStrength(password) {
  let score = 0
  if (password.length >= MIN_PASSWORD_LENGTH) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

function PasswordStrengthBar({ password }) {
  if (!password) return null
  const score = getPasswordStrength(password)
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong']
  const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-primary-500', 'bg-primary-600']
  const textColors = ['', 'text-red-600', 'text-orange-500', 'text-yellow-600', 'text-primary-600', 'text-primary-700']

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= score ? colors[score] : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className={`text-xs ${textColors[score]}`}>{labels[score]}</p>
    </div>
  )
}

function PasswordInput({ label, value, onChange, placeholder, autoComplete, id }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="input pr-10"
          value={value}
          onChange={onChange}
          placeholder={placeholder || '••••••••'}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export default function Auth() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setMessage('')
    setPassword('')
    setConfirmPassword('')
  }

  const validateSignup = () => {
    if (getPasswordStrength(password) < 2) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return false
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (mode === 'signup' && !validateSignup()) return

    setLoading(true)

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password)
        if (error) throw error
        setMessage('Account created! Check your email to confirm it, then sign in.')
        switchMode('signin')
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email)
        if (error) throw error
        setMessage('Password reset link sent! Check your email.')
        switchMode('signin')
      }
    } catch (err) {
      const msg = err.message || 'Something went wrong. Please try again.'
      // Normalise Supabase's generic "Invalid login credentials" to something friendlier
      if (msg.toLowerCase().includes('invalid login')) {
        setError('Incorrect email or password.')
      } else if (msg.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Try signing in.')
      } else if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
        setError('Too many attempts. Please wait a moment before trying again.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🥗</div>
          <h1 className="text-3xl font-bold text-gray-900">CalorieAI</h1>
          <p className="text-gray-600 mt-2">Smart nutrition tracking powered by AI</p>
        </div>

        <div className="card">
          {mode !== 'forgot' && (
            <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'signin' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => switchMode('signin')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'signup' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => switchMode('signup')}
              >
                Create Account
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to sign in
              </button>
              <h2 className="text-lg font-semibold text-gray-900 mt-3">Reset your password</h2>
              <p className="text-sm text-gray-500 mt-1">We'll send a reset link to your email.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            {mode !== 'forgot' && (
              <PasswordInput
                id="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            )}

            {mode === 'signup' && (
              <>
                <PasswordStrengthBar password={password} />
                <PasswordInput
                  id="confirm-password"
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-400">
                  Use at least {MIN_PASSWORD_LENGTH} characters. Mix letters, numbers, and symbols for a stronger password.
                </p>
              </>
            )}

            {error && (
              <div className="flex gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {message && (
              <div className="flex gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {message}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Please wait...
                </span>
              ) : mode === 'signin' ? 'Sign In'
                : mode === 'signup' ? 'Create Account'
                : 'Send Reset Link'}
            </button>

            {mode === 'signin' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-sm text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your data is private — secured with Supabase row-level security.
        </p>
      </div>
    </div>
  )
}
