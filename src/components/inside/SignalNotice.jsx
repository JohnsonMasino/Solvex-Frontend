// src/components/Inside/SignalNotice.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, BellRing } from 'lucide-react'
import api from '../Api'
import { getCachedStatus, setCachedStatus } from './SignalNoticeStore'

const SIGNALS_URL = '/dashboard/signals'
const PROMPT_MESSAGE = 'You are eligible for trading signals. Purchase a trading signal to get started.'

function useSignalNotice() {
  const [status, setStatus] = useState(getCachedStatus)

  useEffect(() => {
    let alive = true

    const check = () => {
      Promise.allSettled([api.get('/api/signals/eligibility/'), api.get('/api/signals/purchases/')]).then(
        ([elig, purch]) => {
          if (!alive) return
          // If we cannot tell, keep whatever is showing. Never nag by mistake.
          if (elig.status !== 'fulfilled') return

          let next = 'none'
          if (elig.value.data?.data?.eligible === true) {
            if (purch.status !== 'fulfilled') return
            next = purch.value.data?.data?.purchased === true ? 'purchased' : 'prompt'
          }
          setCachedStatus(next)
          setStatus(next)
        },
      )
    }

    const onVisible = () => {
      if (!document.hidden) check()
    }

    check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return status
}

/* Marquee + reduced-motion rules. Plain CSS keeps the scrolling smooth and off the React render path. */
const STYLES = `
@keyframes sn-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.sn-track { animation: sn-marquee 32s linear infinite; will-change: transform; }
.sn-mask {
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
}
@media (hover: hover) { .sn-wrap:hover .sn-track { animation-play-state: paused; } }
@media (prefers-reduced-motion: reduce) {
  .sn-track { animation: none; width: auto; }
  .sn-extra { display: none; }
  .sn-msg { white-space: normal; }
}
`

const linkBtn =
  'relative inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs'

function PromptBar({ reduce }) {
  return (
    <div className="sn-wrap flex items-center gap-2.5 sm:gap-3">
      {/* ringing bell */}
      <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/30 sm:h-8 sm:w-8">
        {!reduce && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-lg bg-amber-400/30"
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <motion.span
          className="relative grid origin-top place-items-center"
          animate={reduce ? undefined : { rotate: [0, -16, 16, -12, 12, -5, 5, 0] }}
          transition={{ duration: 0.9, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.4 }}
        >
          <BellRing className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
        </motion.span>
      </span>

      {/* sliding message (right to left) */}
      <div className="sn-mask relative min-w-0 flex-1 overflow-hidden">
        <span className="sr-only">{PROMPT_MESSAGE}</span>
        <div className="sn-track flex w-max" aria-hidden="true">
          {[0, 1].map((c) => (
            <div key={c} className="flex shrink-0 items-center">
              {[0, 1, 2].map((r) => (
                <span
                  key={r}
                  className={`sn-msg flex shrink-0 items-center gap-3 whitespace-nowrap pr-6 text-[12px] font-medium text-amber-100 sm:text-[13px] ${
                    c || r ? 'sn-extra' : ''
                  }`}
                >
                  {PROMPT_MESSAGE}
                  <span className="h-1 w-1 shrink-0 rotate-45 bg-amber-300/70" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* steady purchase link (does not move with the text) */}
      <Link
        to={SIGNALS_URL}
        className={`${linkBtn} bg-[#3DDC97] text-[#06140E] hover:bg-[#5BEBAD] focus-visible:ring-[#3DDC97]/70`}
      >
        {!reduce && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-lg bg-[#3DDC97]"
            animate={{ scale: [1, 1.35], opacity: [0.45, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className="relative">
          <span className="sm:hidden">Purchase</span>
          <span className="hidden sm:inline">Purchase now</span>
        </span>
        <motion.span
          className="relative grid place-items-center"
          animate={reduce ? undefined : { x: [0, 3, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
        </motion.span>
      </Link>
    </div>
  )
}

function PurchasedBar({ reduce }) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#3DDC97]/15 text-[#3DDC97] ring-1 ring-[#3DDC97]/30 sm:h-8 sm:w-8">
        {!reduce && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-lg bg-[#3DDC97]/30"
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <motion.span
          className="relative grid place-items-center"
          initial={reduce ? false : { scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.15 }}
        >
          <BadgeCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
        </motion.span>
      </span>

      <p className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-emerald-50 sm:text-[13px]">
        <span className="font-bold text-[#3DDC97]">Active signal.</span>{' '}
        <span className="text-emerald-100/90">You have an active purchased trading signal.</span>
      </p>
    </div>
  )
}

/* Sits directly under the header line. There is deliberately no close button. */
export default function SignalNotice({ reduce }) {
  const status = useSignalNotice()
  const show = status === 'prompt' || status === 'purchased'
  const prompt = status === 'prompt'

  return (
    <>
      <style>{STYLES}</style>
      <AnimatePresence initial={false}>
        {show && (
          <motion.div
            key="signal-notice"
            role="status"
            aria-live="polite"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-0 overflow-hidden border-b border-white/10 bg-[#0E1822]"
          >
            {/* colour tint */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 transition-colors duration-500 ${
                prompt
                  ? 'bg-gradient-to-r from-amber-400/[0.12] via-amber-400/[0.06] to-[#3DDC97]/[0.10]'
                  : 'bg-gradient-to-r from-[#3DDC97]/[0.14] via-[#3DDC97]/[0.06] to-transparent'
              }`}
            />
            {/* light sweep */}
            {!reduce && (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-1/4 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
                animate={{ x: ['-120%', '520%'] }}
                transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 3.5, ease: 'easeInOut' }}
              />
            )}

            <div className="relative mx-auto max-w-7xl px-3 py-1.5 sm:px-6 sm:py-2 lg:px-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={status}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  {prompt ? <PromptBar reduce={reduce} /> : <PurchasedBar reduce={reduce} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}