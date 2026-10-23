// src/pages/outside/Login.jsx
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  UserPlus,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONSTANTS + HELPERS
──────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const DEFAULT_REDIRECT = '/dashboard'
const DEFAULT_LOCK_SECONDS = 60
const FORM_FIELDS = ['email', 'password']

const card = 'rounded-2xl border border-white/10 bg-[#0B141B]'

// Only allow in-app paths, and never bounce back onto an auth page
function safeRedirect(path) {
  if (typeof path !== 'string') return DEFAULT_REDIRECT
  if (!path.startsWith('/') || path.startsWith('//')) return DEFAULT_REDIRECT
  if (/^\/(login|signup)(\/|\?|$)/.test(path)) return DEFAULT_REDIRECT
  return path
}

// Same keys that Api.jsx clears when a session ends
function saveSession({ access, refresh, user }) {
  localStorage.setItem('accessToken', access)
  localStorage.setItem('refreshToken', refresh)
  localStorage.setItem('user', JSON.stringify(user ?? null))
  localStorage.setItem('isAuthenticated', 'true')
}

// Turns any axios error into { message, code, status, fields, data }
function parseError(err) {
  const res = err?.response
  if (!res) {
    return {
      message:
        err?.code === 'ECONNABORTED'
          ? 'The server is taking too long to respond. It may be waking up, so please try again in a moment.'
          : 'Network error. Check your connection and try again.',
      code: 'network',
      status: 0,
      fields: {},
      data: null,
    }
  }
  const d = typeof res.data === 'object' && res.data ? res.data : {}
  const fields = {}
  if (d.errors && typeof d.errors === 'object') {
    Object.entries(d.errors).forEach(([k, v]) => {
      fields[k] = Array.isArray(v) ? String(v[0]) : String(v)
    })
  }
  return {
    message: d.message || 'Something went wrong. Please try again.',
    code: d.code || '',
    status: res.status,
    fields,
    data: d.data && typeof d.data === 'object' ? d.data : null,
  }
}

// Seconds to wait for a lockout: prefer the server's number, fall back to the message text
function lockSecondsFrom(data, message) {
  const n = Number(data?.retry_after_seconds)
  if (Number.isFinite(n) && n > 0) return Math.ceil(n)
  const m = String(message).match(/(\d+)\s*minute/i)
  return m ? Number(m[1]) * 60 : DEFAULT_LOCK_SECONDS
}

function validate(f) {
  const e = {}
  if (!f.email.trim()) e.email = 'Enter your email address.'
  else if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.'
  if (!f.password) e.password = 'Enter your password.'
  return e
}

const formatClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/* ────────────────────────────────────────────────
   SMALL UI PIECES
──────────────────────────────────────────────── */

