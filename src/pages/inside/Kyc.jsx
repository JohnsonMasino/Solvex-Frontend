// src/pages/inside/Kyc.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Fingerprint,
  History as HistoryIcon,
  Image as ImageIcon,
  Info,
  LayoutDashboard,
  Loader2,
  MapPin,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  X,
  XCircle,
} from 'lucide-react'
import api from '../../components/Api'
import { TierBadge } from '../../components/inside/Sidebar'

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const DASHBOARD_URL = '/dashboard'
const HISTORY_PAGE_SIZE = 10
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,19}$/

// Image rules. The server sends image_max_mb and image_formats in /api/kyc/options/,
// these are the fallbacks when it does not.
const DEFAULT_IMAGE_MAX_MB = 5
const DEFAULT_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
const UPLOAD_TIMEOUT_MS = 120000

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

// Approved is green, pending is blue, declined is red, not submitted is amber
const META = {
  approved: {
    icon: ShieldCheck,
    title: 'KYC approved',
    box: 'bg-[#3DDC97]/[0.1]',
    chip: 'bg-[#3DDC97] text-[#06231A]',
    text: 'text-[#3DDC97]',
    ring: 'bg-[#3DDC97]',
    pill: 'bg-[#3DDC97]/[0.12] text-[#3DDC97]',
    pillLabel: 'Approved',
  },
  pending: {
    icon: Clock,
    title: 'Under review',
    box: 'bg-sky-400/[0.1]',
    chip: 'bg-sky-400 text-[#06141F]',
    text: 'text-sky-300',
    ring: 'bg-sky-400',
    pill: 'bg-sky-400/[0.12] text-sky-300',
    pillLabel: 'Pending',
  },
  rejected: {
    icon: XCircle,
    title: 'KYC declined',
    box: 'bg-[#F6465D]/[0.1]',
    chip: 'bg-[#F6465D] text-white',
    text: 'text-red-300',
    ring: 'bg-[#F6465D]',
    pill: 'bg-[#F6465D]/[0.12] text-red-300',
    pillLabel: 'Declined',
  },
  not_submitted: {
    icon: ShieldAlert,
    title: 'Verify your identity',
    box: 'bg-amber-400/[0.1]',
    chip: 'bg-amber-400 text-[#2A1B00]',
    text: 'text-amber-300',
    ring: 'bg-amber-400',
    pill: 'bg-amber-400/[0.12] text-amber-300',
    pillLabel: 'Not submitted',
  },
}

const TONES = {
  error: { box: 'bg-[#F6465D]/10 text-red-200', icon: 'text-[#F6465D]', Icon: AlertCircle },
  warn: { box: 'bg-amber-400/10 text-amber-200', icon: 'text-amber-300', Icon: AlertCircle },
  success: { box: 'bg-[#3DDC97]/[0.12] text-[#B8F5DA]', icon: 'text-[#3DDC97]', Icon: CheckCircle2 },
  info: { box: 'bg-sky-400/10 text-sky-200', icon: 'text-sky-300', Icon: Info },
}

// Fields that have an input on screen, grouped exactly like the API sections
const SECTION_FIELDS = {
  personal: ['full_name', 'date_of_birth', 'nationality', 'sex', 'phone_number'],
  address: ['line1', 'line2', 'city', 'state', 'postal_code', 'country'],
  identification: ['id_type', 'id_number'],
  employment: [
    'employment_status',
    'source_of_income',
    'occupation',
    'employer_name',
    'annual_income_range',
    'expected_annual_volume',
    'transaction_frequency',
    'typical_transaction_size',
  ],
  consent: ['accuracy_declaration', 'privacy_notice_accepted', 'terms_accepted', 'marketing_consent'],
}

// The two ID images are top-level multipart fields, not dotted section keys
const IMAGE_KEYS = ['id_front', 'id_back']

const KNOWN_PATHS = new Set([
  ...Object.entries(SECTION_FIELDS).flatMap(([section, fields]) => fields.map((f) => `${section}.${f}`)),
  ...IMAGE_KEYS,
])

const REQUIRED = [
  ['personal.full_name', 'Full name'],
  ['personal.date_of_birth', 'Date of birth'],
  ['personal.nationality', 'Nationality'],
  ['personal.sex', 'Sex'],
  ['personal.phone_number', 'Phone number'],
  ['address.line1', 'Address line 1'],
  ['address.city', 'City'],
  ['address.country', 'Country'],
  ['identification.id_type', 'ID type'],
  ['identification.id_number', 'ID number'],
  ['employment.employment_status', 'Employment status'],
  ['employment.source_of_income', 'Source of income'],
  ['employment.occupation', 'Occupation'],
  ['employment.annual_income_range', 'Annual income'],
  ['employment.expected_annual_volume', 'Expected annual volume'],
  ['employment.transaction_frequency', 'Transaction frequency'],
  ['employment.typical_transaction_size', 'Typical transaction size'],
  ['consent.accuracy_declaration', 'Accuracy declaration'],
  ['consent.privacy_notice_accepted', 'Privacy notice'],
  ['consent.terms_accepted', 'Terms of service'],
]

// Total counted by the submit bar: every required text field plus the two ID images
const TOTAL_REQUIRED = REQUIRED.length + IMAGE_KEYS.length

const CONSENT_MESSAGES = {
  'consent.accuracy_declaration': 'You must confirm that the information provided is accurate.',
  'consent.privacy_notice_accepted': 'You must accept the privacy notice.',
  'consent.terms_accepted': 'You must accept the terms of service.',
}

const IMAGE_LABELS = {
  id_front: 'Front of ID',
  id_back: 'Back of ID',
}

const EMPLOYER_REQUIRED_FOR = ['employed', 'self_employed']

// ISO 3166-1 alpha-2 codes. Country names come from the browser's own Intl data.
const COUNTRY_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  )

let regionNames = null
try {
  regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
} catch {
  regionNames = null
}

const countryName = (code) => {
  if (!code) return ''
  try {
    return regionNames?.of(code) || code
  } catch {
    return code
  }
}

const COUNTRIES = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
  a.name.localeCompare(b.name),
)

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────── */

const humanize = (v) => (v ? String(v).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '')

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

const formatDob = (value) => {
  if (!value) return ''
  const [y, m, d] = String(value).split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Shows the friendly label from the options endpoint, falling back to a readable version of the value
const optLabel = (options, key, value) => {
  if (!value) return ''
  const hit = options?.[key]?.find((o) => o.value === value)
  return hit?.label || humanize(value)
}

const getAt = (form, path) => {
  const [section, key] = path.split('.')
  return form?.[section]?.[key]
}

const flatten = (v) => {
  if (v == null) return []
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(flatten)
  if (typeof v === 'object') return Object.values(v).flatMap(flatten)
  return [String(v)]
}

// The API keys errors by dotted path, for example "personal.date_of_birth".
// Image errors are keyed by the field name: "id_front" and "id_back".
function collectErrors(errors) {
  const fields = {}
  const general = []

  const walk = (key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.entries(val).forEach(([k, v]) => walk(key ? `${key}.${k}` : k, v))
      return
    }
    const msgs = flatten(val)
    if (!msgs.length) return
    if (KNOWN_PATHS.has(key)) fields[key] = msgs[0]
    else general.push(...msgs)
  }

  Object.entries(errors || {}).forEach(([k, v]) => walk(k, v))
  return { fields, general }
}

