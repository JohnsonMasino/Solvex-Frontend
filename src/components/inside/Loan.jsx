// src/pages/inside/Loan.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const HIDE_KEY = 'balanceHidden'
const MASK = '••••••'
const DEPOSIT_PATH = '/dashboard/deposit' // change if your deposit route is different
const KYC_PATH = '/dashboard/kyc'
const POLL_PENDING_MS = 45 * 1000 // re-check a pending request every 45 seconds
const HISTORY_PAGE_SIZE = 10
const QUICK_AMOUNTS = [100, 500, 1000, 5000]

const HISTORY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'repaid', label: 'Repaid' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_STYLE = {
  pending: { label: 'Pending', cls: 'bg-amber-400/[0.15] text-amber-300' },
  active: { label: 'Active', cls: 'bg-sky-400/[0.15] text-sky-300' },
  repaid: { label: 'Repaid', cls: 'bg-[#3DDC97]/[0.15] text-[#3DDC97]' },
  rejected: { label: 'Rejected', cls: 'bg-[#F6465D]/[0.15] text-red-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-white/[0.08] text-slate-300' },
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

const NOTICE_STYLE = {
  success: { cls: 'bg-[#3DDC97]/10 text-[#9BF0C8]', icon: CheckCircle2, color: 'text-[#3DDC97]' },
  warn: { cls: 'bg-amber-400/10 text-amber-200', icon: Clock, color: 'text-amber-300' },
  info: { cls: 'bg-sky-400/10 text-sky-200', icon: Info, color: 'text-sky-300' },
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

// "0.20" -> "0.2%", "1.00" -> "1%"
const pct = (v) => `${String(num(v))}%`

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

const trimZeros = (v) => {
  const s = String(v ?? '')
  if (!s.includes('.')) return s
  return s.replace(/0+$/, '').replace(/\.$/, '')
}

// Keeps only digits and one dot, at most 2 decimals
function cleanAmount(raw) {
  let v = String(raw).replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const i = v.indexOf('.')
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '').slice(0, 2)
  v = v.replace(/^0+(?=\d)/, '')
  if (v.startsWith('.')) v = `0${v}`
  return v.slice(0, 12)
}

function fmtDate(iso, withTime = false) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return d.toLocaleString(
      'en-US',
      withTime
        ? { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
        : { year: 'numeric', month: 'short', day: 'numeric' },
    )
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

const sourceLabel = (s) => {
  const v = String(s || '').toLowerCase()
  if (v === 'deposit') return 'From a deposit'
  if (v === 'manual' || v === 'wallet' || v === 'balance') return 'From your balance'
  return v ? `${v.charAt(0).toUpperCase()}${v.slice(1)}` : 'Payment'
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

// Errors for the read endpoints
const loadError = (err, what) => {
  const res = err?.response
  if (!res) return 'Network error. Check your connection and try again.'
  if (res.status === 401) return 'Your session has expired. Please sign in again to continue.'
  if (res.status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (res.status >= 500) return 'Something went wrong on our side. Please try again in a moment.'
  return `We could not load ${what}.`
}

// POST /api/loans/  ->  { message, amount?, duration?, action?, refresh?, close? }
function describeRequestError(err) {
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.' }

  const { status, data } = res
  const code = data?.code
  const serverMsg = typeof data?.message === 'string' ? data.message : ''

  if (status === 400) {
    const errors = data?.errors || {}
    const amount = flatten(errors.amount)[0] || ''
    const duration = flatten(errors.duration)[0] || ''
    const rest =
      Object.entries(errors)
        .filter(([k]) => k !== 'amount' && k !== 'duration')
        .flatMap(([, v]) => flatten(v))[0] || ''
    return {
      amount,
      duration,
      message: rest || (amount || duration ? '' : serverMsg || 'Please check the details and try again.'),
      // e.g. balance too high: eligibility has probably changed
      refresh: code !== 'validation_error' && !amount && !duration,
    }
  }
  if (status === 401) return { message: 'Your session has expired. Please sign in again to continue.' }
  if (status === 403) {
    if (code === 'kyc_required') {
      return {
        message: serverMsg || 'Complete identity verification (KYC) and wait for approval before requesting a loan.',
        action: { to: KYC_PATH, label: 'Verify identity' },
      }
    }
    return { message: serverMsg || 'You do not have access to loans.' }
  }
  if (status === 409) {
    const fallback =
      code === 'active_loan_exists' ? 'You already have an active loan.' : 'You already have a loan request waiting for approval.'
    return { message: serverMsg || fallback, refresh: true, close: true }
  }
  if (status === 429) return { message: waitMessage(num(data?.data?.retry_after_seconds)) }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.' }
  return { message: serverMsg || 'We could not submit your loan request. Please try again.' }
}

// POST /api/loans/{id}/repay/  ->  { message, action?, refresh? }
function describeRepayError(err) {
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.' }

  const { status, data } = res
  const code = data?.code
  const serverMsg = typeof data?.message === 'string' ? data.message : ''

  if (status === 400) {
    if (code === 'no_funds_to_repay' || data?.data?.action === 'deposit') {
      return {
        message: 'There is no money in your account balance. Deposit money to repay your loan.',
        action: { to: DEPOSIT_PATH, label: 'Deposit money' },
      }
    }
    const amount = flatten(data?.errors?.amount)[0]
    return { message: amount || serverMsg || 'We could not process this payment. Please check the amount and try again.' }
  }
  if (status === 401) return { message: 'Your session has expired. Please sign in again to continue.' }
  if (status === 404) return { message: 'We could not find this loan.', refresh: true }
  if (status === 409) {
    return { message: serverMsg || 'This loan is not active, so there is nothing to repay.', refresh: true }
  }
  if (status === 429) return { message: waitMessage(num(data?.data?.retry_after_seconds)) }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.' }
  return { message: serverMsg || 'We could not process this payment. Please try again.' }
}

// POST /api/loans/{id}/cancel/  ->  { message, refresh? }
function describeCancelError(err) {
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.' }

  const { status, data } = res
  const serverMsg = typeof data?.message === 'string' ? data.message : ''

  if (status === 401) return { message: 'Your session has expired. Please sign in again to continue.' }
  if (status === 404) return { message: 'We could not find this loan request.', refresh: true }
  if (status === 409) {
    return { message: serverMsg || 'Only loan requests waiting for approval can be cancelled.', refresh: true }
  }
  if (status === 429) return { message: waitMessage(num(data?.data?.retry_after_seconds)) }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.' }
  return { message: serverMsg || 'We could not cancel this request. Please try again.' }
}

const getData = (path) => () => api.get(path).then((res) => res.data?.data ?? null)
const fetchConfig = getData('/api/loans/config/')
const fetchEligibility = getData('/api/loans/eligibility/')
const fetchCurrent = getData('/api/loans/current/')
const fetchWallet = getData('/api/wallet/')

// Loads one resource. `data` is undefined until the first successful load (null means "loaded, nothing there").
// reload() resolves to { ok, data } | { skipped }.
//
// Note: `loading` starts as true, so the first load (run from the mount effect) does not need to set any
// state before the request. State is only set after the request finishes, or from reload() (event handlers).
function useLoad(fetcher, what) {
  const [data, setData] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const alive = useRef(true)
  const busy = useRef(false)
  const fetchRef = useRef(fetcher)

  useEffect(() => {
    fetchRef.current = fetcher
  })

  // For retry buttons, refresh and polling. Only ever called from event handlers / callbacks, never from an effect body.
  const reload = useCallback(
    async ({ silent = false } = {}) => {
      if (busy.current) return { skipped: true }
      busy.current = true
      if (!silent) {
        setLoading(true)
        setError('')
      }
      try {
        const d = await fetchRef.current()
        if (alive.current) {
          setData(d)
          setError('')
        }
        return { ok: true, data: d }
      } catch (err) {
        if (alive.current && !silent) setError(loadError(err, what))
        return { ok: false }
      } finally {
        busy.current = false
        if (alive.current && !silent) setLoading(false)
      }
    },
    [what],
  )

  // First load. State is only set inside promise callbacks, never synchronously in the effect body.
  // `loading` starts as true, so nothing needs to be set before the request.
  useEffect(() => {
    let cancelled = false
    alive.current = true
    busy.current = true
    fetchRef
      .current()
      .then((d) => {
        if (cancelled) return
        setData(d)
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(loadError(err, what))
      })
      .finally(() => {
        if (cancelled) return
        busy.current = false
        setLoading(false)
      })
    return () => {
      cancelled = true
      alive.current = false
      busy.current = false
    }
  }, [what])

  return { data, setData, loading, error, reload }
}

const stateOf = (r) => (r.data !== undefined ? 'ready' : r.loading ? 'loading' : 'error')

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

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { label: String(status || 'Unknown'), cls: 'bg-white/[0.08] text-slate-300' }
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  )
}

function StatTile({ label, dot, value, valueClass = 'text-white' }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.04] px-2.5 py-2 sm:px-3">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:text-[11px]">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </p>
      <p className={`mt-0.5 truncate text-[13px] font-semibold tabular-nums sm:text-sm ${valueClass}`}>{value}</p>
    </div>
  )
}

