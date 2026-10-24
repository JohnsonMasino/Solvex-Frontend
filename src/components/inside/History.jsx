// src/pages/inside/Transactions.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  Gift,
  Inbox,
  Info,
  LayoutGrid,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const API_PAGE_SIZE = 100 // the API maximum
const MAX_PAGES = 10 // safety cap per source (1000 records)
const VISIBLE_STEP = 20 // rows revealed per "Show more"
const HIDE_KEY = 'balanceHidden' // shared with the Dashboard
const MASK = '••••••'
const EMPTY_PARAMS = {}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

// Same colour language as the Dashboard "Recent transactions" section.
// The ledger has no status field, so ledger rows derive it from the entry type.
const TYPES = {
  deposit: {
    label: 'Deposit',
    icon: Download,
    status: 'completed',
    chip: 'bg-[#3DDC97]/[0.15] text-[#3DDC97]',
    text: 'text-[#3DDC97]',
  },
  withdrawal: {
    label: 'Withdrawal',
    icon: Upload,
    status: 'completed',
    chip: 'bg-sky-400/[0.15] text-sky-300',
    text: 'text-sky-300',
  },
  withdrawal_reserve: {
    label: 'Withdrawal request',
    icon: Upload,
    status: 'pending',
    chip: 'bg-sky-400/[0.15] text-sky-300',
    text: 'text-sky-300',
  },
  withdrawal_release: {
    label: 'Withdrawal returned',
    icon: RotateCcw,
    status: 'failed',
    chip: 'bg-sky-400/[0.15] text-sky-300',
    text: 'text-sky-300',
  },
  trade_lock: {
    label: 'Trade opened',
    icon: TrendingUp,
    status: 'pending',
    chip: 'bg-violet-400/[0.15] text-violet-300',
    text: 'text-violet-300',
  },
  trade_settle: {
    label: 'Trade settled',
    icon: TrendingUp,
    status: 'completed',
    chip: 'bg-violet-400/[0.15] text-violet-300',
    text: 'text-violet-300',
  },
  referral_bonus: {
    label: 'Referral bonus',
    icon: Gift,
    status: 'completed',
    chip: 'bg-pink-400/[0.15] text-pink-300',
    text: 'text-pink-300',
  },
  adjustment: {
    label: 'Adjustment',
    icon: SlidersHorizontal,
    status: 'completed',
    chip: 'bg-slate-400/[0.15] text-slate-300',
    text: 'text-slate-300',
  },
}

const FALLBACK_TYPE = {
  label: 'Transaction',
  icon: SlidersHorizontal,
  status: 'completed',
  chip: 'bg-slate-400/[0.15] text-slate-300',
  text: 'text-slate-300',
}

const STATUS = {
  completed: { label: 'Completed', cls: 'bg-[#3DDC97]/[0.12] text-[#3DDC97]' },
  pending: { label: 'Pending', cls: 'bg-amber-400/[0.12] text-amber-300' },
  failed: { label: 'Failed', cls: 'bg-[#F6465D]/[0.12] text-red-300' },
}

// Detailed API statuses, mapped onto the three filter groups
const DEPOSIT_STATUS = {
  pending: { group: 'pending', label: 'Pending' },
  completed: { group: 'completed', label: 'Completed' },
  declined: { group: 'failed', label: 'Declined' },
  cancelled: { group: 'failed', label: 'Cancelled' },
}

const WITHDRAWAL_STATUS = {
  awaiting_otp: { group: 'pending', label: 'Awaiting OTP' },
  pending: { group: 'pending', label: 'Pending' },
  completed: { group: 'completed', label: 'Completed' },
  failed: { group: 'failed', label: 'Failed' },
  expired: { group: 'failed', label: 'Expired' },
  cancelled: { group: 'failed', label: 'Cancelled' },
}

const OUT_TYPES = new Set(['withdrawal', 'withdrawal_reserve', 'trade_lock'])
const WITHDRAWAL_LEDGER = new Set(['withdrawal', 'withdrawal_reserve', 'withdrawal_release'])

const GROUP_OF = {
  deposit: 'deposits',
  withdrawal: 'withdrawals',
  withdrawal_reserve: 'withdrawals',
  withdrawal_release: 'withdrawals',
  trade_lock: 'trades',
  trade_settle: 'trades',
  referral_bonus: 'bonuses',
  adjustment: 'adjustments',
}

const TYPE_FILTERS = [
  { value: 'all', label: 'All', icon: LayoutGrid },
  { value: 'deposits', label: 'Deposits', icon: Download },
  { value: 'withdrawals', label: 'Withdrawals', icon: Upload },
  { value: 'trades', label: 'Trades', icon: TrendingUp },
  { value: 'bonuses', label: 'Bonuses', icon: Gift },
  { value: 'adjustments', label: 'Adjustments', icon: SlidersHorizontal },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'Any status', dot: null, active: 'bg-[#3DDC97] text-[#06231A]' },
  { value: 'completed', label: 'Completed', dot: 'bg-[#3DDC97]', active: 'bg-[#3DDC97] text-[#06231A]' },
  { value: 'pending', label: 'Pending', dot: 'bg-amber-400', active: 'bg-amber-400 text-[#2A1B00]' },
  { value: 'failed', label: 'Failed', dot: 'bg-[#F6465D]', active: 'bg-[#F6465D] text-white' },
]

