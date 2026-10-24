// src/pages/inside/Withdrawal.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Mail,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const HIDE_KEY = 'balanceHidden'
const MASK = '••••••'
const OTP_LENGTH = 6
const DEFAULT_EXPIRY_MINUTES = 5 // used only if the API does not say
const RESEND_COOLDOWN_SECONDS = 30 // UI cooldown; the server's 429 value always wins
const REVIEW_SECONDS = 5 // "processing" screen before redirecting
const STEPS = ['Details', 'Verify', 'Done']
const PHASE_INDEX = { form: 0, otp: 1, review: 2 }

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

const NETWORK_STYLE = {
  bep20: 'bg-amber-400/[0.15] text-amber-300',
  erc20: 'bg-violet-400/[0.15] text-violet-300',
  trc20: 'bg-[#F6465D]/[0.15] text-red-300',
}
const NETWORK_FALLBACK = 'bg-sky-400/[0.15] text-sky-300'

const NOTICE_STYLE = {
  success: { cls: 'bg-[#3DDC97]/10 text-[#9BF0C8]', icon: CheckCircle2, color: 'text-[#3DDC97]' },
  warn: { cls: 'bg-amber-400/10 text-amber-200', icon: Clock, color: 'text-amber-300' },
  info: { cls: 'bg-sky-400/10 text-sky-200', icon: Mail, color: 'text-sky-300' },
}

const ghostBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-[13px] font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm'

const primaryBtn =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-5 text-[13px] font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm'

const iconBtn =
  'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60'

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────── */

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function makeMoney(currency) {
  try {
    const f = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    return (v) => f.format(num(v))
  } catch {
    return (v) => `$${num(v).toFixed(2)}`
  }
}

// "500.000000" -> "500", "12.500000" -> "12.5"
const trimZeros = (v) => {
  const s = String(v ?? '')
  if (!s.includes('.')) return s
  return s.replace(/0+$/, '').replace(/\.$/, '')
}

// Keeps only digits and one dot, limited decimals
function cleanAmount(raw, decimals = 2) {
  let v = String(raw).replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const i = v.indexOf('.')
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '').slice(0, decimals)
  v = v.replace(/^0+(?=\d)/, '')
  if (v.startsWith('.')) v = `0${v}`
  return v.slice(0, 14)
}

// "USDT (BEP20 – BNB Smart Chain)" -> { title: "USDT", sub: "BEP20 – BNB Smart Chain" }
function splitLabel(label, fallback) {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(label || '')
  if (m) return { title: m[1] || 'USDT', sub: m[2] }
  return { title: label || fallback.toUpperCase(), sub: '' }
}

// Checks an address against the network's regex from the config endpoint
function isValidAddress(address, network) {
  const a = address.trim()
  if (!a) return false
  const pattern = network?.address_regex
  if (!pattern) return a.length >= 10
  try {
    return new RegExp(pattern).test(a)
  } catch {
    return a.length >= 10
  }
}

const mmss = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const flatten = (v) => {
  if (v == null) return []
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(flatten)
  if (typeof v === 'object') return Object.values(v).flatMap(flatten)
  return [String(v)]
}

function readHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

const waitMessage = (secs) =>
  secs
    ? `Too many requests. Please wait ${secs} second${secs === 1 ? '' : 's'} and try again.`
    : 'Too many requests. Please wait a moment and try again.'

