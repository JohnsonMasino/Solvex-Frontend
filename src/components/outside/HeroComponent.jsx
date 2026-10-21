import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import MarqueeModule from 'react-fast-marquee';

const Marquee = MarqueeModule.default;

/* ────────────────────────────────────────────────
   CONTENT
──────────────────────────────────────────────── */

// The five messages that appear and fade out in turn
const SLIDES = [
  {
    title: 'Trade crypto and forex in one place',
    sub: 'Access Bitcoin, Ethereum and major currency pairs from a single account.',
  },
  {
    title: 'Trade with caution, always',
    sub: 'Markets move fast. Only risk money you can afford to lose.',
  },
  {
    title: 'Plan every trade before you enter',
    sub: 'Set your entry, stop-loss and target first, so emotion never makes the call.',
  },
  {
    title: 'Build profits with discipline',
    sub: 'Steady, well-managed trades add up over time. One big bet rarely does.',
  },
  {
    title: 'Verify once, trade with confidence',
    sub: 'Complete your KYC, fund your wallet and withdraw whenever you choose.',
  },
]

// SAMPLE DATA for the ticker. Replace with a live price feed when you have one.
const PAIRS = [
  { pair: 'BTC/USD', change: 1.24 },
  { pair: 'EUR/USD', change: -0.18 },
  { pair: 'ETH/USD', change: 2.07 },
  { pair: 'GBP/USD', change: 0.32 },
  { pair: 'USD/JPY', change: -0.41 },
  { pair: 'SOL/USD', change: 3.15 },
  { pair: 'XAU/USD', change: 0.56 },
  { pair: 'AUD/USD', change: -0.22 },
  { pair: 'XRP/USD', change: -1.08 },
  { pair: 'USD/CHF', change: 0.12 },
  { pair: 'BNB/USD', change: 0.87 },
  { pair: 'USD/CAD', change: -0.09 },
]

const TRUST_POINTS = [
  'KYC-verified accounts',
  'Secure deposits and withdrawals',
  'Crypto and forex, one account',
]

const SLIDE_MS = 4800

/* ────────────────────────────────────────────────
   ANIMATED CANDLESTICK BACKGROUND (canvas)
──────────────────────────────────────────────── */

const GREEN = '#3DDC97'
const RED = '#F6465D'
const MS_PER_CANDLE = 850

function nextCandle(prevClose) {
  const o = prevClose
  // Small random move with a pull toward the middle so the chart stays on screen
  let c = o + (Math.random() - 0.5) * 0.14 + (0.5 - o) * 0.07
  c = Math.min(0.88, Math.max(0.12, c))
  const h = Math.min(0.94, Math.max(o, c) + Math.random() * 0.05)
  const l = Math.max(0.06, Math.min(o, c) - Math.random() * 0.05)
  return { o, c, h, l }
}

