// src/pages/outside/ResetPass.jsx
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  Pencil,
  RefreshCw,
  UserPlus,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONSTANTS + HELPERS
──────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Wait before "Resend" unlocks. A 429 from the server overrides it.
const DEFAULT_COOLDOWN = 60
const MAX_WAIT = 3600

const card = 'rounded-2xl border border-white/10 bg-[#0B141B]'

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

// DRF sends a Retry-After header on throttled replies. Use it when the browser exposes it.
function retryAfterSeconds(err) {
  const h = err?.response?.headers
  const raw = h?.get?.('retry-after') ?? h?.['retry-after']
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.ceil(n), MAX_WAIT) : DEFAULT_COOLDOWN
}

const formatClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/* ────────────────────────────────────────────────
   SMALL UI PIECES
──────────────────────────────────────────────── */

function Field({ id, label, icon: Icon, error, ...inputProps }) {
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

export default function ResetPass() {
  const reduce = useReducedMotion()
  const location = useLocation()

  // 'form' → 'sent'
  const [step, setStep] = useState('form')
  const [email, setEmail] = useState(location.state?.email || '')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState(null) // { type: 'ok' | 'err', text }
  const [cooldown, setCooldown] = useState(0) // before "Resend" unlocks
  const [blocked, setBlocked] = useState(0) // server said 429: no request can go out

  const busy = useRef(false)
  const cleanEmail = email.trim().toLowerCase()
  const ticking = cooldown > 0 || blocked > 0

  // One timer drives both countdowns
  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => {
      setCooldown((c) => (c > 1 ? c - 1 : 0))
      setBlocked((b) => (b > 1 ? b - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [ticking])

  const sendLink = async (resend) => {
    if (busy.current || blocked > 0) return
    if (resend && cooldown > 0) return

    if (!resend) {
      setFormError('')
      if (!cleanEmail) return setError('Enter your email address.')
      if (!EMAIL_RE.test(cleanEmail)) return setError('Enter a valid email address.')
      setError('')
    } else {
      setResendMsg(null)
    }

    busy.current = true
    if (resend) setResending(true)
    else setSubmitting(true)

    try {
      await api.post('/api/auth/password-reset/', { email: cleanEmail }, { skipAuth: true })
      // The server always answers the same way, whether or not the account exists.
      setCooldown(DEFAULT_COOLDOWN)
      if (resend) {
        setResendMsg({ type: 'ok', text: `If an account exists for ${cleanEmail}, we've sent the link again.` })
      } else {
        setStep('sent')
      }
    } catch (err) {
      const { message, code, status, fields } = parseError(err)

      // 429: too many requests → pause everything for the wait time
      if (status === 429 || code === 'throttled') {
        const wait = retryAfterSeconds(err)
        setBlocked(wait)
        setCooldown(wait)
        if (resend) setResendMsg({ type: 'err', text: message })
        else setFormError(message)
        return
      }

      // 400: validation error → show it under the email field
      if (fields.email) {
        if (resend) setResendMsg({ type: 'err', text: fields.email })
        else setError(fields.email)
        return
      }

      if (resend) setResendMsg({ type: 'err', text: message })
      else setFormError(message)
    } finally {
      busy.current = false
      setSubmitting(false)
      setResending(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendLink(false)
  }

  const handleEdit = () => {
    setResendMsg(null)
    setFormError('')
    setError('')
    setStep('form')
  }

  const fade = {
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -14 },
    transition: { duration: 0.28, ease: 'easeOut' },
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
          <div className={`${card} p-5 sm:p-8`}>
            <AnimatePresence mode="wait">
              {/* ───────── STEP 1: ENTER EMAIL ───────── */}
              {step === 'form' && (
                <motion.div key="form" {...fade}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/25">
                    <KeyRound className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Forgot your password?</h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                    Enter the email you registered with and we&rsquo;ll send you a link to set a new password.
                  </p>

                  <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                    {blocked > 0 ? (
                      <Banner tone="warn" icon={Clock}>
                        <p>{formError || 'Too many requests. Please wait before trying again.'}</p>
                        <p className="mt-1 text-xs tabular-nums text-amber-200/80">
                          You can try again in {formatClock(blocked)}.
                        </p>
                      </Banner>
                    ) : (
                      <Banner>{formError}</Banner>
                    )}

                    <Field
                      id="email"
                      label="Email address"
                      icon={Mail}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="john@example.com"
                      autoFocus
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setError('')
                        setFormError('')
                      }}
                      error={error}
                      disabled={submitting}
                    />

                    <button
                      type="submit"
                      disabled={submitting || blocked > 0}
                      className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3DDC97] text-base font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Sending link…
                        </>
                      ) : blocked > 0 ? (
                        <>
                          <Clock className="h-4 w-4" aria-hidden="true" />
                          Try again in {formatClock(blocked)}
                        </>
                      ) : (
                        <>
                          Send reset link
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-slate-400">
                    Remembered your password?{' '}
                    <Link
                      to="/login"
                      state={{ email: cleanEmail }}
                      className="font-semibold text-[#3DDC97] hover:underline focus:outline-none focus-visible:underline"
                    >
                      Log in
                    </Link>
                  </div>
                  <Link
                    to="/login"
                    state={{ email: cleanEmail }}
                    className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-medium text-slate-200 transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
                  >
                    <LogIn className="h-4 w-4 text-[#3DDC97]" aria-hidden="true" />
                    Back to login
                  </Link>
                  <p className="mt-4 text-center text-xs text-slate-500">
                    New here?{' '}
                    <Link to="/signup" className="inline-flex items-center gap-1 text-slate-300 hover:underline">
                      <UserPlus className="h-3 w-3" aria-hidden="true" />
                      Create an account
                    </Link>
                  </p>
                </motion.div>
              )}

              {/* ───────── STEP 2: LINK SENT ───────── */}
              {step === 'sent' && (
                <motion.div key="sent" {...fade}>
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/25">
                    <Mail className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">Check your email</h1>
                  <p className="mx-auto mt-1.5 max-w-sm text-center text-sm leading-relaxed text-slate-400">
                    If a verified account exists for <span className="break-all font-medium text-white">{cleanEmail}</span>,
                    we&rsquo;ve sent a link to reset your password. It can take a minute to arrive.
                  </p>

                  <div className="mt-6 space-y-3">
                    {resendMsg && (
                      <Banner tone={resendMsg.type === 'ok' ? 'success' : 'error'} icon={resendMsg.type === 'ok' ? CheckCircle2 : AlertCircle}>
                        {resendMsg.text}
                      </Banner>
                    )}

                    {blocked > 0 && !resendMsg && (
                      <Banner tone="warn" icon={Clock}>
                        Too many requests. You can try again in{' '}
                        <span className="tabular-nums">{formatClock(blocked)}</span>.
                      </Banner>
                    )}

                    <button
                      type="button"
                      onClick={() => sendLink(true)}
                      disabled={resending || cooldown > 0 || blocked > 0}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3DDC97] text-base font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} aria-hidden="true" />
                      {resending
                        ? 'Sending…'
                        : cooldown > 0
                          ? `Resend link in ${formatClock(cooldown)}`
                          : 'Resend link'}
                    </button>
                  </div>

                  <ul className="mt-5 space-y-1.5 rounded-xl bg-white/[0.04] p-4 text-xs leading-relaxed text-slate-400">
                    <li>Check your spam or junk folder if you can&rsquo;t find it.</li>
                    <li>The link works once and expires after a short time.</li>
                    <li>
                      Only verified accounts receive a reset email. If you never verified yours,{' '}
                      <Link
                        to="/login"
                        state={{ email: cleanEmail }}
                        className="font-medium text-[#3DDC97] hover:underline"
                      >
                        log in
                      </Link>{' '}
                      and we&rsquo;ll send a new verification code.
                    </li>
                  </ul>

                  <div className="mt-6 flex flex-col gap-2.5 border-t border-white/10 pt-5 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={handleEdit}
                      disabled={resending}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-medium text-slate-200 transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit email
                    </button>
                    <Link
                      to="/login"
                      state={{ email: cleanEmail }}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-medium text-slate-200 transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
                    >
                      <LogIn className="h-4 w-4 text-[#3DDC97]" aria-hidden="true" />
                      Back to login
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
            Trading crypto and forex carries a high level of risk. Only trade money you can afford to lose.
          </p>
        </main>
      </div>
    </div>
  )
}