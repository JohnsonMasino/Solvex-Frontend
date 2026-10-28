// src/pages/inside/SignalsPage.jsx
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Crown,
  Gem,
  Info,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  Medal,
  RefreshCw,
  ShieldAlert,
  Star,
  TrendingUp,
  X,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const SUPPORT_EMAIL = 'support@solvexmarketinc.com'

const RATE_TTL_MS = 30 * 1000 // reuse a fetched rate for 30s
const RATE_REFRESH_MS = 20 * 1000 // refresh while the pop-up is open
const PROVIDER_TIMEOUT_MS = 6000 // give up on slow providers after 6s

const SIGNALS = [
  { id: 1, name: 'Momentum Signals', description: 'Identifies strengthening price movement', price: 500 },
  { id: 2, name: 'Oversold Reversal', description: 'Watches for potential rebounds after declines', price: 1000 },
  { id: 3, name: 'Breakout Signals', description: 'Tracks potential moves beyond key price levels', price: 1500 },
  { id: 4, name: 'Premium Trend Signals', description: 'Follows established market trends', price: 2000 },
  { id: 5, name: 'Support & Resistance', description: 'Identifies reactions near important price levels', price: 2500 },
  { id: 6, name: 'Volatility Expansion', description: 'Monitors potential increases in market volatility', price: 3000 },
  { id: 7, name: 'Divergence Signals', description: 'Tracks differences between price and indicator movement', price: 3500 },
  { id: 8, name: 'Multi-Timeframe Confluence', description: 'Combines analysis across multiple timeframes', price: 4000 },
  { id: 9, name: 'Liquidity Flow Signals', description: 'Studies liquidity and trading activity', price: 4500 },
  {
    id: 10,
    name: 'Institutional Market Insights',
    description: 'Premium branding for a comprehensive market-analysis package',
    price: 5000,
  },
]

// Tier is chosen by price: the highest tier whose `min` is <= the signal price
const TIERS = [
  { min: 500, title: 'Bronze', color: '#E0894B', Icon: Medal },
  { min: 1000, title: 'Silver', color: '#C3CFDB', Icon: Star, filled: true },
  { min: 1500, title: 'Gold', color: '#FFC83D', Icon: Star, filled: true },
  { min: 2000, title: 'Platinum', color: '#8FE3F0', Icon: Award },
  { min: 2500, title: 'Sapphire', color: '#5B9DFF', Icon: Gem },
  { min: 3000, title: 'Emerald', color: '#3DDC97', Icon: Gem },
  { min: 3500, title: 'Ruby', color: '#FF6B81', Icon: Gem },
  { min: 4000, title: 'Amethyst', color: '#B58CFF', Icon: Gem },
  { min: 4500, title: 'Diamond', color: '#7DF3FF', Icon: Gem, shimmer: true },
  { min: 5000, title: 'Royal Diamond', color: '#FFD76A', Icon: Crown, filled: true, shimmer: true },
]

const tierFor = (price) => [...TIERS].reverse().find((t) => price >= t.min) || TIERS[0]

const ASSETS = [
  { key: 'usdt', label: 'USDT', name: 'Tether USD', color: '#26A17B', dp: 2 },
  { key: 'btc', label: 'BTC', name: 'Bitcoin', color: '#F7931A', dp: 8 },
  { key: 'eth', label: 'ETH', name: 'Ethereum', color: '#8C9EFF', dp: 6 },
]

