// src/pages/inside/Trade.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import {
  AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Clock, ExternalLink, History, Lightbulb, Loader2, Newspaper, Plus,
  RefreshCw, Search, Share2, TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react'
import api from '../../components/Api'

/* ───────────── CONFIG ───────────── */

const HISTORY_ROUTE = '/dashboard/trade-history'
const DASHBOARD_ROUTE = '/dashboard'
const TV_SRC = 'https://s3.tradingview.com/tv.js'
// Set to false if your backend CORS config does not yet allow the Idempotency-Key header
const SEND_IDEMPOTENCY_KEY = true
// How often the active trades list is refreshed (settled trades leave the list once staff settle them)
const ACTIVE_POLL_MS = 15000
// Public RSS feeds. Each one is tried through rss2json first, then through a CORS proxy (no API keys).
const NEWS_FEEDS = [
  ['Cointelegraph', 'https://cointelegraph.com/rss'],
  ['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'],
  ['FXStreet', 'https://www.fxstreet.com/rss/news'],
  ['ForexLive', 'https://www.forexlive.com/feed/news'],
]
const FX_URL = 'https://open.er-api.com/v6/latest/USD'
const GREEN = '#3DDC97'
const RED = '#F6465D'
const AMBER = '#FBBF24'

const CRYPTO = ('BTC ETH BNB SOL XRP ADA DOGE TRX TON AVAX LINK DOT MATIC SHIB LTC BCH ATOM UNI XLM ETC FIL APT ARB OP NEAR ' +
  'ICP HBAR VET INJ SUI SEI AAVE MKR RUNE ALGO FTM SAND MANA AXS GRT PEPE WIF FET RNDR STX IMX TIA').split(' ')
  .map((b) => ({ pair: `${b}/USDT`, name: b, type: 'crypto', tv: `BINANCE:${b}USDT`, bn: `${b}USDT` }))
const FOREX = ('EUR/USD GBP/USD USD/JPY USD/CHF AUD/USD USD/CAD NZD/USD EUR/GBP EUR/JPY EUR/CHF EUR/AUD EUR/CAD EUR/NZD GBP/JPY GBP/CHF ' +
  'GBP/AUD GBP/CAD GBP/NZD AUD/JPY AUD/CAD AUD/CHF AUD/NZD CAD/JPY CAD/CHF CHF/JPY NZD/JPY NZD/CAD NZD/CHF USD/SGD USD/HKD USD/ZAR ' +
  'USD/MXN USD/TRY USD/NOK USD/SEK USD/PLN USD/CNH').split(' ')
  .map((p) => ({ pair: p, name: p, type: 'forex', tv: `FX:${p.replace('/', '')}` }))
const PAIRS = [...CRYPTO, ...FOREX]
const BY_PAIR = Object.fromEntries(PAIRS.map((p) => [p.pair, p]))

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }

const primaryBtn =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-5 text-[13px] font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm'
const ghostBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-[13px] font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60 sm:text-sm'
const iconBtn =
  'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.08] text-slate-200 transition-colors hover:bg-white/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70'
const fieldCls =
  'w-full rounded-xl bg-[#0E1822] px-3.5 py-3 font-mono text-[15px] text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#3DDC97]/70'

const WEEKEND_MSG = 'Trading is closed for the weekend. You can open new trades again from Monday. Your open trades stay open until they are settled.'

/* ───────────── HELPERS ───────────── */

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const money = (v) => `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signed = (v, d = 2) => `${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(d)}`
const fmtPrice = (p) => {
  if (!p) return '--'
  const d = p >= 1000 ? 2 : p >= 1 ? 4 : p >= 0.01 ? 5 : 8
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: d })
}
const hms = (s) => {
  const t = Math.max(0, Math.floor(s))
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`
}
const flatten = (v) => {
  if (v == null) return []
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(flatten)
  if (typeof v === 'object') return Object.values(v).flatMap(flatten)
  return [String(v)]
}
const cleanDec = (raw, dec = 2) => {
  let v = String(raw).replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const i = v.indexOf('.')
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '').slice(0, dec)
  return v.replace(/^0+(?=\d)/, '').slice(0, 12)
}
const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
const ago = (ts) => {
  const m = Math.max(1, Math.floor((Date.now() / 1000 - ts) / 60))
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`
}

// Entry price is not returned by the API, so we remember the market price at the moment of entry.
const entryKey = (id) => `tradeEntry:${id}`
const getEntry = (id) => { try { return num(localStorage.getItem(entryKey(id))) } catch { return 0 } }
const setEntry = (id, p) => { try { if (p) localStorage.setItem(entryKey(id), String(p)) } catch { /* ignore */ } }

function describeError(err, fallback) {
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.' }
  const { status, data } = res
  const msg = typeof data?.message === 'string' ? data.message : ''
  if (status === 400) {
    const first = flatten(data?.errors)[0]
    return { message: first || msg || 'Please check the trade details and try again.', insufficient: data?.code === 'insufficient_funds' }
  }
  if (status === 401) return { message: 'Your session has expired. Please sign in again to continue.' }
  if (status === 403) {
    if (data?.code === 'kyc_required') return { message: msg || 'Complete identity verification (KYC) before trading.', action: { to: '/dashboard/kyc', label: 'Verify identity' } }
    if (data?.code === 'trade_limit_reached') return { message: msg || 'You reached your open trade limit.', action: { to: '/dashboard/deposit', label: 'Top up balance' } }
    if (data?.code === 'market_closed') return { message: WEEKEND_MSG }
    return { message: msg || 'Trading is not available right now.' }
  }
  if (status === 429) return { message: 'Too many requests. Please wait a moment and try again.' }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.' }
  return { message: msg || fallback }
}

/* ───────────── LIVE PRICES ───────────── */

let fxCache = { at: 0, rates: null }
async function fxRates() {
  if (fxCache.rates && Date.now() - fxCache.at < 60000) return fxCache.rates
  const r = await fetch(FX_URL)
  const j = await r.json()
  fxCache = { at: Date.now(), rates: j.rates }
  return j.rates
}

async function fetchPrice(p) {
  const meta = BY_PAIR[p]
  if (!meta) return null
  if (meta.type === 'crypto') {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${meta.bn}`)
    const j = await r.json()
    return { price: num(j.lastPrice), change: num(j.priceChangePercent), high: num(j.highPrice), low: num(j.lowPrice), vol: num(j.quoteVolume) }
  }
  const [b, q] = p.split('/')
  const rates = await fxRates()
  const price = (b === 'USD' ? 1 : 1 / rates[b]) * (q === 'USD' ? 1 : rates[q])
  return { price, change: null }
}

