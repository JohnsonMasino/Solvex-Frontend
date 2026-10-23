// src/pages/inside/Profile.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock,
  Fingerprint,
  Lock,
  Mail,
  MailCheck,
  MapPin,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  XCircle,
} from 'lucide-react'
import api from '../../components/Api'
import { TierBadge } from '../../components/inside/Sidebar'
import { initialsOf, KYC_URL } from '../../components/inside/Navconfig'

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const EDIT_URL = '/dashboard/profile/edit'
const DASH_URL = '/dashboard'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

// Look and wording for each KYC state
const KYC_STATES = {
  approved: {
    icon: ShieldCheck,
    title: 'Identity verified',
    box: 'bg-[#3DDC97]/[0.1]',
    chip: 'bg-[#3DDC97] text-[#06231A]',
    text: 'text-[#3DDC97]',
    ring: 'bg-[#3DDC97]',
  },
  pending: {
    icon: Clock,
    title: 'Verification under review',
    box: 'bg-sky-400/[0.1]',
    chip: 'bg-sky-400 text-[#06141F]',
    text: 'text-sky-300',
    ring: 'bg-sky-400',
  },
  rejected: {
    icon: XCircle,
    title: 'Verification rejected',
    box: 'bg-[#F6465D]/[0.1]',
    chip: 'bg-[#F6465D] text-white',
    text: 'text-red-300',
    ring: 'bg-[#F6465D]',
  },
  not_submitted: {
    icon: ShieldAlert,
    title: 'Not verified yet',
    box: 'bg-amber-400/[0.1]',
    chip: 'bg-amber-400 text-[#2A1B00]',
    text: 'text-amber-300',
    ring: 'bg-amber-400',
  },
}

// Tier perks are descriptive text only, adjust the wording to match your platform rules
const TIERS = [
  {
    level: 1,
    name: 'Tier 1',
    desc: 'Basic account',
    perks: ['Create and manage your profile', 'Email verification'],
  },
  {
    level: 2,
    name: 'Tier 2',
    desc: 'Verified trader',
    perks: ['Live trading enabled', 'Wallet balances and funding'],
  },
]

const LOCKED_LABELS = {
  full_name: 'Full name',
  date_of_birth: 'Date of birth',
  nationality: 'Nationality',
  sex: 'Sex',
}

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────── */

const humanize = (v) => (v ? String(v).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '')

// "25k_50k" becomes "25k – 50k", anything else is just made readable
const prettyRange = (v) => {
  if (!v) return ''
  const parts = String(v).split('_')
  if (parts.length === 2 && parts.every((p) => /^\d+(\.\d+)?k?$/i.test(p))) return `${parts[0]} – ${parts[1]}`
  return humanize(v)
}

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

// Date-only values like 1995-04-12 are built locally so the day never shifts with timezone
const formatDob = (value) => {
  if (!value) return ''
  const [y, m, d] = String(value).split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const loadError = (err) =>
  err?.response ? 'We could not load your profile.' : 'Network error. Check your connection and try again.'

/* ────────────────────────────────────────────────
   SMALL UI PIECES
──────────────────────────────────────────────── */

function InlineError({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#F6465D]/10 px-3.5 py-3 text-sm text-red-200"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-[#F6465D]" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
        >
          Try again
        </button>
      )}
    </div>
  )
}

function Section({ icon: Icon, title, aside, children }) {
  return (
    <motion.section variants={item} className="rounded-2xl bg-[#14212D] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-base font-semibold text-white">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[#3DDC97]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="truncate">{title}</span>
        </h2>
        {aside}
      </div>
      {children}
    </motion.section>
  )
}

function FieldGrid({ children }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
}

function Field({ label, value, locked = false, mono = false }) {
  const empty = value === undefined || value === null || value === ''
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {label}
        {locked && (
          <>
            <Lock className="h-3 w-3 text-slate-500" aria-hidden="true" />
            <span className="sr-only">(locked)</span>
          </>
        )}
      </dt>
      <dd
        className={`mt-1 break-words text-sm ${empty ? 'text-slate-500' : 'font-medium text-white'} ${
          mono ? 'font-mono tracking-wide' : ''
        }`}
      >
        {empty ? '—' : value}
      </dd>
    </div>
  )
}

function Note({ children }) {
  return <p className="rounded-xl bg-white/[0.04] px-3.5 py-3 text-sm text-slate-400">{children}</p>
}

