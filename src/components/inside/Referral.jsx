// src/pages/inside/Referral.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Gift,
  Inbox,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const PAGE_SIZE = 20
const DEFAULT_BONUS = 3
const EMPTY_PARAMS = {}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

// The referral funnel, in the order a referred person moves through it
const STAGES = [
  {
    value: 'registered',
    label: 'Signed up',
    icon: UserPlus,
    chip: 'bg-slate-400/[0.15] text-slate-300',
    pill: 'bg-slate-400/[0.12] text-slate-300',
    bar: 'bg-slate-400',
    hint: 'Waiting for them to verify their email.',
  },
  {
    value: 'verified',
    label: 'Verified',
    icon: ShieldCheck,
    chip: 'bg-sky-400/[0.15] text-sky-300',
    pill: 'bg-sky-400/[0.12] text-sky-300',
    bar: 'bg-sky-400',
    hint: 'Waiting for their first deposit.',
  },
  {
    value: 'funded',
    label: 'Funded',
    icon: Download,
    chip: 'bg-amber-400/[0.15] text-amber-300',
    pill: 'bg-amber-400/[0.12] text-amber-300',
    bar: 'bg-amber-400',
    hint: 'Deposit received. Waiting for them to start trading.',
  },
  {
    value: 'rewarded',
    label: 'Rewarded',
    icon: Gift,
    chip: 'bg-[#3DDC97]/[0.15] text-[#3DDC97]',
    pill: 'bg-[#3DDC97]/[0.12] text-[#3DDC97]',
    bar: 'bg-[#3DDC97]',
    hint: 'Bonus credited to your wallet.',
  },
]

const STAGE_FILTERS = [{ value: 'all', label: 'All' }, ...STAGES.map((s) => ({ value: s.value, label: s.label }))]

const FUNNEL = [
  { key: 'total_referred', label: 'Signed up' },
  { key: 'verified', label: 'Verified' },
  { key: 'funded', label: 'Funded' },
  { key: 'rewarded', label: 'Rewarded' },
]

const BONUS_STATUS = {
  credited: { label: 'Credited', cls: 'bg-[#3DDC97]/[0.12] text-[#3DDC97]' },
  pending: { label: 'Pending', cls: 'bg-amber-400/[0.12] text-amber-300' },
}

const ghostBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60'

const primaryBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-5 text-sm font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60'

const iconBtn =
  'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60'

const channelBtn =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 transition-colors hover:bg-white/[0.1] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70'

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

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const flatten = (v) => {
  if (v == null) return []
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(flatten)
  if (typeof v === 'object') return Object.values(v).flatMap(flatten)
  return [String(v)]
}

