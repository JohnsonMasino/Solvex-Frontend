import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import MarqueeModule from 'react-fast-marquee'
import CountUpModule from 'react-countup'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  Bitcoin,
  Building2,
  Calculator,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Fingerprint,
  Globe,
  Headphones,
  KeyRound,
  Landmark,
  Layers,
  ListOrdered,
  Lock,
  MapPin,
  Ruler,
  Scale,
  ShieldCheck,
  Smartphone,
  Target,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
  Zap,
} from 'lucide-react'

// Some packages ship CommonJS builds, so Vite can hand back { default: Component }
// instead of the component itself. This picks the real component either way.
const Marquee = MarqueeModule.default ?? MarqueeModule
const CountUp = CountUpModule.default ?? CountUpModule

/* ────────────────────────────────────────────────
   COMPANY DATA  (edit here, it flows through the page)
──────────────────────────────────────────────── */

const GREEN = '#3DDC97'
const RED = '#F6465D'

const COMPANY = {
  name: 'Solvexmarketinc',
  founded: 2012,
  addressLines: ['5 Quinton Road', 'Coventry', 'CV1 2WT', 'United Kingdom'],
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=5+Quinton+Road+Coventry+CV1+2WT+United+Kingdom',
}
const CURRENT_YEAR = new Date().getFullYear()
const YEARS_ACTIVE = CURRENT_YEAR - COMPANY.founded

/* ────────────────────────────────────────────────
   MARKET DATA  (SAMPLE DATA: replace with a live feed)
──────────────────────────────────────────────── */

const RAW_PAIRS = [
  { pair: 'BTC/USD', type: 'crypto', change: 1.24 },
  { pair: 'ETH/USD', type: 'crypto', change: 2.07 },
  { pair: 'BNB/USD', type: 'crypto', change: 0.87 },
  { pair: 'SOL/USD', type: 'crypto', change: 3.15 },
  { pair: 'XRP/USD', type: 'crypto', change: -1.08 },
  { pair: 'ADA/USD', type: 'crypto', change: -0.64 },
  { pair: 'DOGE/USD', type: 'crypto', change: 4.21 },
  { pair: 'DOT/USD', type: 'crypto', change: -0.37 },
  { pair: 'LTC/USD', type: 'crypto', change: 0.95 },
  { pair: 'LINK/USD', type: 'crypto', change: 1.76 },
  { pair: 'EUR/USD', type: 'forex', change: -0.18 },
  { pair: 'GBP/USD', type: 'forex', change: 0.32 },
  { pair: 'USD/JPY', type: 'forex', change: -0.41 },
  { pair: 'AUD/USD', type: 'forex', change: -0.22 },
  { pair: 'USD/CHF', type: 'forex', change: 0.12 },
  { pair: 'USD/CAD', type: 'forex', change: -0.09 },
  { pair: 'NZD/USD', type: 'forex', change: 0.27 },
  { pair: 'EUR/GBP', type: 'forex', change: -0.14 },
  { pair: 'EUR/JPY', type: 'forex', change: 0.38 },
  { pair: 'GBP/JPY', type: 'forex', change: 0.51 },
]