function CandleBackground() {
  const canvasRef = useRef(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas.parentElement
    const ctx = canvas.getContext('2d')

    let raf = 0
    let width = 0
    let height = 0
    let candleW = 10
    let step = 22
    let candles = []
    let progress = 0
    let lastTime = performance.now()
    let visible = true

    const build = () => {
      const count = Math.ceil(width / step) + 6
      candles = []
      let prev = 0.5
      for (let i = 0; i < count; i++) {
        const cd = nextCandle(prev)
        candles.push(cd)
        prev = cd.c
      }
    }

    const resize = () => {
      const rect = parent.getBoundingClientRect()
      const widthChanged = Math.abs(rect.width - width) > 1
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      candleW = width < 640 ? 8 : 12
      step = candleW * 2.3
      // Rebuild only when width changes, so mobile address-bar resizes don't reset the chart
      if (widthChanged || candles.length === 0) build()
      draw(reduce)
    }

    const smooth = (t) => t * t * (3 - 2 * t)

    function draw(isStatic) {
      ctx.clearRect(0, 0, width, height)

      // Faint horizontal grid
      ctx.strokeStyle = 'rgba(255,255,255,0.045)'
      ctx.lineWidth = 1
      for (let i = 1; i < 6; i++) {
        const y = Math.round((height * i) / 6) + 0.5
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      const toY = (v) => height * (1 - v)
      const n = candles.length
      ctx.globalAlpha = 0.6

      for (let i = 0; i < n; i++) {
        const age = n - 1 - i
        const x = width - candleW - age * step + (1 - progress) * step
        if (x < -candleW * 2 || x > width + candleW * 2) continue

        // Candles "form" as they travel in from the right, so they move up and down live
        const m = isStatic ? 1 : smooth(Math.min(1, (age + progress) / 5))
        const cd = candles[i]
        const bodyEnd = cd.o + (cd.c - cd.o) * m
        const top = Math.max(cd.o, bodyEnd)
        const bottom = Math.min(cd.o, bodyEnd)
        const high = top + (cd.h - Math.max(cd.o, cd.c)) * m
        const low = bottom - (Math.min(cd.o, cd.c) - cd.l) * m
        const color = bodyEnd >= cd.o ? GREEN : RED

        ctx.strokeStyle = color
        ctx.fillStyle = color
        ctx.lineWidth = 1.5
        const cx = x + candleW / 2
        ctx.beginPath()
        ctx.moveTo(cx, toY(high))
        ctx.lineTo(cx, toY(low))
        ctx.stroke()

        const bodyTop = toY(top)
        const bodyH = Math.max(2, toY(bottom) - bodyTop)
        ctx.fillRect(x, bodyTop, candleW, bodyH)
      }
      ctx.globalAlpha = 1
    }

    const loop = (now) => {
      const dt = Math.min(now - lastTime, 100)
      lastTime = now
      if (visible) {
        progress += dt / MS_PER_CANDLE
        while (progress >= 1) {
          progress -= 1
          candles.shift()
          candles.push(nextCandle(candles[candles.length - 1].c))
        }
        draw(false)
      }
      raf = requestAnimationFrame(loop)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)

    // Stop drawing while the hero is scrolled out of view
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(parent)

    if (!reduce) raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [reduce])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
}

/* ────────────────────────────────────────────────
   HERO
──────────────────────────────────────────────── */

export default function Hero() {
  const [active, setActive] = useState(0)
  const reduce = useReducedMotion()

  // Moves to the next message. Clicking a bar restarts the timer.
  useEffect(() => {
    const id = setTimeout(() => setActive((i) => (i + 1) % SLIDES.length), SLIDE_MS)
    return () => clearTimeout(id)
  }, [active])

  return (
    <section
      aria-label="Solvexmarketinc crypto and forex trading"
      className="relative flex min-h-[calc(100svh-64px)] flex-col overflow-hidden bg-[#080D12] sm:min-h-[calc(100svh-72px)]"
    >
      {/* Background: moving candlesticks */}
      <CandleBackground />

      {/* Fade so text stays readable: top-down on mobile, left-to-right on desktop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#080D12] via-[#080D12]/85 to-[#080D12]/30 lg:bg-gradient-to-r lg:from-[#080D12] lg:via-[#080D12]/80 lg:to-transparent" />
      {/* Soft fade into the ticker at the bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#080D12] to-transparent" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-5 py-10 sm:px-6 sm:py-16 lg:px-8">
        <div className="w-full max-w-2xl">
          <h1 className="sr-only">
            Solvexmarketinc: crypto and forex trading platform
          </h1>

          {/* All five messages share one grid cell, so the block never changes height */}
          <div className="grid" aria-live="off">
            {SLIDES.map((slide, i) => {
              const isActive = i === active
              return (
                <motion.div
                  key={slide.title}
                  className="col-start-1 row-start-1"
                  aria-hidden={!isActive}
                  initial={false}
                  animate={{
                    opacity: isActive ? 1 : 0,
                    y: reduce ? 0 : isActive ? 0 : -14,
                  }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ pointerEvents: 'none' }}
                >
                  {/* Mobile: slightly tighter title and sub text so they sit neatly in the page */}
                  <p className="text-[1.85rem] font-bold leading-[1.15] tracking-tight text-white sm:text-5xl sm:leading-[1.12] lg:text-6xl">
                    {slide.title}
                  </p>
                  <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-slate-300 sm:mt-5 sm:text-lg">
                    {slide.sub}
                  </p>
                </motion.div>
              )
            })}
          </div>

          {/* Message selector */}
          <div className="mt-6 flex items-center sm:mt-5" role="group" aria-label="Choose message">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.title}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show message ${i + 1} of ${SLIDES.length}`}
                aria-current={i === active}
                className="group py-3 pr-2 focus:outline-none"
              >
                <span
                  className={`block h-1 rounded-full transition-all duration-500 group-focus-visible:ring-2 group-focus-visible:ring-[#3DDC97]/70 motion-reduce:transition-none ${
                    i === active ? 'w-10 bg-[#3DDC97]' : 'w-5 bg-white/20 group-hover:bg-white/40'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Buttons (sit lower on mobile) */}
          <div className="mt-10 flex flex-col gap-3 sm:mt-6 sm:flex-row">
            <Link
              to="/about-us"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-[#3DDC97] px-8 text-sm font-semibold text-[#06140E] shadow-[0_6px_18px_-8px_rgba(61,220,151,0.7)] transition-colors duration-200 hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080D12] sm:text-base"
            >
              About Us
            </Link>
            <Link
              to="/signup"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-white/20 bg-[#080D12]/40 px-8 text-sm font-medium text-white transition-colors duration-200 hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:text-base"
            >
              Create free account
            </Link>
          </div>

          {/* Trust points (hidden on mobile) */}
          <ul className="mt-8 hidden flex-col gap-2.5 sm:flex sm:flex-row sm:flex-wrap sm:gap-x-6">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2 text-sm text-slate-300">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-[#3DDC97]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {point}
              </li>
            ))}
          </ul>

          {/* Risk notice (hidden on mobile) */}
          <p className="mt-6 hidden max-w-xl text-xs leading-relaxed text-slate-400 sm:block">
            Risk warning: trading crypto and forex carries a high level of risk and may not be
            suitable for everyone. You can lose some or all of your capital. Trade responsibly.
          </p>
        </div>
      </div>

      {/* Pair ticker, right to left */}
      <div className="relative z-10 border-t border-white/10 bg-[#0B141B]/90 backdrop-blur-sm">
        <Marquee speed={40} gradient={false} pauseOnHover play={!reduce} direction="left">
          {PAIRS.map(({ pair, change }) => {
            const up = change >= 0
            return (
              <div key={pair} className="flex items-center gap-2.5 px-5 py-3.5 text-sm sm:px-7">
                <span className="font-semibold text-white">{pair}</span>
                <span
                  className={`flex items-center gap-1 font-medium ${
                    up ? 'text-[#3DDC97]' : 'text-[#F6465D]'
                  }`}
                >
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
                    {up ? <path d="M6 2l5 8H1z" /> : <path d="M6 10L1 2h10z" />}
                  </svg>
                  {Math.abs(change).toFixed(2)}%
                </span>
              </div>
            )
          })}
        </Marquee>
      </div>
    </section>
  )
}