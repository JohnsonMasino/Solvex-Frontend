// src/pages/outside/Signup.jsx
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Gift,
  Loader2,
  Lock,
  Mail,
  Pencil,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONSTANTS + HELPERS
──────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const OTP_LENGTH = 6
const DEFAULT_OTP_MINUTES = 10
// Used when the backend doesn't tell us the exact wait. A 429 reply corrects it.
const DEFAULT_COOLDOWN = 60
const REDIRECT_DELAY_MS = 2600
const REF_KEY = 'solvex_ref'
const FORM_FIELDS = ['full_name', 'email', 'password', 'confirm_password', 'referral_code']

const card = 'rounded-2xl border border-white/10 bg-[#0B141B]'

const cleanRef = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)

function readStoredRef() {
  try {
    return sessionStorage.getItem(REF_KEY) || ''
  } catch {
    return ''
  }
}

function storeRef(value) {
  try {
    if (value) sessionStorage.setItem(REF_KEY, value)
  } catch {
    /* storage unavailable, ignore */
  }
}

function clearStoredRef() {
  try {
    sessionStorage.removeItem(REF_KEY)
  } catch {
    /* storage unavailable, ignore */
  }
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

const cooldownFromMessage = (msg) => {
  const m = String(msg).match(/(\d+)\s*second/i)
  return m ? Number(m[1]) : DEFAULT_COOLDOWN
}

function validate(f) {
  const e = {}
  if (f.full_name.trim().length < 2) e.full_name = 'Enter your full name.'
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.'
  if (f.password.length < 8) e.password = 'Use at least 8 characters.'
  if (!f.confirm_password) e.confirm_password = 'Confirm your password.'
  else if (f.password !== f.confirm_password) e.confirm_password = 'Passwords do not match.'
  return e
}

const formatClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// Nothing checked yet for the referral field
const REF_IDLE = { code: '', status: 'idle', name: '', message: '' }

const REF_UNAVAILABLE =
  'We could not check your referral code right now. Try again, or continue without a code.'

/* ────────────────────────────────────────────────
   SMALL UI PIECES
──────────────────────────────────────────────── */

function Field({ id, label, icon: Icon, error, optional, hint, right, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-400">
        <span>{label}</span>
        {optional && <span className="text-slate-500">Optional</span>}
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
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="w-full min-w-0 bg-transparent py-3 text-base text-white outline-none placeholder:text-slate-500"
          {...inputProps}
        />
        {right}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-[#F6465D]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
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

function ErrorBanner({ children }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-[#F6465D]/30 bg-[#F6465D]/10 px-3.5 py-3 text-sm text-red-200"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#F6465D]" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function StepIndicator({ current }) {
  const steps = ['Details', 'Verify', 'Done']
  return (
    <ol className="flex items-center justify-center" aria-label="Sign up progress">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center" aria-current={active ? 'step' : undefined}>
            <span className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-1 transition-colors duration-300 ${
                  done
                    ? 'bg-[#3DDC97] text-[#06140E] ring-[#3DDC97]'
                    : active
                      ? 'bg-[#3DDC97]/15 text-[#3DDC97] ring-[#3DDC97]/60'
                      : 'bg-white/[0.04] text-slate-500 ring-white/10'
                }`}
              >
                {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
              </span>
              <span className={`text-[0.7rem] ${active || done ? 'text-slate-200' : 'text-slate-500'}`}>{label}</span>
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`mx-2 mb-5 h-px w-10 transition-colors duration-300 sm:w-16 ${
                  i < current ? 'bg-[#3DDC97]' : 'bg-white/10'
                }`}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// Six single-digit boxes. Supports typing, backspace, arrow keys, paste and autofill.
function OtpInput({ digits, onChange, inputsRef, disabled, invalid }) {
  const focusAt = (i) => inputsRef.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))]?.focus()

  const fillFrom = (start, str) => {
    const next = [...digits]
    for (let k = 0; k < str.length && start + k < OTP_LENGTH; k++) next[start + k] = str[k]
    onChange(next)
    focusAt(Math.min(start + str.length, OTP_LENGTH - 1))
  }

  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, '')
    if (!v) {
      const next = [...digits]
      next[i] = ''
      onChange(next)
      return
    }
    if (v.length > 1) {
      fillFrom(i, v)
      return
    }
    const next = [...digits]
    next[i] = v
    onChange(next)
    if (i < OTP_LENGTH - 1) focusAt(i + 1)
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault()
      const next = [...digits]
      next[i - 1] = ''
      onChange(next)
      focusAt(i - 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusAt(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusAt(i + 1)
    }
  }

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '')
    if (!text) return
    e.preventDefault()
    fillFrom(0, text.slice(0, OTP_LENGTH))
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={`h-12 w-10 rounded-xl border bg-[#080D12] text-center text-xl font-bold tabular-nums text-white outline-none transition-colors focus:ring-1 disabled:opacity-60 sm:h-14 sm:w-12 ${
            invalid
              ? 'border-[#F6465D]/60 focus:border-[#F6465D] focus:ring-[#F6465D]/30'
              : d
                ? 'border-[#3DDC97]/50 focus:border-[#3DDC97] focus:ring-[#3DDC97]/40'
                : 'border-white/10 focus:border-[#3DDC97]/60 focus:ring-[#3DDC97]/40'
          }`}
        />
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Signup() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Set by Login when an unverified user tries to log in: { verifyEmail, otpSent }
  const location = useLocation()
  const pending = location.state?.verifyEmail ? location.state : null
  const refFromLink = cleanRef(params.get('ref') || '')

  // 'form' → 'otp' → 'done'
  const [step, setStep] = useState(pending ? 'otp' : 'form')

  // Step 1: details
  const [form, setForm] = useState({
    full_name: '',
    email: pending?.verifyEmail || '',
    password: '',
    confirm_password: '',
  })

  // Referral code: what the user typed (null = untouched) wins over the invite link,
  // which wins over a code remembered earlier in this session.
  const [referralEdit, setReferralEdit] = useState(null)
  const [storedRef] = useState(readStoredRef)
  const referralCode = referralEdit ?? (refFromLink || storedRef)
  // Result of the last referral check. It only counts while it matches the code in the field.
  const [refCheck, setRefCheck] = useState(REF_IDLE)
  const [refChecking, setRefChecking] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Step 2: verification
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [otpError, setOtpError] = useState('')
  const [otpMinutes, setOtpMinutes] = useState(DEFAULT_OTP_MINUTES)
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState(null) // { type: 'ok' | 'err', text }
  // If Login already triggered a fresh code, start the resend cooldown straight away
  const [cooldown, setCooldown] = useState(pending?.otpSent ? DEFAULT_COOLDOWN : 0)
  const [alreadyVerified, setAlreadyVerified] = useState(false)
  const [otpHint, setOtpHint] = useState(false)
  const inputsRef = useRef([])
  // Every register/resend call issues a NEW code and kills the previous one,
  // so we make sure two requests can never run at the same time.
  const busy = useRef({ register: false, verify: false, resend: false })
  // Counts referral checks so a slow, older answer can never overwrite a newer one
  const refReq = useRef(0)

  const email = form.email.trim().toLowerCase()
  const code = digits.join('')
  const cooling = cooldown > 0
  const stepIndex = step === 'form' ? 0 : step === 'otp' ? 1 : 2
  const refApplied = Boolean(refFromLink) && referralCode === refFromLink

  // What the referral field shows, worked out from the last check
  const refMatches = refCheck.code === referralCode
  const refValid = Boolean(referralCode) && refMatches && refCheck.status === 'valid'
  const refMessage = referralCode && refMatches && refCheck.status !== 'valid' ? refCheck.message : ''
  const refError = errors.referral_code || refMessage
  const refHint = refValid
    ? refCheck.name
      ? `Code applied. You were invited by ${refCheck.name}.`
      : 'Referral code applied.'
    : refApplied
      ? 'Applied from your invite link. You can change or clear it.'
      : undefined

  // Remember the invite-link code for this session (no state is set here)
  useEffect(() => {
    if (refFromLink) storeRef(refFromLink)
  }, [refFromLink])

  // Resend countdown
  useEffect(() => {
    if (!cooling) return
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooling])

  // After verification, send the user to the login page
  useEffect(() => {
    if (step !== 'done') return
    const id = setTimeout(() => {
      navigate('/login', { replace: true, state: { verified: true, email } })
    }, REDIRECT_DELAY_MS)
    return () => clearTimeout(id)
  }, [step, navigate, email])

  const setField = (name, value) => {
    if (name === 'referral_code') setReferralEdit(value)
    else setForm((f) => ({ ...f, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setFormError('')
  }

  const resetOtp = () => {
    setDigits(Array(OTP_LENGTH).fill(''))
    setOtpError('')
    setResendMsg(null)
    setAlreadyVerified(false)
    setOtpHint(false)
  }

  const goToLogin = () => navigate('/login', { replace: true, state: { verified: true, email } })

  const focusReferral = () => {
    // Wait a beat so the field is enabled again after the submit finishes
    setTimeout(() => {
      const el = document.getElementById('referral_code')
      if (!el) return
      el.focus()
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    }, 80)
  }

  /* ── Referral code check ── */
  // Always resolves to { code, status: 'valid' | 'invalid' | 'error', name, message }
  const checkReferral = async (value) => {
    const id = ++refReq.current
    setRefChecking(true)
    let result
    try {
      const res = await api.get('/api/referrals/validate/', { params: { code: value }, skipAuth: true })
      const data = res.data?.data
      result =
        data && data.valid === false
          ? { code: value, status: 'invalid', name: '', message: 'This referral code is not valid.' }
          : { code: value, status: 'valid', name: data?.referrer_name || '', message: '' }
    } catch (err) {
      const { message, code: errCode, status, fields, data } = parseError(err)
      if (status === 404 || errCode === 'invalid_referral_code') {
        result = {
          code: value,
          status: 'invalid',
          name: '',
          message: message || 'This referral code is not valid.',
        }
      } else if (status === 400) {
        result = {
          code: value,
          status: 'invalid',
          name: '',
          message: fields.code || 'Enter a valid referral code, or clear the field to continue without one.',
        }
      } else if (status === 429) {
        const wait = Number(data?.retry_after_seconds)
        result = {
          code: value,
          status: 'error',
          name: '',
          message:
            Number.isFinite(wait) && wait > 0
              ? `Too many attempts. Try again in ${Math.ceil(wait)} seconds, or continue without a code.`
              : 'Too many attempts. Please wait a moment and try again, or continue without a code.',
        }
      } else {
        result = { code: value, status: 'error', name: '', message: REF_UNAVAILABLE }
      }
    } finally {
      if (id === refReq.current) setRefChecking(false)
    }
    if (id === refReq.current) {
      setRefCheck(result)
      // A code that does not exist should not follow the person to their next visit
      if (result.status === 'invalid' && value === storedRef) clearStoredRef()
    }
    return result
  }

  // Early feedback when the person leaves the field
  const handleRefBlur = () => {
    if (!referralCode || submitting || refChecking || busy.current.register) return
    if (refCheck.code === referralCode && refCheck.status !== 'error') return
    checkReferral(referralCode)
  }

  const skipReferral = () => {
    refReq.current += 1
    setRefChecking(false)
    setReferralEdit('')
    setRefCheck(REF_IDLE)
    setErrors((prev) => {
      if (!prev.referral_code) return prev
      const next = { ...prev }
      delete next.referral_code
      return next
    })
    clearStoredRef()
  }

  /* ── Step 1: create account ── */
  const handleRegister = async (e) => {
    e.preventDefault()
    if (busy.current.register) return
    setFormError('')

    const v = validate(form)
    setErrors(v)
    if (Object.keys(v).length) return

    busy.current.register = true
    setSubmitting(true)
    try {
      // 1. Check the referral code first. Only a valid code lets registration go on.
      if (referralCode) {
        const known = refCheck.code === referralCode && refCheck.status === 'valid' ? refCheck : null
        const result = known || (await checkReferral(referralCode))
        if (result.status !== 'valid') {
          focusReferral()
          return
        }
      }

      // 2. Create the account
      const payload = {
        full_name: form.full_name.trim(),
        email,
        password: form.password,
        confirm_password: form.confirm_password,
      }
      if (referralCode) payload.referral_code = referralCode

      const res = await api.post('/api/auth/register/', payload, { skipAuth: true })
      const data = res.data?.data ?? {}

      // Works for brand-new accounts AND for an unverified email registering again
      // (the backend simply sends a fresh code), so both land on the same screen.
      setOtpMinutes(data.otp_expires_in_minutes || DEFAULT_OTP_MINUTES)
      resetOtp()
      setCooldown(DEFAULT_COOLDOWN)
      setStep('otp')
    } catch (err) {
      const { message, fields } = parseError(err)
      const known = {}
      const extra = []
      Object.entries(fields).forEach(([k, msg]) => {
        if (FORM_FIELDS.includes(k)) known[k] = msg
        else extra.push(msg)
      })
      setErrors(known)
      // The server can still reject the code at registration time: treat it like a failed check
      if (known.referral_code) {
        setRefCheck({ code: referralCode, status: 'invalid', name: '', message: known.referral_code })
        focusReferral()
      }
      // Show the general message unless the field errors already explain it
      setFormError(extra.length ? extra.join(' ') : Object.keys(known).length ? '' : message)
    } finally {
      busy.current.register = false
      setSubmitting(false)
    }
  }

  // For people who closed the tab and already have a code in their inbox
  const handleHaveCode = () => {
    if (!EMAIL_RE.test(form.email.trim())) {
      setErrors({ email: 'Enter the email address you registered with.' })
      return
    }
    setErrors({})
    setFormError('')
    resetOtp()
    setCooldown(0)
    setStep('otp')
  }

  /* ── Step 2: verify code ── */
  const handleVerify = async (e) => {
    e.preventDefault()
    if (busy.current.verify || busy.current.resend) return
    if (code.length !== OTP_LENGTH) {
      setOtpError(`Enter the ${OTP_LENGTH}-digit code from your email.`)
      return
    }
    setOtpError('')
    busy.current.verify = true
    setVerifying(true)
    const otp = code.replace(/\D/g, '')
    try {
      await api.post('/api/auth/verify-otp/', { email, otp }, { skipAuth: true })
      setStep('done')
    } catch (err) {
      const { message, code: errCode } = parseError(err)
      // Dev only: shows exactly what was sent and what the server answered
      if (import.meta.env.DEV) {
        console.warn('[verify-otp] rejected', { sent: { email, otp }, response: err?.response?.data })
      }
      if (errCode === 'already_verified') setAlreadyVerified(true)
      if (errCode === 'invalid_otp') setOtpHint(true)
      setOtpError(message)
      if (errCode === 'invalid_otp' || errCode === 'otp_expired') {
        setDigits(Array(OTP_LENGTH).fill(''))
        setTimeout(() => inputsRef.current[0]?.focus(), 0)
      }
    } finally {
      busy.current.verify = false
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    if (busy.current.resend || busy.current.verify || cooling) return
    busy.current.resend = true
    setResending(true)
    setResendMsg(null)
    setOtpError('')
    setOtpHint(false)
    try {
      const res = await api.post('/api/auth/resend-otp/', { email }, { skipAuth: true })
      setResendMsg({
        type: 'ok',
        text: res.data?.message || 'A new code has been sent if an unverified account exists.',
      })
      setDigits(Array(OTP_LENGTH).fill(''))
      setCooldown(DEFAULT_COOLDOWN)
      setTimeout(() => inputsRef.current[0]?.focus(), 0)
    } catch (err) {
      const { message, code: errCode, status } = parseError(err)
      if (errCode === 'already_verified') setAlreadyVerified(true)
      if (status === 429 || errCode === 'otp_cooldown') setCooldown(cooldownFromMessage(message))
      setResendMsg({ type: 'err', text: message })
    } finally {
      busy.current.resend = false
      setResending(false)
    }
  }

  const handleEdit = () => {
    resetOtp()
    setFormError('')
    setStep('form')
  }

  const fade = {
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -14 },
    transition: { duration: 0.28, ease: 'easeOut' },
  }

  const emailTaken =
    errors.email && /exist|already|registered|in use|taken/i.test(errors.email)

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
          <StepIndicator current={stepIndex} />

          <div className={`${card} mt-6 p-5 sm:p-8`}>
            <AnimatePresence mode="wait">
              {/* ───────── STEP 1: DETAILS ───────── */}
              {step === 'form' && (
                <motion.div key="form" {...fade}>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Create your account</h1>
                  <p className="mt-1.5 text-sm text-slate-400">
                    Start trading crypto and forex in a few minutes.
                  </p>

                  <form onSubmit={handleRegister} noValidate className="mt-6 space-y-4">
                    <ErrorBanner>{formError}</ErrorBanner>

                    <Field
                      id="full_name"
                      label="Full name"
                      icon={User}
                      type="text"
                      autoComplete="name"
                      placeholder="John Doe"
                      value={form.full_name}
                      onChange={(e) => setField('full_name', e.target.value)}
                      error={errors.full_name}
                      disabled={submitting}
                    />

                    <div>
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
                      {emailTaken && (
                        <Link
                          to="/login"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#3DDC97] hover:underline"
                        >
                          Already verified? Log in instead
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      )}
                    </div>

                    <div>
                      <Field
                        id="password"
                        label="Password"
                        icon={Lock}
                        type={showPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        value={form.password}
                        onChange={(e) => setField('password', e.target.value)}
                        error={errors.password}
                        disabled={submitting}
                        right={
                          <button
                            type="button"
                            onClick={() => setShowPw((s) => !s)}
                            aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
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
                      <PasswordStrength password={form.password} />
                    </div>

                    <Field
                      id="confirm_password"
                      label="Confirm password"
                      icon={Lock}
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      value={form.confirm_password}
                      onChange={(e) => setField('confirm_password', e.target.value)}
                      error={errors.confirm_password}
                      disabled={submitting}
                    />

                    <div>
                      <Field
                        id="referral_code"
                        label="Referral code"
                        optional
                        icon={Gift}
                        type="text"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder="e.g. A8K2QZ7M"
                        value={referralCode}
                        onChange={(e) => setField('referral_code', cleanRef(e.target.value))}
                        onBlur={handleRefBlur}
                        error={refError}
                        hint={refHint}
                        disabled={submitting}
                        right={
                          refChecking ? (
                            <Loader2
                              className="h-4 w-4 shrink-0 animate-spin text-slate-400"
                              aria-label="Checking referral code"
                            />
                          ) : refValid || (refApplied && !refError && refCheck.status === 'idle') ? (
                            <CheckCircle2
                              className="h-4 w-4 shrink-0 text-[#3DDC97]"
                              aria-label={refValid ? 'Referral code is valid' : 'Applied from invite link'}
                            />
                          ) : null
                        }
                      />
                      {referralCode && refError && !submitting && (
                        <button
                          type="button"
                          onClick={skipReferral}
                          className="mt-1.5 text-xs font-medium text-[#3DDC97] hover:underline focus:outline-none focus-visible:underline"
                        >
                          Continue without a code
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3DDC97] text-base font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          {refChecking ? 'Checking referral code…' : 'Creating account…'}
                        </>
                      ) : (
                        <>
                          Create account
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs text-slate-500">
                      Already have a verification code?{' '}
                      <button
                        type="button"
                        onClick={handleHaveCode}
                        className="font-medium text-[#3DDC97] hover:underline focus:outline-none focus-visible:underline"
                      >
                        Enter it here
                      </button>
                    </p>

                    <p className="text-center text-xs leading-relaxed text-slate-500">
                      By creating an account you agree to our{' '}
                      <Link to="/terms-of-service" className="text-slate-300 underline-offset-2 hover:underline">
                        Terms of Service
                      </Link>
                      ,{' '}
                      <Link to="/privacy-policy" className="text-slate-300 underline-offset-2 hover:underline">
                        Privacy Policy
                      </Link>{' '}
                      and{' '}
                      <Link to="/risk-disclosure" className="text-slate-300 underline-offset-2 hover:underline">
                        Risk Disclosure
                      </Link>
                      .
                    </p>
                  </form>

                  <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-slate-400">
                    Already have an account?{' '}
                    <Link
                      to="/login"
                      className="font-semibold text-[#3DDC97] hover:underline focus:outline-none focus-visible:underline"
                    >
                      Log in
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* ───────── STEP 2: VERIFY OTP ───────── */}
              {step === 'otp' && (
                <motion.div key="otp" {...fade}>
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/25">
                    <Mail className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">Check your email</h1>
                  <p className="mx-auto mt-1.5 max-w-sm text-center text-sm leading-relaxed text-slate-400">
                    Enter the {OTP_LENGTH}-digit code we sent to{' '}
                    <span className="break-all font-medium text-white">{email}</span>. It expires in {otpMinutes}{' '}
                    {otpMinutes === 1 ? 'minute' : 'minutes'}.
                  </p>

                  <form onSubmit={handleVerify} noValidate className="mt-6 space-y-4">
                    <OtpInput
                      digits={digits}
                      onChange={(d) => {
                        setDigits(d)
                        if (otpError) setOtpError('')
                      }}
                      inputsRef={inputsRef}
                      disabled={verifying}
                      invalid={Boolean(otpError)}
                    />

                    {otpError && (
                      <ErrorBanner>
                        {otpError}
                        {otpHint && (
                          <span className="mt-1 block text-xs text-red-200/80">
                            Only the newest code works. If you registered or resent more than once, open the most
                            recent email.
                          </span>
                        )}
                      </ErrorBanner>
                    )}

                    {alreadyVerified && (
                      <Link
                        to="/login"
                        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#3DDC97]/40 bg-[#3DDC97]/10 text-sm font-semibold text-[#3DDC97] transition-colors hover:bg-[#3DDC97]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
                      >
                        This email is verified. Go to login
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    )}

                    <button
                      type="submit"
                      disabled={verifying || resending || code.length !== OTP_LENGTH}
                      className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3DDC97] text-base font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Verifying…
                        </>
                      ) : (
                        <>
                          Verify email
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Resend */}
                  <div className="mt-5 text-center text-sm text-slate-400">
                    <span>Didn&rsquo;t get the code? </span>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending || cooling}
                      className="inline-flex items-center gap-1.5 font-semibold text-[#3DDC97] hover:underline focus:outline-none focus-visible:underline disabled:cursor-not-allowed disabled:text-slate-500 disabled:no-underline"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} aria-hidden="true" />
                      {resending ? 'Sending…' : cooling ? `Resend in ${formatClock(cooldown)}` : 'Resend code'}
                    </button>
                  </div>

                  {resendMsg && (
                    <p
                      role="status"
                      className={`mt-3 text-center text-xs leading-relaxed ${
                        resendMsg.type === 'ok' ? 'text-[#3DDC97]' : 'text-[#F6465D]'
                      }`}
                    >
                      {resendMsg.text}
                    </p>
                  )}
                  <p className="mt-3 text-center text-xs text-slate-500">
                    Can&rsquo;t find it? Check your spam or junk folder.
                  </p>

                  {/* Edit details */}
                  <div className="mt-6 flex flex-col gap-2.5 border-t border-white/10 pt-5 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={handleEdit}
                      disabled={verifying}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-medium text-slate-200 transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit my details
                    </button>
                    <Link
                      to="/login"
                      className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium text-slate-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
                    >
                      I have an account
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* ───────── STEP 3: DONE ───────── */}
              {step === 'done' && (
                <motion.div key="done" {...fade} className="text-center">
                  <motion.span
                    initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#3DDC97]/15 text-[#3DDC97] ring-1 ring-[#3DDC97]/40"
                  >
                    <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
                  </motion.span>
                  <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">Email verified</h1>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
                    Your account is ready. Taking you to the login page so you can sign in.
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
                    onClick={goToLogin}
                    className="group mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-8 text-base font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  >
                    Continue to login
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </button>
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