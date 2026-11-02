// src/pages/inside/copyTradeUtils.js

/* ───────────── CONFIG ───────────── */

export const TRADE_ROUTE = '/dashboard/trade'
export const DEPOSIT_ROUTE = '/dashboard/deposit'
export const DASHBOARD_ROUTE = '/dashboard'
// Set to false if your backend CORS config does not yet allow the Idempotency-Key header
export const SEND_IDEMPOTENCY_KEY = true

export const GREEN = '#3DDC97'
export const RED = '#F6465D' // losses are red
export const AMBER = '#FBBF24'

export const WEEKEND_MSG = 'Trading is closed for the weekend. You can open new trades again from Monday. Your open trades stay open until they are settled.'

export const primaryBtn =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-5 text-[13px] font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm'
export const ghostBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-[13px] font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60 sm:text-sm'
export const iconBtn =
  'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.08] text-slate-200 transition-colors hover:bg-white/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70'
export const fieldCls =
  'w-full rounded-xl bg-[#0E1822] px-3.5 py-3 font-mono text-[15px] text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#3DDC97]/70'

/* ───────────── HELPERS ───────────── */

export const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const money = (v) =>
  `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const signedPct = (v, d = 2) => `${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(d)}%`

export const fmtM = (n) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

export const cleanDec = (raw, dec = 2) => {
  let v = String(raw).replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const i = v.indexOf('.')
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '').slice(0, dec)
  return v.replace(/^0+(?=\d)/, '').slice(0, 12)
}

export const uuid = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const flatten = (v) => {
  if (v == null) return []
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(flatten)
  if (typeof v === 'object') return Object.values(v).flatMap(flatten)
  return [String(v)]
}

export function describeError(err, fallback) {
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.' }
  const { status, data } = res
  const msg = typeof data?.message === 'string' ? data.message : ''
  if (status === 400) {
    const first = flatten(data?.errors)[0]
    return {
      message: first || msg || 'Please check the trade details and try again.',
      insufficient: data?.code === 'insufficient_funds',
    }
  }
  if (status === 401) return { message: 'Your session has expired. Please sign in again to continue.' }
  if (status === 403) {
    if (data?.code === 'kyc_required') {
      return {
        message: msg || 'Complete identity verification (KYC) before trading.',
        action: { to: '/dashboard/kyc', label: 'Verify identity' },
      }
    }
    if (data?.code === 'trade_limit_reached') {
      return {
        message: msg || 'You reached your open trade limit.',
        action: { to: DEPOSIT_ROUTE, label: 'Top up balance' },
      }
    }
    if (data?.code === 'market_closed') return { message: WEEKEND_MSG }
    return { message: msg || 'Trading is not available right now.' }
  }
  if (status === 429) return { message: 'Too many requests. Please wait a moment and try again.' }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.' }
  return { message: msg || fallback }
}

/* ───────────── ELIGIBILITY (by available balance) ───────────── */

const TIER1_MAX = 500
const TIER2_MAX = 2000
const TIERS = {
  1: { lev: 10, wr: 70 },
  2: { lev: 15, wr: 85 },
  3: { lev: Infinity, wr: 100 },
}

export function getTier(balance) {
  return balance < TIER1_MAX ? 1 : balance < TIER2_MAX ? 2 : 3
}

export function getEligibility(balance, trader, minAmount = 10) {
  const tier = getTier(balance)
  const cap = TIERS[tier]
  const reasons = []
  if (balance < minAmount) {
    reasons.push(`Your available balance is below the ${money(minAmount)} minimum trade amount.`)
  }
  if (trader.leverage > cap.lev) {
    reasons.push(`Its average leverage (${trader.leverage.toFixed(1)}x) is above the ${cap.lev}x limit for your balance tier.`)
  }
  if (trader.winRate > cap.wr) {
    reasons.push(`Its win rate (${trader.winRate.toFixed(1)}%) is above the ${cap.wr}% limit for your balance tier.`)
  }
  const next = tier === 1 ? TIER1_MAX : tier === 2 ? TIER2_MAX : null
  return { ok: reasons.length === 0, reasons, tier, next }
}

/* ───────────── ENTRY PRICE ───────────── */
// The Trade page reads `tradeEntry:<id>` from localStorage as the entry price of a trade.
// We save the live price when the trade opens so the Trade page shows the right entry straight away.

const tmo = (ms) =>
  typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined

export async function quickPrice(pair) {
  const [b, q] = pair.split('/')
  try {
    if (q === 'USDT') {
      for (const host of ['https://api.binance.com', 'https://data-api.binance.vision']) {
        try {
          const r = await fetch(`${host}/api/v3/ticker/price?symbol=${b}USDT`, { signal: tmo(5000) })
          if (r.ok) {
            const p = num((await r.json()).price)
            if (p > 0) return p
          }
        } catch {
          /* try next host */
        }
      }
      return 0
    }
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: tmo(5000) })
    if (!r.ok) return 0
    const rates = (await r.json()).rates || {}
    const rb = b === 'USD' ? 1 : rates[b]
    const rq = q === 'USD' ? 1 : rates[q]
    return rb && rq ? rq / rb : 0
  } catch {
    return 0
  }
}

export function saveEntry(id, price) {
  if (!price) return
  try {
    const k = `tradeEntry:${id}`
    if (!localStorage.getItem(k)) localStorage.setItem(k, String(price))
  } catch {
    /* ignore */
  }
}