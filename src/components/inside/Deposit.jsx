// src/pages/inside/Deposit.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Info,
  Loader2,
  RefreshCw,
  TrendingUp,
  UploadCloud,
  Wallet,
  X,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const HIDE_KEY = 'balanceHidden'
const MASK = '••••••'
const PAY_WINDOW_MS = 30 * 60 * 1000 // 30 minutes to pay (and upload the screenshot)
const REVIEW_SECONDS = 5 // "pending review" screen before redirecting
const QUICK_AMOUNTS = [50, 100, 250, 500, 1000] // USDT units, or USD for BTC / ETH
const DEFAULT_DECIMALS = 6
const DEFAULT_REFRESH_SECONDS = 30
const STEPS = ['Amount', 'Payment', 'Proof', 'Review']
const PHASE_INDEX = { form: 0, pay: 1, proof: 2, review: 3 }

// Screenshot upload limits. The server config (screenshot_max_mb / screenshot_formats) overrides these.
const DEFAULT_MAX_MB = 5
const DEFAULT_FORMATS = ['jpg', 'png', 'webp', 'heic']
const UPLOAD_TIMEOUT_MS = 120 * 1000 // slow mobile connections need time
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const IMAGE_ACCEPT = 'image/*,.heic,.heif'

// Network preselected when the user arrives from the Signals page
const SIGNAL_NETWORK = 'bep20'

// QR images live in /public and are named after the network value (bep20.jfif, btc.jfif, eth.jfif ...)
const QR_EXTENSIONS = ['jfif', 'png', 'jpg', 'jpeg', 'webp']

const ASSET_NAMES = { usdt: 'Tether USD', btc: 'Bitcoin', eth: 'Ethereum' }

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
  btc: 'bg-orange-400/[0.15] text-orange-300',
  eth: 'bg-indigo-400/[0.15] text-indigo-300',
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

// Rates need more precision than balances: $1.0002, $95,123.45
function makeRate(currency) {
  try {
    const f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })
    return (v) => f.format(num(v))
  } catch {
    return (v) => `$${num(v)}`
  }
}

// "500.000000" -> "500", "12.500000" -> "12.5"
const trimZeros = (v) => {
  const s = String(v ?? '')
  if (!s.includes('.')) return s
  return s.replace(/0+$/, '').replace(/\.$/, '')
}

// Rounds UP to `d` decimals and returns a fixed string (used for minimums and quick amounts)
const ceilTo = (v, d) => {
  const f = 10 ** d
  return (Math.ceil(v * f - 1e-9) / f).toFixed(d)
}

// Keeps only digits and one dot, at most `maxDecimals` decimals
function cleanAmount(raw, maxDecimals = DEFAULT_DECIMALS) {
  let v = String(raw).replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const i = v.indexOf('.')
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '').slice(0, maxDecimals)
  v = v.replace(/^0+(?=\d)/, '')
  if (v.startsWith('.')) v = `0${v}`
  return v.slice(0, 18)
}

// "USDT (BEP20 – BNB Smart Chain)" -> { title: "USDT", sub: "BEP20 – BNB Smart Chain" }
function splitLabel(label, fallback) {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(label || '')
  if (m) return { title: m[1] || 'USDT', sub: m[2] }
  return { title: label || fallback.toUpperCase(), sub: '' }
}

// A network can be used only when the server says so, it has an address and a live rate
const isNetworkAvailable = (n) => Boolean(n?.deposit_enabled) && Boolean(n?.deposit_address) && num(n?.rate) > 0

const assetFromNetwork = (network) => (network === 'btc' ? 'btc' : network === 'eth' ? 'eth' : 'usdt')

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

// Reads the signal sent by the Signals page through router state. Returns null when the
// user did not come from there (or the data is unusable), so nothing special happens.
function readSignal(state) {
  const s = state?.fromSignal
  if (!s || !(num(s.usdt) > 0)) return null
  return {
    id: s.id,
    name: String(s.name || 'trading signal'),
    usd: num(s.usd),
    usdt: trimZeros(String(s.usdt)),
  }
}

