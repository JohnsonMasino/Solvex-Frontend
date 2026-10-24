// src/pages/inside/TradeHistory.jsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle, ArrowLeft, ChevronDown, Clock, Loader2, SlidersHorizontal, TrendingDown, TrendingUp, X, Search, History,
} from 'lucide-react'
import api from '../../components/Api'

/* ───────────── CONFIG ───────────── */

const TRADE_ROUTE = '/dashboard/trade' // route of Trade.jsx, change if yours differs
const PAGE_SIZE = 20
const GREEN = '#3DDC97'
const RED = '#F6465D'
const EMPTY = { outcome: 'all', market: '', side: '', order: '-opened_at', from: '', to: '', pair: '' }

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }

const primaryBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-5 text-[13px] font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm'
const ghostBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-[13px] font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60 sm:text-sm'
const iconBtn =
  'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.08] text-slate-200 transition-colors hover:bg-white/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70'
const fieldCls =
  'w-full rounded-xl bg-[#0E1822] px-3.5 py-2.5 text-[14px] text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#3DDC97]/70'

/* ───────────── HELPERS ───────────── */

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const money = (v) => `$${Math.abs(num(v)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const sMoney = (v) => `${num(v) >= 0 ? '+' : '-'}${money(v)}`
const sPct = (v) => `${num(v) >= 0 ? '+' : '-'}${Math.abs(num(v)).toFixed(2)}%`
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '--')
const nice = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
const hms = (s) => {
  const t = Math.max(0, Math.floor(num(s)))
  return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const flatten = (v) => {
  if (v == null) return []
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(flatten)
  if (typeof v === 'object') return Object.values(v).flatMap(flatten)
  return [String(v)]
}
const tone = (t) => {
  if (t.status === 'open') return { c: '#38BDF8', label: 'Open' }
  if (t.outcome === 'profit') return { c: GREEN, label: 'Profit' }
  if (t.outcome === 'loss') return { c: RED, label: 'Loss' }
  return { c: '#94A3B8', label: nice(t.outcome) || 'Closed' }
}

function describeError(err, what) {
  const res = err?.response
  if (!res) return 'Network error. Check your connection and try again.'
  const { status, data } = res
  if (status === 400) return flatten(data?.errors)[0] || data?.message || 'One of the filters is not valid.'
  if (status === 401) return 'Your session has expired. Please sign in again to continue.'
  if (status === 404) return 'This trade could not be found.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.'
  return `We could not load ${what}.`
}

function buildParams(f) {
  const p = { ordering: f.order, page_size: f.outcome === 'profit' || f.outcome === 'loss' ? 100 : PAGE_SIZE }
  if (f.outcome === 'profit' || f.outcome === 'loss') p.status = 'closed'
  if (f.outcome === 'open') p.status = 'open'
  if (f.market) p.market_type = f.market
  if (f.side) p.side = f.side
  if (f.from) p.date_from = f.from
  if (f.to) p.date_to = f.to
  if (f.pair) p.pair = f.pair
  return p
}

/* ───────────── SMALL UI ───────────── */

function InlineError({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#F6465D]/10 px-3.5 py-3 text-[13px] text-red-200 sm:text-sm">
      <AlertCircle className="h-4 w-4 shrink-0 text-[#F6465D]" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="rounded-lg px-2.5 py-1 text-xs font-semibold hover:underline">Try again</button>}
    </div>
  )
}

function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-[#14212D] sm:rounded-3xl">
            <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
              <h2 className="text-base font-semibold text-white">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className={iconBtn}><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto px-4 pb-5 sm:px-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.04] px-3 py-2.5">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:text-[11px]">{label}</p>
      <p className="mt-0.5 truncate font-mono text-[15px] font-semibold tabular-nums sm:text-base" style={{ color: color || '#fff' }}>{value}</p>
    </div>
  )
}

function Summary({ s, error, onRetry }) {
  if (error) return <InlineError message={error} onRetry={onRetry} />
  if (!s) return <div className="h-40 animate-pulse rounded-2xl bg-[#14212D]" aria-hidden="true" />
  const wins = num(s.wins), losses = num(s.losses), closed = wins + losses
  const rate = closed ? (wins / closed) * 100 : 0
  const pnl = num(s.total_pnl)
  return (
    <section aria-label="Trading summary" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <div className="rounded-xl bg-[#1A2C3D] p-3.5 sm:p-5">
        <p className="text-[13px] font-medium text-slate-300 sm:text-sm">Total profit / loss</p>
        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums sm:text-4xl" style={{ color: pnl >= 0 ? GREEN : RED }}>{sMoney(pnl)}</p>
        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-slate-400 sm:text-xs"><span>Win rate</span><span className="font-mono text-slate-200">{rate.toFixed(0)}%</span></div>
          <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
            <motion.div className="h-full" style={{ background: GREEN }} initial={{ width: 0 }} animate={{ width: `${closed ? rate : 0}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
            <motion.div className="h-full" style={{ background: RED }} initial={{ width: 0 }} animate={{ width: `${closed ? 100 - rate : 0}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Trades" value={num(s.total_trades)} />
          <Stat label="Wins" value={wins} color={GREEN} />
          <Stat label="Losses" value={losses} color={RED} />
          <Stat label="Open" value={`${num(s.open_trades)}/${num(s.max_open_trades)}`} color="#38BDF8" />
        </div>
      </div>
    </section>
  )
}

function Row({ t, onOpen }) {
  const o = tone(t)
  const buy = t.side === 'buy'
  return (
    <li>
      <button type="button" onClick={() => onOpen(t)}
        className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: `${o.c}26`, color: o.c }} aria-hidden="true">
          {t.status === 'open' ? <Clock className="h-[18px] w-[18px]" /> : t.outcome === 'loss' ? <TrendingDown className="h-[18px] w-[18px]" /> : <TrendingUp className="h-[18px] w-[18px]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-semibold text-white sm:text-sm">
            {t.pair}
            <span className="font-mono text-[10px] font-bold" style={{ color: buy ? GREEN : RED }}>{buy ? 'LONG' : 'SHORT'} {t.leverage}x</span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-slate-400 sm:text-xs">{fmtDate(t.opened_at)} · {money(t.amount)}</span>
        </span>
        <span className="shrink-0 text-right">
          {t.status === 'open' ? (
            <span className="font-mono text-[13px] font-semibold text-sky-300">Open</span>
          ) : (
            <>
              <span className="block font-mono text-[13px] font-semibold tabular-nums sm:text-sm" style={{ color: o.c }}>{sMoney(t.pnl_amount)}</span>
              <span className="block font-mono text-[11px] tabular-nums text-slate-400">{sPct(t.pnl_pct)}</span>
            </>
          )}
        </span>
      </button>
    </li>
  )
}

function Detail({ base, id }) {
  const [res, setRes] = useState({ id: null })
  const [attempt, setAttempt] = useState(0)
  const key = `${id}:${attempt}`
  useEffect(() => {
    let live = true
    api.get(`/api/trades/${id}/`)
      .then((r) => live && setRes({ key, data: r.data?.data }))
      .catch((e) => live && setRes({ key, error: describeError(e, 'this trade') }))
    return () => { live = false }
  }, [id, key])
  const fresh = res.key === key
  const t = (fresh && res.data) || base
  const o = tone(t)
  const rows = [
    ['Reference', t.reference], ['Market', nice(t.market_type)], ['Direction', t.side === 'buy' ? 'Buy / Long' : 'Sell / Short'],
    ['Margin', money(t.amount)], ['Leverage', `${t.leverage}x`], ['Take profit', `${num(t.take_profit_pct) || '-'}%`],
    ['Stop loss', `${num(t.stop_loss_pct) || '-'}%`], ['Duration', `${t.duration_hours}h`], ['Opened', fmtDate(t.opened_at)],
    ['Scheduled close', fmtDate(t.scheduled_close_at)],
    ...(t.status === 'closed' ? [['Closed', fmtDate(t.closed_at)], ['Close reason', nice(t.close_reason)]] : [['Time remaining', hms(t.time_remaining_seconds)]]),
  ]
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#0E1822] p-4 text-center">
        <p className="text-base font-semibold text-white">{t.pair}</p>
        <span className="mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: `${o.c}26`, color: o.c }}>{o.label}</span>
        {t.status === 'closed' ? (
          <>
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums" style={{ color: o.c }}>{sMoney(t.pnl_amount)}</p>
            <p className="font-mono text-sm tabular-nums text-slate-400">{sPct(t.pnl_pct)}</p>
          </>
        ) : <p className="mt-3 text-[13px] text-slate-400">Result is shown once the trade closes.</p>}
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.min(100, num(t.progress_pct))}%`, background: o.c }} />
      </div>
      {fresh && res.error && <InlineError message={res.error} onRetry={() => setAttempt((a) => a + 1)} />}
      {!fresh && <p className="flex items-center justify-center gap-2 text-[11px] text-slate-500"><Loader2 className="h-3 w-3 animate-spin" />Refreshing details…</p>}
      <dl className="divide-y divide-white/[0.06] rounded-xl bg-white/[0.04] px-3.5 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2.5"><dt className="text-slate-400">{k}</dt><dd className="min-w-0 break-words text-right font-mono text-white">{v}</dd></div>
        ))}
      </dl>
    </div>
  )
}