const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

const NOTE_TONES = {
  error: { box: 'bg-[#F6465D]/10 text-red-200', icon: 'text-[#F6465D]', Icon: AlertCircle },
  warn: { box: 'bg-amber-400/10 text-amber-200', icon: 'text-amber-300', Icon: AlertCircle },
  info: { box: 'bg-sky-400/10 text-sky-200', icon: 'text-sky-300', Icon: Info },
  success: { box: 'bg-[#3DDC97]/[0.12] text-[#B8F5DA]', icon: 'text-[#3DDC97]', Icon: CheckCircle2 },
}

const inputCls = (error) =>
  `h-11 w-full rounded-xl bg-[#0E1822] px-3.5 text-base text-white outline-none ring-1 transition placeholder:text-slate-500 focus:ring-2 sm:text-sm ${
    error ? 'ring-[#F6465D]/60 focus:ring-[#F6465D]' : 'ring-white/10 focus:ring-[#3DDC97]/70'
  }`

const ghostBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60'

const primaryBtn =
  'inline-flex h-10 items-center justify-center rounded-lg bg-[#3DDC97] px-5 text-sm font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70'

const iconBtn =
  'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60'

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────── */

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const humanize = (v) => (v ? String(v).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '')

function makeFormatters(currency) {
  let money
  try {
    const full = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    money = (v) => full.format(v)
  } catch {
    money = (v) => `$${num(v).toFixed(2)}`
  }
  const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v))}`
  return { money, signed }
}

const FMT = makeFormatters('USD')

function readHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

const toTime = (iso) => {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

const pad = (n) => String(n).padStart(2, '0')
const localDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const shortDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''

const fullDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''

function dayLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((today - that) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

const networkLabel = (n) => (n ? String(n).toUpperCase() : '')

const tokenAmount = (v) =>
  `${num(v).toLocaleString('en-US', { maximumFractionDigits: 6 })} USDT`

const flatten = (v) => {
  if (v == null) return []
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(flatten)
  if (typeof v === 'object') return Object.values(v).flatMap(flatten)
  return [String(v)]
}

// Turns { date_from: ["msg"] } into { date_from: "msg" }
function fieldErrors(errors) {
  const out = {}
  Object.entries(errors || {}).forEach(([key, val]) => {
    const msgs = flatten(val)
    if (msgs.length) out[key] = msgs[0]
  })
  return out
}

// Turns any failed request into a message the page can show
function describeError(err, what) {
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.', fields: {} }
  const { status, data } = res
  if (status === 400) {
    return {
      message: data?.message || 'Some filters are not valid.',
      fields: fieldErrors(data?.errors),
    }
  }
  if (status === 401) return { message: 'Your session has expired. Please sign in again to continue.', fields: {} }
  if (status === 429) return { message: 'Too many requests. Please wait a moment and try again.', fields: {} }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.', fields: {} }
  return { message: `We could not load ${what}.`, fields: {} }
}

// Pulls every page of a paginated endpoint (the API caps page_size at 100)
async function fetchAll(path, params) {
  const results = []
  let page = 1
  let truncated = false
  for (;;) {
    const res = await api.get(path, { params: { ...params, page, page_size: API_PAGE_SIZE } })
    const data = res.data?.data
    results.push(...(data?.results || []))
    if (!data?.next) break
    if (page >= MAX_PAGES) {
      truncated = true
      break
    }
    page += 1
  }
  return { results, truncated }
}

// One paginated source: loads all pages, keeps old rows while refetching, exposes retry and patch
function usePagedSource(path, params, enabled, what) {
  const [state, setState] = useState({
    doneKey: null, // the request this result belongs to
    status: 'loading',
    loaded: false,
    items: [],
    error: null,
    truncated: false,
  })
  const [tick, setTick] = useState(0)
  const key = JSON.stringify(params)
  const requestKey = `${key}|${tick}`

  // Loading is derived: a request is in flight until its result has been stored
  const loading = enabled && state.doneKey !== requestKey

  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    fetchAll(path, JSON.parse(key))
      .then(({ results, truncated }) => {
        if (alive) {
          setState({ doneKey: `${key}|${tick}`, status: 'ok', loaded: true, items: results, error: null, truncated })
        }
      })
      .catch((err) => {
        if (alive) {
          setState((s) => ({ ...s, doneKey: `${key}|${tick}`, status: 'error', error: describeError(err, what) }))
        }
      })
    return () => {
      alive = false
    }
  }, [path, key, enabled, what, tick])

  const retry = useCallback(() => setTick((t) => t + 1), [])
  const patch = useCallback((data) => {
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === data.id ? data : i)) }))
  }, [])

  return {
    status: loading ? 'loading' : state.status,
    loaded: state.loaded,
    items: state.items,
    error: loading ? null : state.error,
    truncated: state.truncated,
    retry,
    patch,
  }
}

// Direction of money for a ledger entry: 1 = in, -1 = out
function directionOf(entry) {
  const d = num(entry.balance_delta)
  if (d > 0) return 1
  if (d < 0) return -1
  return OUT_TYPES.has(entry.entry_type) ? -1 : 1
}

/* ────────────────────────────────────────────────
   ROW BUILDERS (every source becomes the same shape)
──────────────────────────────────────────────── */

const searchText = (parts) => parts.filter(Boolean).join(' ').toLowerCase()

function fromLedger(e) {
  const meta = TYPES[e.entry_type] || FALLBACK_TYPE
  return {
    key: `ledger-${e.id}`,
    source: 'ledger',
    id: e.id,
    kind: e.entry_type,
    group: GROUP_OF[e.entry_type] || 'other',
    meta,
    title: meta.label,
    sub: e.description || e.reference || '',
    amount: Math.abs(num(e.amount)),
    dir: directionOf(e),
    status: meta.status,
    statusLabel: STATUS[meta.status].label,
    createdAt: e.created_at,
    ts: toTime(e.created_at),
    search: searchText([meta.label, e.description, e.reference, STATUS[meta.status].label]),
    raw: e,
  }
}

function fromDeposit(d) {
  const meta = TYPES.deposit
  const st = DEPOSIT_STATUS[d.status] || { group: 'pending', label: humanize(d.status) }
  return {
    key: `deposit-${d.id}`,
    source: 'deposit',
    id: d.id,
    kind: 'deposit',
    group: 'deposits',
    meta,
    title: meta.label,
    sub: [d.reference, networkLabel(d.network)].filter(Boolean).join(' · '),
    amount: num(d.usd_amount) || num(d.usdt_amount),
    dir: 1,
    status: st.group,
    statusLabel: st.label,
    createdAt: d.created_at,
    ts: toTime(d.created_at),
    search: searchText([meta.label, d.reference, d.network, d.deposit_address, d.tx_hash, st.label]),
    raw: d,
  }
}

function fromWithdrawal(w) {
  const meta = TYPES.withdrawal
  const st = WITHDRAWAL_STATUS[w.status] || { group: 'pending', label: humanize(w.status) }
  return {
    key: `withdrawal-${w.id}`,
    source: 'withdrawal',
    id: w.id,
    kind: 'withdrawal',
    group: 'withdrawals',
    meta,
    title: meta.label,
    sub: [w.reference, networkLabel(w.network)].filter(Boolean).join(' · '),
    amount: num(w.usd_amount) || num(w.usdt_amount),
    dir: -1,
    status: st.group,
    statusLabel: st.label,
    createdAt: w.created_at,
    ts: toTime(w.created_at),
    search: searchText([meta.label, w.reference, w.network, w.address, w.admin_tx_hash, st.label]),
    raw: w,
  }
}

const rebuild = (source, raw) =>
  source === 'deposit' ? fromDeposit(raw) : source === 'withdrawal' ? fromWithdrawal(raw) : fromLedger(raw)

const matches = (row, { type, status, q }) =>
  (type === 'all' || row.group === type) && (status === 'all' || row.status === status) && (!q || row.search.includes(q))

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

/* ────────────────────────────────────────────────
   SMALL UI PIECES
──────────────────────────────────────────────── */

function InlineError({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#F6465D]/10 px-3.5 py-3 text-sm text-red-200"
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
    </div>
  )
}

function StatusPill({ status, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[status].cls}`}
    >
      {status === 'pending' && (
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  )
}