// Turns any failed request into a message the page can show
function describeError(err, what) {
  const res = err?.response
  if (!res) return { message: 'Network error. Check your connection and try again.' }
  const { status, data } = res
  if (status === 400) {
    const first = flatten(data?.errors)[0]
    return { message: data?.message || first || 'That filter is not valid.' }
  }
  if (status === 401) return { message: 'Your session has expired. Please sign in again to continue.' }
  if (status === 403) return { message: `You do not have access to ${what}.` }
  if (status === 429) return { message: 'Too many requests. Please wait a moment and try again.' }
  if (status >= 500) return { message: 'Something went wrong on our side. Please try again in a moment.' }
  return { message: `We could not load ${what}.` }
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

// The referral dashboard: one request, with loading derived from which request has finished
function useDashboard() {
  const [state, setState] = useState({ doneTick: null, data: null, error: null })
  const [tick, setTick] = useState(0)
  const loading = state.doneTick !== tick

  useEffect(() => {
    let alive = true
    api
      .get('/api/referrals/')
      .then((res) => {
        if (!alive) return
        const data = res.data?.data
        if (data && typeof data === 'object') {
          setState({ doneTick: tick, data, error: null })
        } else {
          setState((s) => ({ ...s, doneTick: tick, error: { message: 'We could not read your referral details.' } }))
        }
      })
      .catch((err) => {
        if (alive) setState((s) => ({ ...s, doneTick: tick, error: describeError(err, 'your referral details') }))
      })
    return () => {
      alive = false
    }
  }, [tick])

  return {
    loading,
    data: state.data,
    error: loading ? null : state.error,
    retry: () => setTick((t) => t + 1),
  }
}

// A server-paginated list that restarts when its params change and appends on "load more"
function usePagedList(path, params, enabled, what) {
  const [state, setState] = useState({
    doneKey: null,
    dataKey: null,
    items: [],
    next: false,
    count: 0,
    page: 1,
    meta: null,
    error: null,
  })
  const [tick, setTick] = useState(0)
  const [more, setMore] = useState({ loading: false, error: '' })

  const key = JSON.stringify(params)
  const loading = enabled && state.doneKey !== `${key}|${tick}`
  const sameData = state.dataKey === key // the stored rows belong to the current filter

  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    api
      .get(path, { params: { ...JSON.parse(key), page: 1, page_size: PAGE_SIZE } })
      .then((res) => {
        if (!alive) return
        const data = res.data?.data
        setState({
          doneKey: `${key}|${tick}`,
          dataKey: key,
          items: Array.isArray(data?.results) ? data.results : [],
          next: Boolean(data?.next),
          count: num(data?.count),
          page: 1,
          meta: data || null,
          error: null,
        })
        setMore({ loading: false, error: '' })
      })
      .catch((err) => {
        if (!alive) return
        setState((s) => ({
          ...s,
          doneKey: `${key}|${tick}`,
          dataKey: key,
          items: s.dataKey === key ? s.items : [],
          error: describeError(err, what),
        }))
      })
    return () => {
      alive = false
    }
  }, [path, key, enabled, what, tick])

  const loadMore = async () => {
    if (more.loading || !state.next || !sameData) return
    const requestKey = key
    setMore({ loading: true, error: '' })
    try {
      const res = await api.get(path, { params: { ...params, page: state.page + 1, page_size: PAGE_SIZE } })
      const data = res.data?.data
      const incoming = Array.isArray(data?.results) ? data.results : []
      setState((s) => {
        if (s.dataKey !== requestKey) return s
        const seen = new Set(s.items.map((i) => i.id))
        return {
          ...s,
          items: [...s.items, ...incoming.filter((i) => !seen.has(i.id))],
          next: Boolean(data?.next),
          page: s.page + 1,
        }
      })
      setMore({ loading: false, error: '' })
    } catch (err) {
      setMore({ loading: false, error: describeError(err, 'more results').message })
    }
  }

  return {
    loading,
    items: sameData ? state.items : [],
    next: sameData && state.next,
    count: sameData ? state.count : 0,
    meta: sameData ? state.meta : null,
    error: loading ? null : state.error,
    more,
    loadMore,
    retry: () => setTick((t) => t + 1),
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

function Block({ className }) {
  return <div className={`animate-pulse rounded-2xl bg-[#14212D] ${className}`} aria-hidden="true" />
}

function CopyBtn({ text, label }) {
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
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
        done ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-white/[0.08] text-slate-200 hover:bg-white/[0.14] hover:text-white'
      }`}
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

function StatTile({ icon: Icon, label, value, chip }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#14212D] px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${chip}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      </div>
      <p className="mt-2 truncate text-lg font-semibold tabular-nums text-white">{value}</p>
    </div>
  )
}

function Chip({ active, onClick, label, layoutId, reduce }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative inline-flex h-9 shrink-0 snap-start items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
        active ? 'text-[#06231A]' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white'
      }`}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-full bg-[#3DDC97]"
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <span className="relative">{label}</span>
    </button>
  )
}

function RowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-4 py-4 sm:px-6" aria-hidden="true">
      <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-28 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-40 max-w-full animate-pulse rounded bg-white/[0.06]" />
      </div>
      <div className="space-y-2">
        <div className="ml-auto h-3.5 w-14 animate-pulse rounded bg-white/10" />
        <div className="ml-auto h-4 w-16 animate-pulse rounded-full bg-white/[0.06]" />
      </div>
    </li>
  )
}

/* ────────────────────────────────────────────────
   REFERRAL CARD (code, link, share, write-up)
──────────────────────────────────────────────── */

