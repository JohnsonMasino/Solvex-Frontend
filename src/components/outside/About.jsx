import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import CountUpModule from 'react-countup'
import {
  ArrowRight,
  Award,
  Briefcase,
  Building2,
  Calendar,
  Check,
  Clock,
  Eye,
  Landmark,
  MapPin,
  Scale,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react'

// Some packages ship CommonJS builds, so Vite can hand back { default: Component }
// instead of the component itself. This picks the real component either way.
const CountUp = CountUpModule.default ?? CountUpModule

/* ────────────────────────────────────────────────
   COMPANY + TEAM DATA  (edit here, it flows through the page)
──────────────────────────────────────────────── */

const COMPANY = {
  name: 'Solvexmarketinc',
  founded: 2012,
  addressLines: ['5 Quinton Road', 'Coventry', 'CV1 2WT', 'United Kingdom'],
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=5+Quinton+Road+Coventry+CV1+2WT+United+Kingdom',
}
const CURRENT_YEAR = new Date().getFullYear()
const YEARS_ACTIVE = CURRENT_YEAR - COMPANY.founded

// PLACEHOLDER TEAM: replace the names, titles, photos and backgrounds with your real leadership.
// Put the photos in /public/team/ (or change the paths below). A neat initials avatar
// shows automatically if an image is missing.
const TEAM = [
  {
    name: 'James Whitfield',
    title: 'Chief Executive Officer',
    image: '/ceo.jpg',
    experience: '18+ years',
    bio: 'Began his career on a forex desk and has traded major currency pairs through several market cycles. He leads the company’s strategy, client standards and risk governance.',
    focus: ['Forex', 'Strategy', 'Risk governance'],
  },
  {
    name: 'Sophie Ramsay',
    title: 'Head of Trading',
    image: '/hot.jfif',
    experience: '14+ years',
    bio: 'A markets specialist who has worked across currency and digital asset trading. She oversees market analysis, trading education and the way our traders are supported day to day.',
    focus: ['Crypto', 'Technical analysis', 'Trader education'],
  },
]

const VALUES = [
  { icon: Eye, title: 'Transparency', text: 'Clear information about markets, costs and risk, so you can decide with confidence.' },
  { icon: Scale, title: 'Risk first', text: 'We teach protecting capital before chasing profit. Every plan starts with the downside.' },
  { icon: ShieldCheck, title: 'Security', text: 'Identity verification and account safeguards protect every client on the platform.' },
  { icon: Users, title: 'Client focus', text: 'Responsive support and tools built around how real traders work.' },
]

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

function Eyebrow({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#3DDC97]/30 bg-[#3DDC97]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#3DDC97]">
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  )
}

function Heading({ eyebrow, icon, title, text }) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">{text}</p>}
    </Reveal>
  )
}

function Section({ id, alt = false, children }) {
  return (
    <section
      id={id}
      className={`relative overflow-hidden px-4 py-14 sm:px-6 sm:py-20 lg:px-8 ${alt ? 'bg-[#0A1118]' : 'bg-[#080D12]'}`}
    >
      <div className="relative mx-auto max-w-7xl">{children}</div>
    </section>
  )
}

/* ────────────────────────────────────────────────
   1. PAGE HERO
──────────────────────────────────────────────── */