function ConsentItem({ label, ok }) {
  return (
    <li className="flex items-center gap-2.5 text-sm text-slate-200">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
          ok ? 'bg-[#3DDC97]/[0.15] text-[#3DDC97]' : 'bg-white/[0.06] text-slate-400'
        }`}
      >
        {ok ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
      </span>
      <span className="min-w-0">{label}</span>
    </li>
  )
}

function Pill({ ok, yes, no, Icon, IconOff }) {
  const Ic = ok ? Icon : IconOff
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${
        ok
          ? 'bg-[#3DDC97]/[0.12] text-[#3DDC97] ring-[#3DDC97]/30'
          : 'bg-amber-400/10 text-amber-300 ring-amber-400/30'
      }`}
    >
      <Ic className="h-3 w-3" aria-hidden="true" />
      {ok ? yes : no}
    </span>
  )
}

/* ────────────────────────────────────────────────
   VERIFICATION STATUS BOX
──────────────────────────────────────────────── */

function StatusIcon({ state, approved, reduce }) {
  const Icon = state.icon
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center">
      {!reduce && (
        <motion.span
          className={`absolute inset-0 rounded-full ${state.ring}`}
          initial={{ scale: 1, opacity: 0.3 }}
          animate={{ scale: 1.55, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          aria-hidden="true"
        />
      )}
      <motion.span
        className={`relative grid h-12 w-12 place-items-center rounded-full ${state.chip}`}
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 }}
      >
        {approved ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.45, ease: 'easeOut' }}
            />
          </svg>
        ) : (
          <Icon className="h-6 w-6" aria-hidden="true" />
        )}
      </motion.span>
    </span>
  )
}

function VerificationBox({ status, submission, reduce }) {
  const state = KYC_STATES[status] || KYC_STATES.not_submitted
  const approved = status === 'approved'

  let message
  if (approved) {
    const when = formatDate(submission?.reviewed_at)
    message = `Your KYC was approved${when ? ` on ${when}` : ''}. Live trading is enabled on your account.`
  } else if (status === 'pending') {
    const when = formatDate(submission?.submitted_at)
    message = `Your documents${when ? ` were submitted on ${when} and` : ''} are being reviewed. We will update your status once the review is done.`
  } else if (status === 'rejected') {
    message = submission?.rejection_reason
      ? `Reason: ${submission.rejection_reason}`
      : 'Your last submission could not be approved. Please review your details and submit again.'
  } else {
    message = 'Complete your KYC to unlock live trading and move up to Tier 2.'
  }

  const needsAction = status === 'not_submitted' || status === 'rejected'

  return (
    <motion.section variants={item} aria-label="Verification status" className={`rounded-2xl p-4 sm:p-5 ${state.box}`}>
      <div className="flex items-start gap-3.5">
        <StatusIcon state={state} approved={approved} reduce={reduce} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">KYC status</p>
          <h2 className={`mt-0.5 text-base font-semibold ${state.text}`}>{state.title}</h2>
          <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-300">{message}</p>
        </div>
      </div>

      {needsAction && (
        <motion.div whileTap={reduce ? undefined : { scale: 0.98 }} className="mt-4">
          <Link
            to={KYC_URL}
            className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-5 text-sm font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1822]"
          >
            {status === 'rejected' ? 'Resubmit KYC' : 'Complete KYC'}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </motion.div>
      )}
    </motion.section>
  )
}

/* ────────────────────────────────────────────────
   TIER DETAILS
──────────────────────────────────────────────── */

