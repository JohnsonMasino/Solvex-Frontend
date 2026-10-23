// src/pages/inside/Settings.jsx
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  XCircle,
} from 'lucide-react'
import api from '../../components/Api'
import { KYC_URL } from '../../components/inside/Navconfig'

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

const stepVariants = {
  enter: (d) => ({ opacity: 0, x: d * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (d) => ({ opacity: 0, x: d * -24 }),
}

const KYC_STATES = {
  approved: {
    icon: ShieldCheck,
    title: 'Identity verified',
    box: 'bg-[#3DDC97]/[0.1]',
    chip: 'bg-[#3DDC97] text-[#06231A]',
    text: 'text-[#3DDC97]',
    ring: 'bg-[#3DDC97]',
  },
  pending: {
    icon: Clock,
    title: 'Verification under review',
    box: 'bg-sky-400/[0.1]',
    chip: 'bg-sky-400 text-[#06141F]',
    text: 'text-sky-300',
    ring: 'bg-sky-400',
  },
  rejected: {
    icon: XCircle,
    title: 'Verification rejected',
    box: 'bg-[#F6465D]/[0.1]',
    chip: 'bg-[#F6465D] text-white',
    text: 'text-red-300',
    ring: 'bg-[#F6465D]',
  },
  not_submitted: {
    icon: ShieldAlert,
    title: 'KYC not submitted',
    box: 'bg-amber-400/[0.1]',
    chip: 'bg-amber-400 text-[#2A1B00]',
    text: 'text-amber-300',
    ring: 'bg-amber-400',
  },
}

const TONES = {
  error: { box: 'bg-[#F6465D]/10 text-red-200', icon: 'text-[#F6465D]', Icon: AlertCircle },
  warn: { box: 'bg-amber-400/10 text-amber-200', icon: 'text-amber-300', Icon: AlertCircle },
}

const STRENGTH = [
  { label: '', color: '' },
  { label: 'Weak', color: 'bg-[#F6465D]', text: 'text-red-300' },
  { label: 'Fair', color: 'bg-amber-400', text: 'text-amber-300' },
  { label: 'Good', color: 'bg-sky-400', text: 'text-sky-300' },
  { label: 'Strong', color: 'bg-[#3DDC97]', text: 'text-[#3DDC97]' },
]

const MIN_LENGTH = 8

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────── */

const humanize = (v) => (v ? String(v).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '')

const prettyRange = (v) => {
  if (!v) return ''
  const parts = String(v).split('_')
  if (parts.length === 2 && parts.every((p) => /^\d+(\.\d+)?k?$/i.test(p))) return `${parts[0]} – ${parts[1]}`
  return humanize(v)
}

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

const formatDob = (value) => {
  if (!value) return ''
  const [y, m, d] = String(value).split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

let regionNames = null
try {
  regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
} catch {
  regionNames = null
}

const countryName = (code) => {
  if (!code) return ''
  try {
    return regionNames?.of(code) || code
  } catch {
    return code
  }
}

const flatten = (v) => {
  if (v == null) return []
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(flatten)
  if (typeof v === 'object') return Object.values(v).flatMap(flatten)
  return [String(v)]
}

const PASSWORD_FIELDS = ['current_password', 'new_password', 'confirm_password']

function mapPasswordErrors(errors) {
  const fields = {}
  const general = []
  Object.entries(errors || {}).forEach(([key, val]) => {
    const msgs = flatten(val)
    if (!msgs.length) return
    if (PASSWORD_FIELDS.includes(key)) fields[key] = msgs[0]
    else general.push(...msgs)
  })
  return { fields, general }
}

const inputCls = (error) =>
  `h-11 w-full rounded-xl bg-[#0E1822] px-3.5 pr-12 text-base text-white outline-none ring-1 transition placeholder:text-slate-500 focus:ring-2 sm:text-sm ${
    error ? 'ring-[#F6465D]/60 focus:ring-[#F6465D]' : 'ring-white/10 focus:ring-[#3DDC97]/70'
  }`

const primaryBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-5 text-sm font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#14212D] disabled:cursor-not-allowed disabled:opacity-60'

const ghostBtn =
  'inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60'

/* ────────────────────────────────────────────────
   SHARED PIECES
──────────────────────────────────────────────── */

function InlineError({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#F6465D]/10 px-3.5 py-3 text-sm text-red-200"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-[#F6465D]" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
        >
          Try again
        </button>
      )}
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <motion.section variants={item} className="rounded-2xl bg-[#14212D] p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2.5 text-base font-semibold text-white">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[#3DDC97]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {title}
      </h2>
      {children}
    </motion.section>
  )
}

function FieldGrid({ children, cols = 'sm:grid-cols-2' }) {
  return <dl className={`grid gap-x-6 gap-y-4 ${cols}`}>{children}</dl>
}

function Field({ label, value, mono = false }) {
  const empty = value === undefined || value === null || value === ''
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</dt>
      <dd
        className={`mt-1 break-words text-sm ${empty ? 'text-slate-500' : 'font-medium text-white'} ${
          mono ? 'font-mono tracking-wide' : ''
        }`}
      >
        {empty ? '—' : value}
      </dd>
    </div>
  )
}

function ConsentItem({ label, ok }) {
  return (
    <li className="flex items-center gap-2.5 text-sm text-slate-200">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
          ok ? 'bg-[#3DDC97]/[0.15] text-[#3DDC97]' : 'bg-white/[0.06] text-slate-400'
        }`}
      >
        {ok ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
      </span>
      <span className="min-w-0">{label}</span>
    </li>
  )
}

function StatusIcon({ state, approved, reduce }) {
  const Icon = state.icon
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center">
      {!reduce && (
        <motion.span
          className={`absolute inset-0 rounded-full ${state.ring}`}
          initial={{ scale: 1, opacity: 0.3 }}
          animate={{ scale: 1.55, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          aria-hidden="true"
        />
      )}
      <motion.span
        className={`relative grid h-12 w-12 place-items-center rounded-full ${state.chip}`}
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 }}
      >
        {approved ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.45, ease: 'easeOut' }}
            />
          </svg>
        ) : (
          <Icon className="h-6 w-6" aria-hidden="true" />
        )}
      </motion.span>
    </span>
  )
}

/* ────────────────────────────────────────────────
   PASSWORD FLOW (modal, 3 steps + success)
──────────────────────────────────────────────── */

function PasswordField({ id, label, value, onChange, error, hint, show, onToggle, autoComplete, inputRef, placeholder }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={inputCls(error)}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-1.5 flex items-start gap-1.5 text-xs text-red-300"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-[#F6465D]" aria-hidden="true" />
            <span className="min-w-0 break-words">{error}</span>
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            id={`${id}-hint`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-1.5 text-xs text-slate-500"
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function StrengthMeter({ value }) {
  const checks = [
    { label: 'At least 8 characters', ok: value.length >= MIN_LENGTH },
    { label: 'Upper and lower case letters', ok: /[a-z]/.test(value) && /[A-Z]/.test(value) },
    { label: 'A number', ok: /\d/.test(value) },
    { label: 'A symbol (recommended)', ok: /[^A-Za-z0-9]/.test(value) },
  ]
  const score = !value ? 0 : value.length < MIN_LENGTH ? 1 : Math.max(1, checks.filter((c) => c.ok).length)
  const level = STRENGTH[score]

  return (
    <div className="rounded-xl bg-white/[0.04] p-3.5">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-colors duration-300 ${i < score ? level.color : 'bg-white/10'}`}
            />
          ))}
        </div>
        <span className={`w-12 text-right text-xs font-medium ${level.text || 'text-slate-500'}`}>
          {level.label || '—'}
        </span>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-2 text-xs ${c.ok ? 'text-slate-200' : 'text-slate-500'}`}>
            <span
              className={`grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors ${
                c.ok ? 'bg-[#3DDC97]/[0.2] text-[#3DDC97]' : 'bg-white/[0.06] text-slate-600'
              }`}
            >
              <Check className="h-2.5 w-2.5" aria-hidden="true" />
            </span>
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function StepBar({ step }) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <div className="grid flex-1 grid-cols-3 gap-1.5">
        {[1, 2, 3].map((n) => (
          <span key={n} className="block h-1 overflow-hidden rounded-full bg-white/10">
            <motion.span
              className="block h-full origin-left rounded-full bg-[#3DDC97]"
              initial={false}
              animate={{ scaleX: n <= step ? 1 : 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </span>
        ))}
      </div>
    </div>
  )
}

function ModalBanner({ banner }) {
  const tone = banner ? TONES[banner.tone] : null
  return (
    <AnimatePresence initial={false}>
      {banner && (
        <motion.div
          key={banner.id}
          role="alert"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ${tone.box}`}
        >
          <tone.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.icon}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="break-words font-medium">{banner.text}</p>
            {banner.lines?.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[13px] opacity-90">
                {banner.lines.map((line) => (
                  <li key={line} className="break-words">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PasswordModal({ onClose, onSuccess, reduce }) {
  const [step, setStep] = useState(1)
  const [dir, setDir] = useState(1)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState({ current: false, next: false, confirm: false })

  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [cooldown, setCooldown] = useState(0)

  const focusRef = useRef(null)
  const bannerId = useRef(0)

  const goTo = (n) => {
    setDir(n > step ? 1 : -1)
    setStep(n)
  }

  const requestClose = () => {
    if (!submitting) onClose()
  }

  // Escape closes (unless a request is running) and the page behind stops scrolling
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [submitting, onClose])

  // Move focus to the main control of each step
  useEffect(() => {
    const id = setTimeout(() => focusRef.current?.focus(), reduce ? 0 : 220)
    return () => clearTimeout(id)
  }, [step, reduce])

  // Counts down after a 429 that came with a Retry-After header
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const showBanner = (tone, text, lines = []) => {
    bannerId.current += 1
    setBanner({ id: bannerId.current, tone, text, lines })
  }

  const clearError = (key) =>
    setErrors((prev) => {
      if (!prev[key]) return prev
      const copy = { ...prev }
      delete copy[key]
      return copy
    })

  const toggle = (key) => setShow((s) => ({ ...s, [key]: !s[key] }))

  /* Step 2: current password */
  const submitCurrent = (e) => {
    e.preventDefault()
    if (!current) {
      setErrors({ current_password: 'Enter your current password.' })
      return
    }
    setErrors({})
    setBanner(null)
    goTo(3)
  }

  const handleError = (err) => {
    const res = err?.response
    if (!res) {
      showBanner('error', 'Network error. Check your connection and try again.')
      return
    }

    const { status, data } = res
    const code = data?.code
    const msg = data?.message

    if (status === 400) {
      const { fields, general } = mapPasswordErrors(data?.errors)
      // Wrong current password: send the user back to that step
      if (code === 'invalid_current_password' || fields.current_password) {
        setCurrent('')
        setErrors({ current_password: fields.current_password || msg || 'Your current password is incorrect.' })
        setBanner(null)
        goTo(2)
        return
      }
      setErrors(fields)
      if (Object.keys(fields).length) {
        showBanner('error', msg || 'Please correct the highlighted fields.', general)
      } else {
        showBanner('error', msg || 'We could not change your password.', general)
      }
      return
    }

    if (status === 401) {
      showBanner('error', 'Your session has expired. Please sign in again to continue.')
      return
    }

    if (status === 429) {
      const wait = Number(res.headers?.['retry-after'])
      if (Number.isFinite(wait) && wait > 0) setCooldown(Math.min(Math.ceil(wait), 300))
      showBanner('warn', msg || 'Too many attempts. Please wait a moment and try again.')
      return
    }

    showBanner('error', 'Something went wrong on our side. Please try again in a moment.')
  }

  /* Step 3: new password, sends the request */
  const submitNew = async (e) => {
    e.preventDefault()
    if (submitting || cooldown > 0) return

    const errs = {}
    if (next.length < MIN_LENGTH) errs.new_password = `Use at least ${MIN_LENGTH} characters.`
    else if (next === current) errs.new_password = 'Your new password must be different from your current one.'
    if (confirm !== next) errs.confirm_password = 'Passwords do not match.'
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setSubmitting(true)
    setErrors({})
    setBanner(null)

    try {
      let refresh = null
      try {
        refresh = localStorage.getItem('refreshToken')
      } catch {
        refresh = null
      }

      const body = { current_password: current, new_password: next, confirm_password: confirm }
      if (refresh) body.refresh = refresh

      const res = await api.post('/api/auth/change-password/', body)
      const msg = res.data?.message || 'Password changed successfully.'

      // Wipe everything sensitive from memory
      setCurrent('')
      setNext('')
      setConfirm('')
      setShow({ current: false, next: false, confirm: false })
      setMessage(msg)
      onSuccess(msg)
      setDir(1)
      setStep(4)
    } catch (err) {
      handleError(err)
    } finally {
      setSubmitting(false)
    }
  }

  const titles = {
    1: 'Change your password?',
    2: 'Confirm your current password',
    3: 'Choose a new password',
    4: 'Password changed',
  }

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.2 }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={requestClose} aria-hidden="true" />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-title"
        initial={reduce ? false : { opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#14212D] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/50 sm:rounded-2xl sm:p-6"
      >
        {/* Top row: step label + close */}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {step < 4 ? (
              <>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Step {step} of 3
                </p>
                <StepBar step={step} />
              </>
            ) : (
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#3DDC97]">Complete</p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={submitting}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={stepVariants}
              initial={reduce ? false : 'enter'}
              animate="center"
              exit={reduce ? { opacity: 0 } : 'exit'}
              transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
            >
              <h2 id="pw-title" className="text-lg font-semibold text-white">
                {titles[step]}
              </h2>

              {/* STEP 1: confirm */}
              {step === 1 && (
                <>
                  <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-400/[0.1] px-3.5 py-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                    <p className="text-sm leading-relaxed text-amber-100">
                      Do this if you think your password may have been exposed. You will confirm your current password,
                      then choose a new one. Your other devices will be signed out.
                    </p>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:justify-end">
                    <button type="button" onClick={onClose} className={ghostBtn}>
                      Cancel
                    </button>
                    <button type="button" ref={focusRef} onClick={() => goTo(2)} className={primaryBtn}>
                      Proceed
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}

              {/* STEP 2: current password */}
              {step === 2 && (
                <form onSubmit={submitCurrent} noValidate>
                  <p className="mt-1.5 text-sm text-slate-400">Enter the password you use to sign in right now.</p>
                  <div className="mt-4">
                    <PasswordField
                      id="current_password"
                      label="Current password"
                      value={current}
                      onChange={(e) => {
                        setCurrent(e.target.value)
                        clearError('current_password')
                      }}
                      error={errors.current_password}
                      show={show.current}
                      onToggle={() => toggle('current')}
                      autoComplete="current-password"
                      inputRef={focusRef}
                    />
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:justify-end">
                    <button type="button" onClick={() => goTo(1)} className={ghostBtn}>
                      Back
                    </button>
                    <button type="submit" className={primaryBtn}>
                      Continue
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: new password */}
              {step === 3 && (
                <form onSubmit={submitNew} noValidate>
                  <p className="mt-1.5 text-sm text-slate-400">
                    Pick something you have not used anywhere else, then type it again to confirm.
                  </p>

                  <div className="mt-4 space-y-4">
                    <PasswordField
                      id="new_password"
                      label="New password"
                      value={next}
                      onChange={(e) => {
                        setNext(e.target.value)
                        clearError('new_password')
                      }}
                      error={errors.new_password}
                      show={show.next}
                      onToggle={() => toggle('next')}
                      autoComplete="new-password"
                      inputRef={focusRef}
                    />

                    <AnimatePresence initial={false}>
                      {next && (
                        <motion.div
                          key="meter"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: reduce ? 0 : 0.2 }}
                          className="overflow-hidden"
                        >
                          <StrengthMeter value={next} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <PasswordField
                      id="confirm_password"
                      label="Confirm new password"
                      value={confirm}
                      onChange={(e) => {
                        setConfirm(e.target.value)
                        clearError('confirm_password')
                      }}
                      error={errors.confirm_password}
                      show={show.confirm}
                      onToggle={() => toggle('confirm')}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="mt-4">
                    <ModalBanner banner={banner} />
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:justify-end">
                    <button type="button" onClick={() => goTo(2)} disabled={submitting} className={ghostBtn}>
                      Back
                    </button>
                    <button type="submit" disabled={submitting || cooldown > 0} className={primaryBtn}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Changing…
                        </>
                      ) : cooldown > 0 ? (
                        `Try again in ${cooldown}s`
                      ) : (
                        'Change password'
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 4: success */}
              {step === 4 && (
                <>
                  <div className="mt-5 flex flex-col items-center text-center">
                    <span className="relative grid h-16 w-16 place-items-center">
                      {!reduce && (
                        <motion.span
                          className="absolute inset-0 rounded-full bg-[#3DDC97]"
                          initial={{ scale: 1, opacity: 0.3 }}
                          animate={{ scale: 1.6, opacity: 0 }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                          aria-hidden="true"
                        />
                      )}
                      <motion.span
                        className="relative grid h-16 w-16 place-items-center rounded-full bg-[#3DDC97] text-[#06231A]"
                        initial={reduce ? false : { scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-8 w-8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          aria-hidden="true"
                        >
                          <motion.path
                            d="M5 12.5l4.5 4.5L19 7.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={reduce ? false : { pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
                          />
                        </svg>
                      </motion.span>
                    </span>
                    <p className="mt-4 text-sm font-medium text-white" role="status">
                      {message}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-400">
                      Your other devices have been signed out. Use your new password the next time you sign in.
                    </p>
                  </div>
                  <div className="mt-6">
                    <button type="button" ref={focusRef} onClick={onClose} className={`${primaryBtn} w-full`}>
                      Done
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ────────────────────────────────────────────────
   SECURITY CARD
──────────────────────────────────────────────── */

function SecurityCard({ onOpen, note, onDismissNote, buttonRef, reduce }) {
  return (
    <Section icon={KeyRound} title="Security">
      <div className="rounded-xl bg-white/[0.04] p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Password</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            Change your password if you think it may have been exposed. Other devices will be signed out.
          </p>
        </div>
        <motion.button
          ref={buttonRef}
          type="button"
          onClick={onOpen}
          whileTap={reduce ? undefined : { scale: 0.97 }}
          className={`${primaryBtn} mt-4 w-full shrink-0 sm:mt-0 sm:w-auto`}
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Change password
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {note && (
          <motion.div
            key="note"
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0 : 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-[#3DDC97]/[0.12] px-3.5 py-3 text-sm text-[#B8F5DA]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3DDC97]" aria-hidden="true" />
              <p className="min-w-0 flex-1 break-words font-medium">{note}</p>
              <button
                type="button"
                onClick={onDismissNote}
                aria-label="Dismiss message"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#B8F5DA]/80 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   KYC INFORMATION
──────────────────────────────────────────────── */

function Accordion({ icon: Icon, title, children, reduce }) {
  const [open, setOpen] = useState(false)
  const uid = useId()
  return (
    <div className="rounded-xl bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[#3DDC97]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{title}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          className="text-slate-400"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            id={`${uid}-panel`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function KycSection({ reduce }) {
  const [state, setState] = useState('loading') // loading | none | ok | error
  const [kyc, setKyc] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    api
      .get('/api/kyc/submission/')
      .then((res) => {
        if (!alive) return
        const data = res.data?.data ?? null
        setKyc(data)
        setState(data ? 'ok' : 'none')
      })
      .catch((err) => {
        if (!alive) return
        // 404 means the user has not submitted KYC yet
        setKyc(null)
        setState(err?.response?.status === 404 ? 'none' : 'error')
      })
    return () => {
      alive = false
    }
  }, [attempt])

  const retry = () => {
    setState('loading')
    setAttempt((a) => a + 1)
  }

  const status = state === 'ok' ? kyc?.status || 'pending' : 'not_submitted'
  const meta = KYC_STATES[status] || KYC_STATES.not_submitted
  const approved = status === 'approved'

  let message
  if (state === 'none') {
    message = 'You have not submitted your KYC yet. Complete it to unlock live trading and move up to Tier 2.'
  } else if (approved) {
    const when = formatDate(kyc?.reviewed_at)
    message = `Your KYC was approved${when ? ` on ${when}` : ''}.`
  } else if (status === 'pending') {
    message = 'Your documents are being reviewed. We will update your status once the review is done.'
  } else if (status === 'rejected') {
    message = kyc?.rejection_reason
      ? `Reason: ${kyc.rejection_reason}`
      : 'Your last submission could not be approved.'
  } else {
    message = ''
  }

  const personal = kyc?.personal
  const address = kyc?.address
  const id = kyc?.identification
  const job = kyc?.employment
  const consent = kyc?.consent

  return (
    <Section icon={ShieldCheck} title="Verification (KYC)">
      {state === 'loading' && (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-24 animate-pulse rounded-xl bg-white/[0.05]" />
          <div className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      )}

      {state === 'error' && <InlineError message="We could not load your verification details." onRetry={retry} />}

      {(state === 'none' || state === 'ok') && (
        <div className="space-y-3">
          <div className={`rounded-xl p-4 ${meta.box}`}>
            <div className="flex items-start gap-3.5">
              <StatusIcon state={meta} approved={approved} reduce={reduce} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">KYC status</p>
                <h3 className={`mt-0.5 text-base font-semibold ${meta.text}`}>{meta.title}</h3>
                <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-300">{message}</p>
              </div>
            </div>

            {state === 'ok' && (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.08] pt-4 sm:grid-cols-3">
                <Field label="Attempt" value={kyc?.attempt_number ? `#${kyc.attempt_number}` : ''} />
                <Field label="Submitted" value={formatDate(kyc?.submitted_at)} />
                <Field label="Reviewed" value={formatDate(kyc?.reviewed_at) || 'Awaiting review'} />
              </dl>
            )}

            {state === 'none' && (
              <motion.div whileTap={reduce ? undefined : { scale: 0.98 }} className="mt-4">
                <Link to={KYC_URL} className={`group ${primaryBtn} w-full sm:w-auto`}>
                  Complete KYC
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </motion.div>
            )}
          </div>

          {state === 'ok' && (
            <>
              <Accordion icon={User} title="Personal details" reduce={reduce}>
                <FieldGrid>
                  <Field label="Full name" value={personal?.full_name} />
                  <Field label="Date of birth" value={formatDob(personal?.date_of_birth)} />
                  <Field label="Sex" value={humanize(personal?.sex)} />
                  <Field label="Nationality" value={countryName(personal?.nationality)} />
                  <Field label="Phone number" value={personal?.phone_number} />
                </FieldGrid>
              </Accordion>

              <Accordion icon={MapPin} title="Address" reduce={reduce}>
                <FieldGrid>
                  <Field label="Address line 1" value={address?.line1} />
                  <Field label="Address line 2" value={address?.line2} />
                  <Field label="City" value={address?.city} />
                  <Field label="State / Region" value={address?.state} />
                  <Field label="Postal code" value={address?.postal_code} />
                  <Field label="Country" value={countryName(address?.country)} />
                </FieldGrid>
              </Accordion>

              <Accordion icon={Fingerprint} title="Government ID" reduce={reduce}>
                <FieldGrid>
                  <Field label="ID type" value={humanize(id?.id_type)} />
                  <Field label="ID number" value={id?.id_number} mono />
                </FieldGrid>
              </Accordion>

              <Accordion icon={Briefcase} title="Financial information" reduce={reduce}>
                <FieldGrid>
                  <Field label="Employment status" value={humanize(job?.employment_status)} />
                  <Field label="Source of income" value={humanize(job?.source_of_income)} />
                  <Field label="Occupation" value={job?.occupation} />
                  <Field label="Employer" value={job?.employer_name} />
                  <Field label="Annual income" value={prettyRange(job?.annual_income_range)} />
                  <Field label="Expected annual volume" value={prettyRange(job?.expected_annual_volume)} />
                  <Field label="Transaction frequency" value={humanize(job?.transaction_frequency)} />
                  <Field label="Typical transaction size" value={prettyRange(job?.typical_transaction_size)} />
                </FieldGrid>
              </Accordion>

              {consent && (
                <Accordion icon={ClipboardCheck} title="Consent and declarations" reduce={reduce}>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    <ConsentItem label="Accuracy declaration" ok={Boolean(consent.accuracy_declaration)} />
                    <ConsentItem label="Privacy notice accepted" ok={Boolean(consent.privacy_notice_accepted)} />
                    <ConsentItem label="Terms accepted" ok={Boolean(consent.terms_accepted)} />
                    <ConsentItem label="Marketing emails" ok={Boolean(consent.marketing_consent)} />
                  </ul>
                  <div className="mt-4 border-t border-white/[0.06] pt-4">
                    <FieldGrid>
                      <Field label="Policy version" value={consent.policy_version} mono />
                      <Field label="Consented on" value={formatDate(consent.consented_at)} />
                    </FieldGrid>
                  </div>
                </Accordion>
              )}
            </>
          )}
        </div>
      )}
    </Section>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Settings() {
  const reduce = useReducedMotion()
  const [modalOpen, setModalOpen] = useState(false)
  const [note, setNote] = useState('')
  const triggerRef = useRef(null)

  const closeModal = () => {
    setModalOpen(false)
    // Put focus back on the button that opened the dialog
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <>
      <motion.div
        className="mx-auto max-w-3xl space-y-5"
        variants={container}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        <motion.div variants={item}>
          <h1 className="text-lg font-semibold text-white sm:text-xl">Settings</h1>
          <p className="mt-0.5 text-sm text-slate-400">Manage your password and see your verification details.</p>
        </motion.div>

        <SecurityCard
          onOpen={() => {
            setNote('')
            setModalOpen(true)
          }}
          note={note}
          onDismissNote={() => setNote('')}
          buttonRef={triggerRef}
          reduce={reduce}
        />

        <KycSection reduce={reduce} />
      </motion.div>

      {createPortal(
        <AnimatePresence>
          {modalOpen && (
            <PasswordModal key="password-modal" onClose={closeModal} onSuccess={setNote} reduce={reduce} />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}