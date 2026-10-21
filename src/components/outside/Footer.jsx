import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

/* ────────────────────────────────────────────────
   CONTENT
──────────────────────────────────────────────── */

const LEGAL_LINKS = [
  { label: 'Terms of Service', to: '/terms-of-service' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Risk Disclosure', to: '/risk-disclosure' },
  { label: 'Cookie Policy', to: '/cookie-policy' },
  { label: 'AML Policy', to: '/aml-policy' },
]

// Each icon opens the homepage of that social network
const SOCIALS = [
  {
    name: 'Facebook',
    href: 'https://www.facebook.com',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    name: 'X',
    href: 'https://x.com',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <path d="M17.5 6.5h.01" />
      </svg>
    ),
  },
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    name: 'Telegram',
    href: 'https://telegram.org',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 2L11 13" />
        <path d="M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    ),
  },
]

/* ────────────────────────────────────────────────
   FOOTER
──────────────────────────────────────────────── */

export default function Footer() {
  const reduce = useReducedMotion()
  const year = new Date().getFullYear()

  // Parent staggers its children in as the footer scrolls into view
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.09 } },
  }
  const item = {
    hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  }

  const scrollTop = () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })

  return (
    <footer className="relative overflow-hidden border-t border-white/[0.08] bg-[#080D12]">
      {/* Animated top accent line */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px origin-center bg-gradient-to-r from-transparent via-[#3DDC97] to-transparent"
        initial={{ scaleX: reduce ? 1 : 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      {/* Soft floating glows */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#3DDC97]/10 blur-3xl"
        animate={reduce ? undefined : { y: [0, 24, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-24 h-64 w-64 rounded-full bg-[#2E9BFF]/10 blur-3xl"
        animate={reduce ? undefined : { y: [0, -24, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-40px' }}
      >
        {/* Top section: brand left, legal right */}
        <div className="grid gap-10 py-12 sm:py-14 md:grid-cols-[1.4fr_1fr] md:items-start md:gap-16 lg:grid-cols-[1.6fr_1fr]">
          {/* Logo + trading statement */}
          <motion.div variants={item} className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Link
              to="/"
              onClick={scrollTop}
              aria-label="Solvexmarketinc, go to home page"
              className="group flex shrink-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
            >
              <motion.span
                whileHover={reduce ? undefined : { rotate: -6, scale: 1.06 }}
                transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F1B24] ring-1 ring-white/10 transition-colors duration-200 group-hover:ring-[#3DDC97]/50"
              >
                <img
                  src="/Logo_nbg.png"
                  alt=""
                  className="h-10 w-10 object-contain"
                  draggable="false"
                />
              </motion.span>
              <span className="text-lg font-semibold tracking-tight text-white sm:hidden">
                SOLVE<span className="text-[#FF4D4F]">X</span>
                <span className="text-[#3DDC97]">MARKETINC</span>
              </span>
            </Link>

            <div className="max-w-md">
              <p className="hidden text-lg font-semibold tracking-tight text-white sm:block">
                SOLVE<span className="text-[#FF4D4F]">X</span>
                <span className="text-[#3DDC97]">MARKETINC</span>
              </p>
              <p className="text-sm leading-relaxed text-slate-400 sm:mt-1.5">
                Trade crypto and forex with discipline. Plan every trade, manage your risk and
                trade with confidence, all from one account.
              </p>
            </div>
          </motion.div>

          {/* Legal */}
          <motion.nav variants={item} aria-label="Legal" className="md:justify-self-end">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3DDC97]" aria-hidden="true" />
              Legal
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-1 md:gap-y-2.5">
              {LEGAL_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    onClick={scrollTop}
                    className="group inline-flex items-center gap-1 rounded text-sm text-slate-400 transition-colors duration-200 hover:text-[#3DDC97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
                  >
                    <ChevronRight
                      className="h-3.5 w-3.5 -ml-1 opacity-0 transition-all duration-200 group-hover:ml-0 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                    <span className="relative">
                      {l.label}
                      <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-[#3DDC97] transition-transform duration-300 group-hover:scale-x-100" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.nav>
        </div>

        {/* Bottom section: copyright left, socials right */}
        <motion.div
          variants={item}
          className="flex flex-col items-center gap-5 border-t border-white/[0.08] py-6 text-center md:flex-row md:justify-between md:text-left"
        >
          <p className="text-xs text-slate-500 sm:text-sm">
            &copy; {year} Solvexmarketinc. All rights reserved.
          </p>

          <ul className="flex items-center gap-2.5" aria-label="Social media">
            {SOCIALS.map((s, i) => (
              <motion.li
                key={s.name}
                initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: reduce ? 0 : 0.35 + i * 0.07 }}
              >
                <motion.a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.name} (opens in a new tab)`}
                  whileHover={reduce ? undefined : { y: -3 }}
                  whileTap={{ scale: 0.9 }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors duration-200 hover:border-[#3DDC97]/50 hover:bg-[#3DDC97]/10 hover:text-[#3DDC97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
                >
                  {s.icon}
                </motion.a>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </motion.div>
    </footer>
  )
}