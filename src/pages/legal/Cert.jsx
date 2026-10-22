import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUp,
  Award,
  Building2,
  CalendarDays,
  Clock,
  Download,
  MapPin,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

// The image lives in the /public folder, so it is served from the site root (no import needed)
const certImage = '../../public/cert.jpeg'

/* ────────────────────────────────────────────────
   DOCUMENT DETAILS  (edit here)
──────────────────────────────────────────────── */
const COMPANY = {
  name: 'Solvexmarketinc',
  founded: 2012,
  address: '5 Quinton Road, Coventry, CV1 2WT, United Kingdom',
}
const LAST_UPDATED = '21 October 2026'

const RELATED = [
  { label: 'Terms of Service', to: '/terms-of-service' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Risk Disclosure', to: '/risk-disclosure' },
  { label: 'AML Policy', to: '/aml-policy' },
]

const DETAILS = [
  { icon: Building2, label: 'Company name', value: COMPANY.name },
  { icon: CalendarDays, label: 'Registered since', value: String(COMPANY.founded) },
  { icon: MapPin, label: 'Head office', value: COMPANY.address },
]

/* ────────────────────────────────────────────────
   SHARED BUTTON STYLES
──────────────────────────────────────────────── */

const btn =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-medium text-white transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:pointer-events-none disabled:opacity-40'

const iconBtn =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-white transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:pointer-events-none disabled:opacity-40'

/* ────────────────────────────────────────────────
   IMAGE LIGHTBOX (zoom + scroll to read small print)
──────────────────────────────────────────────── */

function ImageLightbox({ src, onClose }) {
  const [zoom, setZoom] = useState(1)
  const clamp = (v) => Math.min(4, Math.max(1, Math.round(v * 100) / 100))

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setZoom((z) => clamp(z + 0.25))
      if (e.key === '-') setZoom((z) => clamp(z - 0.25))
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Certificate image, full size"
      className="fixed inset-0 z-[80] flex flex-col bg-[#080D12]/95 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="truncate text-sm font-semibold text-white">Certificate of Registration</p>
        <div className="flex items-center gap-2">
          <button type="button" className={iconBtn} onClick={() => setZoom((z) => clamp(z - 0.25))} disabled={zoom <= 1} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-slate-400">{Math.round(zoom * 100)}%</span>
          <button type="button" className={iconBtn} onClick={() => setZoom((z) => clamp(z + 0.25))} disabled={zoom >= 4} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={iconBtn} onClick={onClose} aria-label="Close" autoFocus>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img
          src={src}
          alt="Company registration certificate"
          className="mx-auto h-auto max-w-none rounded-lg"
          style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? '100%' : 'none' }}
          draggable={false}
        />
      </div>
    </motion.div>
  )
}

/* ────────────────────────────────────────────────
   IMAGE VIEWER
──────────────────────────────────────────────── */

function ImageViewer() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3 sm:p-4">
        <button type="button" className={btn} onClick={() => setOpen(true)}>
          <Maximize2 className="h-4 w-4 text-[#3DDC97]" aria-hidden="true" />
          View full size
        </button>
        <a href={certImage} download="Certificate-of-Registration.jpeg" className={btn}>
          <Download className="h-4 w-4 text-[#3DDC97]" aria-hidden="true" />
          Download image
        </a>
      </div>
      <div className="p-3 sm:p-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl bg-[#0F1A22] p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:p-4"
          aria-label="Open certificate image full size"
        >
          <img src={certImage} alt="Company registration certificate" className="mx-auto h-auto max-h-[80vh] w-auto max-w-full rounded-lg shadow-2xl" />
          <span className="pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-[#080D12]/85 px-3 py-1 text-xs text-white opacity-0 ring-1 ring-white/15 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ZoomIn className="h-3.5 w-3.5 text-[#3DDC97]" aria-hidden="true" />
            Click to zoom
          </span>
        </button>
      </div>
      <AnimatePresence>{open && <ImageLightbox src={certImage} onClose={() => setOpen(false)} />}</AnimatePresence>
    </div>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Certificate() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })

  const toTop = () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })

  const fade = (delay = 0) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: 'easeOut' },
  })


  return (
    <div className="bg-[#080D12] text-slate-300">
      {/* Reading progress bar */}
      <motion.div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-[#3DDC97]"
        style={{ scaleX: progress }}
      />

      {/* Header banner */}
      <section className="relative overflow-hidden border-b border-white/[0.08] px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14 lg:px-8">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#3DDC97]/10 blur-3xl"
          animate={reduce ? undefined : { y: [0, 30, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative mx-auto max-w-7xl">
          <motion.div {...fade(0)}>
            <Link
              to="/"
              className="group inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-medium text-white transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
              Back to homepage
            </Link>
          </motion.div>

          <motion.div {...fade(0.1)} className="mt-6 flex items-start gap-4">
            <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/25 sm:flex">
              <Award className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">Company Certificate</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
                The official registration certificate of {COMPANY.name}. Zoom in to read the details, or download a
                copy.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-[#3DDC97]" aria-hidden="true" />
                  Last updated: {LAST_UPDATED}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {/* Company details */}
        <motion.div {...fade(0.15)} className="mb-6 grid gap-3 sm:grid-cols-3">
          {DETAILS.map((d) => {
            const Icon = d.icon
            return (
              <div key={d.label} className="rounded-2xl border border-white/10 bg-[#0B141B] p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/25">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{d.label}</p>
                <p className="mt-1 text-sm font-medium leading-snug text-white">{d.value}</p>
              </div>
            )
          })}
        </motion.div>

        {/* Viewer */}
        <motion.section
          {...fade(0.22)}
          aria-label="Certificate viewer"
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B141B]"
        >
          <ImageViewer />
        </motion.section>

        {/* Related policies + navigation */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#0B141B] p-5 sm:p-7">
          <p className="text-sm font-semibold text-white">Related policies</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {RELATED.map((r) => (
              <li key={r.to}>
                <Link
                  to={r.to}
                  className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-[#3DDC97]/50 hover:text-[#3DDC97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:text-sm"
                >
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-8 text-sm font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:text-base"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
              Back to homepage
            </Link>
            <button
              type="button"
              onClick={toTop}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-8 text-sm font-medium text-white transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:text-base"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
              Back to top
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}