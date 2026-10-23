// src/pages/inside/Dashboard.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import MarqueeModule from 'react-fast-marquee'
import {
  AlertCircle,
  Download,
  Eye,
  EyeOff,
  Gift,
  RotateCcw,
  SlidersHorizontal,
  TrendingUp,
  Upload,
} from 'lucide-react'
import api from '../../components/Api'

const Marquee = MarqueeModule.default ?? MarqueeModule

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const HIDE_KEY = 'balanceHidden'
const MASK = '••••••'
const CHART_DAYS = 14

// Chart colours (the chart sits on a dark inset panel)
const UP = '#3DDC97'
const DOWN = '#F6465D'
const FLAT = '#2F4254'
const GRID = '#1E2E3D'
const AXIS = '#7F93A6'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

const ACTIONS = [
  { label: 'Deposit', to: '/dashboard/deposit', icon: Download, chip: 'bg-[#3DDC97] text-[#06231A]' },
  { label: 'Withdraw', to: '/dashboard/withdraw', icon: Upload, chip: 'bg-sky-400 text-[#06141F]' },
  { label: 'Trade', to: '/dashboard/trade', icon: TrendingUp, chip: 'bg-amber-400 text-[#2A1B00]' },
]

// SAMPLE DATA for the ticker (same as the Hero). Replace with a live price feed later.
const PAIRS = [
  { pair: 'BTC/USD', change: 1.24 },
  { pair: 'EUR/USD', change: -0.18 },
  { pair: 'ETH/USD', change: 2.07 },
  { pair: 'GBP/USD', change: 0.32 },
  { pair: 'USD/JPY', change: -0.41 },
  { pair: 'SOL/USD', change: 3.15 },
  { pair: 'XAU/USD', change: 0.56 },
  { pair: 'AUD/USD', change: -0.22 },
  { pair: 'XRP/USD', change: -1.08 },
  { pair: 'USD/CHF', change: 0.12 },
  { pair: 'BNB/USD', change: 0.87 },
  { pair: 'USD/CAD', change: -0.09 },
]

// The ledger has no status field, so status is derived from the entry type:
//   withdrawal_reserve → pending, withdrawal_release → failed (funds returned),
//   trade_lock → pending (funds locked in an open trade), everything else → completed.
// Deposits and bonuses only appear in the ledger once they are credited.
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

