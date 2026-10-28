// src/components/Inside/DashboardLayout.jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, ChevronDown, Loader2, LogOut, Menu, Settings } from 'lucide-react'
import api from '../Api'
import Sidebar, { TierBadge } from './Sidebar'
import { DESKTOP_NAV, SETTINGS_ITEM, firstNameOf } from './Navconfig'

const PROFILE_URL = '/dashboard/profile'
const SESSION_KEYS = ['accessToken', 'refreshToken', 'user', 'isAuthenticated']

// Seconds of rest between each vibration of the nav badge
const BADGE_SHAKE_PAUSE = 3

// Kept at module level so moving between dashboard pages doesn't
// flash a loading state each time the layout mounts again.
let cachedUser = null

// Neutral, unisex avatar: head and shoulders on a round background
function ProfileIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#1D3042" />
      <circle cx="16" cy="12.5" r="5" fill="#9FB4C7" />
      <path d="M6.5 27c.8-5 4.9-8 9.5-8s8.7 3 9.5 8a15 15 0 0 1-19 0z" fill="#9FB4C7" />
    </svg>
  )
}

const iconBtn =
  'grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 lg:h-9 lg:w-9 xl:h-10 xl:w-10'

// Desktop link styles: compact on lg, a little roomier on xl and wider
const desktopLink = (isActive) =>
  `inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 xl:gap-2 xl:px-3 xl:py-2 xl:text-sm ${
    isActive ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
  }`

/* Small tag on top of a nav link: pops in once, then vibrates every few seconds */
function NavBadge({ label, reduce }) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute -right-1 -top-2.5 z-10 xl:-right-0.5 xl:-top-3"
      initial={reduce ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 14, delay: 0.35 }}
    >
      {/* soft pulsing glow behind the tag */}
      {!reduce && (
        <motion.span
          className="absolute inset-0 rounded-full bg-[#3DDC97]"
          animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {/* the vibration */}
      <motion.span
        className="relative block origin-bottom rounded-full bg-gradient-to-r from-[#3DDC97] to-[#5BEBAD] px-1.5 py-px font-mono text-[9px] font-extrabold uppercase leading-tight tracking-wide text-[#06140E] shadow-lg shadow-[#3DDC97]/30 xl:px-2 xl:text-[10px]"
        animate={
          reduce
            ? undefined
            : {
                x: [0, -2.5, 2.5, -2, 2, -1, 1, 0],
                rotate: [0, -12, 12, -9, 9, -4, 4, 0],
                scale: [1, 1.18, 1.18, 1.12, 1.12, 1.05, 1.05, 1],
              }
        }
        transition={{
          duration: 0.7,
          ease: 'easeInOut',
          delay: 0.9,
          repeat: Infinity,
          repeatDelay: BADGE_SHAKE_PAUSE,
        }}
      >
        {label}
      </motion.span>
    </motion.span>
  )
}