function ReferralCard({ code, link, bonus, reduce }) {
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const shareText = `Sign up with my referral code ${code} and start trading.`
  const [shareNote, setShareNote] = useState('')
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const flash = (text) => {
    setShareNote(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setShareNote(''), 2200)
  }

  const onShare = async () => {
    if (canShare) {
      try {
        await navigator.share({ title: 'Join me and start trading', text: shareText, url: link })
      } catch {
        /* the person closed the share sheet */
      }
      return
    }
    flash((await copyText(link)) ? 'Link copied to your clipboard.' : 'Could not copy. Copy the link manually.')
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${link}`)}`
  const tg = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`
  const mail = `mailto:?subject=${encodeURIComponent('Join me and start trading')}&body=${encodeURIComponent(
    `${shareText}\n\n${link}`,
  )}`

  const steps = [
    { icon: Share2, title: 'Share', text: 'Send your code or link to a friend.' },
    { icon: Download, title: 'They deposit', text: 'They sign up and fund their account.' },
    { icon: Wallet, title: 'You earn', text: `They start trading and ${bonus} is credited to you.` },
  ]

  return (
    <motion.section variants={item} aria-label="Your referral code" className="rounded-2xl bg-[#14212D] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pink-400/[0.15] text-pink-300">
          <Gift className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">Earn {bonus} for every friend who trades</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">
            Share your referral code. When someone signs up with it, makes a deposit and starts trading, {bonus} is
            added to your wallet. There is no limit on how many friends you can refer.
          </p>
        </div>
      </div>

      {/* Code */}
      <div className="mt-4 rounded-xl bg-[#0E1822] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Your referral code</p>
          <CopyBtn text={code} label="Copy referral code" />
        </div>
        <p
          className="mt-2 break-all font-mono text-3xl font-semibold tracking-[0.2em] text-[#3DDC97]"
          aria-label={`Referral code ${code}`}
        >
          {code.split('').map((ch, i) => (
            <motion.span
              key={`${ch}-${i}`}
              className="inline-block"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15 + i * 0.045, ease: 'easeOut' }}
              aria-hidden="true"
            >
              {ch}
            </motion.span>
          ))}
        </p>
      </div>

      {/* Link */}
      <div className="mt-3 rounded-xl bg-[#0E1822] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            Your referral link
          </p>
          <CopyBtn text={link} label="Copy referral link" />
        </div>
        <p className="mt-2 break-all font-mono text-[13px] text-slate-200">{link}</p>
      </div>

      {/* Share */}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={onShare} className={`${primaryBtn} min-w-0 flex-1`}>
          <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{canShare ? 'Share your link' : 'Copy your link'}</span>
        </button>
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" className={channelBtn}>
          <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
        </a>
        <a href={tg} target="_blank" rel="noopener noreferrer" aria-label="Share on Telegram" className={channelBtn}>
          <Send className="h-[18px] w-[18px]" aria-hidden="true" />
        </a>
        <a href={mail} aria-label="Share by email" className={channelBtn}>
          <Mail className="h-[18px] w-[18px]" aria-hidden="true" />
        </a>
      </div>
      <div aria-live="polite" className="min-h-0">
        <AnimatePresence>
          {shareNote && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 text-xs text-[#3DDC97]"
            >
              {shareNote}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* How it works */}
      <ol className="mt-4 grid gap-2.5 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.07] font-mono text-xs font-semibold text-slate-200">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium text-white">
                <Icon className="h-3.5 w-3.5 shrink-0 text-[#3DDC97]" aria-hidden="true" />
                {title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </motion.section>
  )
}

/* ────────────────────────────────────────────────
   FUNNEL
──────────────────────────────────────────────── */

function Funnel({ stats, reduce }) {
  const total = Math.max(num(stats.total_referred), 1)
  return (
    <motion.section variants={item} aria-label="Referral progress" className="rounded-2xl bg-[#14212D] p-4 sm:p-5">
      <h2 className="text-base font-semibold text-white">Where your referrals are</h2>
      <p className="mt-0.5 text-sm text-slate-400">Each person moves through these steps before you are paid.</p>
      <ul className="mt-4 space-y-3.5">
        {FUNNEL.map(({ key, label }, i) => {
          const count = num(stats[key])
          const pct = count > 0 ? Math.max((count / total) * 100, 4) : 0
          return (
            <li key={key}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-300">{label}</span>
                <span className="font-mono font-semibold tabular-nums text-white">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div
                  className={`h-full rounded-full ${STAGES[i].bar}`}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : 0.2 + i * 0.1, ease: 'easeOut' }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </motion.section>
  )
}

/* ────────────────────────────────────────────────
   HISTORY ROWS
──────────────────────────────────────────────── */

function ReferralRow({ r, bonus, money, index, reduce }) {
  const idx = Math.max(
    STAGES.findIndex((s) => s.value === r.stage),
    0,
  )
  const stage = STAGES[idx]
  const credited = r.status === 'rewarded' || r.stage === 'rewarded'
  const amount = r.bonus_amount != null && r.bonus_amount !== '' ? num(r.bonus_amount) : bonus
  const bonusState = credited ? BONUS_STATUS.credited : BONUS_STATUS.pending
  const name = (r.masked_name || 'Referred user').trim()

  const dates = [
    ['Joined', formatDate(r.joined_at)],
    ['Verified', formatDate(r.verified_at)],
    ['Rewarded', formatDate(r.rewarded_at)],
  ].filter(([, v]) => v)

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04, ease: 'easeOut' }}
      className="px-4 py-4 sm:px-6"
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-semibold ${stage.chip}`}
          aria-hidden="true"
        >
          {name.charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{name}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">{r.masked_email || 'Email hidden'}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className={`text-sm font-semibold tabular-nums ${credited ? 'text-[#3DDC97]' : 'text-amber-300'}`}>
            {credited ? '+' : ''}
            {money(amount)}
          </p>
          <span
            className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${bonusState.cls}`}
          >
            {!credited && (
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            {bonusState.label}
          </span>
        </div>
      </div>

      {/* Progress through the funnel */}
      <div className="mt-3.5" role="img" aria-label={`Stage: ${stage.label}`}>
        <div className="grid grid-cols-4 gap-1.5">
          {STAGES.map((s, i) => (
            <div key={s.value} className="min-w-0">
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div
                  className={`h-full rounded-full ${stage.bar}`}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: i <= idx ? '100%' : '0%' }}
                  transition={{ duration: reduce ? 0 : 0.45, delay: reduce ? 0 : 0.1 + i * 0.08, ease: 'easeOut' }}
                />
              </div>
              <p className={`mt-1 truncate text-[10px] sm:text-[11px] ${i <= idx ? 'text-slate-200' : 'text-slate-500'}`}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 break-words text-xs text-slate-400">{stage.hint}</p>
      {dates.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          {dates.map(([label, value]) => (
            <span key={label}>
              {label} {value}
            </span>
          ))}
        </p>
      )}
    </motion.li>
  )
}

function EarningRow({ e, money, index, reduce }) {
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04, ease: 'easeOut' }}
      className="flex items-center gap-3 px-4 py-3.5 sm:px-6"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pink-400/[0.15] text-pink-300">
        <Gift className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">Bonus from {e.masked_name || 'a referral'}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">{formatDate(e.rewarded_at) || 'Date unavailable'}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-pink-300">+{money(num(e.bonus_amount))}</p>
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${BONUS_STATUS.credited.cls}`}>
          Credited
        </span>
      </div>
    </motion.li>
  )
}