// Clears the router state so a refresh of this page does not replay the signal pre-fill
function clearSignalState() {
  try {
    const st = window.history.state
    if (st && typeof st === 'object' && st.usr) {
      window.history.replaceState({ ...st, usr: null }, '')
    }
  } catch {
    /* ignore, worst case the pop-up shows again after a refresh */
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

// Errors for creating a deposit. Returns { message, amount?, action?, refresh? }
function describeSubmitError(err) {
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.' }

  const { status, data } = res
  const code = data?.code
  const serverMsg = typeof data?.message === 'string' ? data.message : ''

  if (status === 400) {
    // Minimum is checked in USD at the live rate, so show the server message under the amount
    if (code === 'deposit_below_minimum') {
      return { message: '', amount: serverMsg || 'The amount is below the minimum deposit.', refresh: true }
    }
    const amount = flatten(data?.errors?.amount)[0] || flatten(data?.errors?.usdt_amount)[0]
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
    if (code === 'rate_unavailable') {
      return { message: 'Rate temporarily unavailable, please try again in a moment.', refresh: true }
    }
    return {
      message: serverMsg || 'Deposits on this network are temporarily unavailable. Please try another network.',
      refresh: true,
    }
  }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.' }
  return { message: serverMsg || 'We could not create your deposit. Please try again.' }
}

// Checks a chosen screenshot BEFORE uploading. Returns an error string, or '' when it is fine.
// (The server re-checks the real file content, this only saves a wasted upload.)
function checkScreenshot(file, maxMb, formats) {
  if (!file) return 'Please choose a screenshot of your payment.'
  if (!file.size) return 'The selected file is empty.'
  if (file.size > maxMb * 1024 * 1024) return `The image is too large. The maximum size is ${maxMb} MB.`
  const ext = (file.name.split('.').pop() || '').toLowerCase().replace('jpeg', 'jpg').replace('heif', 'heic')
  const okType = IMAGE_MIME.includes((file.type || '').toLowerCase()) || formats.includes(ext)
  if (!okType) return `Upload a ${formats.map((f) => f.toUpperCase()).join(', ')} image.`
  return ''
}

// Errors for POST /deposits/{id}/screenshot/.
// Returns { message, kind? } where kind: 'paid' (already marked as paid) | 'closed' (no longer pending / not found)
function describeUploadError(err) {
  if (err?.code === 'ECONNABORTED') {
    return { message: 'The upload took too long. Check your connection and try again.' }
  }
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.' }

  const { status, data } = res
  const code = data?.code
  const serverMsg = typeof data?.message === 'string' ? data.message : ''

  if (status === 400) {
    if (code === 'image_too_large') {
      const mb = num(data?.data?.max_mb)
      return { message: serverMsg || `The image is too large${mb ? `. The maximum size is ${mb} MB` : ''}.` }
    }
    if (code === 'invalid_image') return { message: serverMsg || 'Upload a JPG, PNG, WEBP or HEIC image.' }
    const first = flatten(data?.errors?.screenshot)[0] || flatten(data?.errors)[0]
    return { message: first || serverMsg || 'We could not read that file. Please choose another image.' }
  }
  if (status === 401) return { message: 'Your session has expired. Please sign in again to continue.' }
  if (status === 403) {
    return { message: serverMsg || 'Please verify your email address to continue.' }
  }
  if (status === 404) return { message: 'We could not find this deposit. Please start a new one.', kind: 'closed' }
  if (status === 409) {
    if (code === 'deposit_already_paid') return { message: '', kind: 'paid' }
    return { message: serverMsg || 'This deposit is no longer pending. Please start a new one.', kind: 'closed' }
  }
  if (status === 413) return { message: 'The image is too large. Please choose a smaller one.' }
  if (status === 429) {
    const secs = num(data?.data?.retry_after_seconds)
    return {
      message: secs
        ? `Too many uploads. Please wait ${secs} second${secs === 1 ? '' : 's'} and try again.`
        : 'Too many uploads. Please wait a moment and try again.',
    }
  }
  if (status === 502) return { message: 'We could not upload your image. Please try again.' }
  if (status === 503) return { message: 'Image uploads are temporarily unavailable. Please try again later.' }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.' }
  return { message: serverMsg || 'We could not upload your screenshot. Please try again.' }
}

// Errors for POST /deposits/{id}/paid/.
// kind: 'paid' (already marked as paid, treat as success) | 'closed' (no longer pending) | 'nofile' (no screenshot stored)
function describePaidError(err) {
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.' }

  const { status, data } = res
  const code = data?.code
  const serverMsg = typeof data?.message === 'string' ? data.message : ''

  if (status === 400) {
    if (code === 'screenshot_required') {
      return { message: serverMsg || 'Please upload a screenshot of your payment first.', kind: 'nofile' }
    }
    return { message: serverMsg || 'We could not confirm your payment. Please try again.' }
  }
  if (status === 401) return { message: 'Your session has expired. Please sign in again to continue.' }
  if (status === 403) return { message: serverMsg || 'Please verify your email address to continue.' }
  if (status === 404) return { message: 'We could not find this deposit. Please start a new one.', kind: 'closed' }
  if (status === 409) {
    if (code === 'deposit_already_paid') return { message: '', kind: 'paid' }
    return { message: serverMsg || 'This deposit is no longer pending. Please start a new one.', kind: 'closed' }
  }
  if (status === 429) {
    const secs = num(data?.data?.retry_after_seconds)
    return {
      message: secs
        ? `Too many requests. Please wait ${secs} second${secs === 1 ? '' : 's'} and try again.`
        : 'Too many requests. Please wait a moment and try again.',
    }
  }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.' }
  return { message: serverMsg || 'We could not confirm your payment. Please try again.' }
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

// "Rate updated 12s ago" (ticks every second on its own, so the page does not re-render)
function RateAge({ ts }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const t = ts ? Date.parse(ts) : NaN
  if (!Number.isFinite(t)) return null
  const s = Math.max(0, Math.floor((now - t) / 1000))
  const text = s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`
  return <span>Rate updated {text}</span>
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

// Loads /{network}.jfif (btc.jfif, eth.jfif, bep20.jfif ...) and falls back to other common extensions
function QrImage({ network }) {
  const [extIndex, setExtIndex] = useState(0)
  const failed = extIndex >= QR_EXTENSIONS.length
  const label = String(network || '').toUpperCase()

  return (
    <div className="grid h-44 w-44 place-items-center overflow-hidden rounded-2xl bg-white p-2.5 sm:h-52 sm:w-52">
      {!failed ? (
        <img
          key={extIndex}
          src={`/${network}.${QR_EXTENSIONS[extIndex]}`}
          alt={`QR code for the ${label} deposit address`}
          className="h-full w-full object-contain"
          onError={() => setExtIndex((i) => i + 1)}
          draggable="false"
        />
      ) : (
        <p className="px-3 text-center text-xs text-slate-600">QR code unavailable. Copy the address below instead.</p>
      )}
    </div>
  )
}

// The countdown card shown on both the Payment and Proof steps
function TimerCard({ left, reduce }) {
  const expired = left <= 0
  const pct = Math.min(100, (left / PAY_WINDOW_MS) * 100)
  const urgent = left < 60 * 1000
  const warn = left < 5 * 60 * 1000
  const timerColor = urgent ? 'text-[#F6465D]' : warn ? 'text-amber-300' : 'text-[#3DDC97]'
  const barColor = urgent ? 'bg-[#F6465D]' : warn ? 'bg-amber-400' : 'bg-[#3DDC97]'

  return (
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
        {expired ? 'Time is up. Closing this request…' : 'This request closes automatically when the timer ends.'}
      </p>
    </section>
  )
}

// Image preview that hides itself (shows a placeholder) when the browser cannot render the file (e.g. HEIC)
function ProofImage({ src, alt }) {
  const [broken, setBroken] = useState(false)

  if (!src || broken) {
    return (
      <div className="grid h-40 w-full place-items-center rounded-xl bg-white/[0.04] px-4 text-center text-xs text-slate-400">
        Preview not available for this file type
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className="max-h-72 w-full rounded-xl bg-black/30 object-contain"
      draggable="false"
    />
  )
}

/* ────────────────────────────────────────────────
   SIGNAL PURCHASE POP-UP (only shown when arriving from the Signals page)
──────────────────────────────────────────────── */

function SignalNoticeModal({ signal, onClose, reduce }) {
  const okRef = useRef(null)
  const usd = useMemo(() => makeMoney('USD')(signal.usd), [signal.usd])

  // lock page scroll, close on Escape, focus the main button
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    okRef.current?.focus()
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
      aria-labelledby="signal-notice-title"
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
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#14212D] shadow-2xl ring-1 ring-white/10 sm:max-w-md sm:rounded-2xl"
        initial={{ opacity: 0, y: reduce ? 0 : 60, scale: reduce ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 30 } }}
        exit={{ opacity: 0, y: reduce ? 0 : 40, transition: { duration: 0.18 } }}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-white/[0.06] p-3.5 sm:p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#3DDC97]/[0.15] text-[#3DDC97]">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="signal-notice-title" className="text-base font-semibold text-white sm:text-lg">
              Complete your signal purchase
            </h2>
            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400 sm:text-sm">
              Proceed with the payment below to complete your purchase of{' '}
              <span className="font-medium text-slate-200">{signal.name}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain p-3.5 sm:p-5">
          <dl className="space-y-2.5 rounded-xl bg-[#0E1822] p-3.5 text-[13px] sm:text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Signal</dt>
              <dd className="min-w-0 break-words text-right font-medium text-white">{signal.name}</dd>
            </div>
            {signal.usd > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-400">Price</dt>
                <dd className="font-mono font-semibold tabular-nums text-white">{usd}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Network</dt>
              <dd>
                <span
                  className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                    NETWORK_STYLE[SIGNAL_NETWORK] || NETWORK_FALLBACK
                  }`}
                >
                  USDT · BEP20
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2.5">
              <dt className="font-medium text-slate-200">Amount to send</dt>
              <dd className="break-all text-right font-mono text-base font-semibold tabular-nums text-[#3DDC97]">
                {signal.usdt} USDT
              </dd>
            </div>
          </dl>

          <section aria-label="Before you pay" className="rounded-2xl bg-amber-400/[0.08] p-3.5 sm:p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-200 sm:text-sm">
              <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
              Before you continue
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-amber-100/80 sm:text-[13px]">
              <li>The amount is already filled in for you. Do not change it except you want to pay with a different asset.</li>
              <li>Tap “Continue to payment”, then send the exact amount to the address shown.</li>
              <li>Your signal purchase is only complete once the payment is made.</li>
            </ul>
          </section>
        </div>

        <div className="shrink-0 border-t border-white/[0.06] p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:p-5">
          <button ref={okRef} type="button" onClick={onClose} className={`${primaryBtn} w-full`}>
            Got it, proceed with payment
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
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
  const available = isNetworkAvailable(n)
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
          {available ? sub || ASSET_NAMES[n.asset] || String(n.asset || '').toUpperCase() : 'Temporarily unavailable'}
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
  chip,
  onQuick,
  setNetwork,
  activeNetwork,
  asset,
  unit,
  decimals,
  rate,
  fmtRate,
  minUsd,
  minText,
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
  const showSummary = amt > 0 && rate > 0
  const isStable = asset === 'usdt'

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

  // USDT: quick amounts are USDT. BTC / ETH: quick amounts are USD, converted at the estimated rate.
  const quick = rate > 0 ? QUICK_AMOUNTS.filter((q) => (isStable ? q * rate >= minUsd : q >= minUsd)) : []

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
            placeholder={isStable ? '0.00' : `0.${'0'.repeat(decimals)}`}
            value={amount}
            onChange={(e) => setAmount(cleanAmount(e.target.value, decimals))}
            aria-invalid={Boolean(amountMsg)}
            aria-describedby="deposit-amount-hint"
            disabled={submitting}
            className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-semibold tabular-nums text-white placeholder:text-slate-600 focus:outline-none sm:text-3xl"
          />
          <span className="shrink-0 rounded-lg bg-[#3DDC97]/[0.15] px-2.5 py-1 font-mono text-xs font-bold text-[#3DDC97] sm:text-sm">
            {unit}
          </span>
        </div>

        <p
          id="deposit-amount-hint"
          className={`mt-2 px-0.5 text-[11px] sm:text-xs ${amountMsg ? 'text-red-300' : 'text-slate-400'}`}
          aria-live="polite"
        >
          {amountMsg || (rate > 0 ? `Minimum deposit is ${money(minUsd)} (≈ ${minText} ${unit}).` : 'Choose an available network to continue.')}
        </p>

        {quick.length > 0 && (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {quick.map((q) => {
                const on = isStable ? amount === String(q) : chip === q
                const label = isStable ? q.toLocaleString('en-US') : `$${q.toLocaleString('en-US')}`
                return (
                  <button
                    key={q}
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      isStable ? onQuick(String(q), q) : onQuick(trimZeros(ceilTo(q / rate, decimals)), q)
                    }
                    aria-pressed={on}
                    className={`h-9 rounded-full px-3.5 font-mono text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:opacity-60 sm:text-[13px] ${
                      on ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {!isStable && (
              <p className="mt-2 px-0.5 text-[11px] text-slate-500 sm:text-xs">
                Quick amounts are in USD and converted to {unit} at the estimated rate.
              </p>
            )}
          </>
        )}
      </section>

      {/* Network */}
      <section aria-label="Network" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        <p className="px-0.5 text-[13px] font-semibold text-white sm:text-sm">Choose a network</p>
        <p className="mt-0.5 px-0.5 text-[11px] text-slate-400 sm:text-xs">
          You will send {unit} on the network you pick here.
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
            <div className="rounded-2xl bg-[#14212D] p-4">
              <dl className="space-y-2.5 text-[13px] sm:text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">You send</dt>
                  <dd className="break-all text-right font-mono font-semibold tabular-nums text-white">
                    {trimZeros(amount)} {unit}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Estimated rate</dt>
                  <dd className="font-mono tabular-nums text-slate-200">
                    1 {unit} = {fmtRate(rate)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2.5">
                  <dt className="font-medium text-slate-200">Estimated credit</dt>
                  <dd className="font-mono text-base font-semibold tabular-nums text-[#3DDC97]">≈ {money(usd)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500 sm:text-xs">
                <RateAge ts={activeNetwork?.rate_updated_at} />
                {activeNetwork?.rate_updated_at ? '. ' : ''}
                The final USD credit is set at the live rate when you continue and can differ slightly from this estimate.
              </p>
            </div>
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

function PayStep({ deposit, left, onNext, onCancel, cancelling, money, fmtRate, reduce }) {
  const expired = left <= 0
  const amountText = trimZeros(deposit.amount)
  const unit = String(deposit.asset || assetFromNetwork(deposit.network)).toUpperCase()
  const netLabel = deposit.network.toUpperCase()
  const lockedRate = num(deposit.rate)
  const busy = cancelling || expired

  return (
    <div className="space-y-4 sm:space-y-5">
      <TimerCard left={left} reduce={reduce} />

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
              {amountText} <span className="text-base text-slate-300 sm:text-lg">{unit}</span>
            </p>
            <CopyIconBtn text={amountText} label="Copy amount" />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400 sm:text-xs">
            You will be credited <span className="font-medium text-slate-200">{money(num(deposit.usd_amount))}</span>
            {lockedRate > 0 && (
              <>
                {' '}
                at <span className="font-mono text-slate-300">1 {unit} = {fmtRate(lockedRate)}</span>
              </>
            )}
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
            Send exactly {amountText} {unit}. A different amount may delay or block your credit.
          </li>
          <li>Use the {netLabel} network only. Funds sent on another network can be lost.</li>
          <li>After your transfer, take a screenshot of the payment. You will upload it in the next step.</li>
        </ul>
      </section>

      {/* Actions */}
      <div className="space-y-2.5">
        <button type="button" onClick={onNext} disabled={busy} className={`${primaryBtn} w-full`}>
          I have sent the payment
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
   STEP 3: UPLOAD PAYMENT SCREENSHOT, THEN "I HAVE PAID"
──────────────────────────────────────────────── */

function ProofStep({
  deposit,
  left,
  localPreview,
  uploading,
  progress,
  paying,
  cancelling,
  error,
  maxMb,
  formats,
  onPick,
  onBack,
  onPaid,
  onCancel,
  reduce,
}) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const expired = left <= 0
  const hasShot = Boolean(deposit.has_screenshot)
  const busy = uploading || paying || cancelling
  const locked = busy || expired
  const amountText = trimZeros(deposit.amount)
  const unit = String(deposit.asset || assetFromNetwork(deposit.network)).toUpperCase()
  const netLabel = deposit.network.toUpperCase()
  const formatText = formats.map((f) => f.toUpperCase()).join(', ')

  // While uploading show the local file, afterwards the copy stored on the server
  const previewSrc = uploading ? localPreview : deposit.screenshot_thumbnail_url || localPreview

  const choose = (file) => {
    if (file && !locked) onPick(file)
  }

  const onInput = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allows picking the same file again
    choose(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    choose(e.dataTransfer?.files?.[0])
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <TimerCard left={left} reduce={reduce} />

      {/* What was paid, as a reminder */}
      <section aria-label="Payment summary" className="rounded-2xl bg-[#14212D] p-3.5 sm:p-4">
        <dl className="space-y-2 text-[13px] sm:text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">Amount sent</dt>
            <dd className="break-all text-right font-mono font-semibold tabular-nums text-[#3DDC97]">
              {amountText} {unit}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">Network</dt>
            <dd>
              <span
                className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                  NETWORK_STYLE[deposit.network] || NETWORK_FALLBACK
                }`}
              >
                {netLabel}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">Reference</dt>
            <dd className="font-mono text-slate-200">{deposit.reference}</dd>
          </div>
        </dl>
      </section>

      {/* Upload */}
      <section aria-label="Upload payment screenshot" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
        <p className="px-0.5 text-[13px] font-semibold text-white sm:text-sm">Upload a screenshot of your payment</p>
        <p className="mt-0.5 px-0.5 text-[11px] leading-relaxed text-slate-400 sm:text-xs">
          Show the amount, network, receiving address and transaction ID or hash if you can. Our team checks this before
          crediting your balance.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={onInput}
          disabled={locked}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        <div className="mt-3">
          {!hasShot && !uploading ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                if (!locked) setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              disabled={locked}
              className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60 ${
                dragging
                  ? 'border-[#3DDC97] bg-[#3DDC97]/[0.08]'
                  : 'border-white/15 bg-[#0E1822] hover:border-white/30'
              }`}
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#3DDC97]/[0.15] text-[#3DDC97]">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-[13px] font-medium text-white sm:text-sm">Tap to choose a screenshot</span>
              <span className="text-[11px] text-slate-400 sm:text-xs">
                {formatText} · up to {maxMb} MB
              </span>
            </button>
          ) : (
            <div className="rounded-xl bg-[#0E1822] p-3">
              {hasShot && !uploading && deposit.screenshot_url ? (
                <a href={deposit.screenshot_url} target="_blank" rel="noopener noreferrer" className="block">
                  <ProofImage src={previewSrc} alt="Your uploaded payment screenshot" />
                </a>
              ) : (
                <ProofImage src={previewSrc} alt="Your payment screenshot" />
              )}

              {uploading ? (
                <div className="mt-3" role="status" aria-live="polite">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-[#3DDC97] transition-[width] duration-200 ease-out"
                      style={{ width: `${Math.max(4, progress)}%` }}
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-[12px] text-slate-300 sm:text-[13px]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#3DDC97]" aria-hidden="true" />
                    {progress >= 100 ? 'Processing your image…' : `Uploading… ${progress}%`}
                  </p>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[12px] font-medium text-[#9BF0C8] sm:text-[13px]">
                    <CheckCircle2 className="h-4 w-4 text-[#3DDC97]" aria-hidden="true" />
                    Screenshot uploaded
                  </p>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={locked}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-slate-200 ring-1 ring-white/15 transition-colors hover:text-white hover:ring-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Replace
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              key="proof-error"
              className="mt-3"
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <InlineError message={error} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Actions */}
      <div className="space-y-2.5">
        <button type="button" onClick={onPaid} disabled={!hasShot || locked} className={`${primaryBtn} w-full`}>
          {paying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Confirming…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              I have paid
            </>
          )}
        </button>
        {!hasShot && !uploading && (
          <p className="text-center text-[11px] text-slate-500 sm:text-xs">Upload your screenshot to enable this button.</p>
        )}
        <div className="flex gap-2.5">
          <button type="button" onClick={onBack} disabled={locked} className={`${ghostBtn} flex-1 px-3`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Payment details
          </button>
          <button type="button" onClick={onCancel} disabled={locked} className={`${ghostBtn} flex-1 px-3`}>
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
    </div>
  )
}

/* ────────────────────────────────────────────────
   STEP 4: PENDING REVIEW
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
        We have received your payment confirmation and screenshot
        {deposit?.reference ? ` (${deposit.reference})` : ''}. Your balance will be credited once the payment is
        confirmed.
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
  const location = useLocation()

  // Set only when the user was sent here from the Signals page, otherwise null
  const [signalInfo] = useState(() => readSignal(location.state))
  const signalRef = useRef(signalInfo)
  const signalDone = useRef(false)
  const [signalModal, setSignalModal] = useState(false)

  // flow
  const [phase, setPhase] = useState('form') // form | pay | proof | review
  const [deposit, setDeposit] = useState(null)
  const [endAt, setEndAt] = useState(null)
  const [notice, setNotice] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  // screenshot proof
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [paying, setPaying] = useState(false)
  const [proofError, setProofError] = useState('')
  const [localPreview, setLocalPreview] = useState(null) // object URL of the file the user just picked

  // form
  const [amount, setAmount] = useState('')
  const [chip, setChip] = useState(null) // selected USD quick amount (BTC / ETH only)
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
  const cfgBusy = useRef(false)
  const busyRef = useRef(false) // true while a screenshot upload or the "I have paid" call is running
  const expireLater = useRef(false) // timer ended during an upload: close the request when it finishes
  const closeRef = useRef(null)
  const previewRef = useRef(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  // Keeps exactly one local object URL alive and frees the previous one
  const setPreview = useCallback((url) => {
    if (previewRef.current && previewRef.current !== url) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setLocalPreview(url)
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
        if (data && typeof data === 'object') {
          setCfg(data)

          // Arrived from the Signals page: prefill the USDT amount, pick USDT BEP20 and show the pop-up.
          // Runs once, and only if that network is actually usable (so a USDT number never lands in BTC / ETH).
          const sig = signalRef.current
          if (sig && !signalDone.current) {
            signalDone.current = true
            const bep = (Array.isArray(data.networks) ? data.networks : []).find(
              (n) =>
                n.value === SIGNAL_NETWORK &&
                isNetworkAvailable(n) &&
                String(n.asset || 'usdt').toLowerCase() === 'usdt',
            )
            if (bep) {
              setNetwork(SIGNAL_NETWORK)
              setAmount(cleanAmount(sig.usdt, num(bep.decimals) || DEFAULT_DECIMALS))
              setSignalModal(true)
            }
            clearSignalState()
          }
        } else setCfgErr('We could not read the deposit settings.')
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

  // Silent refresh of the config (live rates). Errors are ignored, the last good rates stay on screen.
  const refreshConfig = useCallback(() => {
    if (cfgBusy.current) return
    cfgBusy.current = true
    api
      .get('/api/wallet/config/')
      .then((res) => {
        if (!alive.current) return
        const data = res.data?.data
        if (data && typeof data === 'object') setCfg(data)
      })
      .catch(() => {})
      .finally(() => {
        cfgBusy.current = false
      })
  }, [])

  const hasCfg = Boolean(cfg)
  const refreshMs = Math.max(5, num(cfg?.rate_refresh_seconds) || DEFAULT_REFRESH_SECONDS) * 1000

  // Re-fetch rates every rate_refresh_seconds while the form is visible. Paused when the tab is hidden.
  useEffect(() => {
    if (phase !== 'form' || !hasCfg) return undefined

    const tick = () => {
      if (!document.hidden) refreshConfig()
    }
    const id = setInterval(tick, refreshMs)
    document.addEventListener('visibilitychange', tick)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [phase, hasCfg, refreshMs, refreshConfig])

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

  const closeSignalModal = useCallback(() => setSignalModal(false), [])

  const currency = wallet?.currency || cfg?.currency || 'USD'
  const money = useMemo(() => makeMoney(currency), [currency])
  const fmtRate = useMemo(() => makeRate(currency), [currency])

  const networks = useMemo(() => cfg?.networks || [], [cfg])
  const activeNetwork =
    networks.find((n) => n.value === network && isNetworkAvailable(n)) || networks.find((n) => isNetworkAvailable(n)) || null

  const asset = String(activeNetwork?.asset || 'usdt').toLowerCase()
  const unit = asset.toUpperCase()
  const decimals = num(activeNetwork?.decimals) || DEFAULT_DECIMALS
  const rate = num(activeNetwork?.rate)
  const minUsd = num(cfg?.min_deposit_usd)
  const minAsset = rate > 0 ? minUsd / rate : 0
  const minText = trimZeros(ceilTo(minAsset, asset === 'usdt' ? 2 : decimals))

  // Screenshot limits come from the server config, with safe defaults
  const maxMb = num(cfg?.screenshot_max_mb) || DEFAULT_MAX_MB
  const formats = useMemo(() => {
    const list = Array.isArray(cfg?.screenshot_formats) ? cfg.screenshot_formats : []
    const clean = list.map((f) => String(f).toLowerCase()).filter(Boolean)
    return clean.length ? clean : DEFAULT_FORMATS
  }, [cfg])

  const amt = num(amount)
  const usd = amt * rate // estimate only, the server re-prices on submit
  const belowMin = amt > 0 && rate > 0 && usd + 1e-9 < minUsd
  const amountMsg =
    amountErr || (belowMin ? `The minimum deposit is ${money(minUsd)} (≈ ${minText} ${unit}).` : '')
  const canSubmit = !submitting && amt > 0 && !belowMin && Boolean(activeNetwork) && rate > 0

  const onAmountChange = (v) => {
    setAmount(v)
    setChip(null)
    setAmountErr('')
    setFormError(null)
  }

  const onQuick = (value, q) => {
    setAmount(value)
    setChip(q)
    setAmountErr('')
    setFormError(null)
  }

  const onNetworkChange = (v) => {
    const next = networks.find((n) => n.value === v)
    setNetwork(v)
    setFormError(null)
    setAmountErr('')
    if (!next) return
    if (activeNetwork && next.asset !== activeNetwork.asset) {
      // Different asset (e.g. USDT -> BTC): the old number would mean something else, so start clean
      setAmount('')
      setChip(null)
    } else {
      setAmount((a) => cleanAmount(a, num(next.decimals) || DEFAULT_DECIMALS))
    }
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
        amount: amount.endsWith('.') ? amount.slice(0, -1) : amount,
        network: activeNetwork.value,
      })
      const d = res.data?.data
      if (!alive.current) return
      if (!d?.id || !d?.deposit_address) {
        setFormError({ message: 'We could not read your deposit details. Please try again.' })
        return
      }
      const net = String(d.network || activeNetwork.value).toLowerCase()
      closing.current = false
      busyRef.current = false
      expireLater.current = false
      setProofError('')
      setProgress(0)
      setPreview(null)
      setDeposit({
        ...d,
        network: net,
        asset: String(d.asset || activeNetwork.asset || assetFromNetwork(net)).toLowerCase(),
        amount: d.amount ?? d.usdt_amount ?? amount,
      })
      setEndAt(Date.now() + PAY_WINDOW_MS)
      setPhase('pay')
    } catch (err) {
      if (!alive.current) return
      const info = describeSubmitError(err)
      if (info.amount) setAmountErr(info.amount)
      if (info.message) setFormError({ message: info.message, action: info.action })
      if (info.refresh) refreshConfig()
    } finally {
      if (alive.current) setSubmitting(false)
    }
  }

  // Back to a fresh form (used after cancel, timeout, or when the server says the deposit is closed)
  const resetToForm = useCallback(
    (n) => {
      setDeposit(null)
      setEndAt(null)
      setAmount('')
      setChip(null)
      setAmountErr('')
      setFormError(null)
      setCancelling(false)
      setUploading(false)
      setPaying(false)
      setProgress(0)
      setProofError('')
      setPreview(null)
      busyRef.current = false
      expireLater.current = false
      closing.current = false
      setNotice(n)
      setPhase('form')
      // Refresh the balance and live rates for the fresh start
      refreshConfig()
      api
        .get('/api/wallet/')
        .then((res) => {
          if (alive.current) setWallet(res.data?.data ?? null)
        })
        .catch(() => {})
    },
    [refreshConfig, setPreview],
  )

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
      resetToForm(
        reason === 'expired'
          ? { tone: 'warn', text: 'Your payment window ended and the request was closed. Start a new deposit when you are ready.' }
          : { tone: 'success', text: 'Deposit request cancelled.' },
      )
    },
    [deposit, resetToForm],
  )

  useEffect(() => {
    closeRef.current = closeDeposit
  })

  // When the timer ends: close the request, unless an upload / confirmation is mid-flight (then wait for it)
  const onTimerExpire = useCallback(() => {
    if (busyRef.current) {
      expireLater.current = true
      return
    }
    closeRef.current?.('expired')
  }, [])

  const left = useCountdown(phase === 'pay' || phase === 'proof' ? endAt : null, onTimerExpire)

  // Runs when an upload / confirmation finishes: applies a timer expiry that happened meanwhile
  const finishBusy = () => {
    busyRef.current = false
    if (!alive.current) return
    setUploading(false)
    setPaying(false)
    if (expireLater.current) {
      expireLater.current = false
      closeRef.current?.('expired')
    }
  }

  const goReview = () => {
    expireLater.current = false
    setEndAt(null)
    setSecs(REVIEW_SECONDS)
    setPhase('review')
  }

  // The user picked a screenshot: check it, show it, upload it to POST /deposits/{id}/screenshot/
  const pickScreenshot = async (file) => {
    if (!deposit || phase !== 'proof' || busyRef.current || closing.current) return

    const problem = checkScreenshot(file, maxMb, formats)
    if (problem) {
      setProofError(problem)
      return
    }

    busyRef.current = true
    setProofError('')
    setProgress(0)
    setUploading(true)
    setPreview(URL.createObjectURL(file))

    try {
      const form = new FormData()
      form.append('screenshot', file) // field name must be exactly "screenshot"

      // Override the instance's default "application/json". Axios sees multipart, keeps the FormData as-is,
      // and the browser fills in the real multipart boundary when sending.
      const res = await api.post(`/api/wallet/deposits/${deposit.id}/screenshot/`, form, {
        timeout: UPLOAD_TIMEOUT_MS,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (alive.current && ev.total) setProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)))
        },
      })
      if (!alive.current) return
      const d = res.data?.data
      if (!d?.has_screenshot) {
        setProofError('We could not confirm your upload. Please try again.')
        return
      }
      // Keep our normalised network / asset / amount, take everything else (screenshot fields) from the server
      setDeposit((prev) => ({ ...prev, ...d, network: prev.network, asset: prev.asset, amount: prev.amount }))
    } catch (err) {
      if (!alive.current) return
      const info = describeUploadError(err)
      if (info.kind === 'paid') {
        // The server already has a payment confirmation for this deposit
        goReview()
      } else if (info.kind === 'closed') {
        resetToForm({ tone: 'warn', text: info.message })
      } else {
        setProofError(info.message)
      }
    } finally {
      finishBusy()
    }
  }

  // "I have paid": POST /deposits/{id}/paid/ (the server requires the screenshot to be uploaded first)
  const markPaid = async () => {
    if (!deposit || phase !== 'proof' || busyRef.current || closing.current) return
    if (!deposit.has_screenshot) {
      setProofError('Please upload a screenshot of your payment first.')
      return
    }

    busyRef.current = true
    setProofError('')
    setPaying(true)

    try {
      const res = await api.post(`/api/wallet/deposits/${deposit.id}/paid/`)
      if (!alive.current) return
      const d = res.data?.data
      if (d) setDeposit((prev) => ({ ...prev, ...d, network: prev.network, asset: prev.asset, amount: prev.amount }))
      goReview()
    } catch (err) {
      if (!alive.current) return
      const info = describePaidError(err)
      if (info.kind === 'paid') {
        goReview()
      } else if (info.kind === 'closed') {
        resetToForm({ tone: 'warn', text: info.message })
      } else {
        if (info.kind === 'nofile') setDeposit((prev) => ({ ...prev, has_screenshot: false }))
        setProofError(info.message)
      }
    } finally {
      finishBusy()
    }
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
                  chip={chip}
                  onQuick={onQuick}
                  setNetwork={onNetworkChange}
                  activeNetwork={activeNetwork}
                  asset={asset}
                  unit={unit}
                  decimals={decimals}
                  rate={rate}
                  fmtRate={fmtRate}
                  minUsd={minUsd}
                  minText={minText}
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
                  onNext={() => setPhase('proof')}
                  onCancel={() => closeDeposit('manual')}
                  cancelling={cancelling}
                  money={money}
                  fmtRate={fmtRate}
                  reduce={reduce}
                />
              </motion.div>
            )}

            {phase === 'proof' && deposit && (
              <motion.div key="proof" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                <ProofStep
                  deposit={deposit}
                  left={left}
                  localPreview={localPreview}
                  uploading={uploading}
                  progress={progress}
                  paying={paying}
                  cancelling={cancelling}
                  error={proofError}
                  maxMb={maxMb}
                  formats={formats}
                  onPick={pickScreenshot}
                  onBack={() => {
                    setProofError('')
                    setPhase('pay')
                  }}
                  onPaid={markPaid}
                  onCancel={() => closeDeposit('manual')}
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

      {/* Signal purchase pop-up: only ever opens when the user came from the Signals page */}
      <AnimatePresence>
        {signalModal && signalInfo && (
          <SignalNoticeModal key="signal-notice" signal={signalInfo} onClose={closeSignalModal} reduce={reduce} />
        )}
      </AnimatePresence>
    </div>
  )
}