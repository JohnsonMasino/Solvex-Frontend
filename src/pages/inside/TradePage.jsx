// src/pages/inside/Trade.jsx
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import {
  AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Clock, ExternalLink, History, Loader2, Newspaper, Plus,
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
// How often REST prices are polled (crypto also streams over WebSocket for ~1s ticks)
const PRICE_POLL_MS = 4000
// Public RSS feeds. Each one is tried through rss2json first, then through several CORS proxies (no API keys).
const NEWS_FEEDS = [
  ['Cointelegraph', 'https://cointelegraph.com/rss'],
  ['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'],
  ['Decrypt', 'https://decrypt.co/feed'],
  ['CryptoSlate', 'https://cryptoslate.com/feed/'],
  ['FXStreet', 'https://www.fxstreet.com/rss/news'],
  ['ForexLive', 'https://www.forexlive.com/feed/news'],
  ['Investing.com', 'https://www.investing.com/rss/news.rss'],
  ['CNBC', 'https://www.cnbc.com/id/10000664/device/rss/rss.html'],
  ['Yahoo Finance', 'https://finance.yahoo.com/news/rssindex'],
]
const PROXIES = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
]
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
const BN_TO_PAIR = Object.fromEntries(CRYPTO.map((p) => [p.bn, p.pair]))

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
const tmo = (ms = 6000) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined)
const getJson = async (url, ms = 6000) => {
  const r = await fetch(url, { signal: tmo(ms) })
  if (!r.ok) throw new Error(`http ${r.status}`)
  return r.json()
}

/* The API does not return an entry price, so the live market price is captured when the trade opens and kept
   per trade in a tiny external store (memory + localStorage). Components subscribe with useSyncExternalStore,
   so nothing reads or writes refs during render. */
const entryKey = (id) => `tradeEntry:${id}`
const entryMem = {}
const entrySubs = new Set()
const getEntry = (id) => {
  if (entryMem[id]) return entryMem[id]
  try {
    const v = num(localStorage.getItem(entryKey(id)))
    if (v) entryMem[id] = v
    return v
  } catch { return 0 }
}
const setEntry = (id, p) => {
  if (!p) return
  entryMem[id] = p
  try { localStorage.setItem(entryKey(id), String(p)) } catch { /* ignore */ }
  entrySubs.forEach((f) => f())
}
const subscribeEntry = (f) => { entrySubs.add(f); return () => { entrySubs.delete(f) } }
const useEntry = (id) => useSyncExternalStore(subscribeEntry, () => getEntry(id), () => 0)

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

const bnTicker = (j) => ({ price: num(j.lastPrice), change: num(j.priceChangePercent), high: num(j.highPrice), low: num(j.lowPrice), vol: num(j.quoteVolume) })

