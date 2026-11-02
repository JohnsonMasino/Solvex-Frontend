// Minichart.jsx
import { useId, useState } from 'react'
import { GREEN, RED, signedPct } from './copyTradeUtils'

const TIMEFRAMES = ['1H', '4H', '1D', '1W', '1M']
const W = 200
const H = 60
const PAD = 4

export default function MiniChart({ charts, pnlPct }) {
  const [tf, setTf] = useState('1D')
  const uid = useId().replace(/:/g, '')
  const data = charts[tf] ?? charts['1D']
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const x = (i) => PAD + (i / (data.length - 1)) * (W - PAD * 2)
  const y = (v) => PAD + (1 - (v - min) / range) * (H - PAD * 2)
  const line = data.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const area = `${PAD},${H} ${line} ${W - PAD},${H}`
  const color = pnlPct >= 0 ? GREEN : RED

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400">Return</span>
        <span className="font-mono text-sm font-semibold tabular-nums" style={{ color }}>{signedPct(pnlPct)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1.5 h-14 w-full" role="img" aria-label={`Simulated return chart, ${tf}`}>
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${uid})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1.5 flex gap-1" role="tablist" aria-label="Chart timeframe">
        {TIMEFRAMES.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tf === t} onClick={() => setTf(t)}
            className={`h-7 flex-1 rounded-md text-[10px] font-semibold transition-colors ${tf === t ? 'bg-[#3DDC97]/[0.15] text-[#3DDC97]' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'}`}>{t}</button>
        ))}
      </div>
    </div>
  )
}