const isFilled = (form, path) => {
  const v = getAt(form, path)
  if (typeof v === 'boolean') return v
  return String(v ?? '').trim() !== ''
}

const sectionProgress = (form, section) => {
  const list = REQUIRED.filter(([p]) => p.startsWith(`${section}.`))
  return { done: list.filter(([p]) => isFilled(form, p)).length, total: list.length }
}

const maxDob = (minAge) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - minAge)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function dobProblem(dob, minAge) {
  const [y, m, d] = String(dob).split('-').map(Number)
  if (!y || !m || !d) return 'Enter a valid date of birth.'
  const t = new Date()
  let age = t.getFullYear() - y
  const monthNow = t.getMonth() + 1
  if (monthNow < m || (monthNow === m && t.getDate() < d)) age -= 1
  if (age < 0) return 'Date of birth cannot be in the future.'
  if (age < minAge) return `You must be at least ${minAge} years old.`
  return ''
}

const employerIsRequired = (form) => EMPLOYER_REQUIRED_FOR.includes(form?.employment?.employment_status)

function validate(form, files, minAge) {
  const errs = {}
  const val = (p) => String(getAt(form, p) ?? '').trim()

  REQUIRED.forEach(([path, label]) => {
    if (path.startsWith('consent.')) {
      if (!getAt(form, path)) errs[path] = CONSENT_MESSAGES[path]
    } else if (!val(path)) {
      errs[path] = `${label} is required.`
    }
  })

  if (employerIsRequired(form) && !val('employment.employer_name')) {
    errs['employment.employer_name'] = 'Employer is required when you are employed or self-employed.'
  }

  if (!errs['personal.date_of_birth']) {
    const problem = dobProblem(val('personal.date_of_birth'), minAge)
    if (problem) errs['personal.date_of_birth'] = problem
  }
  if (!errs['personal.phone_number'] && !PHONE_RE.test(val('personal.phone_number'))) {
    errs['personal.phone_number'] = 'Enter a valid phone number, for example +2348012345678.'
  }
  if (!errs['identification.id_number'] && val('identification.id_number').length < 4) {
    errs['identification.id_number'] = 'Enter the full ID number as shown on your document.'
  }

  if (!files?.id_front) errs.id_front = 'Please add a photo of the front of your ID document.'
  if (!files?.id_back) errs.id_back = 'Please add a photo of the back of your ID document.'

  return errs
}

const trimSection = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))

function buildPayload(form) {
  return {
    personal: trimSection(form.personal),
    address: trimSection(form.address),
    identification: trimSection(form.identification),
    employment: trimSection(form.employment),
    consent: {
      accuracy_declaration: Boolean(form.consent.accuracy_declaration),
      privacy_notice_accepted: Boolean(form.consent.privacy_notice_accepted),
      terms_accepted: Boolean(form.consent.terms_accepted),
      marketing_consent: Boolean(form.consent.marketing_consent),
    },
  }
}

// POST /api/kyc/submit/ is multipart/form-data. Sections go as dotted keys
// ("personal.full_name"), the images as the top-level fields id_front and id_back.
// Empty optional values are left out, booleans are sent as "true" / "false".
function toKycFormData(sections, files) {
  const fd = new FormData()

  Object.entries(sections).forEach(([section, obj]) => {
    Object.entries(obj).forEach(([key, value]) => {
      const name = `${section}.${key}`
      if (typeof value === 'boolean') fd.append(name, value ? 'true' : 'false')
      else if (value !== null && value !== undefined && String(value).trim() !== '') fd.append(name, value)
    })
  })

  fd.append('id_front', files.id_front.file, files.id_front.file.name)
  fd.append('id_back', files.id_back.file, files.id_back.file.name)
  return fd
}

/* ── Image helpers ─────────────────────────────── */

const extOf = (name) => {
  const m = /\.([a-z0-9]+)$/i.exec(name || '')
  return m ? m[1].toLowerCase() : ''
}

const isHeic = (file) => {
  const ext = extOf(file?.name)
  const type = String(file?.type || '').toLowerCase()
  return ext === 'heic' || ext === 'heif' || type === 'image/heic' || type === 'image/heif'
}

// image_formats may come back as ["JPG", "PNG"] or as mime types, so both are normalised
function imageRules(options) {
  const maxMb = Number(options?.image_max_mb) > 0 ? Number(options.image_max_mb) : DEFAULT_IMAGE_MAX_MB

  let exts = DEFAULT_IMAGE_EXTS
  if (Array.isArray(options?.image_formats) && options.image_formats.length) {
    const set = new Set()
    options.image_formats.forEach((f) => {
      const x = String(f).toLowerCase().replace(/^image\//, '').replace(/^\./, '')
      if (x === 'jpg' || x === 'jpeg') {
        set.add('jpg')
        set.add('jpeg')
      } else if (x === 'heic' || x === 'heif') {
        set.add('heic')
        set.add('heif')
      } else if (x) {
        set.add(x)
      }
    })
    if (set.size) exts = [...set]
  }

  const label = [...new Set(exts.map((e) => (e === 'jpeg' ? 'jpg' : e === 'heif' ? 'heic' : e).toUpperCase()))].join(', ')
  const accept = [...exts.map((e) => `.${e}`), ...exts.map((e) => `image/${e === 'jpg' ? 'jpeg' : e}`)].join(',')

  return { maxMb, exts, label, accept }
}

function imageProblem(file, rules) {
  if (!file) return 'Please choose an image.'
  if (!rules.exts.includes(extOf(file.name)) && !/^image\//i.test(file.type || '')) {
    return `Unsupported file type. Use ${rules.label}.`
  }
  if (!rules.exts.includes(extOf(file.name)) && extOf(file.name)) {
    return `Unsupported file type. Use ${rules.label}.`
  }
  if (file.size === 0) return 'This file is empty. Please choose another image.'
  if (file.size > rules.maxMb * 1024 * 1024) {
    return `The image is too large. The maximum size is ${rules.maxMb} MB.`
  }
  return ''
}

const formatSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const prefersNativeCamera = () => {
  try {
    return window.matchMedia?.('(pointer: coarse)').matches
  } catch {
    return false
  }
}

const canUseLiveCamera = () => Boolean(navigator.mediaDevices?.getUserMedia)

// Starting values: the last submission (for a declined user), then known profile data.
// The ID number is never pre-filled because it only comes back masked.
// The images are never pre-filled either: they are locked after submit and must be sent again.
function buildInitial(prefill, previous, options) {
  const first = (a, b) => (a !== undefined && a !== null && a !== '' ? a : (b ?? ''))
  const valid = (list, v) => (options?.[list] || []).some((o) => o.value === v) ? v : ''
  const pre = prefill || {}
  const prev = previous || {}
  const manual = (options?.address_entry_methods || []).some((o) => o.value === 'manual')
    ? 'manual'
    : options?.address_entry_methods?.[0]?.value || 'manual'

  const p = (key) => first(prev.personal?.[key], pre.personal?.[key])
  const a = (key) => first(prev.address?.[key], pre.address?.[key])
  const e = (key) => prev.employment?.[key] || ''

  return {
    personal: {
      full_name: p('full_name'),
      date_of_birth: p('date_of_birth'),
      nationality: p('nationality'),
      sex: valid('sex', p('sex')),
      phone_number: p('phone_number'),
    },
    address: {
      line1: a('line1'),
      line2: a('line2'),
      city: a('city'),
      state: a('state'),
      postal_code: a('postal_code'),
      country: a('country'),
      entry_method: manual,
    },
    identification: {
      id_type: valid('id_types', prev.identification?.id_type),
      id_number: '',
    },
    employment: {
      employment_status: valid('employment_statuses', e('employment_status')),
      source_of_income: valid('sources_of_income', e('source_of_income')),
      occupation: e('occupation'),
      employer_name: e('employer_name'),
      annual_income_range: valid('income_ranges', e('annual_income_range')),
      expected_annual_volume: valid('annual_volume_ranges', e('expected_annual_volume')),
      transaction_frequency: valid('transaction_frequencies', e('transaction_frequency')),
      typical_transaction_size: valid('transaction_sizes', e('typical_transaction_size')),
    },
    consent: {
      accuracy_declaration: false,
      privacy_notice_accepted: false,
      terms_accepted: false,
      marketing_consent: false,
    },
  }
}

const idOf = (path) => `kyc-${path.replace('.', '-')}`

const inputCls = (error) =>
  `h-11 w-full rounded-xl bg-[#0E1822] px-3.5 text-base text-white outline-none ring-1 transition placeholder:text-slate-500 focus:ring-2 sm:text-sm ${
    error ? 'ring-[#F6465D]/60 focus:ring-[#F6465D]' : 'ring-white/10 focus:ring-[#3DDC97]/70'
  }`

const primaryBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-5 text-sm font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1822] disabled:cursor-not-allowed disabled:opacity-60'