const OUT_TYPES = new Set(['withdrawal', 'withdrawal_reserve', 'trade_lock'])

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────── */

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function makeFormatters(currency) {
  let money
  let compact
  try {
    const full = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    const short = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    })
    money = (v) => full.format(v)
    compact = (v) => short.format(v)
  } catch {
    money = (v) => `$${num(v).toFixed(2)}`
    compact = (v) => `$${Math.round(num(v))}`
  }
  const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v))}`
  return { money, compact, signed }
}

function readHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

const shortDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const dateTime = (iso) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

// Direction of money for a ledger entry: 1 = in, -1 = out
function directionOf(entry) {
  const d = num(entry.balance_delta)
  if (d > 0) return 1
  if (d < 0) return -1
  return OUT_TYPES.has(entry.entry_type) ? -1 : 1
}

// One candle per day: open = balance at the start of the day, close = balance at the end.
// Green means the balance grew that day (inflow), red means it shrank (outflow).
function buildCandles(entries, currentBalance) {
  const sorted = [...entries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = []
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d)
  }
  const startMs = days[0].getTime()

  // Balance going into the first day of the window
  const before = sorted.filter((e) => new Date(e.created_at).getTime() < startMs)
  let carry
  if (before.length) {
    carry = num(before[before.length - 1].balance_after)
  } else {
    const first = sorted.find((e) => new Date(e.created_at).getTime() >= startMs)
    carry = first ? num(first.balance_after) - num(first.balance_delta) : num(currentBalance)
  }

  const byDay = new Map()
  sorted.forEach((e) => {
    const t = new Date(e.created_at)
    if (t.getTime() < startMs) return
    const key = dayKey(t)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(e)
  })

  return days.map((date) => {
    const group = byDay.get(dayKey(date))
    if (!group) {
      return { date, open: carry, close: carry, high: carry, low: carry, flat: true }
    }
    const open = carry
    const closes = group.map((e) => num(e.balance_after))
    const close = closes[closes.length - 1]
    const candle = {
      date,
      open,
      close,
      high: Math.max(open, ...closes),
      low: Math.min(open, ...closes),
      flat: false,
    }
    carry = close
    return candle
  })
}

const loadError = (err, what) =>
  err?.response ? `We could not load ${what}.` : 'Network error. Check your connection and try again.'

/* ────────────────────────────────────────────────
   LIVE CLOCK (its own small chip, monospace digits)
──────────────────────────────────────────────── */

function LiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <time dateTime={now.toISOString()} className="shrink-0 rounded-xl bg-[#0E1822] px-3 py-2 text-right">
      <span className="flex items-center justify-end gap-1.5 font-mono text-sm font-semibold tabular-nums text-white sm:text-base">
        <span className="h-1.5 w-1.5 rounded-full bg-[#3DDC97]" aria-hidden="true" />
        {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
      </span>
      <span className="mt-0.5 block text-[11px] text-slate-400 sm:text-xs">
        {now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
    </time>
  )
}

/* ────────────────────────────────────────────────
   CANDLESTICK CHART (SVG, sized to its container)
──────────────────────────────────────────────── */

function MovementChart({ candles, loading, hidden, fmt }) {
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [sel, setSel] = useState(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = candles.length
  const hasActivity = candles.some((c) => !c.flat)
  const activeIndex = sel !== null && sel < n ? sel : n - 1
  const active = candles[activeIndex]
  const change = active ? active.close - active.open : 0

  const compactView = width < 520
  const height = compactView ? 200 : 250
  const padL = 4
  const padR = compactView ? 46 : 58
  const padT = 10
  const padB = 24
  const plotW = Math.max(0, width - padL - padR)
  const plotH = height - padT - padB

  let geometry = null
  if (width > 0 && n > 0) {
    const rawLo = Math.min(...candles.map((c) => c.low))
    const rawHi = Math.max(...candles.map((c) => c.high))
    let lo = rawLo
    let hi = rawHi
    if (hi - lo <= 0) {
      const span = Math.max(Math.abs(hi) * 0.1, 1)
      lo -= span / 2
      hi += span / 2
    } else {
      const pad = (hi - lo) * 0.12
      lo -= pad
      hi += pad
    }
    if (rawLo >= 0) lo = Math.max(0, lo)

    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * plotH
    const slot = plotW / n
    const bodyW = Math.max(4, Math.min(18, slot * 0.5))
    const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3)
    geometry = { y, slot, bodyW, ticks }
  }

  const labelStep = compactView ? 4 : 2

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-sm font-semibold text-white">Account movement</p>
          <p className="text-xs text-slate-400">Last {CHART_DAYS} days</p>
        </div>
        {active && !loading && (
          <p className="text-right font-mono text-xs text-slate-400">
            <span className="font-medium text-slate-200">{shortDate(active.date)}</span>
            <span className="mx-1.5">·</span>
            {active.flat ? (
              'No activity'
            ) : (
              <span className="font-semibold tabular-nums" style={{ color: change >= 0 ? UP : DOWN }}>
                {hidden ? MASK : fmt.signed(change)}
              </span>
            )}
          </p>
        )}
      </div>

      <div ref={wrapRef} className="relative mt-3">
        {loading ? (
          <div className="animate-pulse rounded-xl bg-white/[0.06]" style={{ height }} aria-hidden="true" />
        ) : (
          geometry && (
            <>
              <svg
                width={width}
                height={height}
                role="img"
                aria-label={`Candlestick chart of account balance movement over the last ${CHART_DAYS} days`}
                className="block touch-pan-y select-none"
                onPointerLeave={(e) => {
                  if (e.pointerType === 'mouse') setSel(null)
                }}
              >
                {geometry.ticks.map((t) => (
                  <g key={t}>
                    <line
                      x1={padL}
                      x2={padL + plotW}
                      y1={geometry.y(t)}
                      y2={geometry.y(t)}
                      stroke={GRID}
                      strokeWidth="1"
                    />
                    <text
                      x={padL + plotW + 8}
                      y={geometry.y(t) + 4}
                      fontSize="10"
                      fill={AXIS}
                      fontFamily={MONO}
                    >
                      {hidden ? '•••' : fmt.compact(t)}
                    </text>
                  </g>
                ))}

                {hasActivity && (
                  <rect
                    x={padL + geometry.slot * activeIndex}
                    y={padT}
                    width={geometry.slot}
                    height={plotH}
                    rx="6"
                    fill="#FFFFFF"
                    opacity="0.05"
                  />
                )}

                {candles.map((c, i) => {
                  const cx = padL + geometry.slot * i + geometry.slot / 2
                  const color = c.flat ? FLAT : c.close >= c.open ? UP : DOWN
                  const top = geometry.y(Math.max(c.open, c.close))
                  const bottom = geometry.y(Math.min(c.open, c.close))
                  return (
                    <g key={c.date.getTime()}>
                      {hasActivity && (
                        <>
                          <line
                            x1={cx}
                            x2={cx}
                            y1={geometry.y(c.high)}
                            y2={geometry.y(c.low)}
                            stroke={color}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                          <rect
                            x={cx - geometry.bodyW / 2}
                            y={top}
                            width={geometry.bodyW}
                            height={Math.max(2, bottom - top)}
                            rx="1.5"
                            fill={color}
                          />
                        </>
                      )}
                      {i % labelStep === 0 && (
                        <text
                          x={cx}
                          y={height - 6}
                          fontSize="10"
                          textAnchor="middle"
                          fill={AXIS}
                          fontFamily={MONO}
                        >
                          {shortDate(c.date)}
                        </text>
                      )}
                      <rect
                        x={padL + geometry.slot * i}
                        y={0}
                        width={geometry.slot}
                        height={height}
                        fill="transparent"
                        onPointerEnter={() => setSel(i)}
                        onPointerDown={() => setSel(i)}
                      />
                    </g>
                  )
                })}
              </svg>

              {!hasActivity && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
                  <div>
                    <p className="text-sm font-semibold text-white">No activity yet</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Your balance movement will appear here after your first deposit.
                    </p>
                  </div>
                </div>
              )}
            </>
          )
        )}
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: UP }} aria-hidden="true" />
          Net inflow
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: DOWN }} aria-hidden="true" />
          Net outflow
        </span>
      </div>
    </div>
  )
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
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg px-2.5 py-1 text-xs font-semibold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
      >
        Try again
      </button>
    </div>
  )
}

function StatTile({ label, dot, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.04] px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  )
}

function TransactionRow({ entry, hidden, fmt }) {
  const meta = TYPES[entry.entry_type] || FALLBACK_TYPE
  const status = STATUS[meta.status]
  const Icon = meta.icon
  const dir = directionOf(entry)
  const amount = Math.abs(num(entry.amount))

  return (
    <li className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.chip}`}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{meta.label}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {dateTime(entry.created_at)}
          {entry.description && <span className="hidden sm:inline"> · {entry.description}</span>}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold tabular-nums ${meta.text}`}>
          {hidden ? MASK : `${dir > 0 ? '+' : '−'}${fmt.money(amount)}`}
        </p>
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${status.cls}`}>
          {status.label}
        </span>
      </div>
    </li>
  )
}