// Small seeded generator so the sample curves are stable between renders
function rng(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const POINTS = 24

// Every pair gets a 24-point curve that starts at 100 and ends at 100 + change
const PAIRS = (() => {
  let c = 0
  let f = 0
  return RAW_PAIRS.map((p, i) => {
    const idx = p.type === 'crypto' ? c++ : f++
    const color =
      p.type === 'crypto' ? `hsl(${140 + idx * 8}, 75%, 58%)` : `hsl(${205 + idx * 9}, 80%, 66%)`
    const r = rng(i * 977 + 13)
    const vol = p.type === 'crypto' ? 0.9 : 0.3
    const walk = [0]
    for (let k = 1; k < POINTS; k++) walk.push(walk[k - 1] + (r() - 0.5) * vol)
    const end = walk[POINTS - 1]
    const series = walk.map((n, k) => {
      const bridge = n - (k / (POINTS - 1)) * end
      return 100 + (p.change * k) / (POINTS - 1) + bridge
    })
    return { ...p, color, series }
  })
})()

const LINE_ROWS = Array.from({ length: POINTS }, (_, k) => {
  const row = { t: k }
  PAIRS.forEach((p) => {
    row[p.pair] = Number(p.series[k].toFixed(3))
  })
  return row
})

const fmt = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

/* Coin / currency badges (glyph based, no external images needed) */
const CCY = {
  BTC: ['₿', '#F7931A'],
  ETH: ['Ξ', '#627EEA'],
  BNB: ['B', '#F3BA2F'],
  SOL: ['S', '#9945FF'],
  XRP: ['X', '#3B4650'],
  ADA: ['A', '#2A5ADA'],
  DOGE: ['Ð', '#C2A633'],
  DOT: ['●', '#E6007A'],
  LTC: ['Ł', '#345D9D'],
  LINK: ['L', '#2A5ADA'],
  USD: ['$', '#2F8F5B'],
  EUR: ['€', '#2459D1'],
  GBP: ['£', '#B1243B'],
  JPY: ['¥', '#C23B3B'],
  CHF: ['Fr', '#D52B1E'],
  AUD: ['A$', '#00843D'],
  CAD: ['C$', '#D80621'],
  NZD: ['N$', '#1F3C88'],
}

function Coin({ code }) {
  const [glyph, bg] = CCY[code] || [code[0], '#334155']
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-[#0B141B]"
      style={{ background: bg }}
    >
      {glyph}
    </span>
  )
}

function PairBadge({ pair }) {
  const [a, b] = pair.split('/')
  return (
    <span className="flex -space-x-2">
      <Coin code={a} />
      <Coin code={b} />
    </span>
  )
}

/* ────────────────────────────────────────────────
   SHARED BUILDING BLOCKS
──────────────────────────────────────────────── */

const card = 'rounded-2xl border border-white/10 bg-[#0B141B]'

function Reveal({ children, delay = 0, y = 24, className = '' }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

function Heading({ eyebrow, title, text, icon: Icon }) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-[#3DDC97]/30 bg-[#3DDC97]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#3DDC97]">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {eyebrow}
      </span>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
        {title}
      </h2>
      {text && <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">{text}</p>}
    </Reveal>
  )
}

function Section({ id, alt = false, children }) {
  return (
    <section
      id={id}
      className={`relative overflow-hidden px-4 py-14 sm:px-6 sm:py-20 lg:px-8 ${
        alt ? 'bg-[#0A1118]' : 'bg-[#080D12]'
      }`}
    >
      <div className="relative mx-auto max-w-7xl">{children}</div>
    </section>
  )
}

const chartTooltipStyle = {
  background: '#0B141B',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  fontSize: 12,
  color: '#fff',
}
const axisTick = { fill: '#94A3B8', fontSize: 11 }
const axisLine = { stroke: 'rgba(255,255,255,0.1)' }

/* ────────────────────────────────────────────────
   1. COMPANY INTRO + COUNTERS
──────────────────────────────────────────────── */

function Intro() {
  const reduce = useReducedMotion()
  const stats = [
    { icon: Calendar, end: COMPANY.founded, label: 'Founded and registered' },
    { icon: Clock, end: YEARS_ACTIVE, suffix: '+', label: 'Years in the markets' },
    { icon: Layers, end: 20, suffix: '+', label: 'Featured trading pairs' },
    { icon: Globe, end: 24, suffix: '/7', label: 'Crypto market access' },
  ]
  return (
    <section className="relative overflow-hidden bg-[#080D12] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#3DDC97]/10 blur-3xl"
        animate={reduce ? undefined : { y: [0, 30, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#2E9BFF]/10 blur-3xl"
        animate={reduce ? undefined : { y: [0, -30, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto max-w-7xl">
        <Heading
          icon={Landmark}
          eyebrow={`Established ${COMPANY.founded}`}
          title={`Crypto and forex markets, backed by ${YEARS_ACTIVE}+ years of experience`}
          text={`${COMPANY.name} was founded and registered in ${COMPANY.founded}. From our headquarters in Coventry, United Kingdom, we give traders a single account to access Bitcoin, Ethereum and the world's major currency pairs.`}
        />

        <Reveal delay={0.1} className="mt-6 flex justify-center">
          <a
            href={COMPANY.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-slate-300 transition-colors hover:border-[#3DDC97]/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:text-sm"
          >
            <MapPin className="h-4 w-4 shrink-0 text-[#3DDC97]" aria-hidden="true" />
            <span className="truncate">HQ: 5 Quinton Road, Coventry CV1 2WT, United Kingdom</span>
          </a>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <Reveal key={s.label} delay={i * 0.08}>
                <motion.div
                  whileHover={reduce ? undefined : { y: -4 }}
                  className={`${card} p-4 text-center sm:p-6`}
                >
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-3xl font-bold tabular-nums text-white sm:text-4xl">
                    <CountUp
                      end={s.end}
                      suffix={s.suffix || ''}
                      duration={reduce ? 0 : 2.4}
                      enableScrollSpy
                      scrollSpyOnce
                    />
                  </p>
                  <p className="mt-1 text-xs text-slate-400 sm:text-sm">{s.label}</p>
                </motion.div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────
   2. TOP 20 MARKETS: animated combined chart
──────────────────────────────────────────────── */

function LinesTooltip({ active, payload, focus }) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].sort((a, b) => b.value - a.value)
  const rows = focus
    ? sorted.filter((p) => p.dataKey === focus)
    : sorted.length > 6
      ? [...sorted.slice(0, 3), ...sorted.slice(-3)]
      : sorted
  return (
    <div className="rounded-xl border border-white/10 bg-[#0B141B] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-slate-400">
        {focus ? 'Selected pair' : 'Leaders and laggards'}
      </p>
      {rows.map((r) => {
        const pct = r.value - 100
        return (
          <p key={r.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-white">
              <span className="h-2 w-2 rounded-full" style={{ background: r.stroke }} />
              {r.dataKey}
            </span>
            <span style={{ color: pct >= 0 ? GREEN : RED }}>{fmt(pct)}</span>
          </p>
        )
      })}
    </div>
  )
}

function MarketsChartSection() {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-120px' })
  const [filter, setFilter] = useState('all')
  const [focus, setFocus] = useState(null)

  const visible = useMemo(
    () => PAIRS.filter((p) => filter === 'all' || p.type === filter),
    [filter],
  )
  const gainers = visible.filter((p) => p.change >= 0).length
  const best = [...visible].sort((a, b) => b.change - a.change)[0]
  const worst = [...visible].sort((a, b) => a.change - b.change)[0]

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'forex', label: 'Forex' },
  ]
  const kpis = [
    { label: 'Pairs rising', value: `${gainers} / ${visible.length}`, color: GREEN, icon: TrendingUp },
    { label: 'Pairs falling', value: `${visible.length - gainers} / ${visible.length}`, color: RED, icon: TrendingDown },
    { label: `Top mover ${best.pair}`, value: fmt(best.change), color: GREEN, icon: Activity },
    { label: `Weakest ${worst.pair}`, value: fmt(worst.change), color: RED, icon: Activity },
  ]

  return (
    <Section id="markets" alt>
      <Heading
        icon={Activity}
        eyebrow="Market overview"
        title="The top crypto and forex pairs, in one view"
        text="Ten leading crypto pairs and ten major forex pairs plotted together. Select a pair to isolate it, or filter by market."
      />

      {/* Ticker */}
      <Reveal delay={0.1} className={`${card} mt-8 overflow-hidden`}>
        <Marquee speed={38} gradient={false} pauseOnHover play={!reduce}>
          {PAIRS.map((p) => (
            <div key={p.pair} className="flex items-center gap-3 px-5 py-3 text-sm">
              <PairBadge pair={p.pair} />
              <span className="font-semibold text-white">{p.pair}</span>
              <span className="font-medium" style={{ color: p.change >= 0 ? GREEN : RED }}>
                {fmt(p.change)}
              </span>
            </div>
          ))}
        </Marquee>
      </Reveal>

      {/* Filters + KPIs */}
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-full rounded-xl border border-white/10 bg-[#0B141B] p-1 sm:w-auto" role="tablist" aria-label="Market filter">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => {
                setFilter(t.id)
                setFocus(null)
              }}
              className={`relative flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:flex-none sm:px-6 ${
                filter === t.id ? 'text-[#06140E]' : 'text-slate-300 hover:text-white'
              }`}
            >
              {filter === t.id && (
                <motion.span
                  layoutId="market-tab"
                  className="absolute inset-0 rounded-lg bg-[#3DDC97]"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Sample data for illustration. Not live prices.</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <div key={k.label} className={`${card} flex items-center gap-3 p-3 sm:p-4`}>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${k.color}1A`, color: k.color }}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.7rem] text-slate-400 sm:text-xs">{k.label}</p>
                <p className="text-base font-bold text-white sm:text-lg">{k.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div ref={ref} className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={`${card} p-4 sm:p-5`}>
          <h3 className="text-sm font-semibold text-white sm:text-base">24h performance, all pairs joined</h3>
          <p className="mt-1 text-xs text-slate-400">Each line starts at 0% and ends at the pair's 24h change.</p>
          <div className="mt-4 h-[280px] sm:h-[340px]">
            {inView && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart key={filter} data={LINE_ROWS} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="t"
                    ticks={[0, 6, 12, 18, 23]}
                    tickFormatter={(t) => (t === 23 ? 'Now' : `-${23 - t}h`)}
                    tick={axisTick}
                    axisLine={axisLine}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v - 100 >= 0 ? '+' : ''}${(v - 100).toFixed(1)}%`}
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <ReferenceLine y={100} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
                  <Tooltip content={<LinesTooltip focus={focus} />} />
                  {visible.map((p, i) => (
                    <Line
                      key={p.pair}
                      type="monotone"
                      dataKey={p.pair}
                      stroke={p.color}
                      strokeWidth={focus === p.pair ? 3 : 1.6}
                      strokeOpacity={focus && focus !== p.pair ? 0.1 : 0.9}
                      dot={false}
                      isAnimationActive={!reduce}
                      animationDuration={1600}
                      animationBegin={i * 70}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`${card} p-4 sm:p-5`}>
          <h3 className="text-sm font-semibold text-white sm:text-base">24h change by pair</h3>
          <p className="mt-1 text-xs text-slate-400">Bars show each pair; the line joins them into one market profile.</p>
          <div className="mt-4 overflow-x-auto">
            <div className="h-[280px] min-w-[560px] sm:h-[340px]">
              {inView && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart key={filter} data={visible} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="pair"
                      interval={0}
                      angle={-55}
                      textAnchor="end"
                      height={64}
                      tick={{ ...axisTick, fontSize: 10 }}
                      axisLine={axisLine}
                      tickLine={false}
                    />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={axisTick} axisLine={false} tickLine={false} width={44} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={chartTooltipStyle}
                      formatter={(v) => [fmt(v), '24h change']}
                    />
                    <Bar dataKey="change" radius={[4, 4, 0, 0]} isAnimationActive={!reduce} animationDuration={1200}>
                      {visible.map((p) => (
                        <Cell key={p.pair} fill={p.change >= 0 ? GREEN : RED} fillOpacity={focus && focus !== p.pair ? 0.25 : 0.85} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="change"
                      stroke="#E2E8F0"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#E2E8F0' }}
                      isAnimationActive={!reduce}
                      animationBegin={600}
                      animationDuration={1400}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pair chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {visible.map((p) => (
          <button
            key={p.pair}
            type="button"
            aria-pressed={focus === p.pair}
            onClick={() => setFocus((f) => (f === p.pair ? null : p.pair))}
            className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
              focus === p.pair
                ? 'border-[#3DDC97] bg-[#3DDC97]/10 text-white'
                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30'
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.pair}
            <span style={{ color: p.change >= 0 ? GREEN : RED }}>{fmt(p.change)}</span>
          </button>
        ))}
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   3. MARKETS WE OFFER + LIVE SESSIONS CLOCK
──────────────────────────────────────────────── */

const OFFERS = [
  {
    icon: Bitcoin,
    title: 'Crypto markets',
    tag: '24 / 7',
    points: [
      'Bitcoin, Ethereum, Solana, XRP and more',
      'Trading never closes, including weekends',
      'Larger price swings: bigger opportunity, bigger risk',
    ],
  },
  {
    icon: Banknote,
    title: 'Forex markets',
    tag: '24 / 5',
    points: [
      'Major and cross pairs such as EUR/USD and GBP/JPY',
      'Deep liquidity and tight, steady price moves',
      'Busiest when the London and New York sessions overlap',
    ],
  },
]

const SESSIONS = [
  { name: 'Sydney', hours: [[22, 24], [0, 7]], color: '#38BDF8' },
  { name: 'Tokyo', hours: [[0, 9]], color: '#A78BFA' },
  { name: 'London', hours: [[8, 17]], color: GREEN },
  { name: 'New York', hours: [[13, 22]], color: '#F59E0B' },
]

function MarketSessions() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])
  const h = now.getUTCHours() + now.getUTCMinutes() / 60
  const clock = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`

  return (
    <div className={`${card} p-4 sm:p-6`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white sm:text-lg">Forex trading sessions</h3>
          <p className="mt-1 text-xs text-slate-400">Approximate hours in UTC. They shift with daylight saving.</p>
        </div>
        <span className="shrink-0 rounded-lg bg-[#3DDC97]/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#3DDC97]">
          {clock} UTC
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {SESSIONS.map((s) => {
          const open = s.hours.some(([a, b]) => h >= a && h < b)
          return (
            <div key={s.name}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-white">{s.name}</span>
                <span className={open ? 'text-[#3DDC97]' : 'text-slate-500'}>{open ? 'Open' : 'Closed'}</span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.06]">
                {s.hours.map(([a, b]) => (
                  <motion.span
                    key={`${a}-${b}`}
                    className="absolute inset-y-0 origin-left rounded-full"
                    style={{ left: `${(a / 24) * 100}%`, width: `${((b - a) / 24) * 100}%`, background: s.color, opacity: open ? 1 : 0.55 }}
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                  />
                ))}
                <span className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${(h / 24) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex justify-between text-[0.65rem] text-slate-500">
        {['00', '06', '12', '18', '24'].map((t) => (
          <span key={t}>{t}:00</span>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#3DDC97]/[0.07] p-3 text-xs leading-relaxed text-slate-300">
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#3DDC97]" aria-hidden="true" />
        Liquidity and volatility are usually highest when London and New York overlap, roughly 13:00 to 17:00 UTC.
      </p>
    </div>
  )
}

function MarketsOffer() {
  const reduce = useReducedMotion()
  return (
    <Section id="offer">
      <Heading
        icon={Layers}
        eyebrow="Markets"
        title="Two major markets. One account."
        text="Trade digital assets around the clock and the world's most liquid currency pairs, all from the same wallet."
      />
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          {OFFERS.map((o, i) => {
            const Icon = o.icon
            return (
              <Reveal key={o.title} delay={i * 0.1}>
                <motion.div whileHover={reduce ? undefined : { y: -4 }} className={`${card} h-full p-5 sm:p-6`}>
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/20">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                      {o.tag}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{o.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {o.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-sm text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3DDC97]" aria-hidden="true" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </Reveal>
            )
          })}
        </div>
        <Reveal delay={0.15}>
          <MarketSessions />
        </Reveal>
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   4. HOW IT WORKS
──────────────────────────────────────────────── */

const STEPS = [
  { icon: UserPlus, title: 'Create your account', text: 'Register with your email in a couple of minutes.' },
  { icon: Fingerprint, title: 'Verify your identity', text: 'Complete KYC once to unlock funding and withdrawals.' },
  { icon: Wallet, title: 'Fund your wallet', text: 'Deposit using a supported payment method.' },
  { icon: Activity, title: 'Place your trade', text: 'Choose a pair, then set entry, stop-loss and target first.' },
  { icon: Banknote, title: 'Withdraw anytime', text: 'Request withdrawals to your verified method when you choose.' },
]

function HowItWorks() {
  return (
    <Section id="how-it-works" alt>
      <Heading
        icon={ListOrdered}
        eyebrow="Getting started"
        title="From sign-up to first trade in five steps"
        text="A simple, secure path that keeps your account protected and your trading organised."
      />
      <div className="relative mt-12">
        <motion.div
          aria-hidden="true"
          className="absolute left-[10%] right-[10%] top-7 hidden h-px origin-left bg-gradient-to-r from-[#3DDC97]/0 via-[#3DDC97]/60 to-[#3DDC97]/0 lg:block"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <Reveal key={s.title} delay={i * 0.1}>
                <div className="relative h-full rounded-2xl border border-white/10 bg-[#0B141B] p-5 text-center lg:border-transparent lg:bg-transparent lg:p-2">
                  <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F1B24] text-[#3DDC97] ring-1 ring-[#3DDC97]/30">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#3DDC97] text-xs font-bold text-[#06140E]">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-white">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.text}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   5. TRADING ESSENTIALS
──────────────────────────────────────────────── */

const ESSENTIALS = [
  {
    icon: Ruler,
    term: 'Pips and spreads',
    text: 'A pip is the smallest standard price move in forex (0.0001 for most pairs). The spread is the gap between the buy and sell price, and it is your cost of entering a trade.',
    example: 'EUR/USD moving from 1.0850 to 1.0860 is a 10-pip move.',
  },
  {
    icon: Layers,
    term: 'Leverage and margin',
    text: 'Leverage lets you control a larger position with less capital, while margin is the deposit held against it. It magnifies profits and losses equally.',
    example: 'At 10:1, $1,000 controls $10,000, so a 10% adverse move can wipe out the whole margin.',
  },
  {
    icon: ArrowDownUp,
    term: 'Going long or short',
    text: 'Buy (long) when you expect the price to rise. Sell (short) when you expect it to fall. Both are available in crypto and forex.',
    example: 'Short BTC/USD at 60,000, close at 58,000: the trade gains 2,000 per coin.',
  },
  {
    icon: Target,
    term: 'Stop-loss and take-profit',
    text: 'A stop-loss closes a trade at a set loss. A take-profit closes it at a set gain. Planning both before entry takes emotion out of the decision.',
    example: 'Entry 100, stop 95, target 110 gives a 1:2 risk-to-reward ratio.',
  },
  {
    icon: ListOrdered,
    term: 'Market and limit orders',
    text: 'A market order fills immediately at the best available price. A limit order waits until the price you choose is reached.',
    example: 'Limit buy ETH/USD below today’s price to enter only on a pullback.',
  },
  {
    icon: Scale,
    term: 'Position sizing',
    text: 'Decide how much to risk first, then size the trade to fit. Small, consistent risk keeps one bad trade from becoming a serious setback.',
    example: 'Risking 1% of a $5,000 account means a maximum loss of $50 per trade.',
  },
]

function Essentials() {
  const reduce = useReducedMotion()
  return (
    <Section id="essentials">
      <Heading
        icon={Ruler}
        eyebrow="Trading essentials"
        title="Six concepts every trader should know"
        text="Understand the language of the market before you place your first order."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ESSENTIALS.map((e, i) => {
          const Icon = e.icon
          return (
            <Reveal key={e.term} delay={(i % 3) * 0.08}>
              <motion.div whileHover={reduce ? undefined : { y: -4 }} className={`${card} flex h-full flex-col p-5 sm:p-6`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/20">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">{e.term}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{e.text}</p>
                <p className="mt-4 rounded-xl bg-white/[0.04] p-3 text-xs leading-relaxed text-slate-300">
                  <span className="font-semibold text-[#3DDC97]">Example: </span>
                  {e.example}
                </p>
              </motion.div>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   6. TRADING STYLES (tabs)
──────────────────────────────────────────────── */

const STYLES = [
  {
    id: 'scalping',
    label: 'Scalping',
    desc: 'Many very short trades aiming for small gains. It demands fast decisions and tight cost control.',
    frame: '1 to 5 minute charts',
    hold: 'Seconds to minutes',
    fit: 'Experienced, highly focused traders',
    risk: 'Spreads and fees add up quickly',
    level: 95,
  },
  {
    id: 'day',
    label: 'Day trading',
    desc: 'Positions are opened and closed within the same day, so nothing is held overnight.',
    frame: '15 minute to 1 hour charts',
    hold: 'Minutes to hours',
    fit: 'Traders who can watch the market daily',
    risk: 'Overtrading and intraday volatility',
    level: 75,
  },
  {
    id: 'swing',
    label: 'Swing trading',
    desc: 'Capture larger moves that develop over several days, using trends and key support and resistance levels.',
    frame: '4 hour to daily charts',
    hold: 'Days to weeks',
    fit: 'Part-time traders with a plan',
    risk: 'Overnight and weekend price gaps',
    level: 50,
  },
  {
    id: 'position',
    label: 'Position trading',
    desc: 'A long-term approach built on major trends and fundamentals, with fewer trades and wider stops.',
    frame: 'Daily to weekly charts',
    hold: 'Weeks to months',
    fit: 'Patient, long-term traders',
    risk: 'Capital tied up and large drawdowns',
    level: 30,
  },
]

function Styles() {
  const [active, setActive] = useState('day')
  const s = STYLES.find((x) => x.id === active)
  const rows = [
    { label: 'Typical chart', value: s.frame },
    { label: 'Holding time', value: s.hold },
    { label: 'Best suited to', value: s.fit },
    { label: 'Main risk', value: s.risk },
  ]
  return (
    <Section id="styles" alt>
      <Heading
        icon={Activity}
        eyebrow="Trading styles"
        title="Find a style that fits your schedule"
        text="There is no single right way to trade. Match your approach to your time, temperament and risk tolerance."
      />
      <div className="mx-auto mt-10 max-w-4xl">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Trading styles">
          {STYLES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active === t.id}
              onClick={() => setActive(t.id)}
              className={`relative rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
                active === t.id
                  ? 'border-[#3DDC97]/60 bg-[#3DDC97]/10 text-white'
                  : 'border-white/10 bg-[#0B141B] text-slate-300 hover:border-white/25'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={`${card} mt-4 p-5 sm:p-7`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <p className="text-sm leading-relaxed text-slate-300 sm:text-base">{s.desc}</p>
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                  <span>Time commitment</span>
                  <span>{s.level >= 75 ? 'Very high' : s.level >= 50 ? 'High' : 'Moderate'}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#3DDC97] to-[#5BEBAD]"
                    initial={{ width: 0 }}
                    animate={{ width: `${s.level}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                </div>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {rows.map((r) => (
                  <div key={r.label} className="rounded-xl bg-white/[0.04] p-3.5">
                    <dt className="text-xs text-slate-400">{r.label}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-white">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   7. RISK MANAGEMENT: calculator + recovery chart
──────────────────────────────────────────────── */

const RECOVERY = [5, 10, 20, 30, 40, 50].map((loss) => ({
  loss: `-${loss}%`,
  need: Number(((loss / (100 - loss)) * 100).toFixed(1)),
}))

const RISK_RULES = [
  'Risk only 1 to 2% of your account on any single trade',
  'Always set a stop-loss before you enter',
  'Aim for a reward at least 1.5 times your risk',
  'Avoid overtrading after a loss',
  'Keep a journal and review it every week',
]

function Field({ label, value, onChange, suffix }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="mt-1 flex items-center rounded-xl border border-white/10 bg-[#080D12] focus-within:border-[#3DDC97]/60 focus-within:ring-1 focus-within:ring-[#3DDC97]/40">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent px-3 py-2.5 text-base text-white outline-none"
        />
        {suffix && <span className="pr-3 text-xs text-slate-500">{suffix}</span>}
      </span>
    </label>
  )
}

function RiskManagement() {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const [bal, setBal] = useState('5000')
  const [pct, setPct] = useState('1')
  const [entry, setEntry] = useState('100')
  const [stop, setStop] = useState('95')
  const [rr, setRr] = useState('2')

  const b = Number(bal)
  const p = Number(pct)
  const e = Number(entry)
  const s = Number(stop)
  const r = Number(rr)
  const dist = Math.abs(e - s)
  const valid = [b, p, e, s, r].every((n) => Number.isFinite(n) && n > 0) && dist > 0
  const riskAmt = valid ? (b * p) / 100 : 0
  const units = valid ? riskAmt / dist : 0
  const target = valid ? (e > s ? e + dist * r : e - dist * r) : 0
  const num = (n, d = 2) =>
    valid ? n.toLocaleString('en-GB', { maximumFractionDigits: d }) : '–'

  const outputs = [
    { label: 'Amount at risk', value: `$${num(riskAmt)}` },
    { label: 'Position size (units)', value: num(units, 4) },
    { label: 'Position value', value: `$${num(units * e)}` },
    { label: `Take-profit at 1:${rr || 0}`, value: num(target) },
    { label: 'Potential reward', value: `$${num(riskAmt * r)}` },
    { label: 'Stop distance', value: num(dist, 4) },
  ]

  return (
    <Section id="risk">
      <Heading
        icon={AlertTriangle}
        eyebrow="Risk management"
        title="Protect your capital first. Profits follow."
        text="Use the position size calculator to decide how big a trade should be before you enter it."
      />

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <Reveal>
          <div className={`${card} h-full p-5 sm:p-6`}>
            <h3 className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
              <Calculator className="h-5 w-5 text-[#3DDC97]" aria-hidden="true" />
              Position size calculator
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Account balance" value={bal} onChange={setBal} suffix="$" />
              <Field label="Risk per trade" value={pct} onChange={setPct} suffix="%" />
              <Field label="Entry price" value={entry} onChange={setEntry} />
              <Field label="Stop-loss price" value={stop} onChange={setStop} />
              <div className="col-span-2">
                <Field label="Reward-to-risk ratio (1 : x)" value={rr} onChange={setRr} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {outputs.map((o) => (
                <div key={o.label} className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-[0.7rem] text-slate-400">{o.label}</p>
                  <p className="mt-0.5 truncate text-base font-bold tabular-nums text-white">{o.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              {!valid
                ? 'Enter values above zero, and make sure entry and stop-loss differ.'
                : p > 2
                  ? 'Risking more than 2% per trade is considered aggressive.'
                  : 'For education only. Always check position size on your trading ticket.'}
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div ref={ref} className={`${card} flex h-full flex-col p-5 sm:p-6`}>
            <h3 className="text-base font-semibold text-white sm:text-lg">Why small losses matter</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              The gain needed to recover grows faster than the loss itself.
            </p>
            <div className="mt-4 h-[220px]">
              {inView && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={RECOVERY} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="loss" tick={axisTick} axisLine={axisLine} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={axisTick} axisLine={false} tickLine={false} width={44} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={chartTooltipStyle}
                      formatter={(v) => [`+${v}%`, 'Gain needed to recover']}
                    />
                    <Bar dataKey="need" radius={[6, 6, 0, 0]} isAnimationActive={!reduce} animationDuration={1200}>
                      {RECOVERY.map((d, i) => (
                        <Cell key={d.loss} fill={i < 2 ? GREEN : i < 4 ? '#F59E0B' : RED} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <ul className="mt-4 space-y-2">
              {RISK_RULES.map((rule) => (
                <li key={rule} className="flex items-start gap-2 text-sm text-slate-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3DDC97]" aria-hidden="true" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   8. PLATFORM FEATURES
──────────────────────────────────────────────── */

const FEATURES = [
  { icon: Zap, title: 'Fast order handling', text: 'A responsive interface built to place and manage trades without delay.' },
  { icon: Wallet, title: 'One wallet', text: 'Fund once and use the same balance across crypto and forex pairs.' },
  { icon: Activity, title: 'Charts and indicators', text: 'Read price action with interactive charts and market overviews.' },
  { icon: Smartphone, title: 'Built for mobile', text: 'A responsive layout that works on phone, tablet and desktop.' },
  { icon: Bell, title: 'Account notifications', text: 'Stay informed about deposits, withdrawals and account activity.' },
  { icon: Headphones, title: 'Live support', text: 'Reach the support team through live chat whenever you need help.' },
]

function Features() {
  const reduce = useReducedMotion()
  return (
    <Section id="features" alt>
      <Heading
        icon={Zap}
        eyebrow="Platform"
        title="Everything you need to trade with clarity"
        text="Tools designed to keep you informed, organised and in control."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon
          return (
            <Reveal key={f.title} delay={(i % 3) * 0.08}>
              <motion.div whileHover={reduce ? undefined : { y: -4 }} className={`${card} group flex h-full gap-4 p-5 transition-colors hover:border-[#3DDC97]/40`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/20 transition-colors group-hover:bg-[#3DDC97]/20">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{f.text}</p>
                </div>
              </motion.div>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   9. SECURITY
──────────────────────────────────────────────── */

const SECURITY = [
  { icon: BadgeCheck, title: 'KYC-verified accounts', text: 'Identity checks help prevent fraud and protect every client.' },
  { icon: KeyRound, title: 'Account protection', text: 'Strong passwords and two-factor authentication guard your login.' },
  { icon: Lock, title: 'Encrypted connections', text: 'Data between your device and the platform travels over HTTPS.' },
  { icon: ShieldCheck, title: 'Controlled withdrawals', text: 'Withdrawals go to your verified method, with checks on each request.' },
]

function Security() {
  const reduce = useReducedMotion()
  return (
    <Section id="security">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="order-2 lg:order-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#3DDC97]/30 bg-[#3DDC97]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#3DDC97]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Security
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Your account and funds are treated with care
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
            Trading platforms handle sensitive information. These are the safeguards that sit behind every account.
          </p>
          <ul className="mt-6 space-y-4">
            {SECURITY.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.li
                  key={s.title}
                  className="flex gap-3.5"
                  initial={reduce ? false : { opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0F1B24] text-[#3DDC97] ring-1 ring-white/10">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-base font-semibold text-white">{s.title}</span>
                    <span className="block text-sm text-slate-400">{s.text}</span>
                  </span>
                </motion.li>
              )
            })}
          </ul>
        </Reveal>

        {/* Animated shield */}
        <div className="order-1 flex justify-center lg:order-2" aria-hidden="true">
          <div className="relative flex h-64 w-64 items-center justify-center sm:h-80 sm:w-80">
            {[1, 2, 3].map((n) => (
              <motion.span
                key={n}
                className="absolute rounded-full border border-[#3DDC97]/30"
                style={{ inset: `${(n - 1) * 14}%` }}
                animate={reduce ? undefined : { scale: [1, 1.06, 1], opacity: [0.9, 0.4, 0.9] }}
                transition={{ duration: 3.2, repeat: Infinity, delay: n * 0.5, ease: 'easeInOut' }}
              />
            ))}
            <motion.span
              className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[#3DDC97] to-[#1E9E6B] text-[#06140E] shadow-[0_0_60px_-10px_rgba(61,220,151,0.8)] sm:h-28 sm:w-28"
              animate={reduce ? undefined : { y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ShieldCheck className="h-12 w-12 sm:h-14 sm:w-14" />
            </motion.span>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   10. COMPANY PROFILE + TIMELINE
──────────────────────────────────────────────── */

function CompanyProfile() {
  const years = Array.from({ length: YEARS_ACTIVE + 1 }, (_, i) => COMPANY.founded + i)
  const facts = [
    { icon: Calendar, label: 'Founded and registered', value: String(COMPANY.founded) },
    { icon: Clock, label: 'Years in operation', value: `${YEARS_ACTIVE}+` },
    { icon: Building2, label: 'Headquarters', value: 'Coventry, United Kingdom' },
  ]
  return (
    <Section id="company" alt>
      <Heading
        icon={Building2}
        eyebrow="About the company"
        title={`Operating since ${COMPANY.founded}`}
        text="Established, registered and headquartered in the United Kingdom, with a focus on giving traders clear, organised access to the markets."
      />

      <Reveal delay={0.1} className={`${card} mt-10 p-5 sm:p-8`}>
        <div className="flex items-center justify-between text-xs font-semibold sm:text-sm">
          <span className="text-[#3DDC97]">{COMPANY.founded} Founded and registered</span>
          <span className="text-white">{CURRENT_YEAR} Today</span>
        </div>
        <div className="relative mt-4">
          <motion.div
            className="absolute inset-x-0 top-1/2 h-px origin-left -translate-y-1/2 bg-gradient-to-r from-[#3DDC97] to-white/20"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          />
          <div className="relative flex items-center justify-between">
            {years.map((y, i) => {
              const edge = i === 0 || i === years.length - 1
              return (
                <motion.span
                  key={y}
                  title={String(y)}
                  className={`block rounded-full ${edge ? 'h-4 w-4 bg-[#3DDC97] ring-4 ring-[#3DDC97]/20' : 'h-2 w-2 bg-slate-500'}`}
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: 0.15 + i * 0.06 }}
                />
              )
            })}
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-400 sm:text-sm">
          One dot for every year of operation since {COMPANY.founded}.
        </p>
      </Reveal>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-1">
          {facts.map((f, i) => {
            const Icon = f.icon
            return (
              <Reveal key={f.label} delay={i * 0.08}>
                <div className={`${card} flex items-center gap-4 p-4 sm:p-5 lg:h-full`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">{f.label}</p>
                    <p className="text-base font-semibold text-white sm:text-lg">{f.value}</p>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>

        <Reveal delay={0.1} className="lg:col-span-2">
          <div className={`${card} flex h-full flex-col justify-between p-5 sm:p-6`}>
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/20">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">Head office</h3>
              <address className="mt-2 space-y-0.5 text-sm not-italic leading-relaxed text-slate-300">
                {COMPANY.addressLines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </address>
            </div>
            <a
              href={COMPANY.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 text-sm font-medium text-white transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
            >
              Get directions
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </a>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   11. FAQ
──────────────────────────────────────────────── */

const FAQS = [
  {
    q: 'What can I trade on Solvexmarketinc?',
    a: 'You can trade crypto pairs such as BTC/USD, ETH/USD and SOL/USD, and forex pairs such as EUR/USD, GBP/USD and USD/JPY. Available instruments may change over time.',
  },
  {
    q: 'What is the difference between crypto and forex?',
    a: 'Crypto trades 24 hours a day, every day, and tends to move more sharply. Forex trades 24 hours a day, five days a week, and is usually steadier because of its very deep liquidity.',
  },
  {
    q: 'Why do I need to complete KYC?',
    a: 'Identity verification protects your account and helps prevent fraud and money laundering. You verify once, then you can fund your wallet and withdraw.',
  },
  {
    q: 'How do deposits and withdrawals work?',
    a: 'Fund your wallet from your account dashboard and request withdrawals back to your verified payment method. Processing times depend on the method you use.',
  },
  {
    q: 'How much should I risk on each trade?',
    a: 'Many traders risk 1 to 2% of their account per trade. Use the position size calculator on this page to work out the right size for your stop-loss.',
  },
  {
    q: 'Is trading risky?',
    a: 'Yes. Crypto and forex are volatile, and leverage can magnify losses. You can lose some or all of your capital, so only trade money you can afford to lose.',
  },
  {
    q: 'Where is the company based?',
    a: `${COMPANY.name} was founded and registered in ${COMPANY.founded} and is headquartered at ${COMPANY.addressLines.join(', ')}.`,
  },
]

function FAQ() {
  const [openIdx, setOpenIdx] = useState(0)
  return (
    <Section id="faq">
      <Heading eyebrow="FAQ" title="Questions traders ask most" text="Quick answers about markets, accounts and risk." />
      <div className="mx-auto mt-10 max-w-3xl space-y-3">
        {FAQS.map((f, i) => {
          const open = openIdx === i
          return (
            <Reveal key={f.q} delay={i * 0.04}>
              <div className={`${card} overflow-hidden transition-colors ${open ? 'border-[#3DDC97]/40' : ''}`}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? -1 : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3DDC97]/70 sm:px-6"
                >
                  <span className="text-sm font-semibold text-white sm:text-base">{f.q}</span>
                  <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
                    <ChevronDown className="h-5 w-5 shrink-0 text-[#3DDC97]" aria-hidden="true" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <p className="px-4 pb-4 text-sm leading-relaxed text-slate-400 sm:px-6 sm:text-base">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   12. FINAL CALL TO ACTION
──────────────────────────────────────────────── */

function FinalCTA() {
  const reduce = useReducedMotion()
  return (
    <section className="relative overflow-hidden bg-[#0A1118] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-[#3DDC97]/25 bg-gradient-to-br from-[#0F2A25] via-[#0B1A20] to-[#0B141B] p-6 text-center sm:p-12">
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#3DDC97]/20 blur-3xl"
              animate={reduce ? undefined : { scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to trade crypto and forex with confidence?
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Join a platform with {YEARS_ACTIVE}+ years of history. Create your account, verify once and start
                planning your first trade.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-8 text-sm font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:text-base"
                >
                  Create free account
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 px-8 text-sm font-medium text-white transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:text-base"
                >
                  Login
                </Link>
              </div>
              <p className="mx-auto mt-6 max-w-2xl text-xs leading-relaxed text-slate-400">
                Risk warning: trading crypto and forex carries a high level of risk and may not be suitable for
                everyone. You can lose some or all of your capital. Market figures on this page are sample data for
                illustration only.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function HomeContent1() {
  return (
    <div className="bg-[#080D12] text-slate-300">
      <Intro />
      <MarketsChartSection />
      <MarketsOffer />
      <HowItWorks />
      <Essentials />
      <Styles />
      <RiskManagement />
      <Features />
      <Security />
      <CompanyProfile />
      <FAQ />
      <FinalCTA />
    </div>
  )
}