const ghostBtn =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70'

const smallBtn =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/[0.07] px-3 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60'

/* ────────────────────────────────────────────────
   SHARED PIECES
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

function Banner({ banner, innerRef }) {
  const tone = banner ? TONES[banner.tone] : null
  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.id}
          ref={innerRef}
          role={banner.tone === 'error' || banner.tone === 'warn' ? 'alert' : 'status'}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ${tone.box}`}
        >
          <tone.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.icon}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="break-words font-medium">{banner.text}</p>
            {banner.lines?.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[13px] opacity-90">
                {banner.lines.map((line) => (
                  <li key={line} className="break-words">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {banner.onDismiss && (
            <button
              type="button"
              onClick={banner.onDismiss}
              aria-label="Dismiss message"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-80 transition-colors hover:bg-white/[0.08] hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Card({ icon: Icon, title, progress, children }) {
  const complete = progress && progress.done === progress.total
  return (
    <motion.section variants={item} className="rounded-2xl bg-[#14212D] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-base font-semibold text-white">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[#3DDC97]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="truncate">{title}</span>
        </h2>
        {progress && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-medium transition-colors ${
              complete ? 'bg-[#3DDC97]/[0.15] text-[#3DDC97]' : 'bg-white/[0.06] text-slate-400'
            }`}
          >
            {complete && <Check className="h-3 w-3" aria-hidden="true" />}
            {progress.done}/{progress.total}
          </span>
        )}
      </div>
      {children}
    </motion.section>
  )
}

function Detail({ label, value, mono = false }) {
  const empty = value === undefined || value === null || value === ''
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</dt>
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

function DetailGrid({ children }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
}

function StatusPill({ status }) {
  const meta = META[status] || META.pending
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.pill}`}>
      {meta.pillLabel}
    </span>
  )
}

function StatusIcon({ meta, approved, reduce }) {
  const Icon = meta.icon
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center">
      {!reduce && (
        <motion.span
          className={`absolute inset-0 rounded-full ${meta.ring}`}
          initial={{ scale: 1, opacity: 0.3 }}
          animate={{ scale: 1.55, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          aria-hidden="true"
        />
      )}
      <motion.span
        className={`relative grid h-12 w-12 place-items-center rounded-full ${meta.chip}`}
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

function Block({ className }) {
  return <div className={`animate-pulse rounded-2xl bg-[#14212D] ${className}`} />
}

/* ────────────────────────────────────────────────
   STATUS CARD
──────────────────────────────────────────────── */