function TransactionSkeleton() {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5 sm:px-6" aria-hidden="true">
      <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-28 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-36 animate-pulse rounded bg-white/[0.06]" />
      </div>
      <div className="space-y-2">
        <div className="ml-auto h-3.5 w-16 animate-pulse rounded bg-white/10" />
        <div className="ml-auto h-4 w-16 animate-pulse rounded-full bg-white/[0.06]" />
      </div>
    </li>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Dashboard() {
  const reduce = useReducedMotion()

  const [hidden, setHidden] = useState(readHidden)

  const [wallet, setWallet] = useState(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletErr, setWalletErr] = useState('')

  const [entries, setEntries] = useState([])
  const [txLoading, setTxLoading] = useState(true)
  const [txErr, setTxErr] = useState('')

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true

    api
      .get('/api/wallet/')
      .then((res) => {
        if (alive) setWallet(res.data?.data ?? null)
      })
      .catch((err) => {
        if (alive) setWalletErr(loadError(err, 'your balance'))
      })
      .finally(() => {
        if (alive) setWalletLoading(false)
      })

    // One request feeds both the chart (up to 100 entries) and the latest three rows
    api
      .get('/api/wallet/transactions/', { params: { page_size: 100 } })
      .then((res) => {
        if (alive) setEntries(res.data?.data?.results ?? [])
      })
      .catch((err) => {
        if (alive) setTxErr(loadError(err, 'your transactions'))
      })
      .finally(() => {
        if (alive) setTxLoading(false)
      })

    return () => {
      alive = false
    }
  }, [attempt])

  const retry = () => {
    setWalletErr('')
    setTxErr('')
    setWalletLoading(true)
    setTxLoading(true)
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

  const currency = wallet?.currency || 'USD'
  const fmt = useMemo(() => makeFormatters(currency), [currency])
  const candles = useMemo(() => buildCandles(entries, wallet?.balance), [entries, wallet])
  const recent = entries.slice(0, 3)

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Balance, clock and movement chart ── */}
      <section aria-label="Account balance" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        {/* Balance panel + clock chip */}
        <div className="rounded-xl bg-[#1A2C3D] p-3.5 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-slate-300">Total balance</p>
                <button
                  type="button"
                  onClick={toggleHidden}
                  aria-label={hidden ? 'Show balance' : 'Hide balance'}
                  aria-pressed={hidden}
                  className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
                >
                  {hidden ? (
                    <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
                  )}
                </button>
              </div>

              {walletErr ? null : walletLoading && !wallet ? (
                <div className="mt-1 h-9 w-44 animate-pulse rounded bg-white/10" aria-hidden="true" />
              ) : (
                <p className="mt-0.5 break-words text-3xl font-semibold tabular-nums tracking-tight text-white sm:text-4xl">
                  {hidden ? MASK : fmt.money(num(wallet?.balance))}
                </p>
              )}
            </div>

            <LiveClock />
          </div>

          {walletErr ? (
            <div className="mt-3">
              <InlineError message={walletErr} onRetry={retry} />
            </div>
          ) : walletLoading && !wallet ? (
            <div className="mt-4 grid grid-cols-2 gap-2" aria-hidden="true">
              <div className="h-[52px] animate-pulse rounded-xl bg-white/[0.04]" />
              <div className="h-[52px] animate-pulse rounded-xl bg-white/[0.04]" />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <StatTile
                label="Available"
                dot="bg-[#3DDC97]"
                value={hidden ? MASK : fmt.money(num(wallet?.available_balance))}
              />
              <StatTile
                label="Locked"
                dot="bg-amber-400"
                value={hidden ? MASK : fmt.money(num(wallet?.locked_balance))}
              />
            </div>
          )}
        </div>

        {/* Chart panel (darker inset) */}
        <div className="mt-3 rounded-xl bg-[#0E1822] p-3.5 sm:p-5">
          {txErr ? (
            <InlineError message={txErr} onRetry={retry} />
          ) : (
            <MovementChart candles={candles} loading={txLoading} hidden={hidden} fmt={fmt} />
          )}
        </div>
      </section>

      {/* ── Quick actions ── */}
      <section aria-label="Quick actions">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {ACTIONS.map(({ label, to, icon: Icon, chip }) => (
            <Link
              key={label}
              to={to}
              className="flex flex-col items-center gap-2.5 rounded-2xl bg-[#14212D] px-2 py-4 text-sm font-medium text-white transition-colors hover:bg-[#1B2C3C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:flex-row sm:justify-center sm:gap-3 sm:py-5 sm:text-base"
            >
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${chip}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Recent transactions ── */}
      <section aria-labelledby="recent-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent-title" className="text-base font-semibold text-white">
            Recent transactions
          </h2>
          <Link
            to="/dashboard/transactions"
            className="rounded-lg px-2 py-1 text-sm font-medium text-[#3DDC97] transition-colors hover:text-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
          >
            See all
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl bg-[#14212D]">
          {txErr ? (
            <div className="p-4">
              <InlineError message={txErr} onRetry={retry} />
            </div>
          ) : txLoading ? (
            <ul className="divide-y divide-white/[0.06]">
              <TransactionSkeleton />
              <TransactionSkeleton />
              <TransactionSkeleton />
            </ul>
          ) : recent.length ? (
            <ul className="divide-y divide-white/[0.06]">
              {recent.map((entry) => (
                <TransactionRow key={entry.id} entry={entry} hidden={hidden} fmt={fmt} />
              ))}
            </ul>
          ) : (
            <div className="px-4 py-10 text-center sm:px-6">
              <p className="text-sm font-medium text-white">No transactions yet</p>
              <p className="mt-1 text-sm text-slate-400">Fund your wallet to get started.</p>
              <Link
                to="/dashboard/deposit"
                className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[#3DDC97] px-5 text-sm font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
              >
                Make a deposit
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Market ticker ── */}
      <section aria-labelledby="market-title">
        <h2 id="market-title" className="mb-3 text-base font-semibold text-white">
          Markets
        </h2>
        <div className="overflow-hidden rounded-2xl bg-[#14212D]">
          <Marquee speed={40} gradient={false} pauseOnHover play={!reduce} direction="left">
            {PAIRS.map(({ pair, change }) => {
              const up = change >= 0
              return (
                <div key={pair} className="flex items-center gap-2.5 px-5 py-3.5 text-sm sm:px-7">
                  <span className="font-semibold text-white">{pair}</span>
                  <span
                    className={`flex items-center gap-1 font-medium ${
                      up ? 'text-[#3DDC97]' : 'text-[#F6465D]'
                    }`}
                  >
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
                      {up ? <path d="M6 2l5 8H1z" /> : <path d="M6 10L1 2h10z" />}
                    </svg>
                    {Math.abs(change).toFixed(2)}%
                  </span>
                </div>
              )
            })}
          </Marquee>
        </div>
      </section>
    </div>
  )
}