function Chip({ on, onClick, children, count }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${on ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white'}`}>
      {children}{count != null && <span className={`font-mono text-[11px] ${on ? 'text-[#06231A]/70' : 'text-slate-500'}`}>{count}</span>}
    </button>
  )
}

function Seg({ label, value, onChange, options }) {
  return (
    <div>
      <p className="mb-1.5 px-0.5 text-[12px] font-semibold text-white">{label}</p>
      <div className="flex gap-1.5">
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
            className={`h-9 flex-1 rounded-lg text-xs font-medium ${value === v ? 'bg-[#3DDC97]/[0.08] text-white ring-2 ring-[#3DDC97]' : 'bg-white/[0.04] text-slate-300 ring-1 ring-white/10'}`}>{l}</button>
        ))}
      </div>
    </div>
  )
}

/* ───────────── PAGE ───────────── */

export default function TradeHistory() {
  const reduce = useReducedMotion()
  const [f, setF] = useState(EMPTY)
  const [pairInput, setPairInput] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [list, setList] = useState({ key: null })
  const [more, setMore] = useState({ busy: false, error: '' })
  const [summary, setSummary] = useState(null)
  const [sumErr, setSumErr] = useState('')
  const [sumAttempt, setSumAttempt] = useState(0)
  const [sel, setSel] = useState(null)

  const params = useMemo(() => buildParams(f), [f])
  const key = `${JSON.stringify(params)}#${attempt}`

  // debounce the pair search
  useEffect(() => {
    const v = pairInput.trim().toUpperCase()
    const id = setTimeout(() => setF((x) => (x.pair === v ? x : { ...x, pair: v })), 450)
    return () => clearTimeout(id)
  }, [pairInput])

  useEffect(() => {
    let live = true
    api.get('/api/trades/', { params })
      .then((r) => {
        if (!live) return
        const d = r.data?.data
        setList({ key, results: d?.results || [], count: num(d?.count), page: 1 })
        setMore({ busy: false, error: '' })
      })
      .catch((e) => live && setList({ key, error: describeError(e, 'your trades') }))
    return () => { live = false }
  }, [key, params])

  useEffect(() => {
    let live = true
    api.get('/api/trades/summary/')
      .then((r) => { if (live) { setSummary(r.data?.data ?? null); setSumErr('') } })
      .catch((e) => live && setSumErr(describeError(e, 'your summary')))
    return () => { live = false }
  }, [sumAttempt])

  const loading = list.key !== key
  const results = useMemo(() => (loading ? [] : list.results || []), [loading, list.results])
  const visible = useMemo(
    () => results.filter((t) => (f.outcome === 'profit' ? t.outcome === 'profit' : f.outcome === 'loss' ? t.outcome === 'loss' : true)),
    [results, f.outcome],
  )
  const hasMore = !loading && !list.error && results.length < num(list.count)

  const loadMore = () => {
    if (more.busy) return
    setMore({ busy: true, error: '' })
    api.get('/api/trades/', { params: { ...params, page: (list.page || 1) + 1 } })
      .then((r) => {
        const d = r.data?.data
        setList((l) => ({ ...l, results: [...(l.results || []), ...(d?.results || [])], page: (l.page || 1) + 1 }))
        setMore({ busy: false, error: '' })
      })
      .catch((e) => setMore({ busy: false, error: describeError(e, 'more trades') }))
  }

  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const reset = () => { setF(EMPTY); setPairInput('') }
  const active = [f.market, f.side, f.from, f.to, f.pair, f.order !== EMPTY.order ? 'x' : ''].filter(Boolean).length
  const dirty = active > 0 || f.outcome !== 'all'

  return (
    <div>
      <motion.div className="mx-auto max-w-3xl space-y-4 sm:space-y-5" variants={container} initial={reduce ? false : 'hidden'} animate="show">
        <motion.div variants={item} className="flex items-center gap-3">
          <Link to={TRADE_ROUTE} aria-label="Back to trading" className={`${ghostBtn} !h-10 gap-1.5 !px-3.5`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to Trade</Link>
          <h1 className="ml-auto flex items-center gap-2 text-[15px] font-semibold text-white sm:text-base"><History className="h-4 w-4 text-[#3DDC97]" aria-hidden="true" />Trade history</h1>
        </motion.div>

        <motion.div variants={item}><Summary s={summary} error={sumErr} onRetry={() => { setSumErr(''); setSumAttempt((a) => a + 1) }} /></motion.div>

        <motion.section variants={item} aria-label="Trades" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <div className="-mx-0.5 flex min-w-0 flex-1 gap-2 overflow-x-auto px-0.5 pb-1" role="group" aria-label="Filter by result">
              <Chip on={f.outcome === 'all'} onClick={() => set({ outcome: 'all' })} count={summary ? num(summary.total_trades) : null}>All</Chip>
              <Chip on={f.outcome === 'profit'} onClick={() => set({ outcome: 'profit' })} count={summary ? num(summary.wins) : null}>Profit</Chip>
              <Chip on={f.outcome === 'loss'} onClick={() => set({ outcome: 'loss' })} count={summary ? num(summary.losses) : null}>Loss</Chip>
              <Chip on={f.outcome === 'open'} onClick={() => set({ outcome: 'open' })} count={summary ? num(summary.open_trades) : null}>Open</Chip>
            </div>
            <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-label="More filters" className={`${iconBtn} relative`}>
              <SlidersHorizontal className="h-4 w-4" />
              {active > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#3DDC97] px-1 text-[10px] font-bold text-[#06231A]">{active}</span>}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <div className="mt-3 space-y-3 rounded-xl bg-white/[0.03] p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                    <input value={pairInput} onChange={(e) => setPairInput(e.target.value)} placeholder="Pair, e.g. BTC/USDT" aria-label="Filter by pair" autoCapitalize="characters" spellCheck={false} className={`${fieldCls} pl-10`} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Seg label="Market" value={f.market} onChange={(v) => set({ market: v })} options={[['', 'All'], ['crypto', 'Crypto'], ['forex', 'Forex']]} />
                    <Seg label="Direction" value={f.side} onChange={(v) => set({ side: v })} options={[['', 'All'], ['buy', 'Buy'], ['sell', 'Sell']]} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="mb-1.5 block px-0.5 text-[12px] font-semibold text-white">From</label><input type="date" value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} style={{ colorScheme: 'dark' }} className={fieldCls} /></div>
                    <div><label className="mb-1.5 block px-0.5 text-[12px] font-semibold text-white">To</label><input type="date" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} style={{ colorScheme: 'dark' }} className={fieldCls} /></div>
                  </div>
                  <Seg label="Sort by" value={f.order} onChange={(v) => set({ order: v })} options={[['-opened_at', 'Newest first'], ['opened_at', 'Oldest first']]} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {dirty && (
            <div className="mt-2 flex items-center justify-between px-0.5 text-[11px] text-slate-400">
              <span>{loading ? 'Loading…' : `${visible.length} shown${f.outcome === 'profit' || f.outcome === 'loss' ? '' : ` of ${num(list.count)}`}`}</span>
              <button type="button" onClick={reset} className="font-semibold text-[#3DDC97] hover:underline">Clear filters</button>
            </div>
          )}

          <div className="mt-3" aria-live="polite">
            {list.key === key && list.error && <InlineError message={list.error} onRetry={() => setAttempt((a) => a + 1)} />}
            {loading && <div className="space-y-2" aria-hidden="true">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[66px] animate-pulse rounded-xl bg-white/[0.04]" />)}</div>}
            {!loading && !list.error && visible.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.06] text-slate-400"><History className="h-5 w-5" /></span>
                <p className="text-sm font-medium text-white">{dirty ? 'No trades match these filters' : 'No trades yet'}</p>
                <p className="text-[12px] text-slate-400">{dirty ? 'Try a different filter or clear them.' : 'Your closed and open trades will appear here.'}</p>
                {dirty ? <button type="button" onClick={reset} className={`${ghostBtn} mt-2`}>Clear filters</button> : <Link to={TRADE_ROUTE} className={`${primaryBtn} mt-2`}>Enter a trade</Link>}
              </div>
            )}
            {!loading && visible.length > 0 && (
              <ul className="space-y-2">
                {visible.map((t) => <Row key={t.id} t={t} onOpen={setSel} />)}
              </ul>
            )}
            {more.error && <div className="mt-3"><InlineError message={more.error} /></div>}
            {hasMore && (
              <button type="button" onClick={loadMore} disabled={more.busy} className={`${ghostBtn} mt-3 w-full`}>
                {more.busy ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading…</> : <>Load more<ChevronDown className="h-4 w-4" aria-hidden="true" /></>}
              </button>
            )}
            {(f.outcome === 'profit' || f.outcome === 'loss') && !loading && hasMore && visible.length < 3 && (
              <p className="mt-2 text-center text-[11px] text-slate-500">More closed trades are available. Load more to find additional {f.outcome}s.</p>
            )}
          </div>
        </motion.section>
      </motion.div>

      <Sheet open={Boolean(sel)} onClose={() => setSel(null)} title="Trade details">
        {sel && <Detail key={sel.id} base={sel} id={sel.id} />}
      </Sheet>
    </div>
  )
}