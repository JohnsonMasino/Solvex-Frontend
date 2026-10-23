// src/pages/outside/ResetPassConfirm.jsx
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONSTANTS + HELPERS
──────────────────────────────────────────────── */

const REDIRECT_DELAY_MS = 2600
const FORM_FIELDS = ['new_password', 'confirm_password']
// Backend codes that mean "this link can't be used any more"
const LINK_CODES = ['invalid_reset_link', 'reset_link_used', 'reset_link_expired']

const card = 'rounded-2xl border border-white/10 bg-[#0B141B]'

// Same keys that Api.jsx clears. A password reset logs out every session,
// so any old tokens left in this browser are dead anyway.
function clearSession() {
  try {
    ;['accessToken', 'refreshToken', 'user', 'isAuthenticated'].forEach((k) => localStorage.removeItem(k))
  } catch {
    /* storage unavailable, ignore */
  }
}

// Turns any axios error into { message, code, status, fields }
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
    }
  }
  const d = typeof res.data === 'object' && res.data ? res.data : {}
  const fields = {}
  if (d.errors && typeof d.errors === 'object') {
    Object.entries(d.errors).forEach(([k, v]) => {
      fields[k] = Array.isArray(v) ? v.join(' ') : String(v)
    })
  }
  return {
    message: d.message || 'Something went wrong. Please try again.',
    code: d.code || '',
    status: res.status,
    fields,
  }
}

// Mirrors the backend rules: 8+ characters, a letter and a digit
const RULES = [
  { id: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'letter', label: 'At least one letter', test: (p) => /[A-Za-z]/.test(p) },
  { id: 'digit', label: 'At least one number', test: (p) => /\d/.test(p) },
]

function validate(f) {
  const e = {}
  if (!f.new_password) e.new_password = 'Enter a new password.'
  else if (RULES.some((r) => !r.test(f.new_password))) e.new_password = 'Your password does not meet all the requirements.'
  if (!f.confirm_password) e.confirm_password = 'Confirm your new password.'
  else if (f.new_password !== f.confirm_password) e.confirm_password = 'Passwords do not match.'
  return e
}

const PROBLEM_TITLES = {
  reset_link_expired: 'This link has expired',
  reset_link_used: 'This link has already been used',
  invalid_reset_link: 'This link isn’t valid',
}

/* ────────────────────────────────────────────────
   SMALL UI PIECES
──────────────────────────────────────────────── */