function Chip({ active, onClick, icon: Icon, dot, label, count, layoutId, activeCls, reduce }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative inline-flex h-9 shrink-0 snap-start items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
        active
          ? activeCls.split(' ').filter((c) => c.startsWith('text-')).join(' ')
          : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white'
      }`}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className={`absolute inset-0 rounded-full ${activeCls.split(' ').filter((c) => c.startsWith('bg-')).join(' ')}`}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <span className="relative inline-flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-current' : dot}`} aria-hidden="true" />}
        {label}
        {typeof count === 'number' && (
          <span className={`font-mono text-[11px] ${active ? 'opacity-70' : 'text-slate-500'}`}>{count}</span>
        )}
      </span>
    </button>
  )
}

function ChipRow({ label, children }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <div className="-mx-3 sm:-mx-4">
        <div className="flex snap-x gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </div>
    </div>
  )
}

function SummaryTile({ label, dot, value, loading, className = '' }) {
  return (
    <div className={`min-w-0 rounded-2xl bg-[#14212D] px-3.5 py-3 ${className}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
        {label}
      </p>
      {loading ? (
        <div className="mt-1.5 h-6 w-24 animate-pulse rounded bg-white/10" aria-hidden="true" />
      ) : (
        <p className="mt-1 truncate text-base font-semibold tabular-nums text-white sm:text-lg">{value}</p>
      )}
    </div>
  )
}

function RowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5 sm:px-6" aria-hidden="true">
      <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-28 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-36 max-w-full animate-pulse rounded bg-white/[0.06]" />
      </div>
      <div className="space-y-2">
        <div className="ml-auto h-3.5 w-16 animate-pulse rounded bg-white/10" />
        <div className="ml-auto h-4 w-16 animate-pulse rounded-full bg-white/[0.06]" />
      </div>
    </li>
  )
}

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const onCopy = async () => {
    if (await copyText(text)) {
      setDone(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setDone(false), 1600)
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={done ? 'Copied' : label}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
    >
      {done ? (
        <Check className="h-3.5 w-3.5 text-[#3DDC97]" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  )
}

function Field({ label, value, mono = false, copy, full = false }) {
  return (
    <div className={`min-w-0 ${full ? 'sm:col-span-2' : ''}`}>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 flex items-start gap-2">
        <span
          className={`min-w-0 flex-1 text-sm font-medium text-white ${
            mono ? 'break-all font-mono text-[13px]' : 'break-words'
          }`}
        >
          {value}
        </span>
        {copy && <CopyButton text={copy} label={`Copy ${label.toLowerCase()}`} />}
      </dd>
    </div>
  )
}

/* ────────────────────────────────────────────────
   TRANSACTION ROW
──────────────────────────────────────────────── */

function Row({ row, index, hidden, reduce, onOpen }) {
  const Icon = row.meta.icon

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04, ease: 'easeOut' }}
    >
      <button
        type="button"
        onClick={() => onOpen(row)}
        aria-label={`${row.title}, ${row.statusLabel}. View details`}
        className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3DDC97]/70 sm:px-6"
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105 ${row.meta.chip}`}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{row.title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {shortDateTime(row.createdAt)}
            {row.sub && <span className="hidden sm:inline"> · {row.sub}</span>}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`text-sm font-semibold tabular-nums ${row.meta.text} ${row.status === 'failed' ? 'opacity-60' : ''}`}
          >
            {hidden ? MASK : `${row.dir > 0 ? '+' : '−'}${FMT.money(row.amount)}`}
          </p>
          <span className="mt-1 inline-block">
            <StatusPill status={row.status} label={row.statusLabel} />
          </span>
        </div>

        <ChevronRight
          className="hidden h-4 w-4 shrink-0 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-slate-300 sm:block"
          aria-hidden="true"
        />
      </button>
    </motion.li>
  )
}