/* Desktop dropdown (e.g. Wallet): opens on mouse hover or on click/tap */
function NavDropdown({ item, reduce }) {
  const { pathname } = useLocation()
  const [openAt, setOpenAt] = useState(null)
  const open = openAt === pathname
  const wrapRef = useRef(null)
  const Icon = item.icon

  const isActive = item.children.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`))

  const setOpen = useCallback(
  (next) => setOpenAt((prev) => ((typeof next === 'function' ? next(prev === pathname) : next) ? pathname : null)),
  [pathname],
)

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Hover only applies to real mice, so touch taps don't open then instantly close it
  const onEnter = (e) => {
    if (e.pointerType === 'mouse') setOpen(true)
  }
  const onLeave = (e) => {
    if (e.pointerType === 'mouse') setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative" onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className={desktopLink(isActive || open)}
      >
        <Icon
          className={`h-3.5 w-3.5 shrink-0 xl:h-4 xl:w-4 ${isActive ? 'text-[#3DDC97]' : ''}`}
          aria-hidden="true"
        />
        {item.label}
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform duration-200 xl:h-3.5 xl:w-3.5 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          // The pt-2 wrapper bridges the gap so the hover doesn't drop between button and menu
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 top-full z-40 pt-2"
          >
            <div className="min-w-[11rem] rounded-xl border border-white/10 bg-[#14212D] p-1.5 shadow-2xl shadow-black/50">
              {item.children.map((child) => {
                const ChildIcon = child.icon
                return (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    end={child.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive: a }) =>
                      `flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 xl:text-sm ${
                        a ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                      }`
                    }
                  >
                    {({ isActive: a }) => (
                      <>
                        <ChildIcon
                          className={`h-4 w-4 shrink-0 ${a ? 'text-[#3DDC97]' : ''}`}
                          aria-hidden="true"
                        />
                        {child.label}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function DashboardLayout({ children }) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()

  const [user, setUser] = useState(cachedUser)
  const [loading, setLoading] = useState(!cachedUser)
  const [menuOpen, setMenuOpen] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const busy = useRef(false)
  const cancelRef = useRef(null)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  // Fetch the signed-in user (name, email, tier)
  useEffect(() => {
    let alive = true
    api
      .get('/api/auth/me/')
      .then((res) => {
        const data = res.data?.data
        if (!alive || !data) return
        cachedUser = data
        setUser(data)
      })
      .catch(() => {
        /* The Api interceptor already handles expired sessions */
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  /* ── Logout ── */
  const cancelLogout = useCallback(() => {
    if (busy.current) return
    setConfirmOpen(false)
    setLogoutError('')
  }, [])

  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') cancelLogout()
    }
    document.addEventListener('keydown', onKey)
    cancelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmOpen, cancelLogout])

  const finishLogout = () => {
    SESSION_KEYS.forEach((key) => localStorage.removeItem(key))
    cachedUser = null
    navigate('/login', { replace: true })
  }

  const confirmLogout = async () => {
    if (busy.current) return
    const refresh = localStorage.getItem('refreshToken')
    if (!refresh) {
      finishLogout()
      return
    }
    busy.current = true
    setLoggingOut(true)
    setLogoutError('')
    try {
      await api.post('/api/auth/logout/', { refresh })
      finishLogout()
    } catch (err) {
      const status = err?.response?.status
      // 400 means the token was already logged out or expired, 401 means the
      // session is gone. Either way the user is effectively signed out.
      if (status === 400 || status === 401) {
        finishLogout()
        return
      }
      setLogoutError(
        err?.response
          ? 'We could not log you out. Please try again.'
          : 'Network error. Check your connection and try again.',
      )
    } finally {
      busy.current = false
      setLoggingOut(false)
    }
  }

  const firstName = user ? firstNameOf(user) : ''

  return (
    <div className="min-h-screen bg-[#0E1822] text-slate-300">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0E1822]/90 backdrop-blur">
        <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-6 lg:h-16 lg:grid-cols-[auto_1fr_auto] lg:gap-3 lg:px-6 xl:gap-6 xl:px-8">
          {/* Left: hamburger on mobile, logo on desktop */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className={`${iconBtn} lg:hidden`}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <Link
              to="/dashboard"
              aria-label="Solvexmarketinc dashboard"
              className="hidden items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 lg:flex"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#14212D] ring-1 ring-white/10 xl:h-10 xl:w-10">
                <img src="/Logo_nbg.png" alt="" className="h-6 w-6 object-contain xl:h-7 xl:w-7" draggable="false" />
              </span>
              <span className="hidden text-base font-semibold tracking-tight text-white 2xl:block">
                SOLVE<span className="text-[#FF4D4F]">X</span>
                <span className="text-[#3DDC97]">MARKETINC</span>
              </span>
            </Link>
          </div>

          {/* Center: name + tier on mobile, nav links on desktop */}
          <div className="flex min-w-0 justify-center">
            <div className="min-w-0 max-w-[46vw] text-center lg:hidden">
              {user ? (
                <>
                  <p className="truncate text-sm font-semibold leading-tight text-white">{firstName}</p>
                  <div className="mt-0.5 flex justify-center">
                    <TierBadge tier={user.tier} small />
                  </div>
                </>
              ) : loading ? (
                <div className="flex flex-col items-center gap-1.5" aria-hidden="true">
                  <div className="h-3.5 w-16 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-10 animate-pulse rounded bg-white/[0.06]" />
                </div>
              ) : (
                <p className="text-sm font-semibold text-white">My account</p>
              )}
            </div>

            <nav aria-label="Dashboard" className="hidden items-center gap-0.5 lg:flex xl:gap-1">
              {DESKTOP_NAV.map((item) => {
                if (item.children) {
                  return <NavDropdown key={item.label} item={item} reduce={reduce} />
                }
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `${desktopLink(isActive)} ${item.badge ? 'relative' : ''}`}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`h-3.5 w-3.5 shrink-0 xl:h-4 xl:w-4 ${isActive ? 'text-[#3DDC97]' : ''}`}
                          aria-hidden="true"
                        />
                        {item.label}
                        {item.badge && <NavBadge label={item.badge} reduce={reduce} />}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </nav>
          </div>

          {/* Right: profile icon on mobile, account controls on desktop */}
          <div className="flex items-center justify-end gap-2">
            <Link
              to={PROFILE_URL}
              aria-label="Open profile"
              className="h-10 w-10 overflow-hidden rounded-full ring-1 ring-white/15 transition-shadow hover:ring-[#3DDC97]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 lg:hidden"
            >
              <ProfileIcon />
            </Link>

            <div className="hidden items-center gap-1.5 lg:flex xl:gap-2">
              <Link
                to={PROFILE_URL}
                className="flex items-center gap-2 rounded-xl border border-white/10 py-1 pl-1 pr-2 transition-colors hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 xl:gap-2.5 xl:pr-3"
              >
                <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10 xl:h-8 xl:w-8">
                  <ProfileIcon />
                </span>
                {user ? (
                  <span className="min-w-0 text-left">
                    <span className="block max-w-[6rem] truncate text-[13px] font-medium leading-tight text-white xl:max-w-[9rem] xl:text-sm">
                      {firstName}
                    </span>
                    <TierBadge tier={user.tier} small />
                  </span>
                ) : (
                  <span className="text-[13px] font-medium text-white xl:text-sm">{loading ? '' : 'My account'}</span>
                )}
              </Link>

              <NavLink
                to={SETTINGS_ITEM.to}
                aria-label="Settings"
                title="Settings"
                className={({ isActive }) => `${iconBtn} ${isActive ? 'border-white/25 bg-white/[0.08] text-white' : ''}`}
              >
                <Settings className="h-4 w-4 xl:h-[18px] xl:w-[18px]" aria-hidden="true" />
              </NavLink>

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                aria-label="Log out"
                title="Log out"
                className={`${iconBtn} hover:border-rose-400/40 hover:text-rose-300`}
              >
                <LogOut className="h-4 w-4 xl:h-[18px] xl:w-[18px]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <Sidebar
        open={menuOpen}
        onClose={closeMenu}
        user={user}
        loading={loading}
        onLogout={() => setConfirmOpen(true)}
      />

      {/* Page content */}
      <motion.main
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mx-auto w-full max-w-7xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-8 lg:px-8"
      >
        {children}
      </motion.main>

      {/* Logout confirmation */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            key="logout-overlay"
            className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            onClick={cancelLogout}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="logout-title"
              aria-describedby="logout-desc"
              onClick={(e) => e.stopPropagation()}
              initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#14212D] p-5 shadow-2xl shadow-black/50 sm:p-6"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/20">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 id="logout-title" className="mt-4 text-lg font-semibold text-white">
                Log out of your account?
              </h2>
              <p id="logout-desc" className="mt-1.5 text-sm leading-relaxed text-slate-400">
                You will need to sign in again to reach your dashboard.
              </p>

              {logoutError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#F6465D]/30 bg-[#F6465D]/10 px-3.5 py-3 text-sm text-red-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#F6465D]" aria-hidden="true" />
                  <span>{logoutError}</span>
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={cancelLogout}
                  disabled={loggingOut}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmLogout}
                  disabled={loggingOut}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/80 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loggingOut ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Logging out…
                    </>
                  ) : (
                    'Log out'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}