function useLivePrices(pairs, every = 5000) {
  const [map, setMap] = useState({})
  const key = [...new Set(pairs)].sort().join(',')
  useEffect(() => {
    if (!key) return undefined
    let live = true
    const run = async () => {
      const list = key.split(',')
      const res = await Promise.all(list.map((p) => fetchPrice(p).catch(() => null)))
      if (live) setMap((m) => { const n = { ...m }; list.forEach((p, i) => { if (res[i]) n[p] = res[i] }); return n })
    }
    run()
    const id = setInterval(run, every)
    return () => { live = false; clearInterval(id) }
  }, [key, every])
  return map
}

/* ───────────── SMALL UI ───────────── */

function InlineError({ message, onRetry, action }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#F6465D]/10 px-3.5 py-3 text-[13px] text-red-200 sm:text-sm">
      <AlertCircle className="h-4 w-4 shrink-0 text-[#F6465D]" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="rounded-lg px-2.5 py-1 text-xs font-semibold hover:underline">Try again</button>}
      {action && <Link to={action.to} className="rounded-lg px-2.5 py-1 text-xs font-semibold underline underline-offset-2">{action.label}</Link>}
    </div>
  )
}

function AnimNum({ value, fmt }) {
  const ref = useRef(null)
  const mv = useMotionValue(value)
  useEffect(() => { const c = animate(mv, value, { duration: 0.6, ease: 'easeOut' }); return () => c.stop() }, [value, mv])
  useEffect(() => mv.on('change', (v) => { if (ref.current) ref.current.textContent = fmt(v) }), [mv, fmt])
  return <span ref={ref}>{fmt(value)}</span>
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
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-[#14212D] sm:rounded-3xl"
          >
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

function PairList({ value, onPick }) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const list = useMemo(() => {
    const s = q.trim().toUpperCase().replace('/', '')
    return PAIRS.filter((p) => (tab === 'all' || p.type === tab) && p.pair.replace('/', '').includes(s))
  }, [q, tab])
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search BTC, EUR/USD…" aria-label="Search pairs" autoFocus className={`${fieldCls} pl-10`} />
      </div>
      <div className="mt-3 flex gap-2" role="tablist">
        {['all', 'crypto', 'forex'].map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`h-9 rounded-full px-4 text-xs font-medium capitalize transition-colors ${tab === t ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09]'}`}>{t}</button>
        ))}
      </div>
      <ul className="mt-3 max-h-[52dvh] space-y-1.5 overflow-y-auto pr-1">
        {list.length === 0 && <li className="py-8 text-center text-sm text-slate-400">No pairs match “{q}”.</li>}
        {list.map((p) => (
          <li key={p.pair}>
            <button type="button" onClick={() => onPick(p.pair)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${value === p.pair ? 'bg-[#3DDC97]/[0.08] ring-2 ring-[#3DDC97]' : 'bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07]'}`}>
              <span className={`grid h-9 w-9 place-items-center rounded-lg font-mono text-[10px] font-bold ${p.type === 'crypto' ? 'bg-amber-400/[0.15] text-amber-300' : 'bg-sky-400/[0.15] text-sky-300'}`}>{p.name.slice(0, 3)}</span>
              <span className="min-w-0 flex-1 text-sm font-medium text-white">{p.pair}</span>
              <span className="text-[11px] capitalize text-slate-400">{p.type}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ───────────── HERO: TRADINGVIEW ───────────── */

let tvPromise
const loadTV = () => {
  if (window.TradingView) return Promise.resolve()
  if (!tvPromise) {
    tvPromise = new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = TV_SRC; s.async = true; s.onload = res
      s.onerror = () => { tvPromise = null; rej(new Error('tv')) }
      document.head.appendChild(s)
    })
  }
  return tvPromise
}

function TVChart({ symbol }) {
  const host = useRef(null)
  const [state, setState] = useState('loading')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    loadTV().then(() => {
      if (!live || !host.current) return
      host.current.innerHTML = '<div id="tv_chart_host" style="height:100%;width:100%"></div>'
      // eslint-disable-next-line no-new
      new window.TradingView.widget({
        container_id: 'tv_chart_host', symbol, interval: '60', timezone: 'Etc/UTC', theme: 'dark', style: '1', locale: 'en',
        autosize: true, allow_symbol_change: false, hide_side_toolbar: false, withdateranges: true, details: false,
        save_image: false, enable_publishing: false, backgroundColor: '#0E1822', toolbar_bg: '#14212D',
        studies: ['RSI@tv-basicstudies'], hide_volume: false,
      })
      setState('ready')
    }).catch(() => live && setState('error'))
    return () => { live = false }
  }, [symbol, tick])
  return (
    <div className="relative h-[380px] w-full overflow-hidden rounded-xl bg-[#0E1822] sm:h-[480px] lg:h-[560px]">
      <div ref={host} className="h-full w-full" />
      {state === 'loading' && <div className="absolute inset-0 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#3DDC97]" aria-label="Loading chart" /></div>}
      {state === 'error' && <div className="absolute inset-0 grid place-items-center p-4"><InlineError message="The chart could not be loaded." onRetry={() => { setState('loading'); setTick((t) => t + 1) }} /></div>}
    </div>
  )
}

function Hero({ pair, onOpenPicker, tick, refreshKey }) {
  const meta = BY_PAIR[pair]
  const price = tick?.price
  const up = (tick?.change ?? 0) >= 0
  const [prev, setPrev] = useState(price)
  const [flash, setFlash] = useState(null)
  if (price !== prev) {
    setPrev(price)
    setFlash(price && prev ? (price > prev ? 'up' : 'down') : null)
  }
  return (
    <section aria-label="Market" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
        <button type="button" onClick={onOpenPicker} aria-label="Change trading pair"
          className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 transition-colors hover:bg-white/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70">
          <span className={`grid h-8 w-8 place-items-center rounded-lg font-mono text-[10px] font-bold ${meta.type === 'crypto' ? 'bg-amber-400/[0.15] text-amber-300' : 'bg-sky-400/[0.15] text-sky-300'}`}>{meta.name.slice(0, 3)}</span>
          <span className="text-base font-semibold text-white sm:text-lg">{pair}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </button>
        <div className="text-right">
          <motion.p key={price} animate={{ color: flash === 'up' ? GREEN : flash === 'down' ? RED : '#ffffff' }} transition={{ duration: 0.8 }}
            className="font-mono text-xl font-semibold tabular-nums sm:text-2xl">{fmtPrice(price)}</motion.p>
          {tick?.change != null && (
            <p className={`flex items-center justify-end gap-1 font-mono text-xs font-medium ${up ? 'text-[#3DDC97]' : 'text-[#F6465D]'}`}>
              {up ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
              {signed(tick.change)}% <span className="text-slate-500">24h</span>
            </p>
          )}
        </div>
      </div>
      {tick?.high ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[['24h high', fmtPrice(tick.high)], ['24h low', fmtPrice(tick.low)], ['Volume', `${(tick.vol / 1e6).toFixed(1)}M`]].map(([k, v]) => (
            <div key={k} className="min-w-0 rounded-xl bg-white/[0.04] px-2 py-2">
              <dt className="truncate text-[10px] text-slate-400 sm:text-[11px]">{k}</dt>
              <dd className="truncate font-mono text-[12px] font-semibold tabular-nums text-white sm:text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-3"><TVChart key={`${meta.tv}:${refreshKey}`} symbol={meta.tv} /></div>
      <p className="mt-2 px-0.5 text-[11px] text-slate-500">Use the toolbar on the chart to draw, add indicators and analyse before you trade.</p>
    </section>
  )
}

/* ───────────── TRADE FORM ───────────── */

function TradeForm({ cfg, summary, initialPair, onClose, onOpened }) {
  const maxLev = num(cfg?.max_leverage) || 100
  const durations = cfg?.durations_hours?.length ? cfg.durations_hours : [6, 12, 24]
  const minAmt = num(cfg?.min_amount) || 10
  const [pair, setPair] = useState(initialPair)
  const [pick, setPick] = useState(false)
  const [side, setSide] = useState('buy')
  const [amount, setAmount] = useState('')
  const [lev, setLev] = useState(Math.min(10, maxLev))
  const [tp, setTp] = useState('')
  const [sl, setSl] = useState('')
  const [dur, setDur] = useState(durations[0])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const keyRef = useRef(uuid())
  const avail = num(summary?.available_balance)
  const amt = num(amount)
  const bad = amt < minAmt ? `Minimum amount is ${money(minAmt)}.` : summary && amt > avail ? `More than your available ${money(avail)}.` : ''
  // The backend blocks ALL new trades (crypto and forex) at the weekend.
  const marketClosed = cfg?.market_open === false

  const submit = async (e) => {
    e.preventDefault()
    if (busy || bad || marketClosed) return
    setBusy(true); setErr(null)
    try {
      const body = { pair, side, amount: amt.toFixed(2), leverage: lev, duration_hours: dur }
      if (num(tp) > 0) body.take_profit_pct = num(tp).toFixed(2)
      if (num(sl) > 0) body.stop_loss_pct = num(sl).toFixed(2)
      const snap = await fetchPrice(pair).catch(() => null)
      const res = await api.post('/api/trades/', body, SEND_IDEMPOTENCY_KEY ? { headers: { 'Idempotency-Key': keyRef.current } } : undefined)
      const d = res.data?.data
      if (!d?.id) { setErr({ message: 'We could not read your trade details. Check your active trades.' }); return }
      if (snap?.price) setEntry(d.id, snap.price)
      onOpened(d)
    } catch (ex) {
      setErr(describeError(ex, 'We could not open your trade. Please try again.'))
      if (ex?.response?.status === 400) keyRef.current = uuid() // new key after a validation failure
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <button type="button" onClick={() => setPick(true)} className="flex w-full items-center justify-between rounded-xl bg-[#0E1822] px-3.5 py-3 ring-1 ring-white/10 hover:ring-white/25">
        <span><span className="block text-[11px] text-slate-400">Pair</span><span className="text-base font-semibold text-white">{pair}</span></span>
        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </button>
      <Sheet open={pick} onClose={() => setPick(false)} title="Select pair"><PairList value={pair} onPick={(p) => { setPair(p); setPick(false) }} /></Sheet>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Direction">
        {[['buy', 'Buy / Long', GREEN], ['sell', 'Sell / Short', RED]].map(([k, label, c]) => (
          <button key={k} type="button" role="radio" aria-checked={side === k} onClick={() => setSide(k)}
            className="h-12 rounded-xl text-sm font-semibold transition-colors" style={side === k ? { background: c, color: '#06140E' } : { background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>{label}</button>
        ))}
      </div>

      <div>
        <label htmlFor="t-amt" className="mb-1.5 flex justify-between px-0.5 text-[13px] font-semibold text-white">
          <span>Amount (margin)</span><span className="font-normal text-slate-400">Available {money(avail)}</span>
        </label>
        <div className="flex items-center gap-2">
          <input id="t-amt" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(e) => setAmount(cleanDec(e.target.value))} className={fieldCls} aria-invalid={Boolean(bad && amount)} />
          <button type="button" onClick={() => setAmount(String(Math.floor(avail * 100) / 100))} className="h-12 shrink-0 rounded-xl bg-[#3DDC97]/[0.15] px-3 font-mono text-xs font-bold text-[#3DDC97]">MAX</button>
        </div>
        {amount && bad && <p className="mt-1.5 px-0.5 text-[12px] text-red-300">{bad}</p>}
      </div>

      <div>
        <label htmlFor="t-lev" className="mb-1.5 flex justify-between px-0.5 text-[13px] font-semibold text-white">
          <span>Leverage</span><span className="font-mono text-[#3DDC97]">{lev}x</span>
        </label>
        <input id="t-lev" type="range" min="1" max={maxLev} value={lev} onChange={(e) => setLev(Number(e.target.value))} className="w-full accent-[#3DDC97]" />
        <div className="flex flex-wrap gap-2 pt-1">
          {[1, 5, 10, 25, 50, 100].filter((x) => x <= maxLev).map((x) => (
            <button key={x} type="button" onClick={() => setLev(x)} className={`h-8 rounded-full px-3 font-mono text-xs ${lev === x ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-white/[0.05] text-slate-300'}`}>{x}x</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[['Take profit %', tp, setTp, '5'], ['Stop loss %', sl, setSl, '2']].map(([l, v, set, ph]) => (
          <div key={l}>
            <label className="mb-1.5 block px-0.5 text-[13px] font-semibold text-white">{l}</label>
            <input inputMode="decimal" placeholder={ph} value={v} onChange={(e) => set(cleanDec(e.target.value))} className={fieldCls} />
          </div>
        ))}
      </div>

      <div>
        <p className="mb-1.5 px-0.5 text-[13px] font-semibold text-white">Duration</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Duration">
          {durations.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={dur === h} onClick={() => setDur(h)}
              className={`h-11 rounded-xl text-sm font-medium ${dur === h ? 'bg-[#3DDC97]/[0.08] text-white ring-2 ring-[#3DDC97]' : 'bg-white/[0.04] text-slate-300 ring-1 ring-white/10'}`}>{h}h</button>
          ))}
        </div>
      </div>

      <dl className="space-y-2 rounded-xl bg-white/[0.04] p-3.5 text-[13px]">
        <div className="flex justify-between"><dt className="text-slate-400">Position size</dt><dd className="font-mono text-white">{money(amt * lev)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-400">Margin locked</dt><dd className="font-mono text-white">{money(amt)}</dd></div>
      </dl>
      <p className="px-0.5 text-[11px] text-slate-500">TP/SL and leverage are informational. Your result is confirmed shortly after the trade duration ends, and your margin stays locked until then.</p>

      {marketClosed && <InlineError message={WEEKEND_MSG} />}
      {err && <InlineError message={err.message} action={err.action} />}

      <div className="flex gap-2.5">
        <button type="button" onClick={onClose} className={`${ghostBtn} flex-1`}>Cancel</button>
        <button type="submit" disabled={busy || Boolean(bad) || !amount || marketClosed} className={`${primaryBtn} flex-[2]`}>
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Opening…</> : `Open ${side === 'buy' ? 'long' : 'short'}`}
        </button>
      </div>
    </form>
  )
}

