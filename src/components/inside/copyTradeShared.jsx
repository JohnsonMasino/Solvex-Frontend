// src/pages/inside/copyTradeShared.jsx
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Star, X } from 'lucide-react'
import { iconBtn } from './copyTradeUtils'

/* ───────────── SMALL UI ───────────── */

export function InlineError({ message, onRetry, action }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#F6465D]/10 px-3.5 py-3 text-[13px] text-red-200 sm:text-sm">
      <AlertCircle className="h-4 w-4 shrink-0 text-[#F6465D]" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-lg px-2.5 py-1 text-xs font-semibold hover:underline">
          Try again
        </button>
      )}
      {action && (
        <Link to={action.to} className="rounded-lg px-2.5 py-1 text-xs font-semibold underline underline-offset-2">
          {action.label}
        </Link>
      )}
    </div>
  )
}

export function SimBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-amber-400/[0.12] px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 ${className}`}>
      
    </span>
  )
}

export function Stars({ rating }) {
  const full = Math.round(rating)
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rating ${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="h-3 w-3"
          style={{ color: '#FBBF24' }}
          fill={i <= full ? '#FBBF24' : 'none'}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 font-mono text-[10px] text-slate-400">{rating.toFixed(1)}</span>
    </span>
  )
}

export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-[#14212D] sm:rounded-3xl"
          >
            <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
              <h2 className="text-base font-semibold text-white">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className={iconBtn}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-4 pb-5 sm:px-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}