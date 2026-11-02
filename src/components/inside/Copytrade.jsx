// CopyTrade.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Info, Loader2, Search, Wallet } from 'lucide-react'
import api from '../Api'
import { TRADERS } from './Mocktraders'
import TraderCard from './Tradercard'
import {
  DEPOSIT_ROUTE, GREEN, RED, SEND_IDEMPOTENCY_KEY, TRADE_ROUTE, WEEKEND_MSG,
  cleanDec, describeError, fieldCls, getEligibility, getTier, ghostBtn, money, num, primaryBtn,
  quickPrice, saveEntry, uuid,
} from './copyTradeUtils'
import { InlineError, Sheet, SimBadge } from './copyTradeShared'


const PER_PAGE = 12
const FILTERS = [['all', 'All'], ['recommended', 'Recommended'], ['popular', 'Popular'], ['eligible', 'Available to me']]
const SORTS = [['winRate', 'Win rate'], ['pnlPct', 'Return'], ['followers', 'Followers'], ['maxDD', 'Lowest drawdown'], ['price', 'Price']]

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }

function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${active ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09]'}`}>
      {children}
    </button>
  )
}

function SetupRow({ k, children }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-slate-400">{k}</dt><dd className="text-right font-mono text-white">{children}</dd></div>
}

/* ───────────── STEP 1: BLOCKED ───────────── */