function Field({ id, label, icon: Icon, error, right, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-slate-400">
        {label}
      </label>
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

function PasswordChecklist({ password }) {
  return (
    <ul className="mt-2 space-y-1" aria-live="polite">
      {RULES.map((r) => {
        const ok = r.test(password)
        return (
          <li key={r.id} className={`flex items-center gap-2 text-xs ${ok ? 'text-[#3DDC97]' : 'text-slate-500'}`}>
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full ring-1 ${
                ok ? 'bg-[#3DDC97]/15 ring-[#3DDC97]/50' : 'ring-white/15'
              }`}
            >
              {ok && <Check className="h-3 w-3" aria-hidden="true" />}
            </span>
            {r.label}
          </li>
        )
      })}
    </ul>
  )
}

function PasswordStrength({ password }) {
  if (!password) return null
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
  const labels = ['Weak', 'Fair', 'Good', 'Strong']
  const colors = ['#F6465D', '#F59E0B', '#7DD87A', '#3DDC97']
  const idx = Math.max(0, score - 1)
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i < score ? colors[idx] : 'rgba(255,255,255,0.08)' }}
          />
        ))}
      </div>
      <p className="mt-1 text-xs" style={{ color: colors[idx] }}>
        Password strength: {labels[idx]}
      </p>
    </div>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function ResetPassConfirm() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const params = useParams()
  const [search] = useSearchParams()

  // The emailed link is /reset-password/:uid/:token. ?uid=...&token=... also works.
  const uid = params.uid || search.get('uid') || ''
  const token = params.token || search.get('token') || ''
  const linkMissing = !uid || !token

  // 'checking' → 'ready' → 'done'
  const [status, setStatus] = useState('checking')
  // The link can't be used (invalid / used / expired): { code, message }
  const [problem, setProblem] = useState(null)
  // We couldn't check the link (network, 429, server error): retryable
  const [retryError, setRetryError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const [form, setForm] = useState({ new_password: '', confirm_password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const busy = useRef(false)

  // 1. Check the link before showing the form
  useEffect(() => {
    if (linkMissing) return
    let cancelled = false
    api
      .post('/api/auth/password-reset/validate/', { uid, token }, { skipAuth: true })
      .then(() => {
        if (cancelled) return
        setRetryError('')
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        const { message, code, status: http } = parseError(err)
        // Couldn't reach a verdict → let the user retry
        if (code === 'network' || http === 0 || http === 429 || http >= 500) {
          setRetryError(message)
          return
        }
        // 400: the link itself is no good
        setProblem({ code, message })
      })
    return () => {
      cancelled = true
    }
  }, [uid, token, attempt, linkMissing])

  // 2. After a successful reset, move on to login
  useEffect(() => {
    if (status !== 'done') return
    const id = setTimeout(() => {
      navigate('/login', { replace: true, state: { passwordReset: true } })
    }, REDIRECT_DELAY_MS)
    return () => clearTimeout(id)
  }, [status, navigate])

  const retryCheck = () => {
    setRetryError('')
    setAttempt((a) => a + 1)
  }

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setFormError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy.current) return
    setFormError('')

    const v = validate(form)
    setErrors(v)
    if (Object.keys(v).length) return

    busy.current = true
    setSubmitting(true)
    try {
      await api.post(
        '/api/auth/password-reset/confirm/',
        { uid, token, new_password: form.new_password, confirm_password: form.confirm_password },
        { skipAuth: true },
      )
      clearSession()
      setStatus('done')
    } catch (err) {
      const { message, code, fields } = parseError(err)

      // The link died between opening the page and submitting (expired, used, invalid)
      if (LINK_CODES.includes(code) || fields.uid || fields.token) {
        setProblem({ code: LINK_CODES.includes(code) ? code : 'invalid_reset_link', message: fields.uid || fields.token || message })
        return
      }

      // New password is the same as the current one
      if (code === 'password_reuse') {
        setErrors({ new_password: message })
        return
      }

      // 400 validation: show each message under its field
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

      // 429 throttled, network errors, anything else
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

  const shownProblem =
    problem ||
    (linkMissing ? { code: 'invalid_reset_link', message: 'This password reset link is incomplete or invalid.' } : null)

  const toggle = (
    <button
      type="button"
      onClick={() => setShowPw((s) => !s)}
      aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
      className="rounded-md p-1 text-slate-500 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
    >
      {showPw ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </button>
  )

  let content
  if (shownProblem) {
    /* ───────── LINK CAN'T BE USED ───────── */
    content = (
      <motion.div key="problem" {...fade} className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6465D]/10 text-[#F6465D] ring-1 ring-[#F6465D]/25">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
          {PROBLEM_TITLES[shownProblem.code] || PROBLEM_TITLES.invalid_reset_link}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">{shownProblem.message}</p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link
            to="/forgot-password"
            className="group flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] text-base font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            Request a new link
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link
            to="/login"
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-medium text-slate-200 transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
          >
            <LogIn className="h-4 w-4 text-[#3DDC97]" aria-hidden="true" />
            Back to login
          </Link>
        </div>
      </motion.div>
    )
  } else if (status === 'done') {
    /* ───────── SUCCESS ───────── */
    content = (
      <motion.div key="done" {...fade} className="text-center">
        <motion.span
          initial={reduce ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#3DDC97]/15 text-[#3DDC97] ring-1 ring-[#3DDC97]/40"
        >
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </motion.span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">Password updated</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
          Your password has been changed and you&rsquo;ve been signed out on all devices. Taking you to the login page.
        </p>
        <div className="mx-auto mt-5 h-1 w-40 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
          <motion.div
            className="h-full rounded-full bg-[#3DDC97]"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: reduce ? 0 : REDIRECT_DELAY_MS / 1000, ease: 'linear' }}
          />
        </div>
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true, state: { passwordReset: true } })}
          className="group mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-8 text-base font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          Continue to login
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </button>
      </motion.div>
    )
  } else if (retryError) {
    /* ───────── COULDN'T CHECK THE LINK ───────── */
    content = (
      <motion.div key="retry" {...fade} className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F59E0B]/10 text-[#F59E0B] ring-1 ring-[#F59E0B]/25">
          <WifiOff className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">We couldn&rsquo;t check your link</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">{retryError}</p>
        <button
          type="button"
          onClick={retryCheck}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-8 text-base font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </motion.div>
    )
  } else if (status === 'checking') {
    /* ───────── CHECKING THE LINK ───────── */
    content = (
      <motion.div key="checking" {...fade} className="py-6 text-center" role="status" aria-live="polite">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#3DDC97]" aria-hidden="true" />
        <p className="mt-4 text-sm text-slate-400">Checking your reset link…</p>
      </motion.div>
    )
  } else {
    /* ───────── NEW PASSWORD FORM ───────── */
    content = (
      <motion.div key="form" {...fade}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/25">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Set a new password</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
          Choose a strong password. You&rsquo;ll be signed out on every device once it&rsquo;s changed.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <Banner>{formError}</Banner>

          <div>
            <Field
              id="new_password"
              label="New password"
              icon={Lock}
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Your new password"
              autoFocus
              value={form.new_password}
              onChange={(e) => setField('new_password', e.target.value)}
              error={errors.new_password}
              disabled={submitting}
              right={toggle}
            />
            <PasswordStrength password={form.new_password} />
            <PasswordChecklist password={form.new_password} />
          </div>

          <Field
            id="confirm_password"
            label="Confirm new password"
            icon={Lock}
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Repeat your new password"
            value={form.confirm_password}
            onChange={(e) => setField('confirm_password', e.target.value)}
            error={errors.confirm_password}
            disabled={submitting}
          />

          <button
            type="submit"
            disabled={submitting}
            className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3DDC97] text-base font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Updating password…
              </>
            ) : (
              <>
                Update password
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-slate-400">
          Remembered it?{' '}
          <Link
            to="/login"
            className="font-semibold text-[#3DDC97] hover:underline focus:outline-none focus-visible:underline"
          >
            Back to login
          </Link>
        </div>
      </motion.div>
    )
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
          <div className={`${card} p-5 sm:p-8`}>{content}</div>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
            Trading crypto and forex carries a high level of risk. Only trade money you can afford to lose.
          </p>
        </main>
      </div>
    </div>
  )
}