function TierCard({ tier, reduce }) {
  const current = Number(tier) || 1
  const pct = current >= 2 ? 100 : 50

  return (
    <motion.section variants={item} aria-label="Tier details" className="rounded-2xl bg-[#14212D] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Your tier</h2>
        <TierBadge tier={current} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Verification progress</span>
          <span className="font-mono tabular-nums text-slate-200">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-[#3DDC97]"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {TIERS.map((t) => {
          const reached = current >= t.level
          const isCurrent = current === t.level
          return (
            <li
              key={t.level}
              className={`rounded-xl px-3.5 py-3 ${isCurrent ? 'bg-white/[0.07]' : 'bg-white/[0.03]'} ${
                reached ? '' : 'opacity-75'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    reached ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-white/[0.08] text-slate-400'
                  }`}
                >
                  {reached ? (
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Lock className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.desc}</p>
                </div>
                {isCurrent && (
                  <span className="shrink-0 rounded-md bg-[#3DDC97]/[0.15] px-2 py-0.5 text-[11px] font-medium text-[#3DDC97]">
                    Current
                  </span>
                )}
              </div>
              <ul className="mt-2.5 space-y-1 pl-11">
                {t.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-xs text-slate-300">
                    <Check
                      className={`mt-0.5 h-3 w-3 shrink-0 ${reached ? 'text-[#3DDC97]' : 'text-slate-500'}`}
                      aria-hidden="true"
                    />
                    {perk}
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </motion.section>
  )
}

/* ────────────────────────────────────────────────
   LOADING STATE
──────────────────────────────────────────────── */

function Block({ className }) {
  return <div className={`animate-pulse rounded-2xl bg-[#14212D] ${className}`} />
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]" aria-hidden="true">
      <div className="space-y-5">
        <Block className="h-40" />
        <Block className="h-36" />
        <Block className="h-72" />
      </div>
      <div className="space-y-5">
        <Block className="h-64" />
        <Block className="h-56" />
        <Block className="h-48" />
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Profile() {
  const reduce = useReducedMotion()

  const [profile, setProfile] = useState(null)
  const [me, setMe] = useState(null)
  const [kyc, setKyc] = useState(null) // latest submission, or null when none exists
  const [kycState, setKycState] = useState('loading') // loading | none | ok | error

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true

    api
      .get('/api/profile/')
      .then((res) => {
        if (alive) setProfile(res.data?.data ?? null)
      })
      .catch((err) => {
        if (alive) setError(loadError(err))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    api
      .get('/api/auth/me/')
      .then((res) => {
        if (alive) setMe(res.data?.data ?? null)
      })
      .catch(() => {
        /* Email status is a bonus, the page still works without it */
      })

    api
      .get('/api/kyc/submission/')
      .then((res) => {
        if (!alive) return
        setKyc(res.data?.data ?? null)
        setKycState(res.data?.data ? 'ok' : 'none')
      })
      .catch((err) => {
        if (!alive) return
        // 404 simply means the user has not submitted KYC yet
        setKyc(null)
        setKycState(err?.response?.status === 404 ? 'none' : 'error')
      })

    return () => {
      alive = false
    }
  }, [attempt])

  const retry = () => {
    setError('')
    setLoading(true)
    setKycState('loading')
    setAttempt((a) => a + 1)
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="space-y-2" aria-hidden="true">
          <div className="h-6 w-32 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-56 animate-pulse rounded bg-white/[0.06]" />
        </div>
        <ProfileSkeleton />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <InlineError message={error || 'We could not load your profile.'} onRetry={retry} />
      </div>
    )
  }

  const status = profile.kyc_status || me?.kyc_status || 'not_submitted'
  const address = profile.address || {}
  const locked = new Set(profile.locked_fields || [])
  const lockedNames = (profile.locked_fields || []).map((f) => LOCKED_LABELS[f] || humanize(f))
  const emailVerified = me ? Boolean(me.is_email_verified) : null

  const id = kyc?.identification
  const job = kyc?.employment
  const consent = kyc?.consent

  const kycMissing =
    kycState === 'error' ? (
      <InlineError message="We could not load your verification details." onRetry={retry} />
    ) : (
      <Note>Nothing on file yet. Complete your KYC and these details will show up here.</Note>
    )

  return (
    <div>
      <motion.div
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]"
        variants={container}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        {/* ── Left column: identity, status, tier ── */}
        <div className="min-w-0 space-y-5">
          <motion.section variants={item} aria-label="Account holder" className="rounded-2xl bg-[#14212D] p-4 sm:p-5">
            <div className="flex items-center gap-3.5">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#1D3042] text-lg font-semibold text-white ring-1 ring-white/10 sm:h-16 sm:w-16 sm:text-xl">
                {initialsOf(profile)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold leading-tight text-white">{profile.full_name || 'Your account'}</p>
                <p className="mt-0.5 truncate text-sm text-slate-400">{profile.email}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <TierBadge tier={profile.tier} />
              {emailVerified !== null && (
                <Pill ok={emailVerified} yes="Email verified" no="Email not verified" Icon={MailCheck} IconOff={Mail} />
              )}
            </div>

            <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              Member since {formatDate(profile.member_since || me?.date_joined) || '—'}
            </p>
          </motion.section>

          <VerificationBox status={status} submission={kyc} reduce={reduce} />
          <TierCard tier={profile.tier} reduce={reduce} />
        </div>

        {/* ── Right column: details ── */}
        <div className="min-w-0 space-y-5">
          <Section icon={User} title="Personal information">
            {profile.identity_locked && lockedNames.length > 0 && (
              <p className="mb-4 flex items-start gap-2 rounded-xl bg-white/[0.04] px-3.5 py-3 text-xs leading-relaxed text-slate-400">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                <span>{lockedNames.join(', ')} can no longer be changed because your identity is verified.</span>
              </p>
            )}
            <FieldGrid>
              <Field label="Full name" value={profile.full_name} locked={locked.has('full_name')} />
              <Field label="Date of birth" value={formatDob(profile.date_of_birth)} locked={locked.has('date_of_birth')} />
              <Field label="Sex" value={humanize(profile.sex)} locked={locked.has('sex')} />
              <Field
                label="Nationality"
                value={profile.nationality_name || profile.nationality}
                locked={locked.has('nationality')}
              />
              <Field label="Email" value={profile.email} />
              <Field label="Phone number" value={profile.phone_number} />
            </FieldGrid>
          </Section>

          <Section icon={MapPin} title="Address">
            <FieldGrid>
              <Field label="Address line 1" value={address.line1} />
              <Field label="Address line 2" value={address.line2} />
              <Field label="City" value={address.city} />
              <Field label="State / Region" value={address.state} />
              <Field label="Postal code" value={address.postal_code} />
              <Field label="Country" value={address.country_name || address.country} />
            </FieldGrid>
          </Section>

          <Section icon={Fingerprint} title="Government ID">
            {kycState === 'ok' ? (
              <FieldGrid>
                <Field label="ID type" value={humanize(id?.id_type)} />
                <Field label="ID number" value={id?.id_number} mono />
                <Field label="Attempt" value={kyc?.attempt_number ? `#${kyc.attempt_number}` : ''} />
                <Field label="Submitted" value={formatDate(kyc?.submitted_at)} />
                <Field label="Reviewed" value={formatDate(kyc?.reviewed_at) || 'Awaiting review'} />
              </FieldGrid>
            ) : (
              kycMissing
            )}
          </Section>

          <Section icon={Briefcase} title="Financial information">
            {kycState === 'ok' && job ? (
              <FieldGrid>
                <Field label="Employment status" value={humanize(job.employment_status)} />
                <Field label="Source of income" value={humanize(job.source_of_income)} />
                <Field label="Occupation" value={job.occupation} />
                <Field label="Employer" value={job.employer_name} />
                <Field label="Annual income" value={prettyRange(job.annual_income_range)} />
                <Field label="Expected annual volume" value={prettyRange(job.expected_annual_volume)} />
                <Field label="Transaction frequency" value={humanize(job.transaction_frequency)} />
                <Field label="Typical transaction size" value={prettyRange(job.typical_transaction_size)} />
              </FieldGrid>
            ) : (
              kycMissing
            )}
          </Section>

          {kycState === 'ok' && consent && (
            <Section icon={ClipboardCheck} title="Consent and declarations">
              <ul className="grid gap-3 sm:grid-cols-2">
                <ConsentItem label="Accuracy declaration" ok={Boolean(consent.accuracy_declaration)} />
                <ConsentItem label="Privacy notice accepted" ok={Boolean(consent.privacy_notice_accepted)} />
                <ConsentItem label="Terms accepted" ok={Boolean(consent.terms_accepted)} />
                <ConsentItem label="Marketing emails" ok={Boolean(consent.marketing_consent)} />
              </ul>
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <FieldGrid>
                  <Field label="Policy version" value={consent.policy_version} mono />
                  <Field label="Consented on" value={formatDate(consent.consented_at)} />
                </FieldGrid>
              </div>
            </Section>
          )}

          <Section icon={CalendarDays} title="Account">
            <FieldGrid>
              <Field label="Member since" value={formatDate(profile.member_since || me?.date_joined)} />
              <Field label="Last updated" value={formatDate(profile.updated_at)} />
              <Field label="Profile complete" value={profile.is_complete ? 'Yes' : 'Not yet'} />
              <Field
                label="Email status"
                value={emailVerified === null ? '' : emailVerified ? 'Verified' : 'Not verified'}
              />
            </FieldGrid>
          </Section>
        </div>

        {/* ── Edit button ── */}
        <motion.div variants={item} className="lg:col-span-2 lg:flex lg:justify-end">
          <motion.div whileTap={reduce ? undefined : { scale: 0.98 }}>
            <Link
              to={EDIT_URL}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-8 text-sm font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1822] sm:text-base lg:w-auto"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit profile
            </Link>
          </motion.div>
          <motion.div whileTap={reduce ? undefined : { scale: 0.98 }}>
            <Link
              to={DASH_URL}
              className="inline-flex mt-2 mb-2 h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-8 text-sm font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1822] sm:text-base lg:w-auto"
            >
              Dashboard
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}