function BlockedBody({ trader, reasons, balance, tier, onClose }) {
  const shortfall = Math.max(0, num(trader.price) - balance)
  return (
    <div className="space-y-4">
      <dl className="space-y-2 rounded-xl bg-[#F6465D]/10 px-3.5 py-3 text-[12px] text-red-200">
        <div className="flex items-center justify-between gap-3">
          <dt>Your available balance</dt>
          <dd className="font-mono text-sm font-semibold">{money(balance)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>Required balance for {trader.handle}</dt>
          <dd className="font-mono text-sm font-semibold">{money(trader.price)}</dd>
        </div>
        {shortfall > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-red-200/10 pt-2">
            <dt>You need</dt>
            <dd className="font-mono text-sm font-semibold">{money(shortfall)} more</dd>
          </div>
        )}
      </dl>
      <p className="text-[13px] leading-relaxed text-slate-300">
        You cannot copy <span className="font-semibold text-white">{trader.handle}</span> right now:
      </p>
      <ul className="space-y-2">
        {reasons.map((r) => (
          <li key={r} className="flex gap-2.5 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-slate-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" /><span className="min-w-0 break-words">{r}</span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-slate-400">Balance tier {tier} of 3. Use the “Available to me” filter to see the traders you can copy with your current balance.</p>
      <div className="flex gap-2.5">
        <button type="button" onClick={onClose} className={`${ghostBtn} flex-1`}>Browse traders</button>
        <Link to={DEPOSIT_ROUTE} className={`${primaryBtn} flex-1`}>Top up balance</Link>
      </div>
    </div>
  )
}

/* ───────────── STEP 2: CONFIRM ───────────── */

function ConfirmBody({ trader, onCancel, onProceed }) {
  const s = trader.setup
  const long = s.side === 'buy'
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-slate-300">
        You are about to open a trade using the setup of <span className="font-semibold text-white">{trader.handle}</span>.
        You can review and change the details before anything is placed.
      </p>
      <dl className="space-y-2 rounded-xl bg-white/[0.04] p-3.5 text-[13px]">
        <SetupRow k="Required balance">{money(trader.price)}</SetupRow>
        <SetupRow k="Pair">{s.pair}</SetupRow>
        <SetupRow k="Direction"><span style={{ color: long ? GREEN : RED }}>{long ? 'Buy / Long' : 'Sell / Short'}</span></SetupRow>
        <SetupRow k="Leverage">{s.leverage}x</SetupRow>
        <SetupRow k="Take profit / Stop loss">{s.takeProfit}% / {s.stopLoss}%</SetupRow>
        <SetupRow k="Duration">{s.durationHours}h</SetupRow>
      </dl>
      <div className="flex gap-2.5">
        <button type="button" onClick={onCancel} className={`${ghostBtn} flex-1`}>Cancel</button>
        <button type="button" onClick={onProceed} className={`${primaryBtn} flex-[2]`}>Proceed</button>
      </div>
    </div>
  )
}

/* ───────────── STEP 3: PREFILLED ENTER TRADE ───────────── */

function CopyForm({ trader, cfg, avail, onBack, onOpened, onStale, onGo }) {
  const s = trader.setup
  const price = num(trader.price)
  const maxLev = num(cfg?.max_leverage) || 100
  const durations = cfg?.durations_hours?.length ? cfg.durations_hours : [6, 12, 24]
  const minAmt = num(cfg?.min_amount) || 10
  const closest = durations.reduce((a, b) => (Math.abs(b - s.durationHours) < Math.abs(a - s.durationHours) ? b : a), durations[0])
  const suggested = Math.min(avail, Math.max(minAmt, Math.floor(avail * s.riskPct) / 100))

  const [amount, setAmount] = useState(String(Math.floor(suggested * 100) / 100))
  const [lev, setLev] = useState(Math.max(1, Math.min(s.leverage, maxLev)))
  const [tp, setTp] = useState(String(s.takeProfit))
  const [sl, setSl] = useState(String(s.stopLoss))
  const [dur, setDur] = useState(closest)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(null)
  const keyRef = useRef(uuid())

  const amt = num(amount)
  const long = s.side === 'buy'
  const marketClosed = cfg?.market_open === false
  // Balance can change while the form is open (e.g. after a refresh), so the price rule is re-checked here too.
  const belowPrice = avail < price
  const bad = belowPrice
    ? `You need at least ${money(price)} available to copy ${trader.handle}. You have ${money(avail)}.`
    : amt < minAmt ? `Minimum amount is ${money(minAmt)}.` : amt > avail ? `More than your available ${money(avail)}.` : ''

  const submit = async (e) => {
    e.preventDefault()
    if (busy || bad || marketClosed || belowPrice) return
    setBusy(true); setErr(null)
    try {
      const body = { pair: s.pair, side: s.side, amount: amt.toFixed(2), leverage: lev, duration_hours: dur }
      if (num(tp) > 0) body.take_profit_pct = num(tp).toFixed(2)
      if (num(sl) > 0) body.stop_loss_pct = num(sl).toFixed(2)
      const snapP = quickPrice(s.pair) // live price at the moment the trade is sent
      const res = await api.post('/api/trades/', body, SEND_IDEMPOTENCY_KEY ? { headers: { 'Idempotency-Key': keyRef.current } } : undefined)
      const d = res.data?.data
      if (!d?.id) { setErr({ message: 'We could not read your trade details. Check your active trades.', action: { to: TRADE_ROUTE, label: 'View trades' } }); return }
      saveEntry(d.id, await snapP)
      setDone(d)
      onOpened(d)
    } catch (ex) {
      const info = describeError(ex, 'We could not open your trade. Please try again.')
      setErr(info)
      if (ex?.response?.status === 400) keyRef.current = uuid() // new key after a validation failure
      if (info.insufficient) onStale()
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3 py-8 text-center" role="status">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          className="grid h-16 w-16 place-items-center rounded-full bg-[#3DDC97]/[0.15] text-[#3DDC97]"><CheckCircle2 className="h-8 w-8" aria-hidden="true" /></motion.span>
        <p className="text-base font-semibold text-white">Trade {done.reference} opened</p>
        <p className="text-[13px] text-slate-400">Taking you to your active trades…</p>
        <button type="button" onClick={onGo} className={`${ghostBtn} mt-1`}>Go now</button>
      </motion.div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="rounded-xl bg-[#0E1822] px-3.5 py-3 ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="block text-[11px] text-slate-400">Copying {trader.handle}</span>
            <span className="text-base font-semibold text-white">{s.pair}</span>
          </div>
          <span className="rounded-md px-2 py-1 font-mono text-[11px] font-bold" style={{ background: `${long ? GREEN : RED}26`, color: long ? GREEN : RED }}>{long ? 'LONG' : 'SHORT'}</span>
        </div>
        <SimBadge className="mt-2" />
      </div>

      <div>
        <label htmlFor="c-amt" className="mb-1.5 flex justify-between px-0.5 text-[13px] font-semibold text-white">
          <span>Amount (margin)</span><span className="font-normal text-slate-400">Available {money(avail)}</span>
        </label>
        <div className="flex items-center gap-2">
          <input id="c-amt" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(e) => setAmount(cleanDec(e.target.value))} className={fieldCls} aria-invalid={Boolean(bad)} />
          <button type="button" onClick={() => setAmount(String(Math.floor(avail * 100) / 100))} className="h-12 shrink-0 rounded-xl bg-[#3DDC97]/[0.15] px-3 font-mono text-xs font-bold text-[#3DDC97]">MAX</button>
        </div>
        <p className="mt-1.5 px-0.5 text-[11px] text-slate-500">Suggested: {s.riskPct}% of your available balance.</p>
        {bad && <p className="mt-1 px-0.5 text-[12px] text-red-300">{bad}</p>}
      </div>

      <div>
        <label htmlFor="c-lev" className="mb-1.5 flex justify-between px-0.5 text-[13px] font-semibold text-white">
          <span>Leverage</span><span className="font-mono text-[#3DDC97]">{lev}x</span>
        </label>
        <input id="c-lev" type="range" min="1" max={maxLev} value={lev} onChange={(e) => setLev(Number(e.target.value))} className="w-full accent-[#3DDC97]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[['Take profit %', tp, setTp], ['Stop loss %', sl, setSl]].map(([l, v, set]) => (
          <div key={l}>
            <label className="mb-1.5 block px-0.5 text-[13px] font-semibold text-white">{l}</label>
            <input inputMode="decimal" value={v} onChange={(e) => set(cleanDec(e.target.value))} className={fieldCls} />
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
        <SetupRow k="Position size">{money(amt * lev)}</SetupRow>
        <SetupRow k="Margin locked">{money(amt)}</SetupRow>
      </dl>
      <p className="px-0.5 text-[11px] text-slate-500">TP/SL and leverage are informational. Your result is confirmed shortly after the trade duration ends, and your margin stays locked until then.</p>

      {marketClosed && <InlineError message={WEEKEND_MSG} />}
      {err && <InlineError message={err.message} action={err.action} />}

      <div className="flex gap-2.5">
        <button type="button" onClick={onBack} disabled={busy} className={`${ghostBtn} flex-1`}>Back</button>
        <button type="submit" disabled={busy || Boolean(bad) || !amount || marketClosed || belowPrice} className={`${primaryBtn} flex-[2]`}>
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Opening…</> : 'Enter trade'}
        </button>
      </div>
    </form>
  )
}

/* ───────────── PAGE ───────────── */

export default function CopyTrade() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const alive = useRef(true)
  const timer = useRef(null)

  const [wallet, setWallet] = useState(null)
  const [walletErr, setWalletErr] = useState('')
  const [cfg, setCfg] = useState(null)
  const [openCount, setOpenCount] = useState(0)
  const [maxOpen, setMaxOpen] = useState(0)

  const [filter, setFilter] = useState('all')
  const [sortKey, setSortKey] = useState('winRate')
  const [sortDir, setSortDir] = useState('desc')
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(PER_PAGE)
  const [flow, setFlow] = useState(null) // { trader, step: 'blocked' | 'confirm' | 'form', reasons }

  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(timer.current) } }, [])

  const loadWallet = useCallback(() => {
    api.get('/api/wallet/')
      .then((r) => { if (!alive.current) return; setWallet(r.data?.data ?? {}); setWalletErr('') })
      .catch((e) => { if (alive.current) setWalletErr(describeError(e, 'We could not load your balance.').message) })
  }, [])
  const loadConfig = useCallback(() => {
    api.get('/api/trades/config/').then((r) => alive.current && setCfg(r.data?.data ?? null)).catch(() => {})
  }, [])
  const loadActive = useCallback(() => {
    api.get('/api/trades/active/')
      .then((r) => { if (!alive.current) return; setOpenCount((r.data?.data?.results || []).length); setMaxOpen(num(r.data?.data?.max_open_trades)) })
      .catch(() => {})
  }, [])

  useEffect(() => { loadWallet(); loadConfig(); loadActive() }, [loadWallet, loadConfig, loadActive])


  const avail = num(wallet?.available_balance)
  const minAmt = num(cfg?.min_amount) || 10
  const ready = wallet !== null
  const closed = cfg?.market_open === false
  const full = Boolean(maxOpen) && openCount >= maxOpen

  const elig = useMemo(() => Object.fromEntries(TRADERS.map((t) => [t.id, getEligibility(avail, t, minAmt)])), [avail, minAmt])

  const list = useMemo(() => {
    let l = [...TRADERS]
    if (filter === 'recommended') l = l.filter((t) => t.winRate >= 70 && t.stars >= 4)
    else if (filter === 'popular') l = l.filter((t) => t.followers >= 2000)
    else if (filter === 'eligible') l = l.filter((t) => elig[t.id].ok)
    const q = search.trim().toLowerCase()
    if (q) l = l.filter((t) => [t.handle, t.membership, t.favAsset, ...t.tags].some((x) => x.toLowerCase().includes(q)))
    l.sort((a, b) => (sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]))
    return l
  }, [filter, sortKey, sortDir, search, elig])

  const pickSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(k); setSortDir(k === 'maxDD' || k === 'price' ? 'asc' : 'desc') }
    setShown(PER_PAGE)
  }

  const statusFor = (t) => (!ready ? 'loading' : !elig[t.id].ok || closed || full ? 'locked' : 'ok')

  const onCopy = useCallback((t) => {
    const e = elig[t.id]
    const reasons = [...e.reasons]
    if (closed) reasons.unshift(WEEKEND_MSG)
    if (full) reasons.unshift(`You have reached your limit of ${maxOpen} open trades. Wait for one to settle or top up your balance to raise the limit.`)
    setFlow(reasons.length ? { trader: t, step: 'blocked', reasons } : { trader: t, step: 'confirm' })
  }, [elig, closed, full, maxOpen])

  const goTrade = useCallback((d) => {
    clearTimeout(timer.current)
    navigate(TRADE_ROUTE, { state: { openedReference: d?.reference } })
  }, [navigate])

  const onOpened = (d) => {
    if (d.balances) setWallet((w) => ({ ...(w || {}), ...d.balances }))
    timer.current = setTimeout(() => goTrade(d), 1400)
  }

  const closeFlow = useCallback(() => setFlow(null), [])
  const title = flow?.step === 'form' ? 'Enter a trade' : flow?.step === 'confirm' ? 'Copy this trader?' : 'Copy not available'
  const tier = getTier(avail)
  const visible = list.slice(0, shown)

  return (
    <div>
      <motion.div className="mx-auto max-w-6xl space-y-4 sm:space-y-5" variants={container} initial={reduce ? false : 'hidden'} animate="show">
        

        <motion.section variants={item} aria-label="Copy trading" className="rounded-2xl bg-[#14212D] p-3 sm:p-4">
          <h1 className="text-lg font-semibold text-white sm:text-xl">Copy trading</h1>
          <p className="mt-1 text-[13px] text-slate-400">Pick a trader and open a trade with their setup. You need an available balance at or above the trader’s required balance. You review every detail before it is placed.</p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
            <div className="min-w-0 rounded-xl bg-white/[0.04] px-2 py-2.5">
              <p className="flex items-center justify-center gap-1 text-[10px] text-slate-400"><Wallet className="h-3 w-3" aria-hidden="true" />Available</p>
              <p className="truncate font-mono text-sm font-semibold tabular-nums text-white">{ready ? money(avail) : '--'}</p>
            </div>
            <div className="min-w-0 rounded-xl bg-white/[0.04] px-2 py-2.5">
              <p className="text-[10px] text-slate-400">Open trades</p>
              <p className="truncate font-mono text-sm font-semibold tabular-nums text-white">{maxOpen ? `${openCount}/${maxOpen}` : openCount}</p>
            </div>
            <div className="col-span-2 min-w-0 rounded-xl bg-white/[0.04] px-2 py-2.5 sm:col-span-1">
              <p className="text-[10px] text-slate-400">Balance tier</p>
              <p className="truncate font-mono text-sm font-semibold tabular-nums text-white">{ready ? `${tier} of 3` : '--'}</p>
            </div>
          </div>
          {walletErr && <div className="mt-3"><InlineError message={walletErr} onRetry={loadWallet} /></div>}
          {closed && <p className="mt-3 rounded-xl bg-amber-400/10 px-3.5 py-2.5 text-[12px] text-amber-200">{WEEKEND_MSG}</p>}
        </motion.section>

        <motion.section variants={item} aria-label="Filters" className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setShown(PER_PAGE) }} placeholder="Search by name, asset or style…" aria-label="Search traders" className={`${fieldCls} pl-10`} />
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter traders">
            {FILTERS.map(([k, l]) => <Chip key={k} active={filter === k} onClick={() => { setFilter(k); setShown(PER_PAGE) }}>{l}</Chip>)}
          </div>
          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Sort traders">
            <span className="shrink-0 text-[11px] text-slate-500">Sort by</span>
            {SORTS.map(([k, l]) => <Chip key={k} active={sortKey === k} onClick={() => pickSort(k)}>{l}{sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}</Chip>)}
          </div>
        </motion.section>

        <motion.div variants={item}>
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-4 py-12 text-center">
              <p className="text-sm font-medium text-white">No traders match your filters</p>
              <p className="mt-1 text-[12px] text-slate-400">{filter === 'eligible' ? 'Top up your balance to unlock more traders.' : 'Try a different search or filter.'}</p>
              <button type="button" onClick={() => { setSearch(''); setFilter('all') }} className={`${ghostBtn} mt-4`}>Clear filters</button>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence initial={false}>
                {visible.map((t) => (
                  <motion.li key={t.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3 }}>
                    <TraderCard trader={t} status={statusFor(t)} onCopy={onCopy} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          {shown < list.length && (
            <button type="button" onClick={() => setShown((n) => n + PER_PAGE)} className={`${ghostBtn} mt-4 w-full`}>Show more ({list.length - shown} left)</button>
          )}
        </motion.div>
      </motion.div>

      <Sheet open={Boolean(flow)} onClose={closeFlow} title={title}>
        {flow?.step === 'blocked' && <BlockedBody trader={flow.trader} reasons={flow.reasons} balance={avail} tier={tier} onClose={closeFlow} />}
        {flow?.step === 'confirm' && <ConfirmBody trader={flow.trader} onCancel={closeFlow} onProceed={() => setFlow({ ...flow, step: 'form' })} />}
        {flow?.step === 'form' && (
          <CopyForm trader={flow.trader} cfg={cfg} avail={avail}
            onBack={() => setFlow({ ...flow, step: 'confirm' })}
            onOpened={onOpened} onStale={() => { loadWallet(); loadActive() }}
            onGo={() => goTrade()} />
        )}
      </Sheet>
    </div>
  )
}