function StatusCard({ status, st, submission, canSubmit, reduce }) {
  const meta = META[st] || META.not_submitted
  const latest = status?.latest_submission || submission || {}
  const reason = latest.rejection_reason || submission?.rejection_reason
  const used = status?.attempts_used
  const remaining = status?.attempts_remaining

  let message
  if (st === 'approved') {
    const when = formatDate(latest.reviewed_at)
    message = `Your identity has been verified${when ? ` on ${when}` : ''}. Everything is fine: your account is in good standing and live trading is enabled.`
  } else if (st === 'pending') {
    const when = formatDate(latest.submitted_at)
    message = `Your documents${when ? ` were submitted on ${when} and` : ''} are with our team for review. We will email you the outcome.`
  } else if (st === 'rejected') {
    message = canSubmit
      ? 'Your last submission could not be approved. Please check the reason below, correct your details, add a new set of ID photos and submit again.'
      : 'Your last submission could not be approved and you have no attempts left. Please contact support for help.'
  } else {
    message = 'Complete the form below and add photos of your ID to verify your identity. It takes a few minutes and unlocks live trading.'
  }

  return (
    <motion.section variants={item} aria-label="KYC status" className={`rounded-2xl p-4 sm:p-5 ${meta.box}`}>
      <div className="flex items-start gap-3.5">
        <StatusIcon meta={meta} approved={st === 'approved'} reduce={reduce} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">KYC status</p>
          <h2 className={`mt-0.5 text-base font-semibold ${meta.text}`}>{meta.title}</h2>
          <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-300">{message}</p>
        </div>
      </div>

      {st === 'rejected' && reason && (
        <div className="mt-4 rounded-xl bg-[#F6465D]/10 px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-red-300">Reason given</p>
          <p className="mt-1 break-words text-sm text-red-100">{reason}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {status?.tier !== undefined && <TierBadge tier={status.tier} />}
        {typeof used === 'number' && (
          <span className="rounded-md bg-white/[0.07] px-2 py-0.5 text-[11px] font-medium text-slate-200">
            Attempts used: {used}
          </span>
        )}
        {typeof remaining === 'number' && st !== 'approved' && (
          <span className="rounded-md bg-white/[0.07] px-2 py-0.5 text-[11px] font-medium text-slate-200">
            Remaining: {remaining}
          </span>
        )}
      </div>
    </motion.section>
  )
}

/* ────────────────────────────────────────────────
   SUBMISSION DETAILS (read only, for pending and approved)
──────────────────────────────────────────────── */

function SubmissionDetails({ sub, options }) {
  const personal = sub.personal || {}
  const address = sub.address || {}
  const id = sub.identification || {}
  const job = sub.employment || {}
  const consent = sub.consent || {}

  return (
    <>
      <Card icon={User} title="Personal information">
        <DetailGrid>
          <Detail label="Full name" value={personal.full_name} />
          <Detail label="Date of birth" value={formatDob(personal.date_of_birth)} />
          <Detail label="Sex" value={optLabel(options, 'sex', personal.sex)} />
          <Detail label="Nationality" value={countryName(personal.nationality)} />
          <Detail label="Phone number" value={personal.phone_number} />
        </DetailGrid>
      </Card>

      <Card icon={MapPin} title="Address">
        <DetailGrid>
          <Detail label="Address line 1" value={address.line1} />
          <Detail label="Address line 2" value={address.line2} />
          <Detail label="City" value={address.city} />
          <Detail label="State / Region" value={address.state} />
          <Detail label="Postal code" value={address.postal_code} />
          <Detail label="Country" value={countryName(address.country)} />
        </DetailGrid>
      </Card>

      <Card icon={Fingerprint} title="Identification">
        <DetailGrid>
          <Detail label="ID type" value={optLabel(options, 'id_types', id.id_type)} />
          <Detail label="ID number" value={id.id_number} mono />
        </DetailGrid>
        <p className="mt-4 flex items-start gap-2 text-xs text-slate-400">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-[#3DDC97]" aria-hidden="true" />
          <span>Your ID photos are stored privately and can only be viewed by our verification team.</span>
        </p>
      </Card>

      <Card icon={Briefcase} title="Employment and finances">
        <DetailGrid>
          <Detail label="Employment status" value={optLabel(options, 'employment_statuses', job.employment_status)} />
          <Detail label="Source of income" value={optLabel(options, 'sources_of_income', job.source_of_income)} />
          <Detail label="Occupation" value={job.occupation} />
          <Detail label="Employer" value={job.employer_name} />
          <Detail label="Annual income" value={optLabel(options, 'income_ranges', job.annual_income_range)} />
          <Detail
            label="Expected annual volume"
            value={optLabel(options, 'annual_volume_ranges', job.expected_annual_volume)}
          />
          <Detail
            label="Transaction frequency"
            value={optLabel(options, 'transaction_frequencies', job.transaction_frequency)}
          />
          <Detail
            label="Typical transaction size"
            value={optLabel(options, 'transaction_sizes', job.typical_transaction_size)}
          />
        </DetailGrid>
      </Card>

      <Card icon={ClipboardCheck} title="Consent">
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            ['Accuracy declaration', consent.accuracy_declaration],
            ['Privacy notice accepted', consent.privacy_notice_accepted],
            ['Terms accepted', consent.terms_accepted],
            ['Marketing emails', consent.marketing_consent],
          ].map(([label, ok]) => (
            <li key={label} className="flex items-center gap-2.5 text-sm text-slate-200">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                  ok ? 'bg-[#3DDC97]/[0.15] text-[#3DDC97]' : 'bg-white/[0.06] text-slate-400'
                }`}
              >
                {ok ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
              </span>
              {label}
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <DetailGrid>
            <Detail label="Policy version" value={consent.policy_version} mono />
            <Detail label="Consented on" value={formatDate(consent.consented_at)} />
          </DetailGrid>
        </div>
      </Card>
    </>
  )
}

/* ────────────────────────────────────────────────
   FORM FIELDS (read and write the shared form through context)
──────────────────────────────────────────────── */

const FormCtx = createContext(null)
const useFormCtx = () => useContext(FormCtx)

function FieldShell({ id, label, optional, error, hint, children }) {
  return (
    <div className="min-w-0">
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-400"
      >
        {label}
        {optional && <span className="ml-1.5 normal-case tracking-normal text-slate-500">(optional)</span>}
      </label>
      {children}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-1.5 flex items-start gap-1.5 text-xs text-red-300"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-[#F6465D]" aria-hidden="true" />
            <span className="min-w-0 break-words">{error}</span>
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            id={`${id}-hint`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-1.5 text-xs text-slate-500"
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

const describe = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined)

function TextField({ path, label, optional, hint, ...rest }) {
  const { form, setAt, errors } = useFormCtx()
  const id = idOf(path)
  const error = errors[path]
  return (
    <FieldShell id={id} label={label} optional={optional} error={error} hint={hint}>
      <input
        id={id}
        name={path}
        value={getAt(form, path) ?? ''}
        onChange={(e) => setAt(path, e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, error, hint)}
        className={inputCls(error)}
        {...rest}
      />
    </FieldShell>
  )
}

function SelectField({ path, label, optional, placeholder, items, autoComplete }) {
  const { form, setAt, errors } = useFormCtx()
  const id = idOf(path)
  const error = errors[path]
  const value = getAt(form, path) ?? ''
  const known = items.some((o) => o.value === value)
  return (
    <FieldShell id={id} label={label} optional={optional} error={error}>
      <div className="relative">
        <select
          id={id}
          name={path}
          value={value}
          onChange={(e) => setAt(path, e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe(id, error)}
          className={`${inputCls(error)} appearance-none pr-10`}
          style={{ colorScheme: 'dark' }}
        >
          <option value="">{placeholder}</option>
          {value && !known && <option value={value}>{value}</option>}
          {items.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>
    </FieldShell>
  )
}

function CountryField({ path, label }) {
  const items = useMemo(() => COUNTRIES.map((c) => ({ value: c.code, label: c.name })), [])
  return <SelectField path={path} label={label} placeholder="Select a country" items={items} autoComplete="country" />
}

function PickerField({ path, label, items, reduce }) {
  const { form, setAt, errors } = useFormCtx()
  const id = idOf(path)
  const error = errors[path]
  const value = getAt(form, path)
  return (
    <FieldShell id={id} label={label} error={error}>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, error)}
        className={`grid gap-1 rounded-xl bg-[#0E1822] p-1 ring-1 ${error ? 'ring-[#F6465D]/60' : 'ring-white/10'}`}
        style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
      >
        {items.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setAt(path, o.value)}
              className={`relative h-9 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
                on ? 'text-[#06231A]' : 'text-slate-300 hover:text-white'
              }`}
            >
              {on && (
                <motion.span
                  layoutId="kyc-sex-pill"
                  className="absolute inset-0 rounded-lg bg-[#3DDC97]"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}

function CheckField({ path, children, optional }) {
  const { form, setAt, errors } = useFormCtx()
  const id = idOf(path)
  const error = errors[path]
  const checked = Boolean(getAt(form, path))
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className={`flex cursor-pointer items-start gap-3 rounded-xl p-3.5 transition-colors focus-within:ring-2 focus-within:ring-[#3DDC97]/70 ${
          error ? 'bg-[#F6465D]/[0.08]' : checked ? 'bg-[#3DDC97]/[0.08]' : 'bg-white/[0.04] hover:bg-white/[0.06]'
        }`}
      >
        <input
          id={id}
          name={path}
          type="checkbox"
          checked={checked}
          onChange={(e) => setAt(path, e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe(id, error)}
          className="sr-only"
        />
        <span
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors ${
            checked ? 'bg-[#3DDC97] text-[#06231A]' : 'bg-[#0E1822] ring-1 ring-white/20'
          }`}
          aria-hidden="true"
        >
          <AnimatePresence initial={false}>
            {checked && (
              <motion.span
                key="tick"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Check className="h-3.5 w-3.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className="min-w-0 text-sm leading-relaxed text-slate-200">
          {children}
          {optional && <span className="ml-1.5 text-slate-500">(optional)</span>}
        </span>
      </label>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-1.5 flex items-start gap-1.5 text-xs text-red-300"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-[#F6465D]" aria-hidden="true" />
            <span className="min-w-0 break-words">{error}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ────────────────────────────────────────────────
   ID IMAGE CAPTURE / UPLOAD
──────────────────────────────────────────────── */

// Live camera for desktops and laptops (phones use the native camera through the file input)
function CameraModal({ title, maxBytes, onCapture, onClose, onUnavailable }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const v = videoRef.current
        if (v) {
          v.srcObject = stream
          await v.play().catch(() => {})
        }
        setReady(true)
      } catch (err) {
        if (!alive) return
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          setProblem('Camera access was blocked. Allow the camera in your browser settings, or upload a file instead.')
        } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
          setProblem('No camera was found on this device. Please upload a file instead.')
        } else {
          setProblem('We could not start the camera. Please upload a file instead.')
        }
      }
    })()

    return () => {
      alive = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const snap = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth || busy) return
    setBusy(true)

    try {
      const canvas = document.createElement('canvas')
      canvas.width = v.videoWidth
      canvas.height = v.videoHeight
      canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height)

      let blob = null
      for (const quality of [0.92, 0.82, 0.7, 0.55]) {
        // eslint-disable-next-line no-await-in-loop
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
        if (blob && blob.size <= maxBytes) break
      }

      if (!blob) {
        setProblem('We could not take the photo. Please try again.')
        return
      }

      onCapture(new File([blob], `id-photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Take a photo: ${title}`}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-[#14212D] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="relative aspect-[4/3] w-full bg-black">
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-contain" />
          {ready && (
            <div
              className="pointer-events-none absolute inset-[8%] rounded-xl border-2 border-dashed border-white/60"
              aria-hidden="true"
            />
          )}
          {!ready && !problem && (
            <div className="absolute inset-0 grid place-items-center text-slate-300">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="space-y-3 p-4">
          {problem ? (
            <div role="alert" className="rounded-xl bg-[#F6465D]/10 px-3.5 py-3 text-sm text-red-200">
              {problem}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Place your ID inside the frame. Make sure all four edges are visible and the text is sharp, without glare.
            </p>
          )}

          <div className="flex gap-2">
            {problem ? (
              <button type="button" onClick={onUnavailable} className={`${primaryBtn} flex-1`}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Upload a file
              </button>
            ) : (
              <button type="button" onClick={snap} disabled={!ready || busy} className={`${primaryBtn} flex-1`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
                Take photo
              </button>
            )}
            <button type="button" onClick={onClose} className={ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// `entry` is { file, url } and is owned by the form: the preview URL is created (and revoked)
// in the pick and remove handlers, so this component needs no effect for it.
// An empty url means the file cannot be previewed in the browser (HEIC).
function IdImageField({ field, label, entry, error, rules, onPick, onRemove }) {
  const id = idOf(field)
  const fileRef = useRef(null)
  const captureRef = useRef(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  const file = entry?.file || null
  const previewUrl = entry?.url || ''

  const onInputChange = (e) => {
    const picked = e.target.files?.[0]
    e.target.value = '' // lets the same file be chosen again
    if (picked) onPick(field, picked)
  }

  const takePhoto = () => {
    if (prefersNativeCamera() || !canUseLiveCamera()) {
      captureRef.current?.click()
    } else {
      setCameraOpen(true)
    }
  }

  const upload = () => fileRef.current?.click()

  return (
    <div className="min-w-0">
      <p id={`${id}-label`} className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>

      {/* Native pickers. The second one asks phones to open the camera directly. */}
      <input ref={fileRef} id={id} name={field} type="file" accept={rules.accept} onChange={onInputChange} className="sr-only" tabIndex={-1} />
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div
        tabIndex={-1}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, error)}
        aria-labelledby={`${id}-label`}
        className={`overflow-hidden rounded-xl bg-[#0E1822] ring-1 outline-none ${
          error ? 'ring-[#F6465D]/60' : file ? 'ring-[#3DDC97]/40' : 'ring-white/10'
        }`}
      >
        <div className="relative grid aspect-[1.6/1] w-full place-items-center bg-black/20">
          {file ? (
            previewUrl ? (
              <img src={previewUrl} alt={`${label} preview`} className="h-full w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 text-center text-slate-300">
                <ImageIcon className="h-8 w-8 text-slate-400" aria-hidden="true" />
                <p className="text-xs">HEIC photos cannot be previewed in the browser, but this one is ready to submit.</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] text-slate-400">
                <ImageIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm text-slate-300">No photo added yet</p>
              <p className="text-xs text-slate-500">
                {rules.label}, up to {rules.maxMb} MB
              </p>
            </div>
          )}

          {file && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[#3DDC97] px-2 py-0.5 text-[11px] font-semibold text-[#06231A]">
              <Check className="h-3 w-3" aria-hidden="true" />
              Added
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 p-2.5">
          <button type="button" onClick={takePhoto} className={smallBtn}>
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            {file ? 'Retake' : 'Take photo'}
          </button>
          <button type="button" onClick={upload} className={smallBtn}>
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {file ? 'Replace' : 'Upload image'}
          </button>
          {file && (
            <button
              type="button"
              onClick={() => onRemove(field)}
              aria-label={`Remove ${label}`}
              className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-[#F6465D]/10 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {file && (
          <p className="truncate border-t border-white/[0.06] px-3 py-2 text-[11px] text-slate-500">
            {file.name} · {formatSize(file.size)}
          </p>
        )}
      </div>

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-1.5 flex items-start gap-1.5 text-xs text-red-300"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-[#F6465D]" aria-hidden="true" />
            <span className="min-w-0 break-words">{error}</span>
          </motion.p>
        )}
      </AnimatePresence>

      {cameraOpen && (
        <CameraModal
          title={label}
          maxBytes={rules.maxMb * 1024 * 1024}
          onClose={() => setCameraOpen(false)}
          onCapture={(captured) => {
            setCameraOpen(false)
            onPick(field, captured)
          }}
          onUnavailable={() => {
            setCameraOpen(false)
            upload()
          }}
        />
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────
   THE FORM
──────────────────────────────────────────────── */

function KycForm({ options, previous, reduce, onSubmitted, onRefresh }) {
  const init = useRef({ options, previous })
  const [form, setForm] = useState(null)
  // Each entry is { file, url } where url is the object URL used for the preview
  const [files, setFiles] = useState({ id_front: null, id_back: null })
  const filesRef = useRef(files)
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [cooldown, setCooldown] = useState(0)

  const formRef = useRef(null)
  const bannerRef = useRef(null)
  const bannerId = useRef(0)

  const minAge = Number(options?.min_age) || 18
  const rules = useMemo(() => imageRules(options), [options])

  // Pre-fill from the profile (and the last submission when resubmitting)
  useEffect(() => {
    let alive = true
    api
      .get('/api/kyc/prefill/')
      .then((res) => res.data?.data || {})
      .catch(() => ({}))
      .then((prefill) => {
        if (alive) setForm(buildInitial(prefill, init.current.previous, init.current.options))
      })
    return () => {
      alive = false
    }
  }, [])

  // Release any preview URLs still held when the form goes away
  useEffect(
    () => () => {
      Object.values(filesRef.current).forEach((entry) => {
        if (entry?.url) URL.revokeObjectURL(entry.url)
      })
    },
    [],
  )

  // Counts down after a 429
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const showBanner = (tone, text, lines = []) => {
    bannerId.current += 1
    setBanner({ id: bannerId.current, tone, text, lines })
  }

  const reveal = () => {
    requestAnimationFrame(() => {
      const bad = formRef.current?.querySelector('[aria-invalid="true"]')
      const target = bad || bannerRef.current
      if (!target) return
      target.focus?.({ preventScroll: true })
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    })
  }

  const clearError = (key) =>
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })

  const setAt = (path, value) => {
    const [section, key] = path.split('.')
    setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }))
    clearError(path)
    // The employer error depends on the employment status
    if (path === 'employment.employment_status') clearError('employment.employer_name')
  }

  // Swaps an image and releases the preview URL of the one it replaces
  const commitImage = (key, next) => {
    const prev = filesRef.current[key]
    if (prev?.url) URL.revokeObjectURL(prev.url)
    const nextFiles = { ...filesRef.current, [key]: next }
    filesRef.current = nextFiles
    setFiles(nextFiles)
  }

  // Checks the file on the client first so the user does not waste an upload
  const pickImage = (key, file) => {
    const problem = imageProblem(file, rules)
    if (problem) {
      setErrors((prev) => ({ ...prev, [key]: problem }))
      return
    }
    commitImage(key, { file, url: isHeic(file) ? '' : URL.createObjectURL(file) })
    clearError(key)
  }

  const removeImage = (key) => commitImage(key, null)

  const progress = useMemo(() => {
    const images = IMAGE_KEYS.filter((k) => files[k]).length
    if (!form) return { done: images, total: TOTAL_REQUIRED }
    return { done: REQUIRED.filter(([p]) => isFilled(form, p)).length + images, total: TOTAL_REQUIRED }
  }, [form, files])

  const handleError = (err) => {
    const res = err?.response
    if (!res) {
      if (err?.code === 'ECONNABORTED') {
        showBanner('error', 'The upload took too long. Check your connection and try again.')
      } else {
        showBanner('error', 'Network error. Check your connection and try again.')
      }
      return
    }

    const { status, data } = res
    const code = data?.code
    const message = data?.message

    if (status === 400) {
      const { fields, general } = collectErrors(data?.errors)
      setErrors(fields)
      showBanner(
        'error',
        message || (Object.keys(fields).length ? 'Please correct the highlighted fields.' : 'We could not submit your KYC.'),
        general,
      )
      return
    }

    if (status === 401) {
      showBanner('error', 'Your session has expired. Please sign in again to continue.')
      return
    }

    if (status === 403) {
      showBanner(
        'warn',
        message ||
          (code === 'email_not_verified'
            ? 'Please verify your email address to continue.'
            : 'You cannot submit KYC right now.'),
      )
      // An attempt limit changes what the page should show
      if (code !== 'email_not_verified') onRefresh()
      return
    }

    if (status === 409) {
      if (code === 'kyc_already_pending' || code === 'kyc_already_approved' || data?.data?.kyc_status) {
        onRefresh(message || 'Your verification is already under review.')
        return
      }
      // Duplicate ID or another conflict
      if (/duplicate|id/i.test(code || '')) {
        setErrors({ 'identification.id_number': message || 'This ID has already been used.' })
      }
      showBanner('warn', message || 'This submission conflicts with an existing record.')
      return
    }

    // A JSON body was sent instead of multipart. This should never happen from this form.
    if (status === 415) {
      showBanner('error', 'Your request could not be read. Please refresh the page and try again.')
      return
    }

    if (status === 429) {
      const wait = Number(data?.data?.retry_after_seconds)
      if (Number.isFinite(wait) && wait > 0) setCooldown(Math.min(Math.ceil(wait), 300))
      showBanner('warn', message || 'Too many requests. Please wait a moment and try again.')
      return
    }

    // The image host failed. Nothing was saved, so the user can simply submit again.
    if (status === 502) {
      showBanner('warn', message || 'We could not upload your images. Nothing was saved, please press submit again.')
      return
    }

    if (status === 503) {
      showBanner('warn', message || 'Image uploads are temporarily unavailable. Please try again later.')
      return
    }

    showBanner('error', 'Something went wrong on our side. Please try again in a moment.')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (submitting || cooldown > 0 || !form) return

    const clientErrors = validate(form, files, minAge)
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      showBanner('error', 'Please correct the highlighted fields.')
      reveal()
      return
    }

    setSubmitting(true)
    setUploadPct(0)
    setBanner(null)
    setErrors({})

    try {
      const body = toKycFormData(buildPayload(form), files)
      // No Content-Type header here: the browser adds multipart/form-data with the boundary
      const res = await api.post('/api/kyc/submit/', body, {
        timeout: UPLOAD_TIMEOUT_MS,
        onUploadProgress: (ev) => {
          if (ev.total) setUploadPct(Math.min(100, Math.round((ev.loaded * 100) / ev.total)))
        },
      })
      onSubmitted(res.data?.data, res.data?.message || 'KYC submitted. We will review it and email you the outcome.')
    } catch (err) {
      handleError(err)
      reveal()
    } finally {
      setSubmitting(false)
    }
  }

  if (!form) {
    return (
      <div className="space-y-5" aria-hidden="true">
        <Block className="h-72" />
        <Block className="h-72" />
        <Block className="h-40" />
      </div>
    )
  }

  const sexItems = options?.sex || []
  const employerRequired = employerIsRequired(form)
  const imagesDone = IMAGE_KEYS.filter((k) => files[k]).length

  return (
    <FormCtx.Provider value={{ form, setAt, errors }}>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
        <Banner banner={banner} innerRef={bannerRef} />

        <fieldset disabled={submitting} className="min-w-0 space-y-5 border-0 p-0">
          {/* Personal */}
          <Card icon={User} title="Personal information" progress={sectionProgress(form, 'personal')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField
                  path="personal.full_name"
                  label="Full name"
                  autoComplete="name"
                  placeholder="As it appears on your ID"
                />
              </div>
              <TextField
                path="personal.date_of_birth"
                label="Date of birth"
                type="date"
                max={maxDob(minAge)}
                min="1900-01-01"
                autoComplete="bday"
                style={{ colorScheme: 'dark' }}
                hint={`You must be at least ${minAge} years old.`}
              />
              <PickerField path="personal.sex" label="Sex" items={sexItems} reduce={reduce} />
              <CountryField path="personal.nationality" label="Nationality" />
              <TextField
                path="personal.phone_number"
                label="Phone number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+234 801 234 5678"
                hint="Include the country code."
              />
            </div>
          </Card>

          {/* Address */}
          <Card icon={MapPin} title="Address" progress={sectionProgress(form, 'address')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField
                  path="address.line1"
                  label="Address line 1"
                  autoComplete="address-line1"
                  placeholder="Street address"
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  path="address.line2"
                  label="Address line 2"
                  optional
                  autoComplete="address-line2"
                  placeholder="Apartment, suite, unit"
                />
              </div>
              <TextField path="address.city" label="City" autoComplete="address-level2" />
              <TextField path="address.state" label="State / Region" optional autoComplete="address-level1" />
              <TextField path="address.postal_code" label="Postal code" optional autoComplete="postal-code" />
              <CountryField path="address.country" label="Country" />
            </div>
          </Card>

          {/* Identification */}
          <Card icon={Fingerprint} title="Identification" progress={sectionProgress(form, 'identification')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                path="identification.id_type"
                label="ID type"
                placeholder="Select an ID type"
                items={options?.id_types || []}
              />
              <TextField
                path="identification.id_number"
                label="ID number"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="As shown on the document"
                hint="Only the last four characters are shown after you submit."
              />
            </div>
          </Card>

          {/* ID photos */}
          <Card icon={Camera} title="ID photos" progress={{ done: imagesDone, total: IMAGE_KEYS.length }}>
            <p className="mb-4 text-sm leading-relaxed text-slate-300">
              Take a photo or upload an image of the front and back of the government ID you selected above. For a
              passport, add the photo page again or the back cover.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {IMAGE_KEYS.map((key) => (
                <IdImageField
                  key={key}
                  field={key}
                  label={IMAGE_LABELS[key]}
                  entry={files[key]}
                  error={errors[key]}
                  rules={rules}
                  onPick={pickImage}
                  onRemove={removeImage}
                />
              ))}
            </div>

            <ul className="mt-4 space-y-1.5 rounded-xl bg-white/[0.04] px-3.5 py-3 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <Info className="mt-px h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden="true" />
                <span>Use a well lit place, avoid glare and make sure no edges are cropped. All text must be readable.</span>
              </li>
              <li className="flex items-start gap-2">
                <Info className="mt-px h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden="true" />
                <span>The photos are locked once submitted. If a submission is declined, you will add a new set.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-[#3DDC97]" aria-hidden="true" />
                <span>Your photos are stored privately and are only visible to our verification team.</span>
              </li>
            </ul>
          </Card>

          {/* Employment */}
          <Card icon={Briefcase} title="Employment and finances" progress={sectionProgress(form, 'employment')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                path="employment.employment_status"
                label="Employment status"
                placeholder="Select a status"
                items={options?.employment_statuses || []}
              />
              <SelectField
                path="employment.source_of_income"
                label="Source of income"
                placeholder="Select a source"
                items={options?.sources_of_income || []}
              />
              <TextField path="employment.occupation" label="Occupation" autoComplete="organization-title" />
              <TextField
                path="employment.employer_name"
                label="Employer"
                optional={!employerRequired}
                autoComplete="organization"
                hint={employerRequired ? undefined : 'Required if you are employed or self-employed.'}
              />
              <SelectField
                path="employment.annual_income_range"
                label="Annual income"
                placeholder="Select a range"
                items={options?.income_ranges || []}
              />
              <SelectField
                path="employment.expected_annual_volume"
                label="Expected annual volume"
                placeholder="Select a range"
                items={options?.annual_volume_ranges || []}
              />
              <SelectField
                path="employment.transaction_frequency"
                label="Trade frequency"
                placeholder="Select how often"
                items={options?.transaction_frequencies || []}
              />
              <SelectField
                path="employment.typical_transaction_size"
                label="Typical trade size"
                placeholder="Select a size"
                items={options?.transaction_sizes || []}
              />
            </div>
          </Card>

          {/* Consent */}
          <Card icon={ClipboardCheck} title="Consent" progress={sectionProgress(form, 'consent')}>
            <div className="space-y-3">
              <CheckField path="consent.accuracy_declaration">
                I confirm that the information I have provided is true and accurate.
              </CheckField>
              <CheckField path="consent.privacy_notice_accepted">
                I have read and accept the{' '}
                <Link
                  to="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#3DDC97] underline underline-offset-2 hover:text-[#5BEBAD]"
                >
                  Privacy Policy
                </Link>
                .
              </CheckField>
              <CheckField path="consent.terms_accepted">
                I agree to the{' '}
                <Link
                  to="/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#3DDC97] underline underline-offset-2 hover:text-[#5BEBAD]"
                >
                  Terms of Service
                </Link>
                .
              </CheckField>
              <CheckField path="consent.marketing_consent" optional>
                I would like to receive product updates and offers by email.
              </CheckField>
            </div>
            {options?.policy_version && (
              <p className="mt-4 text-xs text-slate-500">
                Policy version <span className="font-mono text-slate-400">{options.policy_version}</span>
              </p>
            )}
          </Card>
        </fieldset>

        {/* Submit bar */}
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-white/10 bg-[#0E1822]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:bottom-4 sm:mx-0 sm:rounded-2xl sm:border-0 sm:bg-[#14212D] sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className="text-xs text-slate-400">
                {submitting ? (
                  uploadPct >= 100 ? (
                    'Upload complete. Finishing up, please keep this page open.'
                  ) : (
                    'Uploading your documents, please keep this page open.'
                  )
                ) : (
                  <>
                    Required fields:{' '}
                    <span className="font-mono text-slate-200">
                      {progress.done} of {progress.total}
                    </span>
                  </>
                )}
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full rounded-full bg-[#3DDC97]"
                  initial={false}
                  animate={{
                    width: submitting ? `${Math.max(uploadPct, 4)}%` : `${(progress.done / progress.total) * 100}%`,
                  }}
                  transition={{ duration: reduce ? 0 : 0.35, ease: 'easeOut' }}
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={submitting || cooldown > 0}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              className={`${primaryBtn} w-full shrink-0 sm:w-auto sm:px-7`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {uploadPct >= 100 ? 'Processing…' : uploadPct > 0 ? `Uploading ${uploadPct}%` : 'Submitting…'}
                </>
              ) : cooldown > 0 ? (
                `Try again in ${cooldown}s`
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Submit for review
                </>
              )}
            </motion.button>
          </div>
        </div>
      </form>
    </FormCtx.Provider>
  )
}

/* ────────────────────────────────────────────────
   HISTORY PANEL
──────────────────────────────────────────────── */

function HistoryPanel({ onClose, reduce }) {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [moreError, setMoreError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    api
      .get('/api/kyc/history/', { params: { page: 1, page_size: HISTORY_PAGE_SIZE } })
      .then((res) => {
        if (!alive) return
        const data = res.data?.data
        setItems(data?.results || [])
        setHasNext(Boolean(data?.next))
        setPage(1)
      })
      .catch((err) => {
        if (!alive) return
        setError(err?.response ? 'We could not load your history.' : 'Network error. Check your connection and try again.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [attempt])

  const retry = () => {
    setError('')
    setLoading(true)
    setAttempt((a) => a + 1)
  }

  const loadMore = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    setMoreError('')
    try {
      const nextPage = page + 1
      const res = await api.get('/api/kyc/history/', { params: { page: nextPage, page_size: HISTORY_PAGE_SIZE } })
      const data = res.data?.data
      setItems((prev) => [...prev, ...(data?.results || [])])
      setHasNext(Boolean(data?.next))
      setPage(nextPage)
    } catch {
      setMoreError('We could not load more. Please try again.')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <motion.section
      aria-label="Submission history"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="rounded-2xl bg-[#14212D] p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-base font-semibold text-white">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[#3DDC97]">
            <HistoryIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          Submission history
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close history"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-24 animate-pulse rounded-xl bg-white/[0.05]" />
          <div className="h-24 animate-pulse rounded-xl bg-white/[0.05]" />
        </div>
      ) : error ? (
        <InlineError message={error} onRetry={retry} />
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-white/[0.04] px-3.5 py-3 text-sm text-slate-400">
          You have not made any submissions yet.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((entry, i) => (
              <motion.li
                key={entry.id}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.05 }}
                className="rounded-xl bg-white/[0.04] p-3.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Attempt #{entry.attempt_number}</p>
                  <StatusPill status={entry.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Detail label="Submitted" value={formatDate(entry.submitted_at)} />
                  <Detail
                    label="Reviewed"
                    value={formatDate(entry.reviewed_at) || (entry.status === 'pending' ? 'Awaiting review' : '')}
                  />
                </dl>
                {entry.rejection_reason && (
                  <p className="mt-3 break-words rounded-lg bg-[#F6465D]/10 px-3 py-2 text-xs text-red-200">
                    Reason: {entry.rejection_reason}
                  </p>
                )}
              </motion.li>
            ))}
          </ul>

          {moreError && (
            <div className="mt-3">
              <InlineError message={moreError} onRetry={loadMore} />
            </div>
          )}

          {hasNext && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className={`${ghostBtn} mt-4 w-full disabled:opacity-60`}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading…
                </>
              ) : (
                'Load more'
              )}
            </button>
          )}
        </>
      )}
    </motion.section>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function Kyc() {
  const reduce = useReducedMotion()

  const [phase, setPhase] = useState('loading') // loading | ready | error
  const [loadErr, setLoadErr] = useState('')
  const [attempt, setAttempt] = useState(0)

  const [status, setStatus] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [options, setOptions] = useState(null)

  const [note, setNote] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const noteId = useRef(0)
  const historyRef = useRef(null)

  // Status first, then the latest submission and the dropdown options
  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const [statusRes, optionsRes] = await Promise.allSettled([
          api.get('/api/kyc/status/'),
          api.get('/api/kyc/options/'),
        ])

        if (statusRes.status === 'rejected') throw statusRes.reason
        const st = statusRes.value.data?.data

        let sub = null
        if (st && st.kyc_status && st.kyc_status !== 'not_submitted') {
          try {
            const res = await api.get('/api/kyc/submission/')
            sub = res.data?.data ?? null
          } catch {
            sub = null // 404 or a failure here is not fatal, the status card still works
          }
        }

        if (!alive) return
        setStatus(st || null)
        setSubmission(sub)
        setOptions(optionsRes.status === 'fulfilled' ? optionsRes.value.data?.data || null : null)
        setPhase('ready')
      } catch (err) {
        if (!alive) return
        setLoadErr(err?.response ? 'We could not load your KYC status.' : 'Network error. Check your connection and try again.')
        setPhase('error')
      }
    })()

    return () => {
      alive = false
    }
  }, [attempt])

  const retry = () => {
    setLoadErr('')
    setPhase('loading')
    setAttempt((a) => a + 1)
  }

  const showNote = (tone, text) => {
    noteId.current += 1
    setNote({ id: noteId.current, tone, text, onDismiss: () => setNote(null) })
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  // After a successful submit: show pending right away, then confirm with fresh data
  const handleSubmitted = (data, message) => {
    setStatus((s) => ({
      ...(s || {}),
      kyc_status: data?.status || 'pending',
      can_submit: false,
      attempts_used: typeof s?.attempts_used === 'number' ? s.attempts_used + 1 : s?.attempts_used,
      attempts_remaining:
        typeof s?.attempts_remaining === 'number' ? Math.max(s.attempts_remaining - 1, 0) : s?.attempts_remaining,
      latest_submission: data || s?.latest_submission,
    }))
    setSubmission(null)
    showNote('success', message)
    setAttempt((a) => a + 1)
  }

  // After a 403 or 409 that changes what the page should show
  const handleRefresh = (message) => {
    if (message) showNote('info', message)
    setAttempt((a) => a + 1)
  }

  const toggleHistory = () => {
    setHistoryOpen((open) => {
      const next = !open
      if (next) {
        requestAnimationFrame(() =>
          historyRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }),
        )
      }
      return next
    })
  }

  if (phase === 'loading') {
    return (
      <div className="mx-auto max-w-3xl space-y-5" aria-hidden="true">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-64 animate-pulse rounded bg-white/[0.06]" />
        </div>
        <Block className="h-44" />
        <Block className="h-64" />
        <Block className="h-48" />
      </div>
    )
  }

  if (phase === 'error' || !status) {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <InlineError message={loadErr || 'We could not load your KYC status.'} onRetry={retry} />
      </div>
    )
  }

  const st = status.kyc_status || 'not_submitted'
  const canSubmit = (st === 'not_submitted' || st === 'rejected') && status.can_submit !== false
  const showDetails = (st === 'approved' || st === 'pending') && submission

  return (
    <div>
      <motion.div
        className="mx-auto max-w-3xl space-y-5"
        variants={container}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >

        <Banner banner={note} />

        <StatusCard status={status} st={st} submission={submission} canSubmit={canSubmit} reduce={reduce} />

        {showDetails && <SubmissionDetails sub={submission} options={options} />}

        {canSubmit &&
          (options ? (
            <KycForm
              options={options}
              previous={st === 'rejected' ? submission : null}
              reduce={reduce}
              onSubmitted={handleSubmitted}
              onRefresh={handleRefresh}
            />
          ) : (
            <InlineError message="We could not load the form options." onRetry={retry} />
          ))}

        {/* Bottom actions */}
        <motion.div variants={item} className="grid gap-3 sm:grid-cols-2">
          <Link to={DASHBOARD_URL} className={ghostBtn}>
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Back to dashboard
          </Link>
          <button
            type="button"
            onClick={toggleHistory}
            aria-expanded={historyOpen}
            className={`${ghostBtn} ${historyOpen ? 'border-[#3DDC97]/50 text-white' : ''}`}
          >
            <HistoryIcon className="h-4 w-4" aria-hidden="true" />
            {historyOpen ? 'Hide submission history' : 'View submission history'}
          </button>
        </motion.div>

        <div ref={historyRef} className="scroll-mt-20">
          <AnimatePresence>
            {historyOpen && <HistoryPanel key="history" onClose={() => setHistoryOpen(false)} reduce={reduce} />}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}