const STEPS = [
  { n: 1, text: 'Choose a signal' },
  { n: 2, text: 'See the live crypto amount' },
  { n: 3, text: 'Pay on the deposit page' },
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

const ghostBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-[13px] font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm'

const primaryBtn =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-5 text-[13px] font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm'

/* ────────────────────────────────────────────────
   LIVE RATES
   Several providers are raced in parallel. The result lives in a small
   module-level store that React reads with useSyncExternalStore, so effects
   only *trigger* fetches and never call setState themselves.
──────────────────────────────────────────────── */

const isPrice = (v) => Number.isFinite(v) && v > 0

// Each provider returns USD prices for BTC, ETH and USDT
const PROVIDERS = [
  {
    name: 'CoinGecko',
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd',
    parse: (j) => ({ btc: j?.bitcoin?.usd, eth: j?.ethereum?.usd, usdt: j?.tether?.usd }),
  },
  {
    name: 'CryptoCompare',
    url: 'https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC,ETH,USDT&tsyms=USD',
    parse: (j) => ({ btc: j?.BTC?.USD, eth: j?.ETH?.USD, usdt: j?.USDT?.USD }),
  },
  {
    name: 'Coinbase',
    url: 'https://api.coinbase.com/v2/exchange-rates?currency=USD',
    parse: (j) => {
      const r = j?.data?.rates || {}
      const inv = (v) => (Number(v) > 0 ? 1 / Number(v) : undefined) // rates are coins per 1 USD
      return { btc: inv(r.BTC), eth: inv(r.ETH), usdt: inv(r.USDT) }
    },
  },
  {
    name: 'Kraken',
    url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,USDTUSD',
    parse: (j) => {
      const out = {}
      Object.entries(j?.result || {}).forEach(([k, v]) => {
        const p = Number(v?.c?.[0])
        if (k.includes('XBT')) out.btc = p
        else if (k.includes('ETH')) out.eth = p
        else if (k.includes('USDT')) out.usdt = p
      })
      return out
    },
  },
]

// Fires every provider at once. The first valid answer wins and the rest are cancelled,
// so one slow or failing API never delays the user.
async function fetchLiveRates() {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS)
  try {
    return await Promise.any(
      PROVIDERS.map(async (p) => {
        const res = await fetch(p.url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
        if (!res.ok) throw new Error(`${p.name} ${res.status}`)
        const { btc, eth, usdt } = p.parse(await res.json())
        const btcN = Number(btc)
        const ethN = Number(eth)
        const usdtN = Number(usdt)
        if (!isPrice(btcN) || !isPrice(ethN)) throw new Error(`${p.name} returned no price`)
        return {
          btc: btcN,
          eth: ethN,
          // USDT is pegged, so anything outside a sane band falls back to $1
          usdt: isPrice(usdtN) && usdtN > 0.5 && usdtN < 1.5 ? usdtN : 1,
          source: p.name,
          ts: Date.now(),
        }
      }),
    )
  } finally {
    clearTimeout(timer)
    ctrl.abort()
  }
}

// ── external store (lives outside React, survives page changes, so repeat visits are instant) ──
let rateState = { rates: null, loading: false, failed: false }
let rateBusy = false
const rateListeners = new Set()

function publishRates(patch) {
  rateState = { ...rateState, ...patch } // new object each time so React sees the change
  rateListeners.forEach((fn) => fn())
}

const subscribeRates = (fn) => {
  rateListeners.add(fn)
  return () => {
    rateListeners.delete(fn)
  }
}

const getRateState = () => rateState

async function loadRates(force = false) {
  if (rateBusy) return
  const { rates } = rateState
  if (!force && rates && Date.now() - rates.ts < RATE_TTL_MS) return

  rateBusy = true
  publishRates({ loading: true })
  try {
    const r = await fetchLiveRates()
    publishRates({ rates: r, failed: false, loading: false })
  } catch {
    // keep the last good rates (if any) and just flag the failure
    publishRates({ failed: true, loading: false })
  } finally {
    rateBusy = false
  }
}

const reloadRates = () => loadRates(true)

function useLiveRates(prefetch, watch) {
  const { rates, loading, failed } = useSyncExternalStore(subscribeRates, getRateState, getRateState)

  // Warm the cache as soon as the page is open so the pop-up already has numbers
  useEffect(() => {
    if (prefetch) loadRates()
  }, [prefetch])

  // Keep the rates fresh while the pop-up is open (paused when the tab is hidden)
  useEffect(() => {
    if (!watch) return undefined
    loadRates()
    const id = setInterval(() => {
      if (!document.hidden) loadRates(true)
    }, RATE_REFRESH_MS)
    return () => clearInterval(id)
  }, [watch])

  return { rates, loading, failed, reload: reloadRates }
}

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────── */

const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const rateFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

// Rounds UP so the user never sends slightly less than the plan price
const ceilTo = (v, d) => {
  const f = 10 ** d
  return (Math.ceil(v * f - 1e-9) / f).toFixed(d)
}

function calcAmounts(usd, rates) {
  if (!rates) return null
  return {
    usdt: ceilTo(usd / rates.usdt, 2),
    btc: ceilTo(usd / rates.btc, 8),
    eth: ceilTo(usd / rates.eth, 6),
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

const loadError = (err) => {
  const res = err?.response
  if (!res) return 'Network error. Check your connection and try again.'
  if (res.status === 401) return 'Your session has expired. Please sign in again to continue.'
  if (res.status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (res.status >= 500) return 'Something went wrong on our side. Please try again in a moment.'
  return 'We could not check your eligibility. Please try again.'
}

/* ────────────────────────────────────────────────
   SMALL UI PIECES
──────────────────────────────────────────────── */

function InlineError({ message, onRetry }) {
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

// "Updated 12s ago" (ticks on its own so the page does not re-render)
function RateAge({ ts }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!ts) return null
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  const text = s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`
  return <span>Updated {text}</span>
}

/* ────────────────────────────────────────────────
   HEADER
──────────────────────────────────────────────── */

function HeaderCard({ eligible, reduce }) {
  return (
    <motion.section
      aria-label="Trading signals"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl bg-[#14212D] p-3 sm:p-4"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#3DDC97]/10 blur-3xl"
      />
      <div className="relative rounded-xl bg-[#1A2C3D] p-3.5 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#3DDC97]/[0.15] text-[#3DDC97]">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">Trading signals</h1>
              {eligible && (
                <motion.span
                  initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 rounded-full bg-[#3DDC97]/[0.15] px-2 py-0.5 text-[11px] font-semibold text-[#3DDC97]"
                >
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Eligible
                </motion.span>
              )}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-300 sm:text-sm">
              Pick a signal package, see the exact amount in BTC, ETH or USDT, then pay from your deposit page.
            </p>
          </div>
        </div>

        {eligible && (
          <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex items-center gap-2.5 rounded-xl bg-[#0E1822] px-3 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#3DDC97] font-mono text-xs font-semibold text-[#06231A]">
                  {s.n}
                </span>
                <span className="text-[12px] font-medium text-slate-200 sm:text-[13px]">{s.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </motion.section>
  )
}

/* ────────────────────────────────────────────────
   STATES: CHECKING / DENIED
──────────────────────────────────────────────── */

function CheckingSkeleton() {
  return (
    <div role="status" aria-label="Checking your eligibility" className="space-y-3 sm:space-y-4">
      <span className="sr-only">Checking your eligibility…</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} className="h-48" />
        ))}
      </div>
    </div>
  )
}

function DeniedCard({ reduce }) {
  return (
    <motion.section
      aria-label="Not eligible"
      role="status"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-2xl bg-[#14212D] px-4 py-10 text-center sm:px-6 sm:py-14"
    >
      <div className="relative mx-auto grid h-24 w-24 place-items-center">
        {!reduce && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-amber-400/20"
              animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              aria-hidden="true"
            />
            <motion.span
              className="absolute inset-3 rounded-full bg-amber-400/15"
              animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
              aria-hidden="true"
            />
          </>
        )}
        <span className="relative grid h-20 w-20 place-items-center rounded-full bg-amber-400/[0.12] ring-1 ring-amber-300/30">
          <ShieldAlert className="h-9 w-9 text-amber-300" aria-hidden="true" />
        </span>
      </div>

      <h2 className="mt-6 text-base font-semibold text-white sm:text-lg">
        You are not eligible for trading signals at this time
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-slate-400 sm:text-sm">
        If you think this is a mistake or you would like to know more, please contact support for enquiries.
      </p>

      <div className="mx-auto mt-6 flex w-full max-w-sm flex-col gap-2.5 sm:max-w-md sm:flex-row sm:justify-center">
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Trading signal eligibility enquiry')}`}
          className={`${primaryBtn} w-full sm:w-auto`}
        >
          <LifeBuoy className="h-4 w-4" aria-hidden="true" />
          Contact support
        </a>
        <Link to="/dashboard" className={`${ghostBtn} w-full sm:w-auto`}>
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
      </div>
    </motion.section>
  )
}

/* ────────────────────────────────────────────────
   SIGNAL CARD
──────────────────────────────────────────────── */

function SignalCard({ signal, index, onSelect, reduce }) {
  const tier = tierFor(signal.price)
  const { Icon } = tier

  return (
    <motion.li
      variants={item}
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative flex flex-col overflow-hidden rounded-2xl bg-[#14212D] p-3 ring-1 ring-white/[0.04] sm:p-4"
    >
      {/* tier-coloured top line + soft glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.18] blur-3xl"
        style={{ backgroundColor: tier.color }}
      />
      {tier.shimmer && !reduce && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
          animate={{ x: ['0%', '450%'] }}
          transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
        />
      )}

      <div className="relative flex items-start gap-3">
        <motion.span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: `${tier.color}22`, color: tier.color, boxShadow: `inset 0 0 0 1px ${tier.color}44` }}
          animate={reduce ? undefined : { y: [0, -2.5, 0] }}
          transition={{ duration: 3 + (index % 3) * 0.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon className="h-6 w-6" fill={tier.filled ? 'currentColor' : 'none'} aria-hidden="true" />
        </motion.span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className="truncate rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider sm:text-[11px]"
              style={{ backgroundColor: `${tier.color}22`, color: tier.color }}
            >
              {tier.title}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-slate-500">
              #{String(signal.id).padStart(2, '0')}
            </span>
          </div>
          <h3 className="mt-1.5 break-words text-[15px] font-semibold leading-snug text-white sm:text-base">
            {signal.name}
          </h3>
        </div>
      </div>

      <p className="relative mt-3 flex-1 text-[13px] leading-relaxed text-slate-400 sm:text-sm">
        {signal.description}
      </p>

      <button
        type="button"
        onClick={onSelect}
        aria-label={`Get ${signal.name} for ${usdFmt.format(signal.price)}`}
        className="relative mt-4 flex w-full items-center justify-between gap-3 rounded-xl bg-[#0E1822] px-3.5 py-3 text-left ring-1 ring-white/10 transition-colors hover:ring-[#3DDC97]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Price</span>
          <span className="block text-2xl font-extrabold tabular-nums tracking-tight text-white sm:text-[26px]">
            {usdFmt.format(signal.price)}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#3DDC97]/[0.15] px-2.5 py-1.5 text-xs font-semibold text-[#3DDC97]">
          Get signal
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </button>
    </motion.li>
  )
}

/* ────────────────────────────────────────────────
   PAYMENT POP-UP (bottom sheet on mobile, centred on desktop)
──────────────────────────────────────────────── */

function PayModal({ signal, rates, loading, failed, onReload, onClose, onProceed, reduce }) {
  const tier = tierFor(signal.price)
  const { Icon } = tier
  const closeRef = useRef(null)
  const amounts = useMemo(() => calcAmounts(signal.price, rates), [signal.price, rates])

  // lock page scroll, close on Escape, focus the close button
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signal-modal-title"
    >
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#14212D] shadow-2xl ring-1 ring-white/10 sm:max-w-lg sm:rounded-2xl"
        initial={{ opacity: 0, y: reduce ? 0 : 60, scale: reduce ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 30 } }}
        exit={{ opacity: 0, y: reduce ? 0 : 40, transition: { duration: 0.18 } }}
      >
        {/* header */}
        <div className="relative shrink-0 border-b border-white/[0.06] p-3.5 sm:p-5">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }}
          />
          <div className="flex items-start gap-3">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
              style={{ backgroundColor: `${tier.color}22`, color: tier.color, boxShadow: `inset 0 0 0 1px ${tier.color}44` }}
            >
              <Icon className="h-6 w-6" fill={tier.filled ? 'currentColor' : 'none'} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: tier.color }}>
                {tier.title} signal
              </p>
              <h2 id="signal-modal-title" className="break-words text-base font-semibold text-white sm:text-lg">
                {signal.name}
              </h2>
              <p className="mt-0.5 text-2xl font-extrabold tabular-nums tracking-tight text-white">
                {usdFmt.format(signal.price)}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain p-3.5 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-white sm:text-sm">Pay with BTC, ETH or USDT</p>
            <button
              type="button"
              onClick={onReload}
              disabled={loading}
              aria-label="Refresh live rates"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-slate-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60 sm:text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {rates ? (
                <span>
                  <RateAge ts={rates.ts} />
                </span>
              ) : (
                <span>Fetching…</span>
              )}
            </button>
          </div>

          {!rates && failed && (
            <InlineError message="Live rates are unavailable right now. Please try again in a moment." onRetry={onReload} />
          )}

          {!rates && !failed && (
            <div className="space-y-2.5" role="status" aria-label="Loading live rates">
              {[0, 1, 2].map((i) => (
                <Block key={i} className="h-[74px]" />
              ))}
            </div>
          )}

          {rates && amounts && (
            <ul className="space-y-2.5">
              {ASSETS.map((a, i) => (
                <motion.li
                  key={a.key}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 0.05 * i, duration: 0.25 }}
                  className="flex items-center gap-3 rounded-xl bg-[#0E1822] p-3 ring-1 ring-white/10"
                >
                  <span
                    className="grid h-10 w-12 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-bold"
                    style={{ backgroundColor: `${a.color}26`, color: a.color }}
                  >
                    {a.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] text-slate-400 sm:text-xs">
                      {a.name} · 1 {a.label} = {rateFmt.format(rates[a.key])}
                    </span>
                    <motion.span
                      key={amounts[a.key]}
                      initial={reduce ? false : { opacity: 0.35 }}
                      animate={{ opacity: 1 }}
                      className="block break-all font-mono text-lg font-semibold tabular-nums text-[#3DDC97] sm:text-xl"
                    >
                      {amounts[a.key]} <span className="text-xs font-medium text-slate-300">{a.label}</span>
                    </motion.span>
                  </span>
                  <CopyIconBtn text={amounts[a.key]} label={`Copy ${a.label} amount`} />
                </motion.li>
              ))}
            </ul>
          )}

          {rates && failed && (
            <p className="text-[11px] text-amber-300 sm:text-xs">
              Could not refresh just now. Showing the last known rates.
            </p>
          )}

          {rates && (
            <p className="text-[11px] text-slate-500 sm:text-xs">Live rate via {rates.source}.</p>
          )}

          <section aria-label="Before you pay" className="rounded-2xl bg-amber-400/[0.08] p-3.5 sm:p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-200 sm:text-sm">
              <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
              Before you pay
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-amber-100/80 sm:text-[13px]">
              <li>Choose one coin (BTC, ETH or USDT) and pay the exact amount shown for it.</li>
              <li>Amounts are live estimates, rounded up. The final USD credit is set at the live rate on the deposit page.</li>
              <li>Pick the matching network on the deposit page for the coin you send.</li>
            </ul>
          </section>
        </div>

        {/* footer */}
        <div className="shrink-0 space-y-2.5 border-t border-white/[0.06] p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:p-5">
          <button type="button" onClick={onProceed} disabled={!rates} className={`${primaryBtn} w-full`}>
            {!rates && loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Getting live rates…
              </>
            ) : (
              <>
                Proceed to deposit
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
          <button type="button" onClick={onClose} className={`${ghostBtn} w-full`}>
            Cancel
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Signals() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()

  const [status, setStatus] = useState('checking') // checking | eligible | denied | error
  const [errMsg, setErrMsg] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState(null)

  const { rates, loading, failed, reload } = useLiveRates(status === 'eligible', Boolean(selected))

  // Eligibility check on every page open (state is only set inside the promise callbacks)
  useEffect(() => {
    let live = true
    api
      .get('/api/signals/eligibility/')
      .then((res) => {
        if (!live) return
        setStatus(res.data?.data?.eligible === true ? 'eligible' : 'denied')
      })
      .catch((err) => {
        if (!live) return
        setErrMsg(loadError(err))
        setStatus('error')
      })
    return () => {
      live = false
    }
  }, [attempt])

  const retry = () => {
    setErrMsg('')
    setStatus('checking')
    setAttempt((a) => a + 1)
  }

  const close = useCallback(() => setSelected(null), [])

  const proceed = () => {
    if (!selected || !rates) return
    const a = calcAmounts(selected.price, rates)
    navigate('/dashboard/deposit', {
      state: {
        fromSignal: {
          id: selected.id,
          name: selected.name,
          usd: selected.price,
          usdt: a.usdt,
          btc: a.btc,
          eth: a.eth,
        },
      },
    })
  }

  return (
    <div>
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
        <HeaderCard eligible={status === 'eligible'} reduce={reduce} />

        {status === 'checking' && <CheckingSkeleton />}

        {status === 'error' && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-[#14212D] p-3 sm:p-4"
          >
            <InlineError message={errMsg} onRetry={retry} />
          </motion.div>
        )}

        {status === 'denied' && <DeniedCard reduce={reduce} />}

        {status === 'eligible' && (
          <>
            <motion.ul
              role="list"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
              variants={container}
              initial={reduce ? false : 'hidden'}
              animate="show"
            >
              {SIGNALS.map((s, i) => (
                <SignalCard key={s.id} signal={s} index={i} reduce={reduce} onSelect={() => setSelected(s)} />
              ))}
            </motion.ul>

            <p className="px-1 pb-2 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
              Signals are market analysis, not financial advice. Trading involves risk, so only trade what you can
              afford to lose.
            </p>
          </>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <PayModal
            key={selected.id}
            signal={selected}
            rates={rates}
            loading={loading}
            failed={failed}
            onReload={reload}
            onClose={close}
            onProceed={proceed}
            reduce={reduce}
          />
        )}
      </AnimatePresence>
    </div>
  )
}