/* ────────────────────────────────────────────────
   DETAIL MODAL (bottom sheet on mobile, dialog on desktop)
──────────────────────────────────────────────── */

function detailError(err) {
  const res = err?.response
  if (!res) return 'Network error. Check your connection and try again.'
  if (res.status === 404) return 'This record could not be found. It may have been removed.'
  if (res.status === 401) return 'Your session has expired. Please sign in again to continue.'
  return 'We could not refresh these details.'
}

function buildFields(row, raw, hidden) {
  const money = (v) => (hidden ? MASK : FMT.money(num(v)))
  const fields = []
  const add = (label, value, opts = {}) => {
    if (value === undefined || value === null || value === '') return
    fields.push({ label, value, ...opts })
  }

  if (row.source === 'deposit') {
    add('Reference', raw.reference, { mono: true, copy: raw.reference })
    add('Network', networkLabel(raw.network))
    add('Amount', money(raw.usd_amount))
    add('USDT amount', hidden ? MASK : tokenAmount(raw.usdt_amount))
    add('Rate', num(raw.rate).toLocaleString('en-US', { maximumFractionDigits: 6 }))
    add('Requested', fullDateTime(raw.created_at))
    add('Processed', fullDateTime(raw.processed_at))
    add('Deposit address', raw.deposit_address, { mono: true, copy: raw.deposit_address, full: true })
    add('Transaction hash', raw.tx_hash, { mono: true, copy: raw.tx_hash, full: true })
  } else if (row.source === 'withdrawal') {
    add('Reference', raw.reference, { mono: true, copy: raw.reference })
    add('Network', networkLabel(raw.network))
    add('Amount', money(raw.usd_amount))
    add('USDT amount', hidden ? MASK : tokenAmount(raw.usdt_amount))
    add('Rate', num(raw.rate).toLocaleString('en-US', { maximumFractionDigits: 6 }))
    add('Requested', fullDateTime(raw.created_at))
    add('Confirmed', fullDateTime(raw.confirmed_at))
    add('Processed', fullDateTime(raw.processed_at))
    if (raw.status === 'awaiting_otp') add('Code expires', fullDateTime(raw.expires_at))
    add('Destination address', raw.address, { mono: true, copy: raw.address, full: true })
    add('Transaction hash', raw.admin_tx_hash, { mono: true, copy: raw.admin_tx_hash, full: true })
  } else {
    const delta = num(raw.balance_delta)
    add('Type', row.title)
    add('Amount', money(raw.amount))
    add('Balance change', hidden ? MASK : FMT.signed(delta))
    if (num(raw.locked_delta) !== 0) add('Locked change', hidden ? MASK : FMT.signed(num(raw.locked_delta)))
    if (num(raw.pending_delta) !== 0) add('Pending change', hidden ? MASK : FMT.signed(num(raw.pending_delta)))
    add('Balance after', money(raw.balance_after))
    add('Date', fullDateTime(raw.created_at))
    add('Description', raw.description, { full: true })
    add('Reference', raw.reference, { mono: true, copy: raw.reference, full: true })
  }
  return fields
}