function PageHero() {
  const reduce = useReducedMotion()
  return (
    <section className="relative overflow-hidden bg-[#080D12] px-4 pb-14 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8">
      {/* Faint grid + glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#3DDC97]/15 blur-3xl"
        animate={reduce ? undefined : { y: [0, 30, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#2E9BFF]/10 blur-3xl"
        animate={reduce ? undefined : { y: [0, -30, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <Reveal>
          <Eyebrow icon={Landmark}>About us</Eyebrow>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-5 text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Trading with discipline,{' '}
            <span className="bg-gradient-to-r from-[#3DDC97] to-[#5BEBAD] bg-clip-text text-transparent">
              since {COMPANY.founded}
            </span>
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-lg">
            {COMPANY.name} gives traders organised, secure access to crypto and forex markets. Founded and registered
            in {COMPANY.founded}, we have spent {YEARS_ACTIVE}+ years helping clients plan their trades and manage risk.
          </p>
        </Reveal>
        <Reveal delay={0.24} className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="#team"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-8 text-sm font-semibold text-[#06140E] shadow-[0_10px_28px_-10px_rgba(61,220,151,0.8)] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:text-base"
          >
            Meet the team
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </a>
          <Link
            to="/signup"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 bg-[#080D12]/40 px-8 text-sm font-medium text-white transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 sm:text-base"
          >
            Create free account
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────
   2. OUR STORY + COUNTERS
──────────────────────────────────────────────── */

function Story() {
  const reduce = useReducedMotion()
  const stats = [
    { icon: Calendar, end: COMPANY.founded, label: 'Founded and registered' },
    { icon: Clock, end: YEARS_ACTIVE, suffix: '+', label: 'Years in the markets' },
    { icon: Building2, end: 1, label: 'Head office, United Kingdom' },
    { icon: Target, end: 2, label: 'Markets: crypto and forex' },
  ]
  return (
    <Section id="story" alt>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <Eyebrow icon={Landmark}>Our story</Eyebrow>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Built to make trading clearer and safer
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-400 sm:text-base">
            <p>
              {COMPANY.name} was founded and registered in {COMPANY.founded} with a simple idea: traders make better
              decisions when markets are explained clearly and risk is respected from the first trade.
            </p>
            <p>
              Today we give clients one account to trade Bitcoin, Ethereum and the world’s major currency pairs. We
              combine verified accounts, secure deposits and withdrawals, and practical education on planning every
              trade before you enter it.
            </p>
            <p>
              Our head office is in Coventry, United Kingdom, where our leadership team continues to guide the
              platform’s direction and standards.
            </p>
          </div>
          <ul className="mt-5 space-y-2">
            {['Founded and registered in ' + COMPANY.founded, 'Headquartered in the United Kingdom', 'Crypto and forex in one account'].map((pt) => (
              <li key={pt} className="flex items-start gap-2 text-sm text-slate-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3DDC97]" aria-hidden="true" />
                {pt}
              </li>
            ))}
          </ul>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <Reveal key={s.label} delay={i * 0.08}>
                <motion.div whileHover={reduce ? undefined : { y: -4 }} className={`${card} h-full p-4 text-center sm:p-6`}>
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-3xl font-bold tabular-nums text-white sm:text-4xl">
                    <CountUp end={s.end} suffix={s.suffix || ''} duration={reduce ? 0 : 2.2} enableScrollSpy scrollSpyOnce />
                  </p>
                  <p className="mt-1 text-xs text-slate-400 sm:text-sm">{s.label}</p>
                </motion.div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   3. VALUES
──────────────────────────────────────────────── */

function Values() {
  const reduce = useReducedMotion()
  return (
    <Section id="values">
      <Heading
        icon={ShieldCheck}
        eyebrow="What we stand for"
        title="The principles behind every account"
        text="Four commitments guide how we build the platform and how we support our traders."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VALUES.map((v, i) => {
          const Icon = v.icon
          return (
            <Reveal key={v.title} delay={i * 0.08}>
              <motion.div
                whileHover={reduce ? undefined : { y: -4 }}
                className={`${card} group h-full p-5 transition-colors hover:border-[#3DDC97]/40 sm:p-6`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/20 transition-colors group-hover:bg-[#3DDC97]/20">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{v.text}</p>
              </motion.div>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   4. LEADERSHIP TEAM (top two members)
──────────────────────────────────────────────── */

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
}

function TeamCard({ member, index }) {
  const reduce = useReducedMotion()
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <Reveal delay={index * 0.15}>
      <motion.article
        whileHover={reduce ? undefined : { y: -6 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className={`${card} group flex h-full flex-col overflow-hidden transition-colors hover:border-[#3DDC97]/40`}
      >
        {/* Photo */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#0F1B24] sm:aspect-[16/11]">
          {!imgFailed ? (
            <img
              src={member.image}
              alt={`${member.name}, ${member.title}`}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div
              role="img"
              aria-label={`${member.name}, ${member.title}`}
              className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#12332B] via-[#0F1B24] to-[#0B141B]"
            >
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#3DDC97]/10 text-4xl font-bold text-[#3DDC97] ring-1 ring-[#3DDC97]/30">
                {initials(member.name)}
              </span>
            </div>
          )}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B141B] via-transparent to-transparent" />
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[#080D12]/80 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/10 backdrop-blur">
            <Briefcase className="h-3.5 w-3.5 text-[#3DDC97]" aria-hidden="true" />
            {member.experience} in trading
          </span>
        </div>

        {/* Details */}
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#3DDC97]">{member.title}</p>
          <h3 className="mt-1 text-xl font-bold text-white sm:text-2xl">{member.name}</h3>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">{member.bio}</p>

          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              Areas of focus
            </p>
            <ul className="flex flex-wrap gap-2">
              {member.focus.map((f) => (
                <li key={f} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.article>
    </Reveal>
  )
}

function Team() {
  return (
    <Section id="team" alt>
      <Heading
        icon={Users}
        eyebrow="Leadership"
        title="Meet the people guiding the platform"
        text="Experienced market professionals who set our standards for trading, risk and client care."
      />
      <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2 md:gap-6">
        {TEAM.map((m, i) => (
          <TeamCard key={m.name} member={m} index={i} />
        ))}
      </div>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   5. HEAD OFFICE
──────────────────────────────────────────────── */

function HeadOffice() {
  return (
    <Section id="head-office">
      <Reveal>
        <div className={`${card} grid overflow-hidden md:grid-cols-2`}>
          {/* Decorative map-style panel */}
          <div className="relative flex min-h-[200px] items-center justify-center overflow-hidden bg-[#0F1B24] sm:min-h-[260px]" aria-hidden="true">
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(61,220,151,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(61,220,151,0.10) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />
            {[1, 2, 3].map((n) => (
              <motion.span
                key={n}
                className="absolute rounded-full border border-[#3DDC97]/40"
                style={{ width: 40, height: 40 }}
                animate={{ scale: [1, 3.2], opacity: [0.7, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: n * 0.9, ease: 'easeOut' }}
              />
            ))}
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#3DDC97] text-[#06140E] shadow-[0_0_40px_-5px_rgba(61,220,151,0.9)]">
              <MapPin className="h-7 w-7" />
            </span>
          </div>

          <div className="p-6 sm:p-8">
            <Eyebrow icon={Building2}>Head office</Eyebrow>
            <h2 className="mt-4 text-xl font-bold text-white sm:text-2xl">Coventry, United Kingdom</h2>
            <address className="mt-3 space-y-0.5 text-sm not-italic leading-relaxed text-slate-300">
              {COMPANY.addressLines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </address>
            <p className="mt-3 text-sm text-slate-400">
              Our head office has been the base for {COMPANY.name} since {COMPANY.founded}.
            </p>
            <a
              href={COMPANY.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-6 text-sm font-medium text-white transition-colors hover:border-[#3DDC97]/60 hover:bg-[#3DDC97]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
            >
              Get directions
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </a>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   6. CALL TO ACTION
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
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">Start trading with a team you can trust</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Join a platform with {YEARS_ACTIVE}+ years of history. Create your account, verify once and plan your
                first trade.
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
                everyone. You can lose some or all of your capital. Trade responsibly.
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

export default function AboutUs() {
  return (
    <div className="bg-[#080D12] text-slate-300">
      <PageHero />
      <Story />
      <Values />
      <Team />
      <HeadOffice />
      <FinalCTA />
    </div>
  )
}