/* ───────────── SHARE IMAGE ───────────── */

function drawShare(t, m) {
  const W = 1080, H = 1350
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')
  const win = m.pnlPct >= 0
  const p = Math.tanh(m.pnlPct / 25) // -1..1, saturates for big moves
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#050B14'); bg.addColorStop(1, win ? '#0E2A24' : '#2A0F18')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  for (let i = 0; i < 90; i++) { // deterministic stars
    g.fillStyle = `rgba(255,255,255,${0.2 + ((i * 37) % 70) / 100})`
    g.beginPath(); g.arc((i * 211) % W, (i * 347) % (H * 0.7), 1 + (i % 3) * 0.7, 0, 7); g.fill()
  }
  // moon
  const mx = 300, my = 330
  const mg = g.createRadialGradient(mx - 30, my - 30, 10, mx, my, 150)
  mg.addColorStop(0, '#F4F1E8'); mg.addColorStop(1, '#9AA3B2')
  g.fillStyle = mg; g.beginPath(); g.arc(mx, my, 150, 0, 7); g.fill()
  g.fillStyle = 'rgba(0,0,0,0.12)'
  ;[[-50, -30, 28], [40, 40, 36], [-10, 70, 18], [60, -60, 14]].forEach(([x, y, r]) => { g.beginPath(); g.arc(mx + x, my + y, r, 0, 7); g.fill() })

  // rocket position: profit -> close to moon, loss -> crashing down
  const rx = win ? 640 - p * 280 : 560 + p * -60
  const ry = win ? 760 - p * 360 : 760 - p * 330
  const ang = win ? -0.9 + (1 - p) * 0.5 : 2.2 + Math.min(1, -p) * 0.9
  g.save(); g.translate(rx, ry); g.rotate(ang)
  if (win) { // trail
    const fl = g.createLinearGradient(0, 0, 0, 220); fl.addColorStop(0, '#FFD166'); fl.addColorStop(1, 'rgba(246,70,93,0)')
    g.fillStyle = fl; g.beginPath(); g.moveTo(-26, 70); g.quadraticCurveTo(0, 70 + 120 + p * 120, 26, 70); g.fill()
  } else {
    g.fillStyle = 'rgba(160,160,170,0.35)'
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((i % 2 ? 14 : -14), 90 + i * 34, 22 + i * 6, 0, 7); g.fill() }
    g.fillStyle = '#F6465D'; g.beginPath(); g.moveTo(-24, 70); g.lineTo(0, 150); g.lineTo(24, 70); g.fill()
  }
  g.fillStyle = '#E5E9F0'; g.beginPath(); g.moveTo(0, -110); g.quadraticCurveTo(60, -30, 40, 70); g.lineTo(-40, 70); g.quadraticCurveTo(-60, -30, 0, -110); g.fill()
  g.fillStyle = win ? '#3DDC97' : '#F6465D'; g.beginPath(); g.moveTo(-40, 20); g.lineTo(-80, 90); g.lineTo(-40, 70); g.fill(); g.beginPath(); g.moveTo(40, 20); g.lineTo(80, 90); g.lineTo(40, 70); g.fill()
  g.beginPath(); g.moveTo(0, -110); g.quadraticCurveTo(30, -85, 38, -60); g.lineTo(-38, -60); g.quadraticCurveTo(-30, -85, 0, -110); g.fill()
  g.fillStyle = '#0E1822'; g.beginPath(); g.arc(0, -20, 20, 0, 7); g.fill(); g.fillStyle = '#7DD3FC'; g.beginPath(); g.arc(0, -20, 14, 0, 7); g.fill()
  g.restore()
  if (!win && p < -0.6) { // impact burst
    g.fillStyle = 'rgba(255,170,60,0.85)'
    for (let i = 0; i < 10; i++) { const a = i * 0.63; g.beginPath(); g.arc(rx + Math.cos(a) * 80, ry + 120 + Math.sin(a) * 40, 16 + (i % 3) * 6, 0, 7); g.fill() }
  }

  // astronaut (right)
  g.save(); g.translate(880, 560); g.rotate(win ? 0.15 : -0.25)
  g.fillStyle = '#F1F5F9'; g.beginPath(); g.roundRect(-45, -10, 90, 110, 28); g.fill()
  g.fillStyle = '#CBD5E1'; g.beginPath(); g.roundRect(-58, 10, 20, 70, 10); g.fill(); g.beginPath(); g.roundRect(38, 10, 20, 70, 10); g.fill()
  g.fillStyle = '#F1F5F9'; g.beginPath(); g.roundRect(-34, 90, 28, 70, 12); g.fill(); g.beginPath(); g.roundRect(6, 90, 28, 70, 12); g.fill()
  g.beginPath(); g.arc(0, -50, 52, 0, 7); g.fill()
  g.fillStyle = '#0E1822'; g.beginPath(); g.roundRect(-34, -72, 68, 46, 22); g.fill()
  g.fillStyle = win ? '#3DDC97' : '#F6465D'; g.fillRect(-20, 30, 40, 10)
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-16, -56, 7, 0, 7); g.fill()
  g.restore()

  // text
  const col = win ? GREEN : RED
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '700 54px system-ui, sans-serif'; g.fillText(t.pair, 70, 90)
  g.fillStyle = t.side === 'buy' ? GREEN : RED; g.font = '600 32px system-ui, sans-serif'
  g.fillText(`${t.side === 'buy' ? 'Long' : 'Short'}  ${t.leverage}x`, 70, 140)
  g.fillStyle = col; g.font = '800 150px system-ui, sans-serif'; g.fillText(`${signed(m.pnlPct)}%`, 70, 1000)
  g.font = '600 52px system-ui, sans-serif'; g.fillText(`${m.pnlAmt >= 0 ? '+' : '-'}${money(Math.abs(m.pnlAmt))}`, 70, 1070)
  g.fillStyle = '#94A3B8'; g.font = '500 30px system-ui, sans-serif'
  g.fillText(`Entry  ${fmtPrice(m.entry)}`, 70, 1160); g.fillText(`Current  ${fmtPrice(m.cur)}`, 70, 1205)
  g.fillText(`Margin  ${money(t.amount)}`, 560, 1160); g.fillText(`Ref  ${t.reference}`, 560, 1205)
  g.fillStyle = '#475569'; g.font = '500 26px system-ui, sans-serif'; g.fillText(new Date().toLocaleString(), 70, 1290)
  return c
}

async function shareTrade(t, m) {
  const canvas = drawShare(t, m)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('image')
  const file = new File([blob], `${t.reference}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `${t.pair} trade`, text: `${t.pair} ${signed(m.pnlPct)}%` }); return 'shared' } catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = `${t.reference}.png`; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  return 'downloaded'
}

/* ───────────── ACTIVE TRADE ───────────── */

const pnlFmt = (v) => signed(v)
const amtFmt = (v) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`

function ActiveTrade({ t, tick, now, reduce }) {
  const [toast, setToast] = useState('')
  const [sharing, setSharing] = useState(false)
  const cur = tick?.price || 0
  let entry = getEntry(t.id)
  if (!entry && cur) { setEntry(t.id, cur); entry = cur }
  const dir = t.side === 'buy' ? 1 : -1
  const pnlPct = entry && cur ? dir * ((cur - entry) / entry) * 100 * t.leverage : 0
  const pnlAmt = (num(t.amount) * pnlPct) / 100
  const win = pnlPct >= 0
  const closeAt = new Date(t.scheduled_close_at).getTime()
  const openAt = new Date(t.opened_at).getTime()
  const left = Math.max(0, (closeAt - now) / 1000)
  const prog = Math.min(100, Math.max(0, ((now - openAt) / Math.max(1, closeAt - openAt)) * 100))
  // Time is up but staff have not set the result yet (server flag, with the local clock as a fallback).
  const awaiting = Boolean(t.awaiting_settlement) || closeAt <= now
  const color = awaiting ? AMBER : win ? GREEN : RED

  const share = async () => {
    setSharing(true)
    try {
      const r = await shareTrade(t, { pnlPct, pnlAmt, entry, cur })
      if (r === 'downloaded') setToast('Image saved to your device.')
    } catch { setToast('Could not create the image. Try again.') }
    setSharing(false)
    setTimeout(() => setToast(''), 2500)
  }

  return (
    <motion.li layout initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      className="rounded-2xl bg-[#1A2C3D] p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-white">
            {t.pair}
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold" style={{ background: `${t.side === 'buy' ? GREEN : RED}26`, color: t.side === 'buy' ? GREEN : RED }}>
              {t.side === 'buy' ? 'LONG' : 'SHORT'} {t.leverage}x
            </span>
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">{t.reference}</p>
        </div>
        <button type="button" onClick={share} disabled={sharing || awaiting} aria-label="Share trade image" title={awaiting ? 'Available once your result is confirmed' : undefined} className={`${iconBtn} disabled:opacity-40`}>
          {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        </button>
      </div>

      {awaiting ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-amber-400/10 px-3.5 py-3.5" role="status">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-300" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-200">Awaiting result</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-amber-100/70">
              Your trade period has ended. We are confirming the result and will update your balance shortly.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-end justify-between gap-3 rounded-xl bg-[#0E1822] px-3.5 py-3">
          <div>
            <p className="text-[11px] text-slate-400">Market estimate (not final)</p>
            <motion.p animate={{ scale: reduce ? 1 : [1, 1.04, 1] }} transition={{ duration: 0.5 }} key={Math.round(pnlAmt * 100)}
              className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl" style={{ color }}>
              <AnimNum value={pnlAmt} fmt={amtFmt} />
            </motion.p>
          </div>
          <p className="flex items-center gap-1 font-mono text-lg font-semibold tabular-nums" style={{ color }}>
            {win ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
            <AnimNum value={pnlPct} fmt={(v) => `${pnlFmt(v)}%`} />
          </p>
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
        {[['Entry', fmtPrice(entry)], ['Current', fmtPrice(cur)], ['Margin', money(t.amount)], ['TP / SL', `${num(t.take_profit_pct) || '-'}% / ${num(t.stop_loss_pct) || '-'}%`]].map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-lg bg-white/[0.04] px-2.5 py-2"><dt className="text-[10px] text-slate-400">{k}</dt><dd className="truncate font-mono font-semibold tabular-nums text-white">{v}</dd></div>
        ))}
      </dl>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1.5 text-slate-400"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{awaiting ? 'Status' : 'Result due in'}</span>
          {awaiting
            ? <span className="font-semibold text-amber-300">Processing result…</span>
            : <span className="font-mono font-semibold tabular-nums text-white" role="timer">{hms(left)}</span>}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
          <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${awaiting ? 'animate-pulse' : ''}`} style={{ width: `${awaiting ? 100 : prog}%`, background: color }} />
        </div>
      </div>
      <AnimatePresence>{toast && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" className="mt-2 text-center text-[12px] text-[#9BF0C8]">{toast}</motion.p>}</AnimatePresence>
    </motion.li>
  )
}

/* ───────────── SETTLED NOTICE ───────────── */

function SettledNotice({ t, onDismiss }) {
  const profit = t.outcome === 'profit'
  const c = profit ? GREEN : RED
  return (
    <motion.li layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      className="flex items-start gap-3 rounded-xl px-3.5 py-3" style={{ background: `${c}1A` }} role="status">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: c }} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[13px] text-slate-100">
        <p className="font-semibold">{t.pair} trade settled: <span style={{ color: c }}>{profit ? 'Profit' : 'Loss'} {amtFmt(num(t.pnl_amount))} ({pnlFmt(num(t.pnl_pct))}%)</span></p>
        <p className="mt-0.5 text-[12px] text-slate-400">Ref {t.reference}. Your margin was released and your balance has been updated.</p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"><X className="h-3.5 w-3.5" /></button>
    </motion.li>
  )
}

/* ───────────── NEWS ───────────── */

// Shown only when every live feed fails, so the section is never empty or broken.
const TIPS = [
  ['Leverage multiplies losses as fast as gains', 'At 10x, a 5% move against you is a 50% hit to your margin. Start low until your strategy proves itself.', 'Leverage'],
  ['Check the economic calendar before forex entries', 'Rate decisions, CPI and jobs data can move pairs by dozens of pips in minutes. Avoid opening right before them.', 'Forex'],
  ['Trade with the higher-timeframe trend', 'Confirm direction on the 4H or daily chart, then time the entry on the 15m or 1H. Counter-trend trades need a clear reason.', 'Analysis'],
  ['Crypto never closes, but liquidity does', 'Weekend and late-night sessions are thinner, so spreads widen and wicks get sharper. Keep your size smaller then.', 'Crypto'],
  ['Use RSI to read momentum, not to guess tops', 'An overbought RSI can stay overbought in a strong trend. Wait for price to confirm before acting on it.', 'Indicators'],
  ['Set take profit and stop loss before you enter', 'Deciding exits in advance removes emotion. If the setup has no clear exit, skip it.', 'Discipline'],
  ['Keep a short trade journal', 'Note the pair, reason, result and mood. After 20 trades the patterns in your wins and losses become obvious.', 'Habits'],
  ['Correlated pairs double your risk', 'Being long EUR/USD and GBP/USD, or several altcoins, is often the same bet twice. Check what you already have open.', 'Risk'],
  ['Do not chase a move you missed', 'If price already ran, wait for a pullback to support or resistance. There is always another setup.', 'Discipline'],
].map(([title, body, tag], i) => ({ id: `tip-${i}`, title, body, tag, source: tag }))

const signal = () => AbortSignal.timeout(8000)

async function viaJson(url) {
  const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`, { signal: signal() })
  const j = await r.json()
  if (j.status !== 'ok' || !j.items?.length) throw new Error('feed')
  return j.items.map((i) => ({
    title: i.title, url: i.link,
    img: i.thumbnail || (/image/.test(i.enclosure?.type || '') ? i.enclosure.link : ''),
    ts: Date.parse(`${String(i.pubDate).replace(' ', 'T')}Z`) / 1000,
  }))
}

async function viaProxy(url) {
  const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { signal: signal() })
  if (!r.ok) throw new Error('proxy')
  const xml = new DOMParser().parseFromString(await r.text(), 'text/xml')
  const items = [...xml.querySelectorAll('item')].slice(0, 10).map((n) => {
    const g = (t) => n.querySelector(t)?.textContent?.trim() || ''
    const media = n.getElementsByTagName('media:content')[0] || n.getElementsByTagName('media:thumbnail')[0] || n.querySelector('enclosure')
    return { title: g('title'), url: g('link'), img: media?.getAttribute('url') || '', ts: Date.parse(g('pubDate')) / 1000 }
  })
  if (!items.length) throw new Error('empty')
  return items
}

async function loadFeed([source, url]) {
  let items
  try { items = await viaJson(url) } catch { items = await viaProxy(url) }
  return items.filter((i) => i.title && i.url).map((i) => ({ ...i, id: i.url, source, ts: i.ts || Date.now() / 1000 }))
}

async function fetchNews() {
  const settled = await Promise.allSettled(NEWS_FEEDS.map(loadFeed))
  const lists = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value).filter((l) => l.length)
  if (!lists.length) throw new Error('no news')
  const out = []
  for (let i = 0; out.length < 10 && i < 20; i++) lists.forEach((l) => { if (l[i] && out.length < 10) out.push(l[i]) })
  return out.sort((a, b) => b.ts - a.ts)
}

function News({ refreshKey }) {
  const [items, setItems] = useState(null)
  const [live, setLive] = useState(true)
  const [all, setAll] = useState(false)
  const hasLive = useRef(false)
  const load = useCallback(() => {
    fetchNews()
      .then((list) => { hasLive.current = true; setItems(list); setLive(true) })
      .catch(() => { if (!hasLive.current) { setItems(TIPS); setLive(false) } })
  }, [])
  const retry = () => { setItems(null); load() }
  useEffect(() => {
    load()
    const id = setInterval(load, 300000)
    return () => clearInterval(id)
  }, [load, refreshKey])
  const shown = items ? (all ? items : items.slice(0, 2)) : []
  return (
    <section aria-label="Market news" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-white sm:text-sm"><Newspaper className="h-4 w-4 text-[#3DDC97]" aria-hidden="true" />{live ? 'Market news' : 'Trading insights'}</h2>
        {live
          ? <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3DDC97]" />Live</span>
          : <button type="button" onClick={retry} className="text-[11px] font-semibold text-[#3DDC97] hover:underline">Try live news again</button>}
      </div>
      {!live && <p className="mt-2 px-0.5 text-[11px] text-slate-500">Live headlines could not be reached, so here are some trading insights instead.</p>}
      <div className="mt-3 space-y-2">
        {!items && [0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />)}
        <AnimatePresence initial={false}>
          {shown.map((n) => {
            const Tag = n.url ? motion.a : motion.div
            const link = n.url ? { href: n.url, target: '_blank', rel: 'noopener noreferrer' } : {}
            return (
              <Tag key={n.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                {...link} className="flex gap-3 overflow-hidden rounded-xl bg-white/[0.04] p-2.5 transition-colors hover:bg-white/[0.07]">
                {n.img ? <img src={n.img} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-20 sm:w-20" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  : !n.url && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-400/[0.15] text-amber-300"><Lightbulb className="h-[18px] w-[18px]" aria-hidden="true" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-medium text-white sm:text-sm">{n.title}</span>
                  {n.body && <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-slate-400">{n.body}</span>}
                  {n.url && (
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400"><span className="truncate">{n.source}</span>·<span className="shrink-0">{ago(n.ts)}</span><ExternalLink className="ml-auto h-3 w-3 shrink-0" aria-hidden="true" /></span>
                  )}
                </span>
              </Tag>
            )
          })}
        </AnimatePresence>
      </div>
      {items && items.length > 2 && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className={`${ghostBtn} mt-3 w-full`}>
          {all ? <>Show less<ChevronUp className="h-4 w-4" /></> : <>See all ({items.length})<ChevronDown className="h-4 w-4" /></>}
        </button>
      )}
    </section>
  )
}

/* ───────────── PAGE ───────────── */

export default function Trade() {
  const reduce = useReducedMotion()
  const [pair, setPair] = useState('BTC/USDT')
  const [picker, setPicker] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [cfg, setCfg] = useState(null)
  const [summary, setSummary] = useState(null)
  const [trades, setTrades] = useState(null)
  const [tradesErr, setTradesErr] = useState('')
  const [maxOpen, setMaxOpen] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [flash, setFlash] = useState('')
  const [settled, setSettled] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const alive = useRef(true)
  const prevIds = useRef([])

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const loadSummary = useCallback(() => {
    api.get('/api/trades/summary/').then((r) => alive.current && setSummary(r.data?.data ?? null)).catch(() => {})
  }, [])

  const loadConfig = useCallback(() => {
    api.get('/api/trades/config/').then((r) => alive.current && setCfg(r.data?.data ?? null)).catch(() => {})
  }, [])

  const loadActive = useCallback(() => {
    api.get('/api/trades/active/')
      .then((res) => {
        if (!alive.current) return
        const list = res.data?.data?.results || []
        const ids = new Set(list.map((x) => x.id))
        // Trades that left the active list were settled by staff: fetch the result and tell the user.
        const gone = prevIds.current.filter((id) => !ids.has(id))
        prevIds.current = list.map((x) => x.id)
        if (gone.length) {
          gone.forEach((id) => {
            api.get(`/api/trades/${id}/`)
              .then((r) => {
                const d = r.data?.data
                if (alive.current && d?.status === 'closed') setSettled((s) => [d, ...s.filter((x) => x.id !== d.id)])
              })
              .catch(() => {})
          })
          loadSummary()
        }
        setTrades(list)
        setMaxOpen(num(res.data?.data?.max_open_trades))
        setTradesErr('')
      })
      .catch((e) => {
        if (alive.current) setTradesErr(describeError(e, 'We could not load your active trades.').message)
      })
  }, [loadSummary])

  const refresh = () => {
    if (refreshing) return
    setRefreshing(true)
    setRefreshKey((k) => k + 1)
    loadActive(); loadSummary(); loadConfig()
    setTimeout(() => alive.current && setRefreshing(false), 900)
  }

  useEffect(() => {
    loadConfig()
    loadActive(); loadSummary()
    const poll = setInterval(loadActive, ACTIVE_POLL_MS)
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(poll); clearInterval(clock) }
  }, [loadActive, loadSummary, loadConfig])

  const pairs = useMemo(() => [pair, ...(trades || []).map((t) => t.pair)], [pair, trades])
  const prices = useLivePrices(pairs)

  const onOpened = (d) => {
    setFormOpen(false)
    prevIds.current = [d.id, ...prevIds.current.filter((id) => id !== d.id)]
    setTrades((l) => [d, ...(l || []).filter((x) => x.id !== d.id)])
    if (d.balances) setSummary((s) => ({ ...(s || {}), ...d.balances }))
    setFlash(`Trade ${d.reference} opened.`)
    setTimeout(() => setFlash(''), 3500)
    loadActive(); loadSummary()
  }

  const full = maxOpen && trades && trades.length >= maxOpen
  const closed = cfg?.market_open === false
  const cannotOpen = Boolean(full) || closed

  return (
    <div>
      <motion.div className="mx-auto max-w-5xl space-y-4 sm:space-y-5" variants={container} initial={reduce ? false : 'hidden'} animate="show">
        <motion.div variants={item} className="flex items-center justify-between gap-3">
          <Link to={DASHBOARD_ROUTE} aria-label="Back to dashboard" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Dashboard
          </Link>
          <button type="button" onClick={refresh} disabled={refreshing} aria-label="Refresh" className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-slate-200 transition-colors hover:bg-white/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </motion.div>

        <motion.div variants={item}>
          <Hero pair={pair} onOpenPicker={() => setPicker(true)} tick={prices[pair]} refreshKey={refreshKey} />
        </motion.div>

        <motion.section variants={item} aria-label="Trades" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 px-0.5">
            <div>
              <h2 className="text-[13px] font-semibold text-white sm:text-sm">Active trades</h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400"><Wallet className="h-3 w-3" aria-hidden="true" />
                {summary ? `Available ${money(summary.available_balance)}` : 'Loading balance…'}
                {maxOpen ? ` · ${trades?.length ?? 0}/${maxOpen} open` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {trades?.length > 0 && (
                <button type="button" onClick={() => setFormOpen(true)} disabled={cannotOpen} aria-label="Enter a trade" className={`${iconBtn} bg-[#3DDC97] text-[#06140E] hover:bg-[#5BEBAD] hover:text-[#06140E] disabled:opacity-50`}><Plus className="h-4 w-4" /></button>
              )}
              <Link to={HISTORY_ROUTE} aria-label="Trade history" className={iconBtn}><History className="h-4 w-4" /></Link>
            </div>
          </div>

          <AnimatePresence>{flash && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" className="mt-3 rounded-xl bg-[#3DDC97]/10 px-3.5 py-2.5 text-[13px] text-[#9BF0C8]">{flash}</motion.p>}</AnimatePresence>
          {closed && <p className="mt-3 rounded-xl bg-amber-400/10 px-3.5 py-2.5 text-[12px] text-amber-200">{WEEKEND_MSG}</p>}

          {settled.length > 0 && (
            <ul className="mt-3 space-y-2">
              <AnimatePresence initial={false}>
                {settled.map((t) => <SettledNotice key={t.id} t={t} onDismiss={() => setSettled((s) => s.filter((x) => x.id !== t.id))} />)}
              </AnimatePresence>
            </ul>
          )}

          <div className="mt-3">
            {tradesErr && <InlineError message={tradesErr} onRetry={loadActive} />}
            {!tradesErr && !trades && <div className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" />}
            {!tradesErr && trades && trades.length === 0 && (
              <button type="button" onClick={() => setFormOpen(true)} disabled={closed} className="group flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 px-4 py-10 transition-colors hover:border-[#3DDC97]/60 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-white/15">
                <motion.span animate={reduce || closed ? {} : { scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }} className="grid h-14 w-14 place-items-center rounded-full bg-[#3DDC97]/[0.15] text-[#3DDC97]"><Plus className="h-6 w-6" /></motion.span>
                <span className="text-sm font-medium text-white">No active trades</span>
                <span className="text-[12px] text-slate-400">{closed ? 'Trading reopens on Monday' : 'Tap to enter your first trade'}</span>
              </button>
            )}
            {trades && trades.length > 0 && (
              <ul className="grid gap-3 lg:grid-cols-2">
                <AnimatePresence initial={false}>
                  {trades.map((t) => <ActiveTrade key={t.id} t={t} tick={prices[t.pair]} now={now} reduce={reduce} />)}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </motion.section>

        <motion.div variants={item}><News refreshKey={refreshKey} /></motion.div>
      </motion.div>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Select pair">
        <PairList value={pair} onPick={(p) => { setPair(p); setPicker(false) }} />
      </Sheet>
      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title="Enter a trade">
        {formOpen && <TradeForm cfg={cfg} summary={summary} initialPair={pair} onClose={() => setFormOpen(false)} onOpened={onOpened} />}
      </Sheet>
    </div>
  )
}