// Crypto REST sources, tried in order (the last one that worked is tried first next time).
const CRYPTO_SOURCES = [
  async (m) => bnTicker(await getJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${m.bn}`)),
  async (m) => bnTicker(await getJson(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${m.bn}`)),
  async (m) => {
    const j = await getJson(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${m.bn}`)
    const d = j?.result?.list?.[0]
    return { price: num(d?.lastPrice), change: num(d?.price24hPcnt) * 100, high: num(d?.highPrice24h), low: num(d?.lowPrice24h), vol: num(d?.turnover24h) }
  },
  async (m) => {
    const j = await getJson(`https://www.okx.com/api/v5/market/ticker?instId=${m.name}-USDT`)
    const d = j?.data?.[0]
    const last = num(d?.last), open = num(d?.open24h)
    return { price: last, change: open ? ((last - open) / open) * 100 : 0, high: num(d?.high24h), low: num(d?.low24h), vol: num(d?.volCcy24h) }
  },
  async (m) => {
    const j = await getJson(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${m.name}&tsyms=USD`)
    const d = j?.RAW?.[m.name]?.USD
    return { price: num(d?.PRICE), change: num(d?.CHANGEPCT24HOUR), high: num(d?.HIGH24HOUR), low: num(d?.LOW24HOUR), vol: num(d?.VOLUME24HOURTO) }
  },
  async (m) => {
    const j = await getJson(`https://api.coinbase.com/v2/prices/${m.name}-USD/spot`)
    return { price: num(j?.data?.amount) }
  },
  async (m) => { // last resort: Binance through a CORS proxy
    const r = await fetch(PROXIES[0](`https://api.binance.com/api/v3/ticker/24hr?symbol=${m.bn}`), { signal: tmo(8000) })
    if (!r.ok) throw new Error('proxy')
    return bnTicker(await r.json())
  },
]
let cryptoPref = 0
async function fetchCrypto(meta) {
  let lastErr
  for (let k = 0; k < CRYPTO_SOURCES.length; k++) {
    const i = (cryptoPref + k) % CRYPTO_SOURCES.length
    try {
      const t = await CRYPTO_SOURCES[i](meta)
      if (t && t.price > 0) { cryptoPref = i; return t }
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('price')
}

// Forex: daily base rates (several fallbacks) overlaid with live USDT-quoted rates for EUR, GBP, AUD and TRY.
const FX_SOURCES = [
  async () => (await getJson('https://open.er-api.com/v6/latest/USD')).rates,
  async () => ({ ...(await getJson('https://api.frankfurter.app/latest?from=USD')).rates, USD: 1 }),
  async () => {
    const j = await getJson('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
    return Object.fromEntries(Object.entries(j?.usd || {}).map(([k, v]) => [k.toUpperCase(), v]))
  },
]
// [currency, binance symbol, symbol is already "per USD"]
const FX_LIVE = [['EUR', 'EURUSDT', false], ['GBP', 'GBPUSDT', false], ['AUD', 'AUDUSDT', false], ['TRY', 'USDTTRY', true]]
let fxBase = { at: 0, rates: null }
let fxMix = { at: 0, rates: null }

async function fxLive() {
  const q = encodeURIComponent(JSON.stringify(FX_LIVE.map((x) => x[1])))
  for (const host of ['https://api.binance.com', 'https://data-api.binance.vision']) {
    try {
      const j = await getJson(`${host}/api/v3/ticker/price?symbols=${q}`, 5000)
      const out = {}
      ;(Array.isArray(j) ? j : []).forEach((x) => {
        const f = FX_LIVE.find((r) => r[1] === x.symbol)
        const p = num(x.price)
        if (f && p > 0) out[f[0]] = f[2] ? p : 1 / p
      })
      if (Object.keys(out).length) return out
    } catch { /* try next host */ }
  }
  return {}
}

async function fxRates() {
  if (fxMix.rates && Date.now() - fxMix.at < 4000) return fxMix.rates
  if (!fxBase.rates || Date.now() - fxBase.at > 600000) {
    for (const src of FX_SOURCES) {
      try {
        const r = await src()
        if (r && r.EUR) { fxBase = { at: Date.now(), rates: { ...r } }; break }
      } catch { /* try next source */ }
    }
  }
  if (!fxBase.rates) throw new Error('fx')
  const live = await fxLive()
  const rates = { ...fxBase.rates, ...live }
  if (!rates.CNH && rates.CNY) rates.CNH = rates.CNY
  fxMix = { at: Date.now(), rates }
  return rates
}

async function fetchPrice(p) {
  const meta = BY_PAIR[p]
  if (!meta) return null
  if (meta.type === 'crypto') return fetchCrypto(meta)
  const [b, q] = p.split('/')
  const rates = await fxRates()
  const rb = b === 'USD' ? 1 : rates[b]
  const rq = q === 'USD' ? 1 : rates[q]
  if (!rb || !rq) throw new Error('rate')
  return { price: rq / rb, change: null }
}

// Real-time crypto ticks (about once a second) over Binance WebSocket. REST polling keeps running as a backup.
function useCryptoStream(key, onTick) {
  const ck = key.split(',').filter((p) => BY_PAIR[p]?.type === 'crypto').join(',')
  useEffect(() => {
    if (!ck || typeof WebSocket === 'undefined') return undefined
    const hosts = ['wss://stream.binance.com:9443', 'wss://data-stream.binance.vision']
    const streams = ck.split(',').map((p) => `${BY_PAIR[p].bn.toLowerCase()}@miniTicker`).join('/')
    let ws, retry, tries = 0, live = true
    const open = () => {
      try { ws = new WebSocket(`${hosts[tries % hosts.length]}/stream?streams=${streams}`) } catch { return }
      ws.onopen = () => { tries = 0 }
      ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data)?.data
          const pair = d?.s && BN_TO_PAIR[d.s]
          const price = num(d?.c)
          const o = num(d?.o)
          if (pair && price > 0) onTick(pair, { price, change: o ? ((price - o) / o) * 100 : 0, high: num(d.h), low: num(d.l), vol: num(d.q) })
        } catch { /* ignore malformed frame */ }
      }
      ws.onclose = () => { if (live && tries < 8) { tries += 1; retry = setTimeout(open, Math.min(20000, 1000 * 2 ** tries)) } }
      ws.onerror = () => { try { ws.close() } catch { /* ignore */ } }
    }
    open()
    return () => { live = false; clearTimeout(retry); try { ws?.close() } catch { /* ignore */ } }
  }, [ck, onTick])
}

function useLivePrices(pairs, every = PRICE_POLL_MS) {
  const [map, setMap] = useState({})
  const key = [...new Set(pairs)].sort().join(',')
  const merge = useCallback((pair, tick) => setMap((m) => ({ ...m, [pair]: { ...m[pair], ...tick } })), [])
  useEffect(() => {
    if (!key) return undefined
    let live = true
    const run = async () => {
      const list = key.split(',')
      const res = await Promise.all(list.map((p) => fetchPrice(p).catch(() => null)))
      if (live) setMap((m) => { const n = { ...m }; list.forEach((p, i) => { if (res[i]?.price > 0) n[p] = { ...n[p], ...res[i] } }); return n })
    }
    run()
    const id = setInterval(run, every)
    return () => { live = false; clearInterval(id) }
  }, [key, every])
  useCryptoStream(key, merge)
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

function TradeForm({ cfg, summary, initialPair, getLive, onClose, onOpened }) {
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
      // Take the live price at the same moment the trade is sent: this becomes the entry price.
      const snapP = fetchPrice(pair).catch(() => null)
      const res = await api.post('/api/trades/', body, SEND_IDEMPOTENCY_KEY ? { headers: { 'Idempotency-Key': keyRef.current } } : undefined)
      const d = res.data?.data
      if (!d?.id) { setErr({ message: 'We could not read your trade details. Check your active trades.' }); return }
      const snap = await snapP
      const entryPx = snap?.price || getLive?.(pair)?.price || 0
      if (!getEntry(d.id)) setEntry(d.id, entryPx) // on an idempotent replay the original entry is kept
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

const pctFmt = (v) => `${signed(v)}%`
const amtFmt = (v) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`

function ActiveTrade({ t, tick, now, reduce }) {
  const [toast, setToast] = useState('')
  const [sharing, setSharing] = useState(false)
  const cur = tick?.price || 0

  // Entry price = live price captured when the trade opened (kept in the external entry store).
  // If none was stored (e.g. trade opened on another device), lock in the first live price we see.
  const entry = useEntry(t.id)
  useEffect(() => {
    if (!getEntry(t.id) && cur) setEntry(t.id, cur)
  }, [t.id, cur])

  const dir = t.side === 'buy' ? 1 : -1
  const rawPct = entry && cur ? dir * ((cur - entry) / entry) * 100 * num(t.leverage) : 0
  const pnlPct = Math.max(-100, rawPct) // you cannot lose more than your margin
  const pnlAmt = (num(t.amount) * pnlPct) / 100
  const win = pnlPct >= 0
  const closeAt = new Date(t.scheduled_close_at).getTime()
  const openAt = new Date(t.opened_at).getTime()
  const left = Math.max(0, (closeAt - now) / 1000)
  const prog = Math.min(100, Math.max(0, ((now - openAt) / Math.max(1, closeAt - openAt)) * 100))
  // Time is up but staff have not set the result yet (server flag, with the local clock as a fallback).
  const awaiting = Boolean(t.awaiting_settlement) || closeAt <= now
  const color = awaiting ? AMBER : win ? GREEN : RED
  const noPrice = !entry || !cur

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
            <p className="text-sm font-semibold text-amber-200">Computing Trade Results...</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-amber-100/70">
              Your trade period has ended. We are confirming the result and will update your balance shortly.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-[#0E1822] px-3.5 py-3">
          <div className="flex items-end justify-between gap-3">
            <motion.p animate={{ scale: reduce ? 1 : [1, 1.04, 1] }} transition={{ duration: 0.5 }} key={Math.round(pnlAmt * 100)}
              className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl" style={{ color }}>
              <AnimNum value={pnlAmt} fmt={amtFmt} />
            </motion.p>
            <p className="flex items-center gap-1 font-mono text-lg font-semibold tabular-nums" style={{ color }}>
              {win ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
              <AnimNum value={pnlPct} fmt={pctFmt} />
            </p>
          </div>
          {noPrice && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400" role="status">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Fetching live price…
            </p>
          )}
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
            ? <span className="font-semibold text-amber-300">Computing Trade Results...</span>
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
        <p className="font-semibold">{t.pair} trade settled: <span style={{ color: c }}>{profit ? 'Profit' : 'Loss'} {amtFmt(num(t.pnl_amount))} ({pctFmt(num(t.pnl_pct))})</span></p>
        <p className="mt-0.5 text-[12px] text-slate-400">Ref {t.reference}. Your margin was released and your balance has been updated.</p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"><X className="h-3.5 w-3.5" /></button>
    </motion.li>
  )
}

/* ───────────── NEWS ───────────── */

const httpsUrl = (u) => {
  if (!u || typeof u !== 'string') return ''
  if (u.startsWith('//')) return `https:${u}`
  if (/^http:\/\//i.test(u)) return u.replace(/^http:/i, 'https:')
  return /^https:\/\//i.test(u) ? u : ''
}
const imgFromHtml = (html) => {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html || '')
  return m ? httpsUrl(m[1]) : ''
}

// Source 1: CryptoCompare news API (keyless, CORS-enabled, always includes an image)
async function viaCryptoCompare() {
  const j = await getJson('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', 8000)
  const list = Array.isArray(j?.Data) ? j.Data : []
  if (!list.length) throw new Error('cc')
  return list.slice(0, 20).map((n) => ({
    title: n.title, url: n.url, img: httpsUrl(n.imageurl),
    source: n.source_info?.name || n.source || 'CryptoCompare', ts: num(n.published_on),
  }))
}

// Source 2: RSS through rss2json
async function viaJson(url) {
  const j = await getJson(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`, 8000)
  if (j.status !== 'ok' || !j.items?.length) throw new Error('feed')
  return j.items.map((i) => ({
    title: i.title, url: i.link,
    img: httpsUrl(i.thumbnail) || httpsUrl(i.enclosure?.thumbnail) || (/image/.test(i.enclosure?.type || '') ? httpsUrl(i.enclosure.link) : '')
      || imgFromHtml(i.content) || imgFromHtml(i.description),
    ts: Date.parse(`${String(i.pubDate).replace(' ', 'T')}Z`) / 1000,
  }))
}

// Source 3: RSS through CORS proxies (each proxy tried in turn)
function parseRss(text) {
  const xml = new DOMParser().parseFromString(text, 'text/xml')
  if (xml.querySelector('parsererror')) throw new Error('xml')
  const items = [...xml.querySelectorAll('item')].slice(0, 15).map((n) => {
    const g = (t) => n.querySelector(t)?.textContent?.trim() || ''
    const media = n.getElementsByTagName('media:content')[0] || n.getElementsByTagName('media:thumbnail')[0]
    const enc = n.querySelector('enclosure')
    const encoded = n.getElementsByTagName('content:encoded')[0]?.textContent || ''
    const encImg = enc && /image/.test(enc.getAttribute('type') || 'image') ? enc.getAttribute('url') : ''
    return {
      title: g('title'), url: g('link'),
      img: httpsUrl(media?.getAttribute('url')) || httpsUrl(encImg) || imgFromHtml(encoded) || imgFromHtml(g('description')),
      ts: Date.parse(g('pubDate')) / 1000,
    }
  })
  if (!items.length) throw new Error('empty')
  return items
}

async function viaProxy(url) {
  let lastErr
  for (const wrap of PROXIES) {
    try {
      const r = await fetch(wrap(url), { signal: tmo(8000) })
      if (!r.ok) throw new Error('proxy')
      return parseRss(await r.text())
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('proxy')
}

async function loadFeed([source, url]) {
  let items
  try { items = await viaJson(url) } catch { items = await viaProxy(url) }
  return items.map((i) => ({ ...i, source }))
}

const NEWS_SOURCES = [viaCryptoCompare, ...NEWS_FEEDS.map((f) => () => loadFeed(f))]

async function fetchNews() {
  const settled = await Promise.allSettled(NEWS_SOURCES.map((fn) => fn()))
  const seen = new Set()
  const lists = settled
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value
      .filter((i) => i.title && i.url && !seen.has(i.url) && seen.add(i.url))
      .map((i) => ({ ...i, id: i.url, ts: i.ts || Date.now() / 1000 })))
    .filter((l) => l.length)
  if (!lists.length) throw new Error('no news')

  // Prefer stories that have a real image, mixing sources so one outlet doesn't dominate.
  const imaged = lists.map((l) => l.filter((i) => i.img))
  const out = []
  for (let i = 0; out.length < 10 && i < 20; i++) imaged.forEach((l) => { if (l[i] && out.length < 10) out.push(l[i]) })
  if (out.length < 6) {
    // Not enough imaged stories: top up with the newest ones that have no image (shown with a plain tile).
    const rest = lists.flat().filter((i) => !i.img).sort((a, b) => b.ts - a.ts)
    rest.slice(0, 6 - out.length).forEach((i) => out.push(i))
  }
  if (!out.length) throw new Error('no news')
  return out.sort((a, b) => b.ts - a.ts)
}

function NewsThumb({ src, source }) {
  // Remember which src failed instead of resetting state in an effect.
  const [failed, setFailed] = useState('')
  const bad = !src || failed === src
  if (bad) {
    return (
      <div className="grid h-20 w-24 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#22405A] to-[#0E1822] font-mono text-sm font-bold text-[#3DDC97] sm:h-24 sm:w-32" aria-hidden="true">
        {String(source || 'N').slice(0, 2).toUpperCase()}
      </div>
    )
  }
  return (
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(src)}
      className="h-20 w-24 shrink-0 rounded-lg bg-[#0E1822] object-cover sm:h-24 sm:w-32" />
  )
}

function News({ refreshKey }) {
  const [items, setItems] = useState(null)
  const [failed, setFailed] = useState(false)
  const [all, setAll] = useState(false)
  const hasData = useRef(false)
  const load = useCallback(() => {
    fetchNews()
      .then((list) => { hasData.current = true; setItems(list); setFailed(false) })
      .catch(() => { if (!hasData.current) { setItems([]); setFailed(true) } })
  }, [])
  const retry = () => { setItems(null); setFailed(false); load() }
  useEffect(() => {
    load()
    const id = setInterval(load, 300000)
    return () => clearInterval(id)
  }, [load, refreshKey])
  const shown = items ? (all ? items : items.slice(0, 2)) : []
  return (
    <section aria-label="Market news" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-white sm:text-sm"><Newspaper className="h-4 w-4 text-[#3DDC97]" aria-hidden="true" />Market news</h2>
        {failed
          ? <button type="button" onClick={retry} className="text-[11px] font-semibold text-[#3DDC97] hover:underline">Try again</button>
          : <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3DDC97]" />Live</span>}
      </div>
      {failed && <p className="mt-3 rounded-xl bg-white/[0.04] px-3.5 py-6 text-center text-[12px] text-slate-400">Market news could not be loaded right now. Please try again in a moment.</p>}
      <div className="mt-3 space-y-2">
        {!items && [0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.04] sm:h-28" />)}
        <AnimatePresence initial={false}>
          {shown.map((n) => (
            <motion.a key={n.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              href={n.url} target="_blank" rel="noopener noreferrer"
              className="flex gap-3 overflow-hidden rounded-xl bg-white/[0.04] p-2.5 transition-colors hover:bg-white/[0.07]">
              <NewsThumb src={n.img} source={n.source} />
              <span className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
                <span className="line-clamp-3 text-[13px] font-medium leading-snug text-white sm:text-sm">{n.title}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="truncate">{n.source}</span>·<span className="shrink-0">{ago(n.ts)}</span>
                  <ExternalLink className="ml-auto h-3 w-3 shrink-0" aria-hidden="true" />
                </span>
              </span>
            </motion.a>
          ))}
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

  // Latest prices for event handlers (the ref is only written in an effect and only read in handlers).
  const pricesRef = useRef({})
  useEffect(() => { pricesRef.current = prices }, [prices])
  const getLive = useCallback((p) => pricesRef.current[p], [])

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
        {formOpen && <TradeForm cfg={cfg} summary={summary} initialPair={pair} getLive={getLive} onClose={() => setFormOpen(false)} onOpened={onOpened} />}
      </Sheet>
    </div>
  )
}