// Errors for the two read endpoints (wallet, config)
const loadError = (err, what) => {
  const res = err?.response
  if (!res) return 'Network error. Check your connection and try again.'
  if (res.status === 401) return 'Your session has expired. Please sign in again to continue.'
  if (res.status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (res.status >= 500) return 'Something went wrong on our side. Please try again in a moment.'
  return `We could not load ${what}.`
}

// Errors for creating a withdrawal. Returns { message, amount?, address?, action? }
function describeSubmitError(err) {
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.' }

  const { status, data } = res
  const code = data?.code
  const serverMsg = typeof data?.message === 'string' ? data.message : ''

  if (status === 400) {
    const errors = data?.errors || {}
    const amount = flatten(errors.usd_amount)[0] || ''
    const address = flatten(errors.address)[0] || ''
    const rest =
      Object.entries(errors)
        .filter(([k]) => k !== 'usd_amount' && k !== 'address')
        .flatMap(([, v]) => flatten(v))[0] || ''
    return {
      amount,
      address,
      message: rest || (amount || address ? '' : serverMsg || 'Please check the details and try again.'),
    }
  }
  if (status === 401) return { message: 'Your session has expired. Please sign in again to continue.' }
  if (status === 403) {
    if (code === 'kyc_required') {
      return {
        message: serverMsg || 'Complete identity verification (KYC) and wait for approval before withdrawing.',
        action: { to: '/dashboard/kyc', label: 'Verify identity' },
      }
    }
    return { message: serverMsg || 'You do not have access to withdrawals.' }
  }
  if (status === 429) return { message: waitMessage(num(data?.data?.retry_after_seconds)) }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.' }
  return { message: serverMsg || 'We could not create your withdrawal. Please try again.' }
}

// Errors for confirm / resend-otp. `kind` tells the page what to do next:
//   otp     -> show under the code boxes     banner  -> show as a message
//   expired -> request is dead, start over   gone    -> request not found / not usable, start over
//   done    -> it was already confirmed, move on
function describeOtpError(err) {
  const res = err?.response
  if (!res) return { kind: 'banner', message: 'Network error. Check your connection and try again.' }

  const { status, data } = res
  const code = data?.code
  const serverMsg = typeof data?.message === 'string' ? data.message : ''

  if (status === 400) {
    const otp = flatten(data?.errors?.otp)[0]
    if (code === 'withdrawal_expired' || (!otp && /expired/i.test(serverMsg))) {
      return { kind: 'expired', message: serverMsg || 'This withdrawal request has expired. Please start a new one.' }
    }
    if (otp) return { kind: 'otp', otp, message: '' }
    const first = flatten(data?.errors)[0]
    return { kind: 'banner', message: first || serverMsg || 'We could not confirm this withdrawal. Please try again.' }
  }
  if (status === 401) return { kind: 'banner', message: 'Your session has expired. Please sign in again to continue.' }
  if (status === 403) return { kind: 'banner', message: serverMsg || 'You do not have access to withdrawals.' }
  if (status === 404) return { kind: 'gone', message: 'We could not find this withdrawal request. Please start a new one.' }
  if (status === 409) {
    if (data?.data?.status === 'pending') return { kind: 'done', message: '' }
    return { kind: 'gone', message: serverMsg || 'This withdrawal is no longer awaiting confirmation.' }
  }
  if (status === 429) {
    const secs = num(data?.data?.retry_after_seconds)
    return { kind: 'banner', message: serverMsg && code === 'otp_cooldown' ? waitMessage(secs) : waitMessage(secs), retry: secs }
  }
  if (status >= 500) return { kind: 'banner', message: 'Something went wrong on our side. Please try again in a moment.' }
  return { kind: 'banner', message: serverMsg || 'Something went wrong. Please try again.' }
}

// Counts down to `endAt` (ms timestamp). Uses the wall clock so throttled tabs stay accurate.
function useCountdown(endAt, onExpire) {
  const [left, setLeft] = useState(() => (endAt ? Math.max(0, endAt - Date.now()) : 0))
  const cb = useRef(onExpire)

  useEffect(() => {
    cb.current = onExpire
  })

  useEffect(() => {
    if (!endAt) return undefined
    let fired = false
    const tick = () => {
      const ms = Math.max(0, endAt - Date.now())
      setLeft(ms)
      if (ms <= 0 && !fired) {
        fired = true
        cb.current?.()
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [endAt])

  return left
}

/* ────────────────────────────────────────────────
   SMALL UI PIECES
──────────────────────────────────────────────── */

function InlineError({ message, onRetry, action }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#F6465D]/10 px-3.5 py-3 text-[13px] text-red-200 sm:text-sm"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-[#F6465D]" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
        >
          Try again
        </button>
      )}
      {action && (
        <Link
          to={action.to}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

function Notice({ tone, children }) {
  const s = NOTICE_STYLE[tone] || NOTICE_STYLE.warn
  const Icon = s.icon
  return (
    <div role="status" className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] sm:text-sm ${s.cls}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.color}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  )
}

function Block({ className }) {
  return <div className={`animate-pulse rounded-2xl bg-[#14212D] ${className}`} aria-hidden="true" />
}

function Stepper({ index, reduce }) {
  return (
    <ol className="flex items-center" aria-label="Withdrawal progress">
      {STEPS.map((label, i) => {
        const done = i < index
        const on = i === index
        const last = i === STEPS.length - 1
        return (
          <li key={label} className={`flex items-center ${last ? '' : 'flex-1'}`} aria-current={on ? 'step' : undefined}>
            <span className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold transition-colors ${
                  done || on ? 'bg-sky-400 text-[#06141F]' : 'bg-white/[0.07] text-slate-400'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={`text-[11px] font-medium sm:text-xs ${on ? 'text-white' : 'hidden text-slate-400 sm:inline'}`}
              >
                {label}
              </span>
            </span>
            {!last && (
              <span className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-white/[0.07] sm:mx-3">
                <motion.span
                  className="block h-full rounded-full bg-sky-400"
                  initial={false}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: reduce ? 0 : 0.5, ease: 'easeOut' }}
                />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function StatTile({ label, dot, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.04] px-2.5 py-2 sm:px-3">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:text-[11px]">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-white sm:text-sm">{value}</p>
    </div>
  )
}

// Six boxes for the emailed code. Supports typing, backspace, arrow keys, paste and autofill.
function OtpInput({ value, onChange, disabled, invalid }) {
  const refs = useRef([])

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  const focusAt = (i) => refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))]?.focus()

  const handleChange = (i, e) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) return
    if (digits.length >= OTP_LENGTH) {
      onChange(digits.slice(0, OTP_LENGTH))
      focusAt(OTP_LENGTH - 1)
      return
    }
    const at = Math.min(i, value.length)
    onChange((value.slice(0, at) + digits.slice(-1) + value.slice(at + 1)).slice(0, OTP_LENGTH))
    focusAt(at + 1)
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (value[i]) {
        onChange(value.slice(0, i) + value.slice(i + 1))
      } else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i))
        focusAt(i - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusAt(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusAt(i + 1)
    }
  }

  const handlePaste = (e) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!digits) return
    e.preventDefault()
    onChange(digits)
    focusAt(digits.length >= OTP_LENGTH ? OTP_LENGTH - 1 : digits.length)
  }

  return (
    <div role="group" aria-label="6-digit verification code" className="flex justify-center gap-1.5 sm:gap-3">
      {Array.from({ length: OTP_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid}
          disabled={disabled}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => {
            if (i > value.length) focusAt(value.length)
            else e.target.select()
          }}
          className={`h-12 min-w-0 max-w-[3rem] flex-1 rounded-xl bg-[#0E1822] text-center font-mono text-xl font-semibold text-white ring-1 transition-colors focus:outline-none focus:ring-2 disabled:opacity-60 sm:h-14 sm:text-2xl ${
            invalid
              ? 'ring-[#F6465D]/60 focus:ring-[#F6465D]'
              : value[i]
                ? 'ring-sky-400/50 focus:ring-sky-400'
                : 'ring-white/10 focus:ring-sky-400'
          }`}
        />
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────
   STEP 1: DETAILS
──────────────────────────────────────────────── */

function BalanceCard({ wallet, loading, error, hidden, onToggle, money, onRetry }) {
  return (
    <section aria-label="Your balance" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <div className="rounded-xl bg-[#1A2C3D] p-3.5 sm:p-5">
        <div className="flex items-center gap-1.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-400/[0.15] text-sky-300">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <p className="text-[13px] font-medium text-slate-300 sm:text-sm">Available to withdraw</p>
          <button
            type="button"
            onClick={onToggle}
            aria-label={hidden ? 'Show balance' : 'Hide balance'}
            aria-pressed={hidden}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
          >
            {hidden ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        {error ? (
          <div className="mt-3">
            <InlineError message={error} onRetry={onRetry} />
          </div>
        ) : loading && !wallet ? (
          <>
            <div className="mt-2 h-9 w-40 animate-pulse rounded bg-white/10" aria-hidden="true" />
            <div className="mt-4 grid grid-cols-3 gap-2" aria-hidden="true">
              <div className="h-[46px] animate-pulse rounded-xl bg-white/[0.04]" />
              <div className="h-[46px] animate-pulse rounded-xl bg-white/[0.04]" />
              <div className="h-[46px] animate-pulse rounded-xl bg-white/[0.04]" />
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 break-words text-2xl font-semibold tabular-nums tracking-tight text-white sm:text-4xl">
              {hidden ? MASK : money(num(wallet?.available_balance))}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatTile label="Total" dot="bg-[#3DDC97]" value={hidden ? MASK : money(num(wallet?.balance))} />
              <StatTile label="Locked" dot="bg-amber-400" value={hidden ? MASK : money(num(wallet?.locked_balance))} />
              <StatTile
                label="Pending"
                dot="bg-sky-400"
                value={hidden ? MASK : money(num(wallet?.pending_withdrawal_balance))}
              />
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function NetworkOption({ n, selected, onSelect, reduce }) {
  const { title, sub } = splitLabel(n.label, n.value)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:px-3.5 ${
        selected ? 'bg-sky-400/[0.08] ring-2 ring-sky-400' : 'bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07]'
      }`}
    >
      <span
        className={`grid h-10 w-12 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-bold uppercase ${
          NETWORK_STYLE[n.value] || NETWORK_FALLBACK
        }`}
      >
        {n.value}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-white sm:text-sm">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-400 sm:text-xs">{sub || 'Tether USD'}</span>
      </span>
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
          selected ? 'border-sky-400 bg-sky-400' : 'border-white/25'
        }`}
        aria-hidden="true"
      >
        <AnimatePresence initial={false}>
          {selected && (
            <motion.span
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            >
              <Check className="h-3 w-3 text-[#06141F]" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </button>
  )
}

function FormStep({
  cfg,
  cfgLoading,
  cfgError,
  onRetryCfg,
  amount,
  setAmount,
  onMax,
  address,
  setAddress,
  onPaste,
  setNetwork,
  activeNetwork,
  rate,
  minUsd,
  usdt,
  amountMsg,
  addressMsg,
  addressOk,
  canSubmit,
  submitting,
  onSubmit,
  formError,
  money,
  reduce,
}) {
  const networks = cfg?.networks || []
  const amt = num(amount)

  if (cfgLoading && !cfg) {
    return (
      <div className="space-y-4">
        <Block className="h-44" />
        <Block className="h-60" />
      </div>
    )
  }

  if (!cfg) {
    return <InlineError message={cfgError || 'We could not load withdrawal settings.'} onRetry={onRetryCfg} />
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 sm:space-y-5">
      {/* Amount */}
      <section aria-label="Withdrawal amount" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        <label htmlFor="withdraw-amount" className="block px-0.5 text-[13px] font-semibold text-white sm:text-sm">
          How much do you want to withdraw?
        </label>

        <div
          className={`mt-3 flex items-center gap-2 rounded-xl bg-[#0E1822] px-3.5 py-3 ring-1 transition-colors focus-within:ring-2 sm:px-4 sm:py-4 ${
            amountMsg ? 'ring-[#F6465D]/60 focus-within:ring-[#F6465D]' : 'ring-white/10 focus-within:ring-sky-400/70'
          }`}
        >
          <span className="shrink-0 font-mono text-xl font-semibold text-slate-500 sm:text-2xl" aria-hidden="true">
            $
          </span>
          <input
            id="withdraw-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(cleanAmount(e.target.value, 2))}
            aria-invalid={Boolean(amountMsg)}
            aria-describedby="withdraw-amount-hint"
            disabled={submitting}
            className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-semibold tabular-nums text-white placeholder:text-slate-600 focus:outline-none sm:text-3xl"
          />
          <button
            type="button"
            onClick={onMax}
            disabled={submitting}
            className="shrink-0 rounded-lg bg-sky-400/[0.15] px-2.5 py-1 font-mono text-xs font-bold text-sky-300 transition-colors hover:bg-sky-400/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:opacity-60 sm:text-sm"
          >
            MAX
          </button>
        </div>

        <p
          id="withdraw-amount-hint"
          className={`mt-2 px-0.5 text-[11px] sm:text-xs ${amountMsg ? 'text-red-300' : 'text-slate-400'}`}
          aria-live="polite"
        >
          {amountMsg || `Minimum withdrawal is ${money(minUsd)}.`}
        </p>
      </section>

      {/* Network */}
      <section aria-label="Network" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        <p className="px-0.5 text-[13px] font-semibold text-white sm:text-sm">Withdraw to which network?</p>
        <p className="mt-0.5 px-0.5 text-[11px] text-slate-400 sm:text-xs">
          Your address must be on the same network, or the funds can be lost.
        </p>

        {networks.length === 0 ? (
          <div className="mt-3">
            <InlineError message="No withdrawal networks are available right now. Please try again later." onRetry={onRetryCfg} />
          </div>
        ) : (
          <div role="radiogroup" aria-label="Withdrawal network" className="mt-3 space-y-2">
            {networks.map((n) => (
              <NetworkOption
                key={n.value}
                n={n}
                selected={activeNetwork?.value === n.value}
                onSelect={() => setNetwork(n.value)}
                reduce={reduce}
              />
            ))}
          </div>
        )}
      </section>

      {/* Address */}
      <section aria-label="Wallet address" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        <label htmlFor="withdraw-address" className="block px-0.5 text-[13px] font-semibold text-white sm:text-sm">
          Your {activeNetwork ? activeNetwork.value.toUpperCase() : 'USDT'} wallet address
        </label>

        <div
          className={`mt-3 flex items-center gap-2 rounded-xl bg-[#0E1822] py-1.5 pl-3.5 pr-1.5 ring-1 transition-colors focus-within:ring-2 sm:pl-4 ${
            addressMsg ? 'ring-[#F6465D]/60 focus-within:ring-[#F6465D]' : 'ring-white/10 focus-within:ring-sky-400/70'
          }`}
        >
          <input
            id="withdraw-address"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={activeNetwork ? `Paste your ${activeNetwork.value.toUpperCase()} address` : 'Paste your address'}
            value={address}
            onChange={(e) => setAddress(e.target.value.replace(/\s/g, ''))}
            aria-invalid={Boolean(addressMsg)}
            aria-describedby="withdraw-address-hint"
            disabled={submitting}
            className="min-w-0 flex-1 bg-transparent py-2 font-mono text-[13px] text-white placeholder:text-slate-600 focus:outline-none sm:text-sm"
          />
          {addressOk ? (
            <motion.span
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              className="grid h-9 w-9 shrink-0 place-items-center text-[#3DDC97]"
              aria-label="Address looks valid"
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </motion.span>
          ) : (
            <button
              type="button"
              onClick={onPaste}
              disabled={submitting}
              className="h-9 shrink-0 rounded-lg bg-white/[0.08] px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60"
            >
              Paste
            </button>
          )}
        </div>

        <p
          id="withdraw-address-hint"
          className={`mt-2 px-0.5 text-[11px] sm:text-xs ${addressMsg ? 'text-red-300' : 'text-slate-400'}`}
          aria-live="polite"
        >
          {addressMsg || 'Double-check the address. Withdrawals cannot be reversed once sent.'}
        </p>
      </section>

      {/* Summary */}
      <AnimatePresence initial={false}>
        {amt > 0 && (
          <motion.section
            aria-label="Withdrawal summary"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <dl className="space-y-2.5 rounded-2xl bg-[#14212D] p-4 text-[13px] sm:text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Deducted from balance</dt>
                <dd className="font-mono font-semibold tabular-nums text-white">{money(amt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Rate</dt>
                <dd className="font-mono tabular-nums text-slate-200">1 USDT = {money(rate)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2.5">
                <dt className="font-medium text-slate-200">You receive</dt>
                <dd className="font-mono text-base font-semibold tabular-nums text-sky-300">
                  {trimZeros(usdt.toFixed(6))} USDT
                </dd>
              </div>
            </dl>
          </motion.section>
        )}
      </AnimatePresence>

      {formError && <InlineError message={formError.message} action={formError.action} />}

      <button type="submit" disabled={!canSubmit} className={`${primaryBtn} w-full`}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Sending your code…
          </>
        ) : (
          <>
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  )
}

/* ────────────────────────────────────────────────
   STEP 2: VERIFY (OTP)
──────────────────────────────────────────────── */

function OtpStep({
  withdrawal,
  left,
  windowMs,
  otp,
  setOtp,
  otpErr,
  banner,
  note,
  onConfirm,
  onResend,
  onCancel,
  confirming,
  resending,
  cancelling,
  cooldownMs,
  money,
  reduce,
}) {
  const expired = left <= 0
  const pct = Math.min(100, (left / Math.max(windowMs, 1)) * 100)
  const urgent = left < 60 * 1000
  const warn = left < 2 * 60 * 1000
  const timerColor = urgent ? 'text-[#F6465D]' : warn ? 'text-amber-300' : 'text-sky-300'
  const barColor = urgent ? 'bg-[#F6465D]' : warn ? 'bg-amber-400' : 'bg-sky-400'
  const netLabel = String(withdrawal.network).toUpperCase()
  const busy = confirming || resending || cancelling || expired
  const complete = otp.length === OTP_LENGTH
  const coolSecs = Math.ceil(cooldownMs / 1000)

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Timer */}
      <section aria-label="Time left to confirm" className="rounded-2xl bg-[#14212D] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13px] font-medium text-slate-300 sm:text-sm">
            <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            Time left to confirm
          </p>
          <p
            className={`font-mono text-xl font-semibold tabular-nums sm:text-2xl ${timerColor} ${
              urgent && !reduce ? 'animate-pulse' : ''
            }`}
            role="timer"
            aria-live="off"
          >
            {mmss(left)}
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-linear ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400 sm:text-xs">
          {expired ? 'Time is up. Closing this request…' : 'This request is cancelled automatically when the timer ends.'}
        </p>
      </section>

      {/* Summary */}
      <section aria-label="Withdrawal details" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        <div className="rounded-xl bg-[#0E1822] p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">You are withdrawing</p>
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                NETWORK_STYLE[withdrawal.network] || NETWORK_FALLBACK
              }`}
            >
              {netLabel}
            </span>
          </div>
          <p className="mt-2 break-all font-mono text-2xl font-semibold tabular-nums text-sky-300 sm:text-3xl">
            {money(num(withdrawal.usd_amount))}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">
            You receive{' '}
            <span className="font-medium text-slate-200">{trimZeros(withdrawal.usdt_amount)} USDT</span>
          </p>
        </div>

        <div className="mt-3 rounded-xl bg-[#0E1822] p-3.5 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Sending to ({netLabel})</p>
          <p className="mt-2 break-all font-mono text-[13px] leading-relaxed text-slate-100 sm:text-sm">
            {withdrawal.address}
          </p>
        </div>

        <p className="mt-3 px-0.5 text-[11px] text-slate-500 sm:text-xs">
          Reference <span className="font-mono text-slate-300">{withdrawal.reference}</span>
        </p>
      </section>

      {/* OTP */}
      <section aria-label="Verification code" className="rounded-2xl bg-[#14212D] p-3.5 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-400/[0.15] text-sky-300">
            <Mail className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-white sm:text-base">Enter your 6-digit code</h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-slate-400 sm:text-sm">
              We emailed you a code to confirm this withdrawal. Check your spam folder if you cannot find it.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <OtpInput value={otp} onChange={setOtp} disabled={busy} invalid={Boolean(otpErr)} />
          <div aria-live="polite" className="min-h-[1.25rem]">
            {otpErr && <p className="mt-2 text-center text-[12px] text-red-300 sm:text-[13px]">{otpErr}</p>}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {note && (
            <motion.div
              key="note"
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2"
            >
              <Notice tone="info">{note}</Notice>
            </motion.div>
          )}
        </AnimatePresence>

        {banner && (
          <div className="mt-2">
            <InlineError message={banner} />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-1.5 text-[12px] text-slate-400 sm:text-[13px]">
          <span>Did not get a code?</span>
          <button
            type="button"
            onClick={onResend}
            disabled={busy || coolSecs > 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-sky-300 transition-colors hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            {resending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {resending ? 'Sending…' : coolSecs > 0 ? `Resend in ${coolSecs}s` : 'Resend code'}
          </button>
        </div>
      </section>

      {/* Actions */}
      <div className="space-y-2.5">
        <button type="button" onClick={onConfirm} disabled={busy || !complete} className={`${primaryBtn} w-full`}>
          {confirming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Confirming…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Confirm withdrawal
            </>
          )}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={`${ghostBtn} w-full`}>
          {cancelling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cancelling…
            </>
          ) : (
            'Cancel withdrawal'
          )}
        </button>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────
   STEP 3: PROCESSING
──────────────────────────────────────────────── */

function ReviewStep({ withdrawal, secs, reduce }) {
  return (
    <section
      aria-label="Withdrawal submitted"
      className="rounded-2xl bg-[#14212D] px-4 py-10 text-center sm:px-6 sm:py-14"
      role="status"
    >
      <div className="relative mx-auto grid h-24 w-24 place-items-center">
        {!reduce && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-sky-400/20"
              animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              aria-hidden="true"
            />
            <motion.span
              className="absolute inset-3 rounded-full bg-sky-400/15"
              animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
              aria-hidden="true"
            />
          </>
        )}
        <span
          className="h-20 w-20 animate-spin rounded-full border-4 border-white/10 border-t-sky-400 motion-reduce:animate-none"
          aria-hidden="true"
        />
        <ArrowRight className="absolute h-7 w-7 -rotate-45 text-sky-300" aria-hidden="true" />
      </div>

      <h2 className="mt-6 text-base font-semibold text-white sm:text-lg">Your withdrawal is being processed</h2>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-slate-400 sm:text-sm">
        Your request{withdrawal?.reference ? ` (${withdrawal.reference})` : ''} has been confirmed. It will be processed
        and completed shortly, and the funds will be sent to your wallet.
      </p>

      <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
        <motion.div
          className="h-full rounded-full bg-sky-400"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: reduce ? 0 : REVIEW_SECONDS, ease: 'linear' }}
        />
      </div>
      <p className="mt-3 text-[11px] text-slate-400 sm:text-xs" aria-live="polite">
        Taking you to your transactions in {secs}s
      </p>
    </section>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Withdrawal() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()

  // flow
  const [phase, setPhase] = useState('form') // form | otp | review
  const [withdrawal, setWithdrawal] = useState(null)
  const [endAt, setEndAt] = useState(null)
  const [windowMs, setWindowMs] = useState(DEFAULT_EXPIRY_MINUTES * 60 * 1000)
  const [resendAt, setResendAt] = useState(null)
  const [notice, setNotice] = useState(null)
  const [secs, setSecs] = useState(REVIEW_SECONDS)

  // form
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [amountErr, setAmountErr] = useState('')
  const [addressErr, setAddressErr] = useState('')

  // otp
  const [otp, setOtp] = useState('')
  const [otpErr, setOtpErr] = useState('')
  const [otpBanner, setOtpBanner] = useState('')
  const [otpNote, setOtpNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [resending, setResending] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // data
  const [hidden, setHidden] = useState(readHidden)
  const [wallet, setWallet] = useState(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletErr, setWalletErr] = useState('')
  const [cfg, setCfg] = useState(null)
  const [cfgLoading, setCfgLoading] = useState(true)
  const [cfgErr, setCfgErr] = useState('')
  const [attempt, setAttempt] = useState(0)

  const alive = useRef(true)
  const closing = useRef(false)
  const confirmingRef = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // Load balance and wallet configuration
  useEffect(() => {
    let live = true

    api
      .get('/api/wallet/')
      .then((res) => {
        if (live) setWallet(res.data?.data ?? null)
      })
      .catch((err) => {
        if (live) setWalletErr(loadError(err, 'your balance'))
      })
      .finally(() => {
        if (live) setWalletLoading(false)
      })

    api
      .get('/api/wallet/config/')
      .then((res) => {
        if (!live) return
        const data = res.data?.data
        if (data && typeof data === 'object') setCfg(data)
        else setCfgErr('We could not read the withdrawal settings.')
      })
      .catch((err) => {
        if (live) setCfgErr(loadError(err, 'withdrawal settings'))
      })
      .finally(() => {
        if (live) setCfgLoading(false)
      })

    return () => {
      live = false
    }
  }, [attempt])

  const retryLoad = () => {
    setWalletErr('')
    setCfgErr('')
    setWalletLoading(true)
    setCfgLoading(true)
    setAttempt((a) => a + 1)
  }

  const toggleHidden = () => {
    setHidden((h) => {
      const next = !h
      try {
        localStorage.setItem(HIDE_KEY, next ? '1' : '0')
      } catch {
        /* storage unavailable, the choice just won't persist */
      }
      return next
    })
  }

  const currency = wallet?.currency || cfg?.currency || 'USD'
  const money = useMemo(() => makeMoney(currency), [currency])

  const rate = num(cfg?.rate) || 1
  const minUsd = num(cfg?.min_withdrawal_usd)
  const expiryMinutes = num(cfg?.withdrawal_request_expiry_minutes) || DEFAULT_EXPIRY_MINUTES
  const networks = useMemo(() => cfg?.networks || [], [cfg])
  const activeNetwork = networks.find((n) => n.value === network) || networks[0] || null

  const available = num(wallet?.available_balance)
  const amt = num(amount)
  const usdt = amt / rate
  const belowMin = amt > 0 && amt + 1e-9 < minUsd
  const exceeds = amt > 0 && Boolean(wallet) && amt - available > 1e-9
  const trimmedAddress = address.trim()
  const addressOk = isValidAddress(trimmedAddress, activeNetwork)
  const addressBad = trimmedAddress.length > 0 && !addressOk

  const amountMsg =
    amountErr ||
    (belowMin
      ? `The minimum withdrawal is ${money(minUsd)}.`
      : exceeds
        ? `That is more than your available balance of ${money(available)}.`
        : '')
  const addressMsg =
    addressErr || (addressBad ? `Enter a valid ${activeNetwork ? activeNetwork.value.toUpperCase() : ''} address.` : '')
  const canSubmit = !submitting && amt > 0 && !belowMin && !exceeds && addressOk && Boolean(activeNetwork)

  const onAmountChange = (v) => {
    setAmount(v)
    setAmountErr('')
    setFormError(null)
  }

  const onAddressChange = (v) => {
    setAddress(v)
    setAddressErr('')
    setFormError(null)
  }

  const onNetworkChange = (v) => {
    setNetwork(v)
    setAddressErr('')
    setFormError(null)
  }

  const onMax = () => {
    if (!wallet) return
    onAmountChange(trimZeros((Math.floor(available * 100) / 100).toFixed(2)))
  }

  const onPaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) onAddressChange(text.replace(/\s/g, ''))
    } catch {
      setAddressErr('Could not read your clipboard. Paste the address manually.')
    }
  }

  // Step 1: validate and email the code
  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setFormError(null)
    setAmountErr('')
    setAddressErr('')
    setNotice(null)

    try {
      const res = await api.post('/api/wallet/withdrawals/', {
        network: activeNetwork.value,
        address: trimmedAddress,
        usd_amount: amt.toFixed(2),
      })
      const d = res.data?.data
      if (!alive.current) return
      if (!d?.id) {
        setFormError({ message: 'We could not read your withdrawal details. Please try again.' })
        return
      }
      const minutes = num(d.expires_in_minutes) || expiryMinutes
      closing.current = false
      confirmingRef.current = false
      setWithdrawal({ ...d, network: String(d.network || activeNetwork.value).toLowerCase() })
      setWindowMs(minutes * 60 * 1000)
      setEndAt(Date.now() + minutes * 60 * 1000)
      setResendAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000)
      setOtp('')
      setOtpErr('')
      setOtpBanner('')
      setOtpNote(d.otp_sent === false ? '' : 'We sent a 6-digit code to your email.')
      setPhase('otp')
    } catch (err) {
      if (!alive.current) return
      const info = describeSubmitError(err)
      if (info.amount) setAmountErr(info.amount)
      if (info.address) setAddressErr(info.address)
      if (info.message) setFormError({ message: info.message, action: info.action })
    } finally {
      if (alive.current) setSubmitting(false)
    }
  }

  // Back to a fresh form (after cancel, expiry or a dead request)
  const resetToForm = useCallback((nextNotice) => {
    setWithdrawal(null)
    setEndAt(null)
    setResendAt(null)
    setAmount('')
    setAddress('')
    setAmountErr('')
    setAddressErr('')
    setFormError(null)
    setOtp('')
    setOtpErr('')
    setOtpBanner('')
    setOtpNote('')
    setCancelling(false)
    setConfirming(false)
    setResending(false)
    setNotice(nextNotice)
    closing.current = false
    confirmingRef.current = false
    setPhase('form')
    api
      .get('/api/wallet/')
      .then((res) => {
        if (alive.current) setWallet(res.data?.data ?? null)
      })
      .catch(() => {})
  }, [])

  // The request went through; show the 5 second processing screen, then leave
  const goReview = useCallback(() => {
    setEndAt(null)
    setResendAt(null)
    setSecs(REVIEW_SECONDS)
    setPhase('review')
  }, [])

  // Cancel the request (auto on timeout, or manual)
  const closeWithdrawal = useCallback(
    async (reason) => {
      if (closing.current || confirmingRef.current || !withdrawal) return
      closing.current = true
      setCancelling(true)
      let locked = false
      try {
        await api.post(`/api/wallet/withdrawals/${withdrawal.id}/cancel/`)
      } catch (err) {
        // 409 means it was already confirmed. Anything else is closed by the server on expiry.
        if (err?.response?.status === 409) locked = true
      }
      if (!alive.current) return
      if (locked) {
        resetToForm({
          tone: 'warn',
          text: 'This request can no longer be cancelled here. Check your transactions for its status.',
        })
      } else if (reason === 'expired') {
        resetToForm({
          tone: 'warn',
          text: 'Your confirmation window ended and the request was closed. Start a new withdrawal when you are ready.',
        })
      } else {
        resetToForm({ tone: 'success', text: 'Withdrawal request cancelled.' })
      }
    },
    [withdrawal, resetToForm],
  )

  const left = useCountdown(phase === 'otp' ? endAt : null, () => closeWithdrawal('expired'))
  const cooldownMs = useCountdown(phase === 'otp' ? resendAt : null)

  // Shared handling for confirm / resend errors that end the request or change its state
  const handleTerminal = (info) => {
    if (info.kind === 'expired' || info.kind === 'gone') {
      resetToForm({ tone: 'warn', text: info.message })
      return true
    }
    if (info.kind === 'done') {
      goReview()
      return true
    }
    return false
  }

  // Step 2: confirm the emailed code
  const confirm = async () => {
    if (otp.length !== OTP_LENGTH || confirming || resending || cancelling || !withdrawal) return
    confirmingRef.current = true
    setConfirming(true)
    setOtpErr('')
    setOtpBanner('')
    setOtpNote('')

    try {
      const res = await api.post(`/api/wallet/withdrawals/${withdrawal.id}/confirm/`, { otp })
      if (!alive.current) return
      const d = res.data?.data
      if (d?.balances) setWallet((w) => ({ ...(w || {}), ...d.balances }))
      if (d) setWithdrawal((w) => ({ ...(w || {}), ...d }))
      goReview()
    } catch (err) {
      if (!alive.current) return
      const info = describeOtpError(err)
      if (handleTerminal(info)) return
      if (info.otp) setOtpErr(info.otp)
      if (info.message) setOtpBanner(info.message)
    } finally {
      confirmingRef.current = false
      if (alive.current) setConfirming(false)
    }
  }

  // Ask for a new code (the old one stops working)
  const resend = async () => {
    if (resending || confirming || cancelling || !withdrawal) return
    setResending(true)
    setOtpErr('')
    setOtpBanner('')
    setOtpNote('')

    try {
      const res = await api.post(`/api/wallet/withdrawals/${withdrawal.id}/resend-otp/`)
      if (!alive.current) return
      const minutes = num(res.data?.data?.expires_in_minutes)
      if (minutes) {
        setWindowMs(minutes * 60 * 1000)
        setEndAt(Date.now() + minutes * 60 * 1000)
      }
      setOtp('')
      setResendAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000)
      setOtpNote('A new code has been sent to your email. The old one no longer works.')
    } catch (err) {
      if (!alive.current) return
      const info = describeOtpError(err)
      if (handleTerminal(info)) return
      if (info.retry) setResendAt(Date.now() + info.retry * 1000)
      if (info.message) setOtpBanner(info.message)
    } finally {
      if (alive.current) setResending(false)
    }
  }

  // Processing screen: 5 second spinner, then go to the transactions page
  useEffect(() => {
    if (phase !== 'review') return undefined
    const tick = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000)
    const done = setTimeout(() => navigate('/dashboard/transactions'), REVIEW_SECONDS * 1000)
    return () => {
      clearInterval(tick)
      clearTimeout(done)
    }
  }, [phase, navigate])

  const stepVariants = {
    initial: { opacity: 0, x: reduce ? 0 : 24 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { opacity: 0, x: reduce ? 0 : -24, transition: { duration: 0.18 } },
  }

  return (
    <div>
      <motion.div
        className="mx-auto max-w-2xl space-y-4 sm:space-y-5"
        variants={container}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        {/* Back + header */}
        <motion.div variants={item} className="space-y-3">
          <AnimatePresence initial={false}>
            {phase === 'form' && (
              <motion.div
                key="back"
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <Link
                  to="/dashboard"
                  className="group inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] pl-3 pr-4 text-[13px] font-medium text-slate-200 transition-colors hover:bg-white/[0.1] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:text-sm"
                >
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                  Back to dashboard
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-white sm:text-xl">Withdraw</h1>
              <p className="mt-0.5 text-[13px] text-slate-400 sm:text-sm">
                Send funds from your wallet to your own USDT address.
              </p>
            </div>
            {phase === 'form' && (
              <button
                type="button"
                onClick={retryLoad}
                disabled={walletLoading || cfgLoading}
                aria-label="Refresh balance and settings"
                className={iconBtn}
              >
                <RefreshCw
                  className={`h-[18px] w-[18px] ${walletLoading || cfgLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        </motion.div>

        {/* Progress */}
        <motion.div variants={item} className="rounded-2xl bg-[#14212D] px-3.5 py-3 sm:px-5 sm:py-3.5">
          <Stepper index={PHASE_INDEX[phase]} reduce={reduce} />
        </motion.div>

        {/* Steps */}
        <motion.div variants={item}>
          <AnimatePresence mode="wait" initial={false}>
            {phase === 'form' && (
              <motion.div
                key="form"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-4 sm:space-y-5"
              >
                <AnimatePresence initial={false}>
                  {notice && (
                    <motion.div
                      key="notice"
                      initial={reduce ? false : { opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <Notice tone={notice.tone}>{notice.text}</Notice>
                    </motion.div>
                  )}
                </AnimatePresence>

                <BalanceCard
                  wallet={wallet}
                  loading={walletLoading}
                  error={walletErr}
                  hidden={hidden}
                  onToggle={toggleHidden}
                  money={money}
                  onRetry={retryLoad}
                />

                <FormStep
                  cfg={cfg}
                  cfgLoading={cfgLoading}
                  cfgError={cfgErr}
                  onRetryCfg={retryLoad}
                  amount={amount}
                  setAmount={onAmountChange}
                  onMax={onMax}
                  address={address}
                  setAddress={onAddressChange}
                  onPaste={onPaste}
                  network={network}
                  setNetwork={onNetworkChange}
                  activeNetwork={activeNetwork}
                  rate={rate}
                  minUsd={minUsd}
                  usdt={usdt}
                  amountMsg={amountMsg}
                  addressMsg={addressMsg}
                  addressOk={addressOk}
                  canSubmit={canSubmit}
                  submitting={submitting}
                  onSubmit={submit}
                  formError={formError}
                  money={money}
                  reduce={reduce}
                />
              </motion.div>
            )}

            {phase === 'otp' && withdrawal && (
              <motion.div key="otp" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                <OtpStep
                  withdrawal={withdrawal}
                  left={left}
                  windowMs={windowMs}
                  otp={otp}
                  setOtp={(v) => {
                    setOtp(v)
                    setOtpErr('')
                    setOtpBanner('')
                  }}
                  otpErr={otpErr}
                  banner={otpBanner}
                  note={otpNote}
                  onConfirm={confirm}
                  onResend={resend}
                  onCancel={() => closeWithdrawal('manual')}
                  confirming={confirming}
                  resending={resending}
                  cancelling={cancelling}
                  cooldownMs={cooldownMs}
                  money={money}
                  reduce={reduce}
                />
              </motion.div>
            )}

            {phase === 'review' && (
              <motion.div key="review" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                <ReviewStep withdrawal={withdrawal} secs={secs} reduce={reduce} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Reminder shown only on the details step */}
        {phase === 'form' && cfg && (
          <motion.p variants={item} className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-slate-500 sm:text-xs">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            We email you a code to confirm each withdrawal. Funds are reserved only after you confirm it.
          </motion.p>
        )}
      </motion.div>
    </div>
  )
}