function Field({ id, label, icon: Icon, error, labelRight, right, ...inputProps }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-400">
        <label htmlFor={id}>{label}</label>
        {labelRight}
      </div>
      <div
        className={`flex items-center gap-2.5 rounded-xl border bg-[#080D12] px-3.5 transition-colors focus-within:ring-1 ${
          error
            ? 'border-[#F6465D]/60 focus-within:border-[#F6465D] focus-within:ring-[#F6465D]/30'
            : 'border-white/10 focus-within:border-[#3DDC97]/60 focus-within:ring-[#3DDC97]/40'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <input
          id={id}
          name={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full min-w-0 bg-transparent py-3 text-base text-white outline-none placeholder:text-slate-500"
          {...inputProps}
        />
        {right}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-[#F6465D]">
          {error}
        </p>
      )}
    </div>
  )
}

function Banner({ tone = 'error', icon: Icon = AlertCircle, children }) {
  if (!children) return null
  const tones = {
    error: 'border-[#F6465D]/30 bg-[#F6465D]/10 text-red-200',
    success: 'border-[#3DDC97]/30 bg-[#3DDC97]/10 text-emerald-100',
    warn: 'border-[#F59E0B]/30 bg-[#F59E0B]/10 text-amber-100',
  }
  const iconTone = { error: 'text-[#F6465D]', success: 'text-[#3DDC97]', warn: 'text-[#F59E0B]' }
  return (
    <div
      role={tone === 'success' ? 'status' : 'alert'}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${tones[tone]}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconTone[tone]}`} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Login() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const location = useLocation()

  // Where to go after login (PrivateRoute can pass state.from), and what Signup passes us
  const redirectTo = safeRedirect(location.state?.from?.pathname)
  const cameFromVerify = Boolean(location.state?.verified)
  const cameFromReset = Boolean(location.state?.passwordReset)

  const [form, setForm] = useState({ email: location.state?.email || '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState(cameFromVerify || cameFromReset)
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 403 email_not_verified → { email, otpSent }
  const [unverified, setUnverified] = useState(null)

  // 429 account_locked → live countdown
  const [lockSeconds, setLockSeconds] = useState(0)
  const [lockMessage, setLockMessage] = useState('')
  const locked = lockSeconds > 0

  const busy = useRef(false)
  const email = form.email.trim().toLowerCase()

  useEffect(() => {
    if (!locked) return
    const id = setInterval(() => setLockSeconds((c) => (c <= 1 ? 0 : c - 1)), 1000)
    return () => clearInterval(id)
  }, [locked])

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setFormError('')
    setUnverified(null)
  }

  const goVerify = () => {
    navigate('/signup', { state: { verifyEmail: unverified.email, otpSent: unverified.otpSent } })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy.current || locked) return

    setNotice(false)
    setFormError('')
    setUnverified(null)

    const v = validate(form)
    setErrors(v)
    if (Object.keys(v).length) return

    busy.current = true
    setSubmitting(true)
    try {
      const res = await api.post('/api/auth/login/', { email, password: form.password }, { skipAuth: true })
      const { access, refresh, user } = res.data?.data ?? {}

      if (!access || !refresh) {
        setFormError('Login worked but the server reply was incomplete. Please try again.')
        return
      }
      try {
        saveSession({ access, refresh, user })
      } catch {
        setFormError('We could not save your session. Make sure your browser allows site storage, then try again.')
        return
      }
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const { message, code, fields, data } = parseError(err)

      // 403: correct credentials, but the email isn't verified yet.
      // The backend has already sent a fresh code when it could (data.otp_sent).
      if (code === 'email_not_verified') {
        setUnverified({ email: data?.email || email, otpSent: Boolean(data?.otp_sent) })
        return
      }

      // 429: account locked → block the form and count down
      if (code === 'account_locked') {
        setLockSeconds(lockSecondsFrom(data, message))
        setLockMessage(message)
        setForm((f) => ({ ...f, password: '' }))
        return
      }

      // 400: wrong email or password → keep the email, clear the password
      if (code === 'invalid_credentials') {
        setFormError(message)
        setForm((f) => ({ ...f, password: '' }))
        return
      }

      // 400: field validation errors
      if (Object.keys(fields).length) {
        const known = {}
        const extra = []
        Object.entries(fields).forEach(([k, msg]) => {
          if (FORM_FIELDS.includes(k)) known[k] = msg
          else extra.push(msg)
        })
        setErrors(known)
        setFormError(extra.length ? extra.join(' ') : Object.keys(known).length ? '' : message)
        return
      }

      // 403 account_disabled, 429 throttled, network errors, anything else
      setFormError(message)
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }

  const fade = {
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: 'easeOut' },
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080D12] text-slate-300">
      {/* Background glows */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-[#3DDC97]/10 blur-3xl"
        animate={reduce ? undefined : { y: [0, 30, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#2E9BFF]/10 blur-3xl"
        animate={reduce ? undefined : { y: [0, -30, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-10 pt-5 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            aria-label="Solvexmarketinc, home"
            className="group flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F1B24] ring-1 ring-white/10 transition-colors group-hover:ring-[#3DDC97]/50">
              <img src="/Logo_nbg.png" alt="" className="h-7 w-7 object-contain" draggable="false" />
            </span>
            <span className="hidden text-base font-semibold tracking-tight text-white sm:block">
              SOLVE<span className="text-[#FF4D4F]">X</span>
              <span className="text-[#3DDC97]">MARKETINC</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-medium text-slate-200 transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>

        <main className="flex flex-1 flex-col justify-center py-8">
          <motion.div {...fade} className={`${card} p-5 sm:p-8`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/25">
              <LogIn className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-400">Log in to your account to continue trading.</p>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              {/* Arrived from the verification step */}
              {notice && !formError && !unverified && !locked && (
                <Banner tone="success" icon={CheckCircle2}>
                  {cameFromReset
                    ? 'Password updated. Log in with your new password.'
                    : 'Email verified. Log in to continue.'}
                </Banner>
              )}

              {/* 429: locked */}
              {locked && (
                <Banner tone="warn" icon={Clock}>
                  <p>{lockMessage}</p>
                  <p className="mt-1 text-xs tabular-nums text-amber-200/80">
                    You can try again in {formatClock(lockSeconds)}.
                  </p>
                </Banner>
              )}

              {/* 400 / 403 disabled / 429 throttled / network */}
              {!locked && <Banner>{formError}</Banner>}

              {/* 403: email not verified */}
              {unverified && (
                <motion.div
                  {...fade}
                  className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-4"
                  role="alert"
                >
                  <div className="flex items-start gap-2.5">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" aria-hidden="true" />
                    <div className="min-w-0 text-sm text-amber-100">
                      <p className="font-semibold">Please verify your email address before logging in.</p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
                        {unverified.otpSent
                          ? `We just sent a new 6-digit code to ${unverified.email}.`
                          : `Enter the code we emailed to ${unverified.email}, or request a new one.`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={goVerify}
                    className="group mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3DDC97] text-sm font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  >
                    Enter verification code
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </button>
                </motion.div>
              )}

              <Field
                id="email"
                label="Email address"
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="john@example.com"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                error={errors.email}
                disabled={submitting}
              />

              <Field
                id="password"
                label="Password"
                icon={Lock}
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                error={errors.password}
                disabled={submitting}
                labelRight={
                  <Link
                    to="/forgot-password"
                    className="font-medium text-[#3DDC97] hover:underline focus:outline-none focus-visible:underline"
                  >
                    Forgot password?
                  </Link>
                }
                right={
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="rounded-md p-1 text-slate-500 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
                  >
                    {showPw ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                }
              />

              <button
                type="submit"
                disabled={submitting || locked}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3DDC97] text-base font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Logging in…
                  </>
                ) : locked ? (
                  <>
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    Try again in {formatClock(lockSeconds)}
                  </>
                ) : (
                  <>
                    Log in
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            {/* Switch to sign up */}
            <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-slate-400">
              Don&rsquo;t have an account?{' '}
              <Link
                to="/signup"
                className="font-semibold text-[#3DDC97] hover:underline focus:outline-none focus-visible:underline"
              >
                Create account
              </Link>
            </div>
            <Link
              to="/signup"
              className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-medium text-slate-200 transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
            >
              <UserPlus className="h-4 w-4 text-[#3DDC97]" aria-hidden="true" />
              Create a free account
            </Link>
          </motion.div>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
            Trading crypto and forex carries a high level of risk. Only trade money you can afford to lose.
          </p>
        </main>
      </div>
    </div>
  )
}