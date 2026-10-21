import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  const [ready, setReady] = useState(false)

  // Starts the one-time chart animation after the first paint
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#080D12] px-5 py-12 text-center">
      {/* Brand */}
      <Link
        to="/"
        aria-label="Solvexmarketinc home"
        className="mb-10 flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F1B24] ring-1 ring-white/10">
          <img src="/Logo_nbg.png" alt="" className="h-7 w-7 object-contain" draggable="false" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-white">
          Solvex<span className="text-[#3DDC97]">marketinc</span>
        </span>
      </Link>

      {/* Chart that climbs, then drops: the "page not found" moment */}
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B141B] p-4 sm:p-6">
        <svg
          viewBox="0 0 320 140"
          className="h-auto w-full"
          role="img"
          aria-label="A price chart that rises and then falls"
        >
          {/* Grid */}
          {[20, 50, 80, 110].map((y) => (
            <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="white" strokeOpacity="0.06" />
          ))}

          {/* Rising line */}
          <path
            d="M10 110 L50 90 L80 98 L120 60 L155 70 L200 30"
            pathLength="1"
            fill="none"
            stroke="#3DDC97"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1"
            strokeDashoffset={ready ? 0 : 1}
            style={{ transition: 'stroke-dashoffset 1.3s ease-out' }}
            className="motion-reduce:!transition-none"
          />

          {/* Falling line */}
          <path
            d="M200 30 L225 55 L250 85 L290 120"
            pathLength="1"
            fill="none"
            stroke="#F5A524"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1"
            strokeDashoffset={ready ? 0 : 1}
            style={{ transition: 'stroke-dashoffset 0.7s ease-in 1.3s' }}
            className="motion-reduce:!transition-none"
          />

          {/* End point */}
          <circle
            cx="290"
            cy="120"
            r="5"
            fill="#F5A524"
            opacity={ready ? 1 : 0}
            style={{ transition: 'opacity 0.3s ease-out 2s' }}
            className="motion-reduce:!transition-none"
          />
        </svg>
      </div>

      {/* Message */}
      <div
        className={`mt-9 transition-all duration-700 ease-out motion-reduce:transition-none ${
          ready ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
        style={{ transitionDelay: '1.6s' }}
      >
        <p className="text-6xl font-bold tracking-tight text-white sm:text-7xl">
          4<span className="text-[#3DDC97]">0</span>4
        </p>
        <h1 className="mt-3 text-xl font-semibold text-white sm:text-2xl">Page not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400 sm:text-base">
          The page you are looking for does not exist, or it has been moved to a new address.
        </p>

        <Link
          to="/"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-[#3DDC97] px-8 text-sm font-semibold text-[#06140E] shadow-[0_6px_18px_-8px_rgba(61,220,151,0.7)] transition-colors duration-200 hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080D12]"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}