function buildNote(row, raw) {
  if (row.source === 'deposit') {
    if (row.status === 'failed') {
      return { tone: 'error', title: 'Reason', text: raw.decline_reason || `This deposit was ${row.statusLabel.toLowerCase()}.` }
    }
    if (row.status === 'pending') {
      return { tone: 'info', text: 'We are waiting for this deposit to be confirmed on the network.' }
    }
    return null
  }
  if (row.source === 'withdrawal') {
    if (row.status === 'failed') {
      return { tone: 'error', title: 'Reason', text: raw.failure_reason || `This withdrawal is ${row.statusLabel.toLowerCase()}.` }
    }
    if (raw.status === 'awaiting_otp') {
      return { tone: 'warn', text: 'This withdrawal is waiting for you to confirm it with your one-time code.' }
    }
    if (row.status === 'pending') {
      return { tone: 'info', text: 'Your withdrawal is being processed. The status updates once it is sent.' }
    }
    return null
  }
  if (row.kind === 'trade_lock') return { tone: 'info', text: 'These funds are locked while the trade is open.' }
  if (row.kind === 'withdrawal_reserve') return { tone: 'info', text: 'These funds are reserved while the withdrawal is processed.' }
  if (row.kind === 'withdrawal_release') return { tone: 'warn', text: 'The withdrawal did not go through and the funds were returned to your balance.' }
  return null
}

