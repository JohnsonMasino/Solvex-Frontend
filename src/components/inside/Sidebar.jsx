// src/components/Inside/Sidebar.jsx
import { useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BadgeCheck, ChevronRight, Lock, LogOut, X } from 'lucide-react'
import NavBadge from './NavBadge'
import { KYC_URL, NAV_ITEMS, SETTINGS_ITEM, initialsOf } from './Navconfig'

/* ────────────────────────────────────────────────
   SHARED COMPONENT (also used by DashboardLayout)
──────────────────────────────────────────────── */

// Tier 2 = verified and allowed to trade (green). Tier 1 = not verified yet (amber).
export function TierBadge({ tier, small = false }) {
  const active = Number(tier) >= 2
  const Icon = active ? BadgeCheck : Lock
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium ring-1 ${
        small ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${
        active
          ? 'bg-[#3DDC97]/[0.12] text-[#3DDC97] ring-[#3DDC97]/30'
          : 'bg-amber-400/10 text-amber-300 ring-amber-400/30'
      }`}
    >
      <Icon className={small ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden="true" />
      Tier {tier}
    </span>
  )
}

/* ────────────────────────────────────────────────
   SIDEBAR
──────────────────────────────────────────────── */

const rowClass = (isActive) =>
  `group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
    isActive ? 'bg-[#3DDC97]/[0.12] text-white' : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
  }`

const chipClass = (isActive) =>
  `grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
    isActive ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-white/[0.06] text-slate-400 group-hover:text-slate-200'
  }`

// Badge sits inline right after the label (use `ml-auto` instead of `ml-2` to push it to the far right)
const INLINE_BADGE = 'pointer-events-none relative ml-2 inline-block shrink-0'

function NavRow({ item, onNavigate, reduce }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => rowClass(isActive)}>
      {({ isActive }) => (
        <>
          <span className={chipClass(isActive)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>{item.label}</span>
          {item.badge && <NavBadge label={item.badge} reduce={reduce} className={INLINE_BADGE} />}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose, user, loading, onLogout }) {
  const reduce = useReducedMotion()
  const closeRef = useRef(null)
  const verified = Number(user?.tier) >= 2

  // Escape closes, page scroll is locked while open, and the drawer
  // closes itself if the screen grows to desktop width.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    const mq = window.matchMedia('(min-width: 1024px)')
    const onMq = (e) => {
      if (e.matches) onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    mq.addEventListener('change', onMq)
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
    }
  }, [open, onClose])

  const slide = reduce ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sidebar-backdrop"
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        />
      )}

      {open && (
        <motion.aside
          key="sidebar-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Main menu"
          className="fixed inset-y-0 left-0 z-50 flex w-[84%] max-w-[300px] flex-col border-r border-white/10 bg-[#111E2A] lg:hidden"
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={slide}
        >
          {/* ── Top: user ── */}
          <div className="relative border-b border-white/10 px-4 pb-4 pt-4">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-3 pr-9">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1D3042] text-sm font-semibold text-white ring-1 ring-white/10">
                {user ? initialsOf(user) : ''}
              </span>

              {user ? (
                <div className="min-w-0">
                  <p className="truncate text-[0.95rem] font-semibold leading-tight text-white">{user.full_name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{user.email}</p>
                </div>
              ) : loading ? (
                <div className="min-w-0 flex-1 space-y-2" aria-hidden="true">
                  <div className="h-3.5 w-28 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-36 animate-pulse rounded bg-white/[0.06]" />
                </div>
              ) : (
                <p className="text-[0.95rem] font-semibold text-white">Your account</p>
              )}
            </div>

            {user && (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <TierBadge tier={user.tier} />
                  <span className="text-xs text-slate-400">{verified ? 'Trading enabled' : 'Trading locked'}</span>
                </div>

                {!verified && (
                  <Link
                    to={KYC_URL}
                    onClick={onClose}
                    className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-200 ring-1 ring-amber-400/20 transition-colors hover:bg-amber-400/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                  >
                    Verify your identity to start trading
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </Link>
                )}
              </>
            )}
          </div>

          {/* ── Middle: page links ── */}
          <nav aria-label="Dashboard" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <ul className="space-y-1">
              {NAV_ITEMS.map((item, i) => (
                <motion.li
                  key={item.to}
                  initial={reduce ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 + i * 0.04, ease: 'easeOut' }}
                >
                  <NavRow item={item} onNavigate={onClose} reduce={reduce} />
                </motion.li>
              ))}
            </ul>
          </nav>

          {/* ── Bottom: settings + logout ── */}
          <div className="space-y-1 border-t border-white/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <NavRow item={SETTINGS_ITEM} onNavigate={onClose} reduce={reduce} />
            <button
              type="button"
              onClick={() => {
                onClose()
                onLogout()
              }}
              className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-300">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </span>
              Log out
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}