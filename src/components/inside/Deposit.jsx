// src/pages/inside/Deposit.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Wallet,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const HIDE_KEY = 'balanceHidden'
const MASK = '••••••'
const PAY_WINDOW_MS = 30 * 60 * 1000 // 30 minutes to pay
const REVIEW_SECONDS = 5 // "pending review" screen before redirecting
const QUICK_AMOUNTS = [50, 100, 250, 500, 1000]
const MAX_DECIMALS = 6
const STEPS = ['Amount', 'Payment', 'Review']
const PHASE_INDEX = { form: 0, pay: 1, review: 2 }

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

// Colour per network (badge only)
const NETWORK_STYLE = {
  bep20: 'bg-amber-400/[0.15] text-amber-300',
  erc20: 'bg-violet-400/[0.15] text-violet-300',
  trc20: 'bg-[#F6465D]/[0.15] text-red-300',
}
const NETWORK_FALLBACK = 'bg-sky-400/[0.15] text-sky-300'

const NOTICE_STYLE = {
  success: { cls: 'bg-[#3DDC97]/10 text-[#9BF0C8]', icon: CheckCircle2, color: 'text-[#3DDC97]' },
  warn: { cls: 'bg-amber-400/10 text-amber-200', icon: Clock, color: 'text-amber-300' },
}

const ghostBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-[13px] font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm'

const primaryBtn =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-5 text-[13px] font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm'

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

// Keeps only digits and one dot, at most 6 decimals
function cleanAmount(raw) {
  let v = String(raw).replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const i = v.indexOf('.')
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '').slice(0, MAX_DECIMALS)
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

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