function LoadMore({ list }) {
  if (!list.next && !list.more.error) return null
  return (
    <div className="space-y-2 border-t border-white/[0.06] p-3 sm:p-4">
      {list.more.error && <InlineError message={list.more.error} onRetry={list.loadMore} />}
      {list.next && !list.more.error && (
        <button type="button" onClick={list.loadMore} disabled={list.more.loading} className={`${ghostBtn} w-full`}>
          {list.more.loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading…
            </>
          ) : (
            'Load more'
          )}
        </button>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Referral() {
  const reduce = useReducedMotion()

  const [tab, setTab] = useState('referrals') // referrals | earnings
  const [stage, setStage] = useState('all')

  const dash = useDashboard()

  const stageParams = useMemo(() => (stage === 'all' ? EMPTY_PARAMS : { stage }), [stage])
  const referrals = usePagedList('/api/referrals/list/', stageParams, tab === 'referrals', 'your referrals')
  const earnings = usePagedList('/api/referrals/earnings/', EMPTY_PARAMS, tab === 'earnings', 'your earnings')

  const data = dash.data
  const currency = data?.currency || 'USD'
  const money = useMemo(() => makeMoney(currency), [currency])
  const bonusValue = data && data.bonus_per_referral != null ? num(data.bonus_per_referral) : DEFAULT_BONUS
  const bonusLabel = money(bonusValue)

  const stats = {
    total_referred: 0,
    verified: 0,
    funded: 0,
    rewarded: 0,
    pending: 0,
    total_earned: 0,
    potential_earnings: 0,
    ...(data?.stats || {}),
  }

  const code = data?.code ? String(data.code) : ''
  const link =
    data?.link ||
    (code && typeof window !== 'undefined' ? `${window.location.origin}/signup?ref=${encodeURIComponent(code)}` : '')

  const active = tab === 'referrals' ? referrals : earnings
  const refreshing = dash.loading || active.loading
  const refreshAll = () => {
    dash.retry()
    referrals.retry()
    earnings.retry()
  }

  const list = active
  const skeleton = list.loading && list.items.length === 0
  const total = tab === 'earnings' ? num(earnings.meta?.total_earned ?? stats.total_earned) : 0

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
            <h1 className="text-lg font-semibold text-white sm:text-xl">Refer and earn</h1>
            <p className="mt-0.5 text-sm text-slate-400">Invite friends and get paid when they start trading.</p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            aria-label="Refresh referrals"
            className={iconBtn}
          >
            <RefreshCw className={`h-[18px] w-[18px] ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </motion.div>

        {/* Referral details */}
        {dash.loading && !data ? (
          <div className="space-y-5">
            <Block className="h-80" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Block className="h-20" />
              <Block className="h-20" />
              <Block className="h-20" />
              <Block className="h-20" />
            </div>
          </div>
        ) : !data ? (
          <motion.div variants={item}>
            <InlineError message={dash.error?.message || 'We could not load your referral details.'} onRetry={dash.retry} />
          </motion.div>
        ) : (
          <>
            {dash.error && (
              <motion.div variants={item}>
                <InlineError message={dash.error.message} onRetry={dash.retry} />
              </motion.div>
            )}

            {code ? (
              <ReferralCard code={code} link={link} bonus={bonusLabel} reduce={reduce} />
            ) : (
              <motion.div variants={item}>
                <InlineError message="Your referral code is not available yet. Please try again shortly." onRetry={dash.retry} />
              </motion.div>
            )}

            <motion.section variants={item} aria-label="Referral earnings" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={Wallet}
                label="Total earned"
                value={money(stats.total_earned)}
                chip="bg-[#3DDC97]/[0.15] text-[#3DDC97]"
              />
              <StatTile
                icon={Clock}
                label="Still to earn"
                value={money(stats.potential_earnings)}
                chip="bg-amber-400/[0.15] text-amber-300"
              />
              <StatTile
                icon={Users}
                label="Referred"
                value={String(num(stats.total_referred))}
                chip="bg-sky-400/[0.15] text-sky-300"
              />
              <StatTile
                icon={CheckCircle2}
                label="Rewarded"
                value={String(num(stats.rewarded))}
                chip="bg-violet-400/[0.15] text-violet-300"
              />
            </motion.section>

            <Funnel stats={stats} reduce={reduce} />
          </>
        )}

        {/* History */}
        <motion.section variants={item} aria-label="Referral history" className="overflow-hidden rounded-2xl bg-[#14212D]">
          <div className="space-y-3.5 p-3 sm:p-4">
            <div role="tablist" aria-label="History" className="grid grid-cols-2 gap-1 rounded-xl bg-[#0E1822] p-1 ring-1 ring-white/10">
              {[
                ['referrals', 'Referrals', Users],
                ['earnings', 'Earnings', Wallet],
              ].map(([value, label, Icon]) => {
                const on = tab === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTab(value)}
                    className={`relative inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
                      on ? 'text-[#06231A]' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {on && (
                      <motion.span
                        layoutId="ref-tab-pill"
                        className="absolute inset-0 rounded-lg bg-[#3DDC97]"
                        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>

            {tab === 'referrals' ? (
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">Stage</p>
                <div className="-mx-3 sm:-mx-4">
                  <div className="flex snap-x gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
                    {STAGE_FILTERS.map((s) => (
                      <Chip
                        key={s.value}
                        label={s.label}
                        active={stage === s.value}
                        onClick={() => setStage(s.value)}
                        layoutId="ref-stage-pill"
                        reduce={reduce}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3.5 py-3">
                <p className="text-sm text-slate-300">Lifetime referral earnings</p>
                <p className="shrink-0 text-base font-semibold tabular-nums text-[#3DDC97]">{money(total)}</p>
              </div>
            )}

            <p className="text-xs text-slate-400" aria-live="polite">
              {skeleton
                ? 'Loading…'
                : `${list.count || list.items.length} ${
                    tab === 'earnings' ? 'bonus' : 'referral'
                  }${(list.count || list.items.length) === 1 ? '' : tab === 'earnings' ? 'es' : 's'}`}
            </p>
          </div>

          {/* Slim progress bar while refetching */}
          <div className="h-0.5 overflow-hidden" aria-hidden="true">
            {list.loading && !skeleton && !reduce && (
              <motion.div
                className="h-full w-1/3 rounded-full bg-[#3DDC97]"
                initial={{ x: '-100%' }}
                animate={{ x: '300%' }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>

          {list.error && list.items.length > 0 && (
            <div className="px-3 pb-3 sm:px-4">
              <InlineError message={list.error.message} onRetry={list.retry} />
            </div>
          )}

          {skeleton ? (
            <ul className="divide-y divide-white/[0.06]">
              {[0, 1, 2].map((i) => (
                <RowSkeleton key={i} />
              ))}
            </ul>
          ) : list.error && list.items.length === 0 ? (
            <div className="px-3 pb-4 sm:px-4">
              <InlineError message={list.error.message} onRetry={list.retry} />
            </div>
          ) : list.items.length === 0 ? (
            <div className="px-4 py-12 text-center sm:px-6">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-slate-400">
                <Inbox className="h-5 w-5" aria-hidden="true" />
              </span>
              {tab === 'earnings' ? (
                <>
                  <p className="mt-3 text-sm font-medium text-white">No bonuses yet</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Your first {bonusLabel} arrives when a friend you referred deposits and starts trading.
                  </p>
                </>
              ) : stage === 'all' ? (
                <>
                  <p className="mt-3 text-sm font-medium text-white">No referrals yet</p>
                  <p className="mt-1 text-sm text-slate-400">Share your code or link above to invite your first friend.</p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-medium text-white">Nobody is at this stage</p>
                  <p className="mt-1 text-sm text-slate-400">Try another stage to see more of your referrals.</p>
                  <button type="button" onClick={() => setStage('all')} className={`${ghostBtn} mt-4 h-10`}>
                    Show all referrals
                  </button>
                </>
              )}
            </div>
          ) : (
            <motion.div
              key={`${tab}-${stage}`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <ul className="divide-y divide-white/[0.06]">
                {tab === 'referrals'
                  ? referrals.items.map((r, i) => (
                      <ReferralRow
                        key={r.id ?? `${r.masked_email}-${i}`}
                        r={r}
                        bonus={bonusValue}
                        money={money}
                        index={i % PAGE_SIZE}
                        reduce={reduce}
                      />
                    ))
                  : earnings.items.map((e, i) => (
                      <EarningRow key={e.id ?? i} e={e} money={money} index={i % PAGE_SIZE} reduce={reduce} />
                    ))}
              </ul>
              <LoadMore list={list} />
            </motion.div>
          )}
        </motion.section>
      </motion.div>
    </div>
  )
}