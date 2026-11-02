// TraderCard.jsx
import { memo } from 'react'
import { motion } from 'framer-motion'
import { Copy, Loader2, Lock, Users } from 'lucide-react'
import MiniChart from './Minichart'
import { GREEN, RED, fmtM, ghostBtn, money, primaryBtn } from './copyTradeUtils'
import { SimBadge, Stars } from './copyTradeShared'

function Tile({ k, v, color }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/[0.04] px-2.5 py-2">
      <dt className="truncate text-[10px] text-slate-400">{k}</dt>
      <dd className="truncate font-mono text-[12px] font-semibold tabular-nums" style={{ color: color || '#fff' }}>{v}</dd>
    </div>
  )
}

// status: 'loading' | 'ok' | 'locked'
function TraderCard({ trader: t, status, onCopy }) {
  const s = t.setup
  const long = s.side === 'buy'
  const wrColor = t.winRate >= 60 ? GREEN : t.winRate >= 50 ? '#FBBF24' : RED

  return (
    <motion.article whileHover={{ y: -2 }} transition={{ duration: 0.2 }}
      className="flex h-full flex-col gap-3 rounded-2xl bg-[#14212D] p-3.5 sm:p-4" aria-label={`Trader ${t.handle}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0E1822] text-[22px]" aria-hidden="true">{t.avatar}</span>
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold text-white">{t.handle}</p>
            <Stars rating={t.stars} />
          </div>
        </div>
        <SimBadge className="shrink-0" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-md bg-[#3DDC97]/[0.12] px-1.5 py-0.5 text-[10px] font-semibold text-[#3DDC97]">{t.membership}</span>
        {t.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">{tag}</span>
        ))}
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <Tile k="Win rate" v={`${t.winRate.toFixed(1)}%`} color={wrColor} />
        <Tile k="Avg leverage" v={`${t.leverage.toFixed(1)}x`} />
        <Tile k="Max drawdown" v={`${t.maxDD.toFixed(1)}%`} color={t.maxDD > 30 ? RED : '#fff'} />
        <Tile k="Total PNL" v={fmtM(t.totalPnl)} />
        <Tile k="Trades" v={`${t.wins}/${t.trades}`} />
        <Tile k="Avg profit" v={`${t.avgProfit.toFixed(1)}%`} />
      </dl>

      <MiniChart charts={t.charts} pnlPct={t.pnlPct} />

      <div className="rounded-xl bg-[#0E1822] px-3 py-2.5">
        <p className="text-[10px] text-slate-400">Trade setup you would copy</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-semibold">
          <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-white">{s.pair}</span>
          <span className="rounded-md px-1.5 py-0.5" style={{ background: `${long ? GREEN : RED}26`, color: long ? GREEN : RED }}>{long ? 'LONG' : 'SHORT'} {s.leverage}x</span>
          <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-slate-300">{s.durationHours}h</span>
          <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-slate-300">TP {s.takeProfit}% / SL {s.stopLoss}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5">
        <span className="text-[11px] text-slate-400">Required balance</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-white">{money(t.price)}</span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><Users className="h-3.5 w-3.5" aria-hidden="true" />{t.followers.toLocaleString()}</span>
        {status === 'loading' ? (
          <button type="button" disabled className={`${ghostBtn} flex-1 sm:flex-none`}><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Checking balance…</button>
        ) : status === 'locked' ? (
          <button type="button" onClick={() => onCopy(t)} className={`${ghostBtn} flex-1 border-[#F6465D]/40 text-red-200 sm:flex-none`}><Lock className="h-4 w-4" aria-hidden="true" />Locked, see why</button>
        ) : (
          <button type="button" onClick={() => onCopy(t)} className={`${primaryBtn} flex-1 sm:flex-none`}><Copy className="h-4 w-4" aria-hidden="true" />Copy trade</button>
        )}
      </div>
    </motion.article>
  )
}

export default memo(TraderCard)