// Errors for the two read endpoints (wallet, config)
const loadError = (err, what) => {
  const res = err?.response
  if (!res) return 'Network error. Check your connection and try again.'
  if (res.status === 401) return 'Your session has expired. Please sign in again to continue.'
  if (res.status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (res.status >= 500) return 'Something went wrong on our side. Please try again in a moment.'
  return `We could not load ${what}.`
}

// Errors for creating a deposit. Returns { message, amount?, action? }
function describeSubmitError(err) {
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.' }

  const { status, data } = res
  const code = data?.code
  const serverMsg = typeof data?.message === 'string' ? data.message : ''

  if (status === 400) {
    const amount = flatten(data?.errors?.usdt_amount)[0]
    const first = flatten(data?.errors)[0]
    return {
      message: amount ? '' : serverMsg || first || 'Please check the details and try again.',
      amount: amount || '',
    }
  }
  if (status === 401) return { message: 'Your session has expired. Please sign in again to continue.' }
  if (status === 403) {
    if (code === 'kyc_required') {
      return {
        message: serverMsg || 'Complete identity verification (KYC) and wait for approval before depositing.',
        action: { to: '/dashboard/kyc', label: 'Verify identity' },
      }
    }
    return { message: serverMsg || 'You do not have access to deposits.' }
  }
  if (status === 409) {
    return {
      message: serverMsg || 'You have too many pending deposits. Please wait for them to be processed.',
      action: { to: '/dashboard/transactions', label: 'View transactions' },
    }
  }
  if (status === 429) {
    const secs = num(data?.data?.retry_after_seconds)
    return {
      message: secs
        ? `Too many requests. Please wait ${secs} second${secs === 1 ? '' : 's'} and try again.`
        : 'Too many requests. Please wait a moment and try again.',
    }
  }
  if (status === 503) {
    return {
      message: serverMsg || 'Deposits on this network are temporarily unavailable. Please try another network.',
    }
  }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.' }
  return { message: serverMsg || 'We could not create your deposit. Please try again.' }
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

function CopyIconBtn({ text, label }) {
  const [done, setDone] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const onCopy = async () => {
    if (await copyText(text)) {
      setDone(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setDone(false), 1800)
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={done ? 'Copied' : label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
        done ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-white/[0.08] text-slate-200 hover:bg-white/[0.14] hover:text-white'
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={done ? 'ok' : 'copy'}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="grid place-items-center"
        >
          {done ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

function Stepper({ index, reduce }) {
  return (
    <ol className="flex items-center" aria-label="Deposit progress">
      {STEPS.map((label, i) => {
        const done = i < index
        const on = i === index
        const last = i === STEPS.length - 1
        return (
          <li key={label} className={`flex items-center ${last ? '' : 'flex-1'}`} aria-current={on ? 'step' : undefined}>
            <span className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold transition-colors ${
                  done || on ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-white/[0.07] text-slate-400'
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
                  className="block h-full rounded-full bg-[#3DDC97]"
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

function QrImage({ network }) {
  const [ok, setOk] = useState(true)
  return (
    <div className="grid h-44 w-44 place-items-center overflow-hidden rounded-2xl bg-white p-2.5 sm:h-52 sm:w-52">
      {ok ? (
        <img
          src={`/${network}.jfif`}
          alt={`QR code for the ${network.toUpperCase()} deposit address`}
          className="h-full w-full object-contain"
          onError={() => setOk(false)}
          draggable="false"
        />
      ) : (
        <p className="px-3 text-center text-xs text-slate-600">QR code unavailable. Copy the address below instead.</p>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────
   STEP 1: AMOUNT + NETWORK
──────────────────────────────────────────────── */

function BalanceCard({ wallet, loading, error, hidden, onToggle, money, onRetry }) {
  return (
    <section aria-label="Your balance" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <div className="rounded-xl bg-[#1A2C3D] p-3.5 sm:p-5">
        <div className="flex items-center gap-1.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#3DDC97]/[0.15] text-[#3DDC97]">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <p className="text-[13px] font-medium text-slate-300 sm:text-sm">Available balance</p>
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
          <div className="mt-2 h-9 w-40 animate-pulse rounded bg-white/10" aria-hidden="true" />
        ) : (
          <>
            <p className="mt-1 break-words text-2xl font-semibold tabular-nums tracking-tight text-white sm:text-4xl">
              {hidden ? MASK : money(num(wallet?.available_balance))}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-400 sm:text-xs">
              Total balance{' '}
              <span className="font-medium tabular-nums text-slate-200">{hidden ? MASK : money(num(wallet?.balance))}</span>
            </p>
          </>
        )}
      </div>
    </section>
  )
}

function NetworkOption({ n, selected, onSelect, reduce }) {
  const available = Boolean(n.deposit_address)
  const { title, sub } = splitLabel(n.label, n.value)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={!available}
      onClick={onSelect}
      className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5 ${
        selected ? 'bg-[#3DDC97]/[0.08] ring-2 ring-[#3DDC97]' : 'bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07]'
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
        <span className="mt-0.5 block truncate text-[11px] text-slate-400 sm:text-xs">
          {available ? sub || 'Tether USD' : 'Temporarily unavailable'}
        </span>
      </span>
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
          selected ? 'border-[#3DDC97] bg-[#3DDC97]' : 'border-white/25'
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
              <Check className="h-3 w-3 text-[#06231A]" strokeWidth={3} />
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
  setNetwork,
  activeNetwork,
  rate,
  minUsd,
  minUsdt,
  usd,
  amountMsg,
  canSubmit,
  submitting,
  onSubmit,
  formError,
  money,
  reduce,
}) {
  const networks = cfg?.networks || []
  const amt = num(amount)
  const showSummary = amt > 0

  if (cfgLoading && !cfg) {
    return (
      <div className="space-y-4">
        <Block className="h-44" />
        <Block className="h-60" />
      </div>
    )
  }

  if (!cfg) {
    return <InlineError message={cfgError || 'We could not load deposit settings.'} onRetry={onRetryCfg} />
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 sm:space-y-5">
      {/* Amount */}
      <section aria-label="Deposit amount" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 px-0.5">
          <label htmlFor="deposit-amount" className="text-[13px] font-semibold text-white sm:text-sm">
            How much do you want to deposit?
          </label>
        </div>

        <div
          className={`mt-3 flex items-center gap-2 rounded-xl bg-[#0E1822] px-3.5 py-3 ring-1 transition-colors focus-within:ring-2 sm:px-4 sm:py-4 ${
            amountMsg ? 'ring-[#F6465D]/60 focus-within:ring-[#F6465D]' : 'ring-white/10 focus-within:ring-[#3DDC97]/70'
          }`}
        >
          <input
            id="deposit-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(cleanAmount(e.target.value))}
            aria-invalid={Boolean(amountMsg)}
            aria-describedby="deposit-amount-hint"
            disabled={submitting}
            className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-semibold tabular-nums text-white placeholder:text-slate-600 focus:outline-none sm:text-3xl"
          />
          <span className="shrink-0 rounded-lg bg-[#3DDC97]/[0.15] px-2.5 py-1 font-mono text-xs font-bold text-[#3DDC97] sm:text-sm">
            USDT
          </span>
        </div>

        <p
          id="deposit-amount-hint"
          className={`mt-2 px-0.5 text-[11px] sm:text-xs ${amountMsg ? 'text-red-300' : 'text-slate-400'}`}
          aria-live="polite"
        >
          {amountMsg || `Minimum deposit is ${money(minUsd)} (${trimZeros(minUsdt.toFixed(2))} USDT).`}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.filter((q) => q * rate >= minUsd).map((q) => {
            const on = amount === String(q)
            return (
              <button
                key={q}
                type="button"
                disabled={submitting}
                onClick={() => setAmount(String(q))}
                aria-pressed={on}
                className={`h-9 rounded-full px-3.5 font-mono text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60 sm:text-[13px] ${
                  on ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white'
                }`}
              >
                {q.toLocaleString('en-US')}
              </button>
            )
          })}
        </div>
      </section>

      {/* Network */}
      <section aria-label="Network" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        <p className="px-0.5 text-[13px] font-semibold text-white sm:text-sm">Choose a network</p>
        <p className="mt-0.5 px-0.5 text-[11px] text-slate-400 sm:text-xs">
          You will send USDT on the network you pick here.
        </p>

        {networks.length === 0 ? (
          <div className="mt-3">
            <InlineError message="No deposit networks are available right now. Please try again later." onRetry={onRetryCfg} />
          </div>
        ) : (
          <div role="radiogroup" aria-label="Deposit network" className="mt-3 space-y-2">
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

      {/* Summary */}
      <AnimatePresence initial={false}>
        {showSummary && (
          <motion.section
            aria-label="Deposit summary"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <dl className="space-y-2.5 rounded-2xl bg-[#14212D] p-4 text-[13px] sm:text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">You send</dt>
                <dd className="font-mono font-semibold tabular-nums text-white">{trimZeros(amount)} USDT</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Rate</dt>
                <dd className="font-mono tabular-nums text-slate-200">1 USDT = {money(rate)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2.5">
                <dt className="font-medium text-slate-200">Credited to your balance</dt>
                <dd className="font-mono text-base font-semibold tabular-nums text-[#3DDC97]">{money(usd)}</dd>
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
            Creating deposit…
          </>
        ) : (
          <>
            Continue to payment
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  )
}

/* ────────────────────────────────────────────────
   STEP 2: PAY
──────────────────────────────────────────────── */

function PayStep({ deposit, left, onPaid, onCancel, cancelling, money, reduce }) {
  const expired = left <= 0
  const pct = Math.min(100, (left / PAY_WINDOW_MS) * 100)
  const urgent = left < 60 * 1000
  const warn = left < 5 * 60 * 1000
  const timerColor = urgent ? 'text-[#F6465D]' : warn ? 'text-amber-300' : 'text-[#3DDC97]'
  const barColor = urgent ? 'bg-[#F6465D]' : warn ? 'bg-amber-400' : 'bg-[#3DDC97]'
  const amountText = trimZeros(deposit.usdt_amount)
  const netLabel = deposit.network.toUpperCase()
  const busy = cancelling || expired

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Timer */}
      <section aria-label="Time left to pay" className="rounded-2xl bg-[#14212D] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13px] font-medium text-slate-300 sm:text-sm">
            <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            Time left to pay
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
          {expired
            ? 'Time is up. Closing this request…'
            : 'This request closes automatically when the timer ends.'}
        </p>
      </section>

      {/* Payment details */}
      <section aria-label="Payment details" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        {/* Exact amount */}
        <div className="rounded-xl bg-[#0E1822] p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Send exactly</p>
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                NETWORK_STYLE[deposit.network] || NETWORK_FALLBACK
              }`}
            >
              {netLabel}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="min-w-0 flex-1 break-all font-mono text-2xl font-semibold tabular-nums text-[#3DDC97] sm:text-3xl">
              {amountText} <span className="text-base text-slate-300 sm:text-lg">USDT</span>
            </p>
            <CopyIconBtn text={amountText} label="Copy amount" />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400 sm:text-xs">
            You will be credited <span className="font-medium text-slate-200">{money(num(deposit.usd_amount))}</span>
          </p>
        </div>

        {/* QR */}
        <div className="mt-3 flex flex-col items-center rounded-xl bg-[#0E1822] px-3.5 py-5">
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.1 }}
          >
            <QrImage key={deposit.network} network={deposit.network} />
          </motion.div>
          <p className="mt-3 text-center text-[11px] text-slate-400 sm:text-xs">
            Scan with your wallet app to pay on {netLabel}
          </p>
        </div>

        {/* Address */}
        <div className="mt-3 rounded-xl bg-[#0E1822] p-3.5 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Deposit address ({netLabel})</p>
          <div className="mt-2 flex items-start gap-2">
            <p className="min-w-0 flex-1 break-all font-mono text-[13px] leading-relaxed text-slate-100 sm:text-sm">
              {deposit.deposit_address}
            </p>
            <CopyIconBtn text={deposit.deposit_address} label="Copy deposit address" />
          </div>
        </div>

        <p className="mt-3 px-0.5 text-[11px] text-slate-500 sm:text-xs">
          Reference <span className="font-mono text-slate-300">{deposit.reference}</span>
        </p>
      </section>

      {/* Warnings */}
      <section aria-label="Before you pay" className="rounded-2xl bg-amber-400/[0.08] p-3.5 sm:p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-200 sm:text-sm">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          Before you pay
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-amber-100/80 sm:text-[13px]">
          <li>
            Send exactly {amountText} USDT. A different amount may delay or block your credit.
          </li>
          <li>Use the {netLabel} network only. Funds sent on another network can be lost.</li>
          <li>Tap “I have paid” after your transfer so our team can review it.</li>
        </ul>
      </section>

      {/* Actions */}
      <div className="space-y-2.5">
        <button type="button" onClick={onPaid} disabled={busy} className={`${primaryBtn} w-full`}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          I have paid
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={`${ghostBtn} w-full`}>
          {cancelling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cancelling…
            </>
          ) : (
            'Cancel deposit'
          )}
        </button>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────
   STEP 3: PENDING REVIEW
──────────────────────────────────────────────── */

function ReviewStep({ deposit, secs, reduce }) {
  return (
    <section
      aria-label="Deposit pending review"
      className="rounded-2xl bg-[#14212D] px-4 py-10 text-center sm:px-6 sm:py-14"
      role="status"
    >
      <div className="relative mx-auto grid h-24 w-24 place-items-center">
        {!reduce && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-[#3DDC97]/20"
              animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              aria-hidden="true"
            />
            <motion.span
              className="absolute inset-3 rounded-full bg-[#3DDC97]/15"
              animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
              aria-hidden="true"
            />
          </>
        )}
        <span
          className="h-20 w-20 animate-spin rounded-full border-4 border-white/10 border-t-[#3DDC97] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <Clock className="absolute h-7 w-7 text-[#3DDC97]" aria-hidden="true" />
      </div>

      <h2 className="mt-6 text-base font-semibold text-white sm:text-lg">Your deposit is pending admin review</h2>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-slate-400 sm:text-sm">
        We have received your request{deposit?.reference ? ` (${deposit.reference})` : ''}. Your balance will be credited
        once the payment is confirmed.
      </p>

      <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
        <motion.div
          className="h-full rounded-full bg-[#3DDC97]"
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

export default function Deposit() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()

  // flow
  const [phase, setPhase] = useState('form') // form | pay | review
  const [deposit, setDeposit] = useState(null)
  const [endAt, setEndAt] = useState(null)
  const [notice, setNotice] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  // form
  const [amount, setAmount] = useState('')
  const [network, setNetwork] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [amountErr, setAmountErr] = useState('')

  // data
  const [hidden, setHidden] = useState(readHidden)
  const [wallet, setWallet] = useState(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletErr, setWalletErr] = useState('')
  const [cfg, setCfg] = useState(null)
  const [cfgLoading, setCfgLoading] = useState(true)
  const [cfgErr, setCfgErr] = useState('')
  const [attempt, setAttempt] = useState(0)

  const [secs, setSecs] = useState(REVIEW_SECONDS)

  const alive = useRef(true)
  const closing = useRef(false)

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
        else setCfgErr('We could not read the deposit settings.')
      })
      .catch((err) => {
        if (live) setCfgErr(loadError(err, 'deposit settings'))
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
  const minUsd = num(cfg?.min_deposit_usd)
  const minUsdt = minUsd / rate
  const networks = useMemo(() => cfg?.networks || [], [cfg])
  const activeNetwork = networks.find((n) => n.value === network && n.deposit_address) || networks.find((n) => n.deposit_address) || null

  const amt = num(amount)
  const usd = amt * rate
  const belowMin = amt > 0 && usd + 1e-9 < minUsd
  const amountMsg = amountErr || (belowMin ? `The minimum deposit is ${money(minUsd)} (${trimZeros(minUsdt.toFixed(2))} USDT).` : '')
  const canSubmit = !submitting && amt > 0 && !belowMin && Boolean(activeNetwork)

  const onAmountChange = (v) => {
    setAmount(v)
    setAmountErr('')
    setFormError(null)
  }

  const onNetworkChange = (v) => {
    setNetwork(v)
    setFormError(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setFormError(null)
    setAmountErr('')
    setNotice(null)

    try {
      const res = await api.post('/api/wallet/deposits/', {
        usdt_amount: amt.toFixed(MAX_DECIMALS),
        network: activeNetwork.value,
      })
      const d = res.data?.data
      if (!alive.current) return
      if (!d?.id || !d?.deposit_address) {
        setFormError({ message: 'We could not read your deposit details. Please try again.' })
        return
      }
      closing.current = false
      setDeposit({ ...d, network: String(d.network || activeNetwork.value).toLowerCase() })
      setEndAt(Date.now() + PAY_WINDOW_MS)
      setPhase('pay')
    } catch (err) {
      if (!alive.current) return
      const info = describeSubmitError(err)
      if (info.amount) setAmountErr(info.amount)
      if (info.message) setFormError({ message: info.message, action: info.action })
    } finally {
      if (alive.current) setSubmitting(false)
    }
  }

  // Close the pending request (auto on timeout, or manual), then restart the page afresh
  const closeDeposit = useCallback(
    async (reason) => {
      if (closing.current || !deposit) return
      closing.current = true
      setCancelling(true)
      try {
        await api.post(`/api/wallet/deposits/${deposit.id}/cancel/`)
      } catch {
        /* if it cannot be cancelled here, the daily cron closes pending requests */
      }
      if (!alive.current) return
      setDeposit(null)
      setEndAt(null)
      setAmount('')
      setAmountErr('')
      setFormError(null)
      setCancelling(false)
      setNotice(
        reason === 'expired'
          ? { tone: 'warn', text: 'Your payment window ended and the request was closed. Start a new deposit when you are ready.' }
          : { tone: 'success', text: 'Deposit request cancelled.' },
      )
      closing.current = false
      setPhase('form')
      // Refresh the balance for the fresh start
      api
        .get('/api/wallet/')
        .then((res) => {
          if (alive.current) setWallet(res.data?.data ?? null)
        })
        .catch(() => {})
    },
    [deposit],
  )

  const left = useCountdown(phase === 'pay' ? endAt : null, () => closeDeposit('expired'))

  const onPaid = () => {
    if (phase !== 'pay' || closing.current) return
    setEndAt(null)
    setSecs(REVIEW_SECONDS)
    setPhase('review')
  }

  // Review screen: 5 second spinner, then go to the transactions page
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

        {/* Progress */}
        <motion.div variants={item} className="rounded-2xl bg-[#14212D] px-3.5 py-3 sm:px-5 sm:py-3.5">
          <Stepper index={PHASE_INDEX[phase]} reduce={reduce} />
        </motion.div>

        {/* Steps */}
        <motion.div variants={item}>
          <AnimatePresence mode="wait" initial={false}>
            {phase === 'form' && (
              <motion.div key="form" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-4 sm:space-y-5">
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
                  network={network}
                  setNetwork={onNetworkChange}
                  activeNetwork={activeNetwork}
                  rate={rate}
                  minUsd={minUsd}
                  minUsdt={minUsdt}
                  usd={usd}
                  amountMsg={amountMsg}
                  canSubmit={canSubmit}
                  submitting={submitting}
                  onSubmit={submit}
                  formError={formError}
                  money={money}
                  reduce={reduce}
                />
              </motion.div>
            )}

            {phase === 'pay' && deposit && (
              <motion.div key="pay" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                <PayStep
                  deposit={deposit}
                  left={left}
                  onPaid={onPaid}
                  onCancel={() => closeDeposit('manual')}
                  cancelling={cancelling}
                  money={money}
                  reduce={reduce}
                />
              </motion.div>
            )}

            {phase === 'review' && (
              <motion.div key="review" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                <ReviewStep deposit={deposit} secs={secs} reduce={reduce} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  )
}