function DetailModal({ row, hidden, reduce, onClose, onPatched }) {
  const isRemote = row.source !== 'ledger'
  const [raw, setRaw] = useState(row.raw)
  const [tries, setTries] = useState(0)
  const [outcome, setOutcome] = useState(null) // { tries, error } once a request finishes

  const panelRef = useRef(null)
  const closeRef = useRef(null)

  // Loading and error are derived from which request has finished
  const loading = isRemote && outcome?.tries !== tries
  const error = loading ? '' : outcome?.error || ''

  const live = useMemo(() => rebuild(row.source, raw), [row.source, raw])
  const Icon = live.meta.icon
  const note = buildNote(live, raw)
  const noteTone = note ? NOTE_TONES[note.tone] : null
  const fields = buildFields(live, raw, hidden)

  // Refresh the record from its own endpoint so the status is current
  useEffect(() => {
    if (!isRemote) return undefined
    let alive = true
    api
      .get(`/api/wallet/${row.source === 'deposit' ? 'deposits' : 'withdrawals'}/${row.id}/`)
      .then((res) => {
        if (!alive) return
        const data = res.data?.data
        if (data) {
          setRaw(data)
          onPatched(row.source, data)
        }
        setOutcome({ tries, error: '' })
      })
      .catch((err) => {
        if (alive) setOutcome({ tries, error: detailError(err) })
      })
    return () => {
      alive = false
    }
  }, [isRemote, row.source, row.id, tries, onPatched])

  // Lock page scroll, close on Escape, keep focus inside, restore focus on close
  useEffect(() => {
    const previous = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll('button:not([disabled]), a[href]')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-detail-title"
        initial={reduce ? false : { opacity: 0, y: 56, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#14212D] shadow-2xl ring-1 ring-white/10 sm:max-w-lg sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${live.meta.chip}`}>
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="tx-detail-title" className="truncate text-base font-semibold text-white">
                {live.title} details
              </h2>
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                {loading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    Refreshing
                  </>
                ) : (
                  fullDateTime(live.createdAt)
                )}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5">
          <div className="rounded-xl bg-[#0E1822] px-4 py-4 text-center">
            <p
              className={`break-words text-3xl font-semibold tabular-nums tracking-tight ${live.meta.text} ${
                live.status === 'failed' ? 'opacity-60' : ''
              }`}
            >
              {hidden ? MASK : `${live.dir > 0 ? '+' : '−'}${FMT.money(live.amount)}`}
            </p>
            <div className="mt-2">
              <StatusPill status={live.status} label={live.statusLabel} />
            </div>
          </div>

          {error && <InlineError message={error} onRetry={() => setTries((t) => t + 1)} />}

          {note && (
            <div className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ${noteTone.box}`}>
              <noteTone.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${noteTone.icon}`} aria-hidden="true" />
              <p className="min-w-0 break-words">
                {note.title && <span className="font-semibold">{note.title}: </span>}
                {note.text}
              </p>
            </div>
          )}

          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {fields.map((f) => (
              <Field key={f.label} {...f} />
            ))}
          </dl>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
          <button type="button" onClick={onClose} className={`${ghostBtn} w-full`}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Transactions() {
  const reduce = useReducedMotion()

  const [hidden, setHidden] = useState(readHidden)
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [datesOpen, setDatesOpen] = useState(false)
  const [limit, setLimit] = useState({ sig: '', count: VISIBLE_STEP })
  const [selected, setSelected] = useState(null)

  const dateOrderBad = Boolean(dateFrom && dateTo && dateFrom > dateTo)

  const ledgerParams = useMemo(
    () => ({ ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) }),
    [dateFrom, dateTo],
  )

  const ledger = usePagedSource('/api/wallet/transactions/', ledgerParams, !dateOrderBad, 'your transactions')
  const deposits = usePagedSource('/api/wallet/deposits/', EMPTY_PARAMS, true, 'your deposits')
  const withdrawals = usePagedSource('/api/wallet/withdrawals/', EMPTY_PARAMS, true, 'your withdrawals')

  const sources = [ledger, deposits, withdrawals]
  const waiting = sources.some((s) => s.status === 'loading' && !s.loaded)
  const refreshing = sources.some((s) => s.status === 'loading')
  const allFailed = sources.every((s) => s.status === 'error' && !s.loaded)
  const truncated = sources.some((s) => s.truncated)

  const refreshAll = () => sources.forEach((s) => s.retry())

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

  // One list from three sources. Deposits and withdrawals come from their own endpoints
  // (so pending, declined and expired requests show up); their ledger twins are dropped
  // to avoid duplicates. If one of those endpoints fails, its ledger entries fill in.
  const rows = useMemo(() => {
    const inRange = (iso) => {
      if (!dateFrom && !dateTo) return true
      const k = localDateKey(new Date(iso))
      return (!dateFrom || k >= dateFrom) && (!dateTo || k <= dateTo)
    }

    const out = []
    ledger.items.forEach((e) => {
      if (e.entry_type === 'deposit' && deposits.loaded) return
      if (WITHDRAWAL_LEDGER.has(e.entry_type) && withdrawals.loaded) return
      out.push(fromLedger(e))
    })
    deposits.items.filter((d) => inRange(d.created_at)).forEach((d) => out.push(fromDeposit(d)))
    withdrawals.items.filter((w) => inRange(w.created_at)).forEach((w) => out.push(fromWithdrawal(w)))
    return out.sort((a, b) => b.ts - a.ts)
  }, [ledger.items, deposits.items, deposits.loaded, withdrawals.items, withdrawals.loaded, dateFrom, dateTo])

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => rows.filter((r) => matches(r, { type, status, q })), [rows, type, status, q])

  const typeCounts = useMemo(() => {
    const c = {}
    TYPE_FILTERS.forEach((t) => {
      c[t.value] = rows.filter((r) => matches(r, { type: t.value, status, q })).length
    })
    return c
  }, [rows, status, q])

  const statusCounts = useMemo(() => {
    const c = {}
    STATUS_FILTERS.forEach((s) => {
      c[s.value] = rows.filter((r) => matches(r, { type, status: s.value, q })).length
    })
    return c
  }, [rows, type, q])

  const totals = useMemo(() => {
    let deposited = 0
    let withdrawn = 0
    let pending = 0
    rows.forEach((r) => {
      if (r.status === 'pending') pending += 1
      if (r.status !== 'completed') return
      if (r.kind === 'deposit') deposited += r.amount
      if (r.kind === 'withdrawal') withdrawn += r.amount
    })
    return { deposited, withdrawn, pending }
  }, [rows])

  // Changing any filter starts the list over at the first page of rows
  const sig = `${type}|${status}|${q}|${dateFrom}|${dateTo}`
  const visible = limit.sig === sig ? limit.count : VISIBLE_STEP

  const shown = filtered.slice(0, visible)
  const remaining = filtered.length - shown.length

  const groups = useMemo(() => {
    const list = []
    shown.forEach((r) => {
      const label = dayLabel(r.createdAt)
      const last = list[list.length - 1]
      if (last && last.label === label) last.rows.push(r)
      else list.push({ label, rows: [r] })
    })
    return list
  }, [shown])

  const activeFilters = [type !== 'all', status !== 'all', Boolean(q), Boolean(dateFrom || dateTo)].filter(Boolean).length

  const clearAll = () => {
    setType('all')
    setStatus('all')
    setQuery('')
    setDateFrom('')
    setDateTo('')
  }

  const applyPreset = (days) => {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - (days - 1))
    setDateFrom(localDateKey(from))
    setDateTo(localDateKey(to))
  }

  const presetActive = (days) => {
    if (!dateFrom || !dateTo) return false
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - (days - 1))
    return dateFrom === localDateKey(from) && dateTo === localDateKey(to)
  }

  const patchDeposit = deposits.patch
  const patchWithdrawal = withdrawals.patch
  const handlePatched = useCallback(
    (source, data) => {
      if (source === 'deposit') patchDeposit(data)
      else if (source === 'withdrawal') patchWithdrawal(data)
    },
    [patchDeposit, patchWithdrawal],
  )

  const ledgerFields = ledger.error?.fields || {}
  const hasLedgerFieldErrors = Object.keys(ledgerFields).length > 0
  const dateFromError = dateOrderBad ? 'The start date must be before the end date.' : ledgerFields.date_from
  const dateToError = ledgerFields.date_to
  const today = localDateKey(new Date())

  const errorBanners = [
    ['ledger', ledger, hasLedgerFieldErrors],
    ['deposits', deposits, false],
    ['withdrawals', withdrawals, false],
  ].filter(([, s, skip]) => s.status === 'error' && s.error && !skip)

  return (
    <div>
      <motion.div
        className="mx-auto max-w-4xl space-y-5"
        variants={container}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-white sm:text-xl">Transactions</h1>
            <p className="mt-0.5 text-sm text-slate-400">Every deposit, withdrawal, trade and bonus in one place.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleHidden}
              aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
              aria-pressed={hidden}
              className={iconBtn}
            >
              {hidden ? <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" /> : <Eye className="h-[18px] w-[18px]" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              aria-label="Refresh transactions"
              className={iconBtn}
            >
              <RefreshCw className={`h-[18px] w-[18px] ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </motion.div>

        {/* Summary */}
        <motion.section variants={item} aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SummaryTile
            label="Deposited"
            dot="bg-[#3DDC97]"
            loading={waiting}
            value={hidden ? MASK : FMT.money(totals.deposited)}
          />
          <SummaryTile
            label="Withdrawn"
            dot="bg-sky-400"
            loading={waiting}
            value={hidden ? MASK : FMT.money(totals.withdrawn)}
          />
          <SummaryTile
            label="Pending"
            dot="bg-amber-400"
            loading={waiting}
            value={`${totals.pending} ${totals.pending === 1 ? 'transaction' : 'transactions'}`}
            className="col-span-2 sm:col-span-1"
          />
        </motion.section>

        {/* Filters */}
        <motion.section variants={item} aria-label="Filters" className="space-y-3.5 rounded-2xl bg-[#14212D] p-3 sm:p-4">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by reference, address or hash"
                aria-label="Search transactions"
                autoComplete="off"
                spellCheck={false}
                className={`${inputCls(false)} pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden`}
              />
              <AnimatePresence>
                {query && (
                  <motion.button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => setDatesOpen((o) => !o)}
              aria-expanded={datesOpen}
              aria-controls="tx-date-panel"
              className={`relative inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#0E1822] px-3.5 text-sm font-medium ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
                datesOpen || dateFrom || dateTo ? 'text-white ring-[#3DDC97]/50' : 'text-slate-300 ring-white/10 hover:text-white'
              }`}
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Dates</span>
              {(dateFrom || dateTo) && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#3DDC97] ring-2 ring-[#14212D]" aria-hidden="true" />
              )}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {datesOpen && (
              <motion.div
                id="tx-date-panel"
                key="dates"
                initial={reduce ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-3 rounded-xl bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESETS.map((p) => (
                      <button
                        key={p.days}
                        type="button"
                        onClick={() => applyPreset(p.days)}
                        aria-pressed={presetActive(p.days)}
                        className={`h-8 rounded-full px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
                          presetActive(p.days)
                            ? 'bg-[#3DDC97] text-[#06231A]'
                            : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] hover:text-white'
                        }`}
                      >
                        Last {p.label}
                      </button>
                    ))}
                    {(dateFrom || dateTo) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDateFrom('')
                          setDateTo('')
                        }}
                        className="h-8 rounded-full px-3 text-xs font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
                      >
                        Clear dates
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label htmlFor="tx-from" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        From
                      </label>
                      <input
                        id="tx-from"
                        type="date"
                        value={dateFrom}
                        max={dateTo || today}
                        onChange={(e) => setDateFrom(e.target.value)}
                        aria-invalid={dateFromError ? true : undefined}
                        style={{ colorScheme: 'dark' }}
                        className={inputCls(dateFromError)}
                      />
                      {dateFromError && (
                        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-red-300">
                          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-[#F6465D]" aria-hidden="true" />
                          <span className="min-w-0 break-words">{dateFromError}</span>
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="tx-to" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        To
                      </label>
                      <input
                        id="tx-to"
                        type="date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        max={today}
                        onChange={(e) => setDateTo(e.target.value)}
                        aria-invalid={dateToError ? true : undefined}
                        style={{ colorScheme: 'dark' }}
                        className={inputCls(dateToError)}
                      />
                      {dateToError && (
                        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-red-300">
                          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-[#F6465D]" aria-hidden="true" />
                          <span className="min-w-0 break-words">{dateToError}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ChipRow label="Type">
            {TYPE_FILTERS.map((t) => (
              <Chip
                key={t.value}
                icon={t.icon}
                label={t.label}
                count={waiting ? undefined : typeCounts[t.value]}
                active={type === t.value}
                onClick={() => setType(t.value)}
                layoutId="tx-type-pill"
                activeCls="bg-[#3DDC97] text-[#06231A]"
                reduce={reduce}
              />
            ))}
          </ChipRow>

          <ChipRow label="Status">
            {STATUS_FILTERS.map((s) => (
              <Chip
                key={s.value}
                dot={s.dot}
                label={s.label}
                count={waiting ? undefined : statusCounts[s.value]}
                active={status === s.value}
                onClick={() => setStatus(s.value)}
                layoutId="tx-status-pill"
                activeCls={s.active}
                reduce={reduce}
              />
            ))}
          </ChipRow>

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs">
            <p className="min-w-0 truncate text-slate-400" aria-live="polite">
              {waiting
                ? 'Loading your transactions…'
                : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`}
            </p>
            <AnimatePresence>
              {activeFilters > 0 && (
                <motion.button
                  type="button"
                  onClick={clearAll}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.15 }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-[#3DDC97] hover:text-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear {activeFilters} {activeFilters === 1 ? 'filter' : 'filters'}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* Source errors */}
        {errorBanners.length > 0 && (
          <motion.div variants={item} className="space-y-2">
            {errorBanners.map(([name, s]) => (
              <InlineError key={name} message={s.error.message} onRetry={s.retry} />
            ))}
          </motion.div>
        )}

        {/* List */}
        <motion.section variants={item} aria-label="Transaction list" aria-busy={waiting} className="overflow-hidden rounded-2xl bg-[#14212D]">
          {/* Slim progress bar while refetching */}
          <div className="h-0.5 overflow-hidden" aria-hidden="true">
            {refreshing && !waiting && !reduce && (
              <motion.div
                className="h-full w-1/3 rounded-full bg-[#3DDC97]"
                initial={{ x: '-100%' }}
                animate={{ x: '300%' }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>

          {waiting ? (
            <ul className="divide-y divide-white/[0.06]">
              {[0, 1, 2, 3, 4].map((i) => (
                <RowSkeleton key={i} />
              ))}
            </ul>
          ) : allFailed ? (
            <div className="px-4 py-10 text-center sm:px-6">
              <p className="text-sm font-medium text-white">We could not load your transactions</p>
              <p className="mt-1 text-sm text-slate-400">Check the messages above, then try again.</p>
              <button type="button" onClick={refreshAll} className={`${primaryBtn} mt-4`}>
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center sm:px-6">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-slate-400">
                <Inbox className="h-5 w-5" aria-hidden="true" />
              </span>
              {rows.length === 0 && activeFilters === 0 ? (
                <>
                  <p className="mt-3 text-sm font-medium text-white">No transactions yet</p>
                  <p className="mt-1 text-sm text-slate-400">Fund your wallet to get started.</p>
                  <Link to="/dashboard/deposit" className={`${primaryBtn} mt-4`}>
                    Make a deposit
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-medium text-white">No matching transactions</p>
                  <p className="mt-1 text-sm text-slate-400">Try a different filter or search term.</p>
                  <button type="button" onClick={clearAll} className={`${ghostBtn} mt-4 h-10`}>
                    Clear all filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <motion.div
              key={sig}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {groups.map((group, gi) => {
                const offset = groups.slice(0, gi).reduce((n, g) => n + g.rows.length, 0)
                return (
                  <div key={group.label}>
                    <div className="flex items-center justify-between gap-3 bg-white/[0.03] px-4 py-2 sm:px-6">
                      <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{group.label}</h3>
                      <span className="font-mono text-[11px] text-slate-500">{group.rows.length}</span>
                    </div>
                    <ul className="divide-y divide-white/[0.06]">
                      {group.rows.map((row, i) => (
                        <Row
                          key={row.key}
                          row={row}
                          index={(offset + i) % VISIBLE_STEP}
                          hidden={hidden}
                          reduce={reduce}
                          onOpen={setSelected}
                        />
                      ))}
                    </ul>
                  </div>
                )
              })}

              {(remaining > 0 || truncated) && (
                <div className="space-y-2 border-t border-white/[0.06] p-3 sm:p-4">
                  {remaining > 0 && (
                    <button
                      type="button"
                      onClick={() => setLimit({ sig, count: visible + VISIBLE_STEP })}
                      className={`${ghostBtn} w-full`}
                    >
                      Show more ({remaining} left)
                    </button>
                  )}
                  {truncated && (
                    <p className="text-center text-xs text-slate-500">
                      Showing your most recent records. Use the date filter to look further back.
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </motion.section>
      </motion.div>

      <AnimatePresence>
        {selected && (
          <DetailModal
            key={selected.key}
            row={selected}
            hidden={hidden}
            reduce={reduce}
            onClose={() => setSelected(null)}
            onPatched={handlePatched}
          />
        )}
      </AnimatePresence>
    </div>
  )
}