function Row({ label, children, strong }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className={`min-w-0 break-words text-right tabular-nums ${strong ? 'font-semibold text-white' : 'text-slate-200'}`}>
        {children}
      </dd>
    </div>
  )
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 px-0.5">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold text-white sm:text-sm">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

function RepaymentList({ items, money }) {
  return (
    <ul className="space-y-2">
      {items.map((r, i) => (
        <li
          key={r.id || i}
          className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/10"
        >
          <div className="min-w-0">
            <p className="font-mono text-[13px] font-semibold tabular-nums text-[#3DDC97] sm:text-sm">
              {money(num(r.amount))}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400 sm:text-xs">
              {sourceLabel(r.source)} · {fmtDate(r.created_at, true)}
            </p>
          </div>
          {r.outstanding_after != null && (
            <p className="shrink-0 text-right text-[11px] text-slate-400 sm:text-xs">
              Left to pay
              <span className="block font-mono text-[13px] font-medium tabular-nums text-slate-200 sm:text-sm">
                {money(num(r.outstanding_after))}
              </span>
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

/* ────────────────────────────────────────────────
   SECTION 1: YOUR LOAN (active / pending / borrow)
──────────────────────────────────────────────── */

function LoanEmpty({ checking, canBorrow, hint, onBorrow }) {
  return (
    <section aria-label="Your loan" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <div className="rounded-xl bg-[#1A2C3D] px-4 py-8 text-center sm:py-10">
        <button
          type="button"
          onClick={onBorrow}
          disabled={!canBorrow}
          aria-label="Request a loan"
          className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#3DDC97] text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-40 sm:h-20 sm:w-20"
        >
          {checking ? (
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-8 w-8" strokeWidth={2.5} aria-hidden="true" />
          )}
        </button>
        <h2 className="mt-4 text-base font-semibold text-white sm:text-lg">You have no active loan</h2>
        <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-slate-400 sm:text-sm">{hint}</p>
      </div>
    </section>
  )
}

function PendingLoan({ loan, money, onCancel, cancelling, cancelErr }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <section aria-label="Your loan request" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <div className="rounded-xl bg-[#1A2C3D] p-3.5 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13px] font-medium text-slate-300 sm:text-sm">
            <Clock className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            Loan request
          </p>
          <StatusBadge status="pending" />
        </div>

        <p className="mt-3 text-[15px] font-semibold leading-snug text-white sm:text-lg">
          Your request of <span className="font-mono tabular-nums text-[#3DDC97]">{money(num(loan.principal))}</span> for{' '}
          {loan.duration_label} is awaiting approval.
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400 sm:text-sm">
          Nothing is owed and no interest runs until an admin approves it. We check for updates automatically and email
          you when it is approved or declined.
        </p>
      </div>

      <dl className="mt-3 space-y-2.5 rounded-xl bg-[#0E1822] p-3.5 text-[13px] sm:p-4 sm:text-sm">
        <Row label="Reference">
          <span className="font-mono">{loan.reference}</span>
        </Row>
        <Row label="Amount requested">{money(num(loan.principal))}</Row>
        <Row label="Duration">
          {loan.duration_label}
          {loan.duration_days ? ` (${plural(num(loan.duration_days), 'day')})` : ''}
        </Row>
        <Row label="Interest">{pct(loan.daily_rate_percent)} per day</Row>
        <Row label="Requested">{fmtDate(loan.requested_at, true)}</Row>
      </dl>

      {cancelErr && (
        <div className="mt-3">
          <InlineError message={cancelErr} />
        </div>
      )}

      <div className="mt-3">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={cancelling}
            className={`${ghostBtn} w-full`}
          >
            Cancel request
          </button>
        ) : (
          <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
            <p className="text-[13px] font-medium text-white sm:text-sm">Cancel this loan request?</p>
            <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">You can send a new request afterwards.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={async () => {
                  await onCancel()
                  setConfirming(false)
                }}
                disabled={cancelling}
                className={`${ghostBtn} border-[#F6465D]/40 text-red-200 hover:border-[#F6465D] hover:text-red-100`}
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Cancelling…
                  </>
                ) : (
                  'Yes, cancel request'
                )}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={cancelling} className={ghostBtn}>
                Keep request
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function ActiveLoan({ loan, wallet, money, onRepay, repaying, repayErr }) {
  const [amount, setAmount] = useState('')

  const overdue = Boolean(loan.is_overdue)
  const duration = num(loan.duration_days)
  const elapsed = Math.min(num(loan.days_elapsed), duration || num(loan.days_elapsed))
  const progress = duration > 0 ? Math.min(100, (num(loan.days_elapsed) / duration) * 100) : 0
  const barColor = overdue ? 'bg-[#F6465D]' : progress >= 75 ? 'bg-amber-400' : 'bg-[#3DDC97]'
  const available = num(wallet?.available_balance)
  const typed = num(amount)
  const invalidAmount = amount !== '' && typed <= 0

  const onMax = () => {
    const cents = Math.floor(Math.min(available, num(loan.outstanding)) * 100 + 1e-6)
    if (cents > 0) setAmount(trimZeros((cents / 100).toFixed(2)))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (repaying || invalidAmount) return
    const ok = await onRepay(amount === '' ? null : typed.toFixed(2))
    if (ok) setAmount('')
  }

  return (
    <section aria-label="Your loan" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <div className="rounded-xl bg-[#1A2C3D] p-3.5 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-slate-300 sm:text-sm">Amount owed</p>
          <div className="flex items-center gap-1.5">
            {overdue && (
              <span className="inline-flex items-center rounded-md bg-[#F6465D]/[0.15] px-2 py-0.5 text-[11px] font-semibold text-red-300">
                Overdue
              </span>
            )}
            <StatusBadge status="active" />
          </div>
        </div>

        <p
          className={`mt-1 break-words text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl ${
            overdue ? 'text-[#F6465D]' : 'text-white'
          }`}
        >
          {money(num(loan.outstanding))}
        </p>
        <p className="mt-1.5 text-[11px] text-slate-400 sm:text-xs">
          Reference <span className="font-mono text-slate-300">{loan.reference}</span> · Interest{' '}
          <span className="font-medium text-slate-200">{pct(loan.current_rate_percent)}</span> per day (
          {money(num(loan.daily_interest_usd))} a day)
        </p>

        {/* Countdown */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-[11px] sm:text-xs">
            <span className="text-slate-400">
              Day {elapsed} of {duration}
            </span>
            <span className={`font-medium ${overdue ? 'text-red-300' : 'text-slate-200'}`}>
              {overdue
                ? `Overdue by ${plural(num(loan.overdue_days), 'day')}`
                : `${plural(num(loan.days_remaining), 'day')} left`}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-linear ${barColor}`}
              style={{ width: `${overdue ? 100 : progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile label="Principal" dot="bg-sky-400" value={money(num(loan.principal))} />
          <StatTile label="Interest" dot="bg-amber-400" value={money(num(loan.interest_accrued))} />
          <StatTile label="Repaid" dot="bg-[#3DDC97]" value={money(num(loan.amount_repaid))} />
        </div>
      </div>

      {overdue && (
        <div className="mt-3">
          <InlineError
            message={`Your loan is past its due date. Interest is now ${pct(loan.current_rate_percent)} per day, so please repay as soon as you can.`}
          />
        </div>
      )}

      {/* Details */}
      <dl className="mt-3 space-y-2.5 rounded-xl bg-[#0E1822] p-3.5 text-[13px] sm:p-4 sm:text-sm">
        <Row label="Total due">{money(num(loan.total_due))}</Row>
        <Row label="Duration">{loan.duration_label}</Row>
        <Row label="Started">{fmtDate(loan.started_at, true)}</Row>
        <Row label={overdue ? 'Was due' : 'Due'}>{fmtDate(loan.due_at, true)}</Row>
        {loan.halfway_at && !overdue && num(loan.days_elapsed) < duration / 2 && (
          <Row label="Halfway reminder">{fmtDate(loan.halfway_at)}</Row>
        )}
      </dl>

      {/* Repay */}
      <form onSubmit={submit} noValidate className="mt-3 rounded-xl bg-[#0E1822] p-3.5 sm:p-4">
        <label htmlFor="repay-amount" className="block text-[13px] font-semibold text-white sm:text-sm">
          Repay your loan
        </label>
        <div
          className={`mt-3 flex items-center gap-2 rounded-xl bg-[#14212D] px-3.5 py-2.5 ring-1 transition-colors focus-within:ring-2 ${
            invalidAmount ? 'ring-[#F6465D]/60 focus-within:ring-[#F6465D]' : 'ring-white/10 focus-within:ring-[#3DDC97]/70'
          }`}
        >
          <span className="shrink-0 font-mono text-lg font-semibold text-slate-500" aria-hidden="true">
            $
          </span>
          <input
            id="repay-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Pay as much as possible"
            value={amount}
            onChange={(e) => setAmount(cleanAmount(e.target.value))}
            aria-invalid={invalidAmount}
            aria-describedby="repay-amount-hint"
            disabled={repaying}
            className="min-w-0 flex-1 bg-transparent font-mono text-base font-semibold tabular-nums text-white placeholder:text-[13px] placeholder:font-normal placeholder:text-slate-600 focus:outline-none sm:text-lg"
          />
          <button
            type="button"
            onClick={onMax}
            disabled={repaying}
            className="shrink-0 rounded-lg bg-[#3DDC97]/[0.15] px-2.5 py-1 font-mono text-xs font-bold text-[#3DDC97] transition-colors hover:bg-[#3DDC97]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60"
          >
            MAX
          </button>
        </div>
        <p
          id="repay-amount-hint"
          className={`mt-2 text-[11px] leading-relaxed sm:text-xs ${invalidAmount ? 'text-red-300' : 'text-slate-400'}`}
          aria-live="polite"
        >
          {invalidAmount
            ? 'Enter an amount above zero, or leave it empty.'
            : `Leave it empty to pay the most you can. Available balance: ${money(available)}.`}
        </p>

        {available <= 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-amber-200 sm:text-xs">
            There is no money in your account balance.{' '}
            <Link to={DEPOSIT_PATH} className="font-semibold underline underline-offset-2">
              Deposit money
            </Link>{' '}
            to repay your loan. Approved deposits are applied to it automatically.
          </p>
        )}

        {repayErr && (
          <div className="mt-3">
            <InlineError message={repayErr.message} action={repayErr.action} />
          </div>
        )}

        <button type="submit" disabled={repaying || invalidAmount} className={`${primaryBtn} mt-3 w-full`}>
          {repaying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Processing payment…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Repay
            </>
          )}
        </button>
      </form>

      <p className="mt-3 px-0.5 text-[11px] leading-relaxed text-slate-400 sm:text-xs">
        You cannot withdraw while a loan is active. Repay it first.
      </p>
    </section>
  )
}

/* ────────────────────────────────────────────────
   SECTION 2: ACCOUNT BALANCE + ELIGIBILITY
──────────────────────────────────────────────── */

const eligibilityReasons = (elig, cfg, money) => {
  const max = elig?.max_eligible_balance_usd ?? cfg?.max_eligible_balance_usd
  const reasons = Array.isArray(elig?.reasons) ? elig.reasons : []
  return reasons.map((r) => {
    if (r === 'loan_request_pending') return 'Your loan request is waiting for approval.'
    if (r === 'active_loan_exists') return 'You have an active loan. Repay it before requesting another.'
    if (r === 'balance_too_high') {
      return `Your account balance (${money(num(elig?.balance))}) is too high. You can borrow only when it is below ${money(num(max))}.`
    }
    return 'You are not eligible for a loan right now.'
  })
}

function AccountSection({
  wallet,
  walletState,
  walletErr,
  onRetryWallet,
  hidden,
  onToggle,
  money,
  showElig,
  elig,
  eligState,
  eligErr,
  onRetryElig,
  cfg,
}) {
  const net = num(wallet?.net_balance ?? wallet?.balance)
  const negative = net < 0
  const reasons = eligibilityReasons(elig, cfg, money)

  return (
    <section aria-label="Account and eligibility" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <div className="rounded-xl bg-[#1A2C3D] p-3.5 sm:p-5">
        <div className="flex items-center gap-1.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#3DDC97]/[0.15] text-[#3DDC97]">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <p className="text-[13px] font-medium text-slate-300 sm:text-sm">Account balance</p>
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

        {walletState === 'error' ? (
          <div className="mt-3">
            <InlineError message={walletErr} onRetry={onRetryWallet} />
          </div>
        ) : walletState === 'loading' ? (
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
            <p
              className={`mt-1 break-words text-2xl font-semibold tabular-nums tracking-tight sm:text-4xl ${
                negative && !hidden ? 'text-[#F6465D]' : 'text-white'
              }`}
            >
              {hidden ? MASK : money(net)}
            </p>
            {negative && !hidden && (
              <p className="mt-1 text-[11px] text-red-300 sm:text-xs">Negative because of your active loan.</p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatTile label="Balance" dot="bg-[#3DDC97]" value={hidden ? MASK : money(num(wallet?.balance))} />
              <StatTile
                label="Loan owed"
                dot="bg-amber-400"
                value={hidden ? MASK : money(num(wallet?.loan_outstanding))}
              />
              <StatTile
                label="Available"
                dot="bg-sky-400"
                value={hidden ? MASK : money(num(wallet?.available_balance))}
              />
            </div>
          </>
        )}
      </div>

      {showElig && (
        <div className="mt-3" aria-live="polite">
          {eligState === 'loading' ? (
            <div className="h-20 animate-pulse rounded-xl bg-white/[0.04]" aria-hidden="true" />
          ) : eligState === 'error' ? (
            <InlineError message={eligErr} onRetry={onRetryElig} />
          ) : elig?.eligible ? (
            <div className="flex items-start gap-3 rounded-xl bg-[#3DDC97]/10 p-3.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#3DDC97]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#9BF0C8] sm:text-sm">You can request a loan</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-300 sm:text-[13px]">
                  You can borrow between {money(num(elig.min_loan_usd ?? cfg?.min_loan_usd))} and{' '}
                  {money(num(elig.max_loan_usd ?? cfg?.max_loan_usd))}. Identity verification (KYC) is checked when you
                  submit.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-amber-400/10 p-3.5">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-amber-200 sm:text-sm">You can&apos;t request a loan right now</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-amber-100/80 sm:text-[13px]">
                  {(reasons.length ? reasons : ['You are not eligible for a loan right now.']).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* ────────────────────────────────────────────────
   SECTION 3: LOAN CONDITIONS
──────────────────────────────────────────────── */

function ConditionRow({ children }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#3DDC97]/[0.15] text-[#3DDC97]">
        <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </li>
  )
}

function ConditionsSection({ cfg, state, error, onRetry, money }) {
  return (
    <section aria-label="Loan conditions" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <SectionTitle title="Loan conditions" subtitle="Please read these before you borrow." />

      {state === 'loading' ? (
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="h-4 w-full animate-pulse rounded bg-white/[0.06]" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-4 w-4/6 animate-pulse rounded bg-white/[0.06]" />
        </div>
      ) : state === 'error' || !cfg ? (
        <div className="mt-3">
          <InlineError message={error || 'We could not read the loan settings.'} onRetry={onRetry} />
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-slate-300 sm:text-[13px]">
          <ConditionRow>
            Your account balance must be below <b className="text-white">{money(num(cfg.max_eligible_balance_usd))}</b> to
            request a loan.
          </ConditionRow>
          <ConditionRow>
            You can borrow from <b className="text-white">{money(num(cfg.min_loan_usd))}</b> up to{' '}
            <b className="text-white">{money(num(cfg.max_loan_usd))}</b>, for the duration you choose.
          </ConditionRow>
          <ConditionRow>
            Identity verification (KYC) must be approved, and only one loan can be open at a time.
          </ConditionRow>
          <ConditionRow>
            Every request needs admin approval. Nothing is owed and no interest runs until it is approved, and you can
            cancel while it is pending.
          </ConditionRow>
          <ConditionRow>
            Interest is <b className="text-white">{pct(cfg.daily_interest_percent)} per day</b> of the original amount
            during the loan period. After the due date it rises to{' '}
            <b className="text-white">{pct(cfg.overdue_daily_interest_percent)} per day</b>.
          </ConditionRow>
          <ConditionRow>
            Interest is simple interest on the original amount, so part payments do not reduce it. A day counts once a full
            24 hours have passed since approval.
          </ConditionRow>
          {cfg.principal_credited_to_wallet === false && (
            <ConditionRow>
              The loan amount is not added to your wallet balance. It is recorded as an amount owed on your account, so your
              account balance can show a negative figure.
            </ConditionRow>
          )}
          <ConditionRow>
            Approved deposits are applied to an active loan automatically. You can also repay from your available balance at
            any time.
          </ConditionRow>
          <ConditionRow>You cannot withdraw while a loan is active. Repay it first.</ConditionRow>
        </ul>
      )}
    </section>
  )
}

/* ────────────────────────────────────────────────
   SECTION 4: REQUEST FORM
──────────────────────────────────────────────── */

function RequestForm({
  cfg,
  money,
  amount,
  setAmount,
  amountMsg,
  duration,
  setDuration,
  durationMsg,
  durationObj,
  preview,
  agreed,
  setAgreed,
  canSubmit,
  submitting,
  onSubmit,
  onClose,
  formError,
  reduce,
}) {
  const min = num(cfg.min_loan_usd)
  const max = num(cfg.max_loan_usd)
  const durations = Array.isArray(cfg.durations) ? cfg.durations : []
  const quick = QUICK_AMOUNTS.filter((q) => q >= min && q <= max)

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 sm:space-y-5">
      {/* Amount */}
      <section aria-label="Loan amount" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 px-0.5">
          <label htmlFor="loan-amount" className="text-[13px] font-semibold text-white sm:text-sm">
            How much do you want to borrow?
          </label>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close the loan request form"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div
          className={`mt-3 flex items-center gap-2 rounded-xl bg-[#0E1822] px-3.5 py-3 ring-1 transition-colors focus-within:ring-2 sm:px-4 sm:py-4 ${
            amountMsg ? 'ring-[#F6465D]/60 focus-within:ring-[#F6465D]' : 'ring-white/10 focus-within:ring-[#3DDC97]/70'
          }`}
        >
          <span className="shrink-0 font-mono text-xl font-semibold text-slate-500 sm:text-2xl" aria-hidden="true">
            $
          </span>
          <input
            id="loan-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(cleanAmount(e.target.value))}
            aria-invalid={Boolean(amountMsg)}
            aria-describedby="loan-amount-hint"
            disabled={submitting}
            className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-semibold tabular-nums text-white placeholder:text-slate-600 focus:outline-none sm:text-3xl"
          />
          <span className="shrink-0 rounded-lg bg-[#3DDC97]/[0.15] px-2.5 py-1 font-mono text-xs font-bold text-[#3DDC97] sm:text-sm">
            {cfg.currency || 'USD'}
          </span>
        </div>

        <p
          id="loan-amount-hint"
          className={`mt-2 px-0.5 text-[11px] sm:text-xs ${amountMsg ? 'text-red-300' : 'text-slate-400'}`}
          aria-live="polite"
        >
          {amountMsg || `Between ${money(min)} and ${money(max)}.`}
        </p>

        {quick.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                disabled={submitting}
                onClick={() => setAmount(String(q))}
                aria-pressed={amount === String(q)}
                className={`h-9 rounded-full px-3.5 font-mono text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60 sm:text-[13px] ${
                  amount === String(q)
                    ? 'bg-[#3DDC97] text-[#06231A]'
                    : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white'
                }`}
              >
                ${q.toLocaleString('en-US')}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Duration */}
      <section aria-label="Loan duration" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        <p className="px-0.5 text-[13px] font-semibold text-white sm:text-sm">Choose a duration</p>
        <p className="mt-0.5 px-0.5 text-[11px] text-slate-400 sm:text-xs">
          Interest is charged for each day of the period you pick.
        </p>

        {durations.length === 0 ? (
          <div className="mt-3">
            <InlineError message="No loan durations are available right now. Please try again later." />
          </div>
        ) : (
          <div role="radiogroup" aria-label="Loan duration" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {durations.map((d) => {
              const on = duration === d.value
              return (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={submitting}
                  onClick={() => setDuration(d.value)}
                  className={`flex min-w-0 flex-col items-start rounded-xl px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60 ${
                    on
                      ? 'bg-[#3DDC97]/[0.08] ring-2 ring-[#3DDC97]'
                      : 'bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="max-w-full truncate text-[13px] font-medium text-white sm:text-sm">{d.label}</span>
                  <span className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">{plural(num(d.days), 'day')}</span>
                </button>
              )
            })}
          </div>
        )}
        {durationMsg && <p className="mt-2 px-0.5 text-[11px] text-red-300 sm:text-xs">{durationMsg}</p>}
      </section>

      {/* Preview */}
      <AnimatePresence initial={false}>
        {preview && (
          <motion.section
            aria-label="Loan preview"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-[#14212D] p-4">
              <dl className="space-y-2.5 text-[13px] sm:text-sm">
                <Row label="Loan amount">
                  <span className="font-mono">{money(preview.amount)}</span>
                </Row>
                <Row label={`Interest per day (${pct(cfg.daily_interest_percent)})`}>
                  <span className="font-mono">{money(preview.daily)}</span>
                </Row>
                <Row label={`Interest for ${durationObj.label}`}>
                  <span className="font-mono">{money(preview.interest)}</span>
                </Row>
                <div className="flex items-start justify-between gap-3 border-t border-white/[0.06] pt-2.5">
                  <dt className="font-medium text-slate-200">Estimated total if repaid on the due date</dt>
                  <dd className="shrink-0 font-mono text-base font-semibold tabular-nums text-[#3DDC97]">
                    {money(preview.total)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500 sm:text-xs">
                These are estimates. Interest starts only when an admin approves your request, and after the due date it
                rises to {pct(cfg.overdue_daily_interest_percent)} per day. The server&apos;s figures are final.
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Agreement */}
      <section aria-label="Agreement" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        <label htmlFor="loan-agree" className="flex cursor-pointer items-start gap-3">
          <input
            id="loan-agree"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[#3DDC97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
          />
          <span className="min-w-0 text-[12px] leading-relaxed text-slate-300 sm:text-[13px]">
            I have read and accept the loan conditions above, including the daily interest, and I understand I cannot
            withdraw while my loan is active.
          </span>
        </label>
      </section>

      {formError && <InlineError message={formError.message} action={formError.action} />}

      <button type="submit" disabled={!canSubmit} className={`${primaryBtn} w-full`}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Submitting request…
          </>
        ) : (
          'Submit loan request'
        )}
      </button>
    </form>
  )
}

/* ────────────────────────────────────────────────
   SECTION 5: PAYMENTS (active loan)
──────────────────────────────────────────────── */

function PaymentsSection({ detail, detailErr, onRetry, money }) {
  const items = Array.isArray(detail?.repayments) ? detail.repayments : []
  return (
    <section aria-label="Payments" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <SectionTitle title="Payments" subtitle="Everything paid towards this loan so far." />
      <div className="mt-3">
        {!detail && detailErr ? (
          <InlineError message={detailErr} onRetry={onRetry} />
        ) : !detail ? (
          <div className="h-16 animate-pulse rounded-xl bg-white/[0.04]" aria-hidden="true" />
        ) : items.length === 0 ? (
          <p className="rounded-xl bg-white/[0.04] px-3.5 py-3 text-[12px] leading-relaxed text-slate-400 sm:text-[13px]">
            No payments yet. Approved deposits are applied to your loan automatically.
          </p>
        ) : (
          <RepaymentList items={items} money={money} />
        )}
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────
   SECTION 6: HISTORY
──────────────────────────────────────────────── */

function HistoryRow({ loan, money }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailErr, setDetailErr] = useState('')
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const hasPayments = num(loan.amount_repaid) > 0

  const fetchDetail = async () => {
    setLoadingDetail(true)
    setDetailErr('')
    try {
      const res = await api.get(`/api/loans/${loan.id}/`)
      if (alive.current) setDetail(res.data?.data ?? null)
    } catch (err) {
      if (alive.current) setDetailErr(loadError(err, 'the payments'))
    } finally {
      if (alive.current) setLoadingDetail(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && hasPayments && !detail && !loadingDetail) fetchDetail()
  }

  const repayments = Array.isArray(detail?.repayments) ? detail.repayments : []

  return (
    <li className="rounded-xl bg-white/[0.04] ring-1 ring-white/10">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[13px] font-semibold text-white">{loan.reference}</span>
          <span className="mt-0.5 block truncate text-[11px] text-slate-400 sm:text-xs">
            {money(num(loan.principal))} · {loan.duration_label} · {fmtDate(loan.requested_at)}
          </span>
        </span>
        <StatusBadge status={loan.status} />
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {loan.status === 'rejected' && loan.decline_reason && (
        <p className="px-3 pb-3 text-[12px] leading-relaxed text-red-300 sm:text-[13px]">
          Reason: {loan.decline_reason}
        </p>
      )}

      {open && (
        <div className="border-t border-white/[0.06] px-3 py-3">
          <dl className="space-y-2 text-[12px] sm:text-[13px]">
            <Row label="Amount">{money(num(loan.principal))}</Row>
            <Row label="Duration">{loan.duration_label}</Row>
            <Row label="Interest rate">{pct(loan.daily_rate_percent)} per day</Row>
            <Row label="Requested">{fmtDate(loan.requested_at, true)}</Row>
            {loan.status === 'rejected' && <Row label="Reviewed">{fmtDate(loan.processed_at, true)}</Row>}
            {loan.started_at && <Row label="Started">{fmtDate(loan.started_at, true)}</Row>}
            {loan.due_at && <Row label="Due">{fmtDate(loan.due_at, true)}</Row>}
            {loan.closed_at && <Row label="Closed">{fmtDate(loan.closed_at, true)}</Row>}
            {(loan.status === 'active' || loan.status === 'repaid') && (
              <>
                <Row label="Interest">{money(num(loan.interest_accrued))}</Row>
                <Row label="Total due">{money(num(loan.total_due))}</Row>
                <Row label="Repaid">{money(num(loan.amount_repaid))}</Row>
              </>
            )}
            {loan.status === 'active' && (
              <Row label="Owed now" strong>
                {money(num(loan.outstanding))}
              </Row>
            )}
          </dl>

          {hasPayments && (
            <div className="mt-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">Payments</p>
              {loadingDetail ? (
                <div className="h-12 animate-pulse rounded-xl bg-white/[0.04]" aria-hidden="true" />
              ) : detailErr ? (
                <InlineError message={detailErr} onRetry={fetchDetail} />
              ) : repayments.length > 0 ? (
                <RepaymentList items={repayments} money={money} />
              ) : (
                <p className="text-[12px] text-slate-400">No payment details available.</p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function HistorySection({
  items,
  loading,
  error,
  onRetry,
  filter,
  onFilter,
  hasMore,
  onMore,
  loadingMore,
  moreErr,
  money,
}) {
  const filterLabel = HISTORY_FILTERS.find((f) => f.value === filter)?.label.toLowerCase() || ''

  return (
    <section aria-label="Loan history" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <SectionTitle title="Loan history" subtitle="Your requests and loans, newest first." />

      <div
        role="group"
        aria-label="Filter loans by status"
        className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {HISTORY_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => onFilter(f.value)}
            aria-pressed={filter === f.value}
            className={`h-8 shrink-0 rounded-full px-3.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
              filter === f.value
                ? 'bg-[#3DDC97] text-[#06231A]'
                : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
            <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
            <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
          </div>
        ) : error ? (
          <InlineError message={error} onRetry={onRetry} />
        ) : items.length === 0 ? (
          <p className="rounded-xl bg-white/[0.04] px-3.5 py-6 text-center text-[12px] text-slate-400 sm:text-[13px]">
            {filter ? `No ${filterLabel} loans.` : 'You have not requested a loan yet.'}
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {items.map((loan) => (
                <HistoryRow key={loan.id} loan={loan} money={money} />
              ))}
            </ul>

            {moreErr && (
              <div className="mt-3">
                <InlineError message={moreErr} />
              </div>
            )}

            {hasMore && (
              <button type="button" onClick={onMore} disabled={loadingMore} className={`${ghostBtn} mt-3 w-full`}>
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Loan() {
  const reduce = useReducedMotion()

  const alive = useRef(true)
  const noticeRef = useRef(null)
  const loanRef = useRef(null)
  const formRef = useRef(null)
  const curRef = useRef(undefined)
  const filterRef = useRef('')
  const histReq = useRef(0)
  const silentRef = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const scrollTo = useCallback(
    (el) => {
      el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    },
    [reduce],
  )

  // data
  const cfgR = useLoad(fetchConfig, 'the loan settings')
  const eligR = useLoad(fetchEligibility, 'your eligibility')
  const curR = useLoad(fetchCurrent, 'your loan')
  const walletR = useLoad(fetchWallet, 'your balance')
  const { reload: reloadCfg } = cfgR
  const { reload: reloadElig } = eligR
  const { reload: reloadCur } = curR
  const { reload: reloadWallet, setData: setWallet } = walletR
  const { setData: setCurrent } = curR

  useEffect(() => {
    curRef.current = curR.data
  })

  const [hidden, setHidden] = useState(readHidden)
  const [notice, setNotice] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // request form
  const [borrowOpen, setBorrowOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [duration, setDuration] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [amountErr, setAmountErr] = useState('')
  const [durationErr, setDurationErr] = useState('')

  // pending / active loan actions
  const [cancelling, setCancelling] = useState(false)
  const [cancelErr, setCancelErr] = useState('')
  const [repaying, setRepaying] = useState(false)
  const [repayErr, setRepayErr] = useState(null)

  // active loan payments
  const [detail, setDetail] = useState(null)
  const [detailErr, setDetailErr] = useState('')

  // history
  const [histFilter, setHistFilter] = useState('')
  const [histItems, setHistItems] = useState([])
  const [histPage, setHistPage] = useState(1)
  const [histHasMore, setHistHasMore] = useState(false)
  const [histLoading, setHistLoading] = useState(true)
  const [histMoreLoading, setHistMoreLoading] = useState(false)
  const [histTick, setHistTick] = useState(0)
  const [histErr, setHistErr] = useState('')
  const [histMoreErr, setHistMoreErr] = useState('')

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

  /* ── history ── */

  // Loads page 1 whenever the filter changes or histTick is bumped (see reloadHistory).
  // State is only set inside promise callbacks, never synchronously in the effect body.
  // histLoading starts as true, and the handlers that change the filter / bump the tick turn it on first.
  useEffect(() => {
    const id = ++histReq.current
    const silent = silentRef.current
    silentRef.current = false
    let cancelled = false
    api
      .get('/api/loans/', {
        params: { page: 1, page_size: HISTORY_PAGE_SIZE, ...(histFilter ? { status: histFilter } : {}) },
      })
      .then((res) => {
        if (cancelled || id !== histReq.current) return
        const d = res.data?.data
        setHistItems(Array.isArray(d?.results) ? d.results : [])
        setHistPage(1)
        setHistHasMore(Boolean(d?.next))
        setHistErr('')
      })
      .catch((err) => {
        if (cancelled || id !== histReq.current || silent) return
        setHistErr(loadError(err, 'your loan history'))
      })
      .finally(() => {
        if (cancelled || id !== histReq.current) return
        setHistLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [histFilter, histTick])

  const onFilter = (v) => {
    if (v === filterRef.current) return
    filterRef.current = v
    setHistLoading(true)
    setHistErr('')
    setHistFilter(v)
  }

  // Re-fetch page 1 of the current filter
  const reloadHistory = useCallback((silent = true) => {
    silentRef.current = silent
    if (!silent) {
      setHistLoading(true)
      setHistErr('')
    }
    setHistTick((t) => t + 1)
  }, [])

  const loadMore = async () => {
    const page = histPage + 1
    const status = filterRef.current
    const id = ++histReq.current
    setHistMoreLoading(true)
    setHistMoreErr('')
    try {
      const res = await api.get('/api/loans/', {
        params: { page, page_size: HISTORY_PAGE_SIZE, ...(status ? { status } : {}) },
      })
      if (!alive.current || id !== histReq.current) return
      const d = res.data?.data
      const results = Array.isArray(d?.results) ? d.results : []
      setHistItems((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        return [...prev, ...results.filter((x) => !seen.has(x.id))]
      })
      setHistPage(page)
      setHistHasMore(Boolean(d?.next))
    } catch (err) {
      if (!alive.current || id !== histReq.current) return
      setHistMoreErr(loadError(err, 'more loans'))
    } finally {
      if (alive.current && id === histReq.current) setHistMoreLoading(false)
    }
  }

  /* ── active loan payments ── */

  const loadDetail = useCallback(async (id) => {
    try {
      const res = await api.get(`/api/loans/${id}/`)
      if (!alive.current) return
      setDetail(res.data?.data ?? null)
      setDetailErr('')
    } catch (err) {
      if (alive.current) setDetailErr(loadError(err, 'your payments'))
    }
  }, [])

  const loan = curR.data && (curR.data.status === 'active' || curR.data.status === 'pending') ? curR.data : null
  const loanId = loan?.id
  const loanStatus = loan?.status
  const loanRepaid = loan?.amount_repaid

  // Loads the payments of the active loan. State is only set inside promise callbacks.
  useEffect(() => {
    if (loanStatus !== 'active' || !loanId) return undefined
    let cancelled = false
    api
      .get(`/api/loans/${loanId}/`)
      .then((res) => {
        if (cancelled) return
        setDetail(res.data?.data ?? null)
        setDetailErr('')
      })
      .catch((err) => {
        if (!cancelled) setDetailErr(loadError(err, 'your payments'))
      })
    return () => {
      cancelled = true
    }
  }, [loanId, loanStatus, loanRepaid])

  /* ── refresh helpers ── */

  // After the loan changes state, bring everything else up to date without flicker
  const afterChange = useCallback(() => {
    reloadElig({ silent: true })
    reloadWallet({ silent: true })
    reloadHistory(true)
  }, [reloadElig, reloadWallet, reloadHistory])

  const applyTransition = useCallback(
    (prev, next) => {
      const was = prev?.status
      const now = next?.status
      if (was === 'pending' && now === 'active') {
        setNotice({ tone: 'success', text: 'Your loan has been approved. Interest now runs daily until you repay it.' })
      } else if (was === 'pending' && !next) {
        setNotice({ tone: 'info', text: 'Your loan request has been processed. Check your loan history for the result.' })
      } else if (was === 'active' && !next) {
        setNotice({ tone: 'success', text: 'Your loan is fully repaid.' })
      } else {
        return
      }
      afterChange()
    },
    [afterChange],
  )

  const refreshCurrent = useCallback(async () => {
    const prev = curRef.current
    const r = await reloadCur({ silent: true })
    if (!r.ok || !alive.current) return
    applyTransition(prev ?? null, r.data)
  }, [reloadCur, applyTransition])

  // While a request is pending, check every 45 seconds. When the tab comes back, check any open loan.
  useEffect(() => {
    if (!loanStatus) return undefined
    const tick = () => {
      if (!document.hidden) refreshCurrent()
    }
    const id = loanStatus === 'pending' ? setInterval(tick, POLL_PENDING_MS) : null
    document.addEventListener('visibilitychange', tick)
    return () => {
      if (id) clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [loanStatus, refreshCurrent])

  const refreshAll = async () => {
    if (refreshing) return
    setRefreshing(true)
    setNotice(null)
    const prev = curRef.current
    reloadHistory(false)
    const [, , cur] = await Promise.all([reloadCfg(), reloadElig(), reloadCur(), reloadWallet()])
    if (!alive.current) return
    setRefreshing(false)
    if (cur?.ok) applyTransition(prev ?? null, cur.data)
    if (cur?.ok && cur.data?.status === 'active') loadDetail(cur.data.id)
  }

  /* ── derived values ── */

  const cfg = cfgR.data || null
  const elig = eligR.data || null
  const wallet = walletR.data || null
  const currency = cfg?.currency || wallet?.currency || 'USD'
  const money = useMemo(() => makeMoney(currency), [currency])

  const curState = stateOf(curR)
  const eligState = stateOf(eligR)
  const walletState = stateOf(walletR)
  const cfgState = stateOf(cfgR)

  const curKnown = curR.data !== undefined
  const canBorrow = Boolean(elig?.eligible) && curKnown && !loan && Boolean(cfg)
  const showForm = borrowOpen && canBorrow
  const checking = (curState === 'loading' || eligState === 'loading' || cfgState === 'loading') && !canBorrow

  let emptyHint = 'Tap the plus button to request a loan.'
  if (checking) emptyHint = 'Checking if you can borrow…'
  else if (!canBorrow) {
    if (eligState === 'error' || cfgState === 'error') {
      emptyHint = 'We could not check if you can borrow. Use the refresh button at the top to try again.'
    } else {
      emptyHint = 'You can’t borrow right now. See the reason below.'
    }
  }

  // request form values
  const min = num(cfg?.min_loan_usd)
  const max = num(cfg?.max_loan_usd)
  const amt = num(amount)
  const durationObj = (Array.isArray(cfg?.durations) ? cfg.durations : []).find((d) => d.value === duration) || null
  const belowMin = amt > 0 && amt + 1e-9 < min
  const aboveMax = max > 0 && amt - max > 1e-9
  const amountMsg =
    amountErr || (belowMin ? `The minimum loan is ${money(min)}.` : aboveMax ? `The maximum loan is ${money(max)}.` : '')
  const canSubmit = !submitting && agreed && amt > 0 && !belowMin && !aboveMax && Boolean(durationObj)

  const preview = useMemo(() => {
    if (!cfg || !durationObj || !(amt > 0) || belowMin || aboveMax) return null
    const daily = (amt * num(cfg.daily_interest_percent)) / 100
    const interest = daily * num(durationObj.days)
    return { amount: amt, daily, interest, total: amt + interest }
  }, [cfg, durationObj, amt, belowMin, aboveMax])

  useEffect(() => {
    if (showForm) scrollTo(formRef.current)
  }, [showForm, scrollTo])

  useEffect(() => {
    if (notice) scrollTo(noticeRef.current)
  }, [notice, scrollTo])

  /* ── actions ── */

  const resetForm = () => {
    setAmount('')
    setDuration('')
    setAgreed(false)
    setFormError(null)
    setAmountErr('')
    setDurationErr('')
  }

  const onBorrow = () => {
    if (!canBorrow) return
    setNotice(null)
    setBorrowOpen(true)
    scrollTo(formRef.current)
  }

  const onAmountChange = (v) => {
    setAmount(v)
    setAmountErr('')
    setFormError(null)
  }

  const onDurationChange = (v) => {
    setDuration(v)
    setDurationErr('')
    setFormError(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setFormError(null)
    setAmountErr('')
    setDurationErr('')
    setNotice(null)

    try {
      const res = await api.post('/api/loans/', { amount: amt.toFixed(2), duration })
      if (!alive.current) return
      const d = res.data?.data
      if (!d?.id) {
        setFormError({ message: 'We could not read your loan request. Please check your loan status before trying again.' })
        reloadCur({ silent: true })
        return
      }
      setCurrent(d)
      if (d.account) setWallet((w) => ({ ...(w || {}), ...d.account }))
      setBorrowOpen(false)
      resetForm()
      setNotice({
        tone: 'success',
        text: res.data?.message || 'Your loan request has been submitted and is waiting for admin approval.',
      })
      afterChange()
      scrollTo(loanRef.current)
    } catch (err) {
      if (!alive.current) return
      const info = describeRequestError(err)
      if (info.close) {
        setBorrowOpen(false)
        setNotice({ tone: 'warn', text: info.message })
      } else {
        if (info.amount) setAmountErr(info.amount)
        if (info.duration) setDurationErr(info.duration)
        if (info.message) setFormError({ message: info.message, action: info.action })
      }
      if (info.refresh) {
        reloadCur({ silent: true })
        reloadElig({ silent: true })
      }
    } finally {
      if (alive.current) setSubmitting(false)
    }
  }

  const onCancel = async () => {
    if (!loan || cancelling) return
    setCancelling(true)
    setCancelErr('')
    try {
      const res = await api.post(`/api/loans/${loan.id}/cancel/`)
      if (!alive.current) return
      setCurrent(null)
      setNotice({ tone: 'success', text: res.data?.message || 'Loan request cancelled.' })
      afterChange()
    } catch (err) {
      if (!alive.current) return
      const info = describeCancelError(err)
      if (info.refresh) {
        setNotice({ tone: 'warn', text: info.message })
        reloadCur({ silent: true })
        afterChange()
      } else {
        setCancelErr(info.message)
      }
    } finally {
      if (alive.current) setCancelling(false)
    }
  }

  // Resolves true when a payment went through
  const onRepay = async (amountStr) => {
    if (!loan || repaying) return false
    setRepaying(true)
    setRepayErr(null)
    try {
      const res = await api.post(`/api/loans/${loan.id}/repay/`, amountStr ? { amount: amountStr } : undefined)
      if (!alive.current) return false
      const d = res.data?.data
      if (d?.balances || d?.account) {
        setWallet((w) => ({ ...(w || {}), ...(d.balances || {}), ...(d.account || {}) }))
      }
      if (d?.status === 'active') setCurrent(d)
      else setCurrent(null)
      setNotice({
        tone: 'success',
        text:
          res.data?.message ||
          (d?.status === 'active' ? 'Payment received.' : 'Payment received. Your loan is fully repaid.'),
      })
      afterChange()
      return true
    } catch (err) {
      if (!alive.current) return false
      const info = describeRepayError(err)
      if (info.refresh) {
        setNotice({ tone: 'warn', text: info.message })
        reloadCur({ silent: true })
        afterChange()
      } else {
        setRepayErr({ message: info.message, action: info.action })
      }
      return false
    } finally {
      if (alive.current) setRepaying(false)
    }
  }

  return (
    <div>
      <motion.div
        className="mx-auto max-w-2xl space-y-4 sm:space-y-5"
        variants={container}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between gap-3 px-0.5">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-white sm:text-xl">Loans</h1>
            <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">Borrow, repay and track your loans.</p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            aria-label="Refresh"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.08] text-slate-200 transition-colors hover:bg-white/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </motion.div>

        {/* Notice */}
        <div ref={noticeRef} className="scroll-mt-4">
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
        </div>

        {/* 1. Your loan */}
        <motion.div variants={item} ref={loanRef} className="scroll-mt-4">
          {curState === 'loading' ? (
            <Block className="h-60" />
          ) : curState === 'error' ? (
            <section aria-label="Your loan" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
              <InlineError message={curR.error} onRetry={() => curR.reload()} />
            </section>
          ) : loan?.status === 'active' ? (
            <ActiveLoan
              loan={loan}
              wallet={wallet}
              money={money}
              onRepay={onRepay}
              repaying={repaying}
              repayErr={repayErr}
            />
          ) : loan?.status === 'pending' ? (
            <PendingLoan loan={loan} money={money} onCancel={onCancel} cancelling={cancelling} cancelErr={cancelErr} />
          ) : (
            <LoanEmpty checking={checking} canBorrow={canBorrow} hint={emptyHint} onBorrow={onBorrow} />
          )}
        </motion.div>

        {/* 2. Account balance and eligibility */}
        <motion.div variants={item}>
          <AccountSection
            wallet={wallet}
            walletState={walletState}
            walletErr={walletR.error}
            onRetryWallet={() => walletR.reload()}
            hidden={hidden}
            onToggle={toggleHidden}
            money={money}
            showElig={!loan}
            elig={elig}
            eligState={eligState}
            eligErr={eligR.error}
            onRetryElig={() => eligR.reload()}
            cfg={cfg}
          />
        </motion.div>

        {/* 3. Loan conditions */}
        <motion.div variants={item}>
          <ConditionsSection cfg={cfg} state={cfgState} error={cfgR.error} onRetry={() => cfgR.reload()} money={money} />
        </motion.div>

        {/* 4. Request form (opens from the plus button) */}
        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div
              key="request-form"
              ref={formRef}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="scroll-mt-4"
            >
              <RequestForm
                cfg={cfg}
                money={money}
                amount={amount}
                setAmount={onAmountChange}
                amountMsg={amountMsg}
                duration={duration}
                setDuration={onDurationChange}
                durationMsg={durationErr}
                durationObj={durationObj}
                preview={preview}
                agreed={agreed}
                setAgreed={setAgreed}
                canSubmit={canSubmit}
                submitting={submitting}
                onSubmit={submit}
                onClose={() => {
                  setBorrowOpen(false)
                  resetForm()
                }}
                formError={formError}
                reduce={reduce}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 5. Payments on the active loan */}
        {loan?.status === 'active' && (
          <motion.div variants={item}>
            <PaymentsSection
              detail={detail?.id === loan.id ? detail : null}
              detailErr={detailErr}
              onRetry={() => loadDetail(loan.id)}
              money={money}
            />
          </motion.div>
        )}

        {/* 6. History */}
        <motion.div variants={item}>
          <HistorySection
            items={histItems}
            loading={histLoading}
            error={histErr}
            onRetry={() => reloadHistory(false)}
            filter={histFilter}
            onFilter={onFilter}
            hasMore={histHasMore}
            onMore={loadMore}
            loadingMore={histMoreLoading}
            moreErr={histMoreErr}
            money={money}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}