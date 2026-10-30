// src/pages/inside/EditProfile.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Save,
  Trash2,
  Upload,
  User,
} from 'lucide-react'
import api from '../../components/Api'

/* ────────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────────── */

const PROFILE_URL = '/dashboard/profile'

const PERSONAL_KEYS = ['full_name', 'date_of_birth', 'sex', 'nationality', 'phone_number']
const ADDRESS_KEYS = ['line1', 'line2', 'city', 'state', 'postal_code', 'country']
const FORM_KEYS = [...PERSONAL_KEYS, ...ADDRESS_KEYS]

const LABELS = {
  full_name: 'Full name',
  date_of_birth: 'Date of birth',
  sex: 'Sex',
  nationality: 'Nationality',
  phone_number: 'Phone number',
  line1: 'Address line 1',
  city: 'City',
  country: 'Country',
}

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

const PHONE_RE = /^\+?[0-9][0-9\s-]{6,19}$/

// Profile picture rules (the server checks the real file content again)
const PHOTO_MAX_MB = 5
const PHOTO_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
const PHOTO_ACCEPT = 'image/*,.heic,.heif'
const PHOTO_UPLOAD_TIMEOUT_MS = 60000

// Other parts of the app (for example the dashboard header) can listen for this
// event to refresh the picture without reloading. detail.url is the new avatar_url or null.
const AVATAR_EVENT = 'avatar-updated'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

const TONES = {
  error: { box: 'bg-[#F6465D]/10 text-red-200', icon: 'text-[#F6465D]', Icon: AlertCircle },
  warn: { box: 'bg-amber-400/10 text-amber-200', icon: 'text-amber-300', Icon: AlertCircle },
  success: { box: 'bg-[#3DDC97]/[0.12] text-[#B8F5DA]', icon: 'text-[#3DDC97]', Icon: CheckCircle2 },
  info: { box: 'bg-sky-400/10 text-sky-200', icon: 'text-sky-300', Icon: Info },
}

// ISO 3166-1 alpha-2 codes. Country names come from the browser's own Intl data.
const COUNTRY_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  )

const COUNTRIES = (() => {
  let names = null
  try {
    names = new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    names = null
  }
  return COUNTRY_CODES.map((code) => ({ code, name: names?.of(code) || code })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
})()

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────── */

const humanize = (v) => (v ? String(v).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '')

const toForm = (p) => {
  const a = p?.address || {}
  return {
    full_name: p?.full_name || '',
    date_of_birth: p?.date_of_birth || '',
    sex: p?.sex || '',
    nationality: p?.nationality || '',
    phone_number: p?.phone_number || '',
    line1: a.line1 || '',
    line2: a.line2 || '',
    city: a.city || '',
    state: a.state || '',
    postal_code: a.postal_code || '',
    country: a.country || '',
  }
}

const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))

// Only changed, editable fields are sent. If anything in the address changed, the whole
// address goes along so the server never sees a half-filled one.
function buildPayload(form, base, locked) {
  const f = clean(form)
  const b = clean(base)
  const payload = {}
  PERSONAL_KEYS.forEach((k) => {
    if (!locked.has(k) && f[k] !== b[k]) payload[k] = f[k]
  })
  if (ADDRESS_KEYS.some((k) => f[k] !== b[k])) {
    payload.address = Object.fromEntries(ADDRESS_KEYS.map((k) => [k, f[k]]))
  }
  return payload
}

function dobProblem(dob) {
  const [y, m, d] = String(dob).split('-').map(Number)
  if (!y || !m || !d) return 'Enter a valid date of birth.'
  const t = new Date()
  let age = t.getFullYear() - y
  const monthNow = t.getMonth() + 1
  if (monthNow < m || (monthNow === m && t.getDate() < d)) age -= 1
  if (age < 0) return 'Date of birth cannot be in the future.'
  if (age < 18) return 'You must be at least 18 years old.'
  return ''
}

function validate(form, base, locked) {
  const f = clean(form)
  const b = clean(base)
  const errs = {}

  PERSONAL_KEYS.forEach((k) => {
    if (locked.has(k)) return
    if (f[k] !== b[k] && !f[k]) errs[k] = `${LABELS[k]} is required.`
  })

  if (!locked.has('date_of_birth') && f.date_of_birth && f.date_of_birth !== b.date_of_birth) {
    const problem = dobProblem(f.date_of_birth)
    if (problem) errs.date_of_birth = problem
  }

  if (f.phone_number && f.phone_number !== b.phone_number && !PHONE_RE.test(f.phone_number)) {
    errs.phone_number = 'Enter a valid phone number, for example +2348012345678.'
  }

  if (ADDRESS_KEYS.some((k) => f[k] !== b[k])) {
    ;['line1', 'city', 'country'].forEach((k) => {
      if (!f[k]) errs[k] = `${LABELS[k]} is required.`
    })
  }

  return errs
}

const flatten = (v) => {
  if (v == null) return []
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(flatten)
  if (typeof v === 'object') return Object.values(v).flatMap(flatten)
  return [String(v)]
}

// Turns the API "errors" object into per-field messages plus anything general
function mapServerErrors(errors) {
  const fields = {}
  const general = []

  Object.entries(errors || {}).forEach(([key, val]) => {
    const msgs = flatten(val)
    if (!msgs.length) return

    if (key === 'address' && val && typeof val === 'object' && !Array.isArray(val)) {
      Object.entries(val).forEach(([k, v]) => {
        const m = flatten(v)
        if (ADDRESS_KEYS.includes(k)) fields[k] = m[0]
        else general.push(...m)
      })
    } else if (key.startsWith('address.') || key.startsWith('address_')) {
      const k = key.replace(/^address[._]/, '')
      if (ADDRESS_KEYS.includes(k)) fields[k] = msgs[0]
      else general.push(...msgs)
    } else if (key === 'address') {
      fields.address = msgs[0]
    } else if (FORM_KEYS.includes(key)) {
      fields[key] = msgs[0]
    } else {
      general.push(...msgs)
    }
  })

  return { fields, general }
}

const maxDob = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const inputCls = (error, muted) =>
  `h-11 w-full rounded-xl px-3.5 text-base outline-none transition sm:text-sm ${
    muted
      ? 'cursor-not-allowed bg-white/[0.03] text-slate-400 ring-1 ring-white/[0.06]'
      : `bg-[#0E1822] text-white placeholder:text-slate-500 ring-1 focus:ring-2 ${
          error ? 'ring-[#F6465D]/60 focus:ring-[#F6465D]' : 'ring-white/10 focus:ring-[#3DDC97]/70'
        }`
  }`

/* ── Profile picture helpers ───────────────────── */

const extOf = (name) => {
  const m = /\.([a-z0-9]+)$/i.exec(name || '')
  return m ? m[1].toLowerCase() : ''
}

const isHeic = (file) => {
  const ext = extOf(file?.name)
  const type = String(file?.type || '').toLowerCase()
  return ext === 'heic' || ext === 'heif' || type === 'image/heic' || type === 'image/heif'
}

const formatSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Checked in the browser first so the user does not waste an upload
function photoProblem(file) {
  const typeOk =
    PHOTO_EXTS.includes(extOf(file.name)) || /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type || '')
  if (!typeOk) return 'Unsupported file type. Use a JPG, PNG, WEBP or HEIC image.'
  if (file.size === 0) return 'This file is empty. Please choose another image.'
  if (file.size > PHOTO_MAX_MB * 1024 * 1024) {
    return `The image is too large. The maximum size is ${PHOTO_MAX_MB} MB.`
  }
  return ''
}

/* ────────────────────────────────────────────────
   FORM PIECES
──────────────────────────────────────────────── */

function Field({ id, label, error, hint, locked = false, children }) {
  return (
    <div className="min-w-0">
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400"
      >
        {label}
        {locked && (
          <>
            <Lock className="h-3 w-3 text-slate-500" aria-hidden="true" />
            <span className="sr-only">(locked)</span>
          </>
        )}
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

const describedBy = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined)

function TextInput({ id, label, value, onChange, error, hint, locked = false, muted = false, ...rest }) {
  return (
    <Field id={id} label={label} error={error} hint={hint} locked={locked}>
      <input
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        disabled={locked}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={inputCls(error, locked || muted)}
        {...rest}
      />
    </Field>
  )
}

function SelectInput({ id, label, value, onChange, error, locked = false, placeholder, children, ...rest }) {
  return (
    <Field id={id} label={label} error={error} locked={locked}>
      <div className="relative">
        <select
          id={id}
          name={id}
          value={value}
          onChange={onChange}
          disabled={locked}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error)}
          className={`${inputCls(error, locked)} appearance-none pr-10`}
          style={{ colorScheme: 'dark' }}
          {...rest}
        >
          <option value="">{placeholder}</option>
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>
    </Field>
  )
}

function CountrySelect({ id, label, value, onChange, error, locked }) {
  const known = COUNTRIES.some((c) => c.code === value)
  return (
    <SelectInput
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      locked={locked}
      placeholder="Select a country"
      autoComplete="country"
    >
      {value && !known && <option value={value}>{value}</option>}
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </SelectInput>
  )
}

function SexPicker({ value, onChange, locked, error, reduce }) {
  const options =
    !value || SEX_OPTIONS.some((o) => o.value === value)
      ? SEX_OPTIONS
      : [...SEX_OPTIONS, { value, label: humanize(value) }]

  return (
    <Field id="sex" label="Sex" error={error} locked={locked}>
      <div
        role="radiogroup"
        aria-labelledby="sex-label"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy('sex', error)}
        className={`grid gap-1 rounded-xl bg-[#0E1822] p-1 ring-1 ${
          error ? 'ring-[#F6465D]/60' : 'ring-white/10'
        } ${locked ? 'opacity-60' : ''}`}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={locked}
              onClick={() => onChange(o.value)}
              className={`relative h-9 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
                on ? 'text-[#06231A]' : 'text-slate-300 hover:text-white'
              } ${locked ? 'cursor-not-allowed' : ''}`}
            >
              {on && (
                <motion.span
                  layoutId="sex-pill"
                  className="absolute inset-0 rounded-lg bg-[#3DDC97]"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          )
        })}
      </div>
    </Field>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <motion.section variants={item} className="rounded-2xl bg-[#14212D] p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2.5 text-base font-semibold text-white">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[#3DDC97]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {title}
      </h2>
      {children}
    </motion.section>
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
        </motion.div>
      )}
    </AnimatePresence>
  )
}

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

function Block({ className }) {
  return <div className={`animate-pulse rounded-2xl bg-[#14212D] ${className}`} />
}

/* ── Profile picture pieces ────────────────────── */

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

// Shows the picture, or the unisex icon when there is none (or it fails to load)
function PhotoPreview({ url }) {
  const [failedUrl, setFailedUrl] = useState(null)

  if (!url || failedUrl === url) return <ProfileIcon />

  return (
    <img
      src={url}
      alt="Profile picture"
      className="h-full w-full object-cover"
      draggable="false"
      decoding="async"
      onError={() => setFailedUrl(url)}
    />
  )
}

const photoBtn =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 disabled:cursor-not-allowed disabled:opacity-60'

function PhotoSection({
  avatarUrl,
  pending,
  busy,
  disabled,
  cooldown,
  confirmRemove,
  note,
  onPick,
  onUpload,
  onCancelPending,
  onAskRemove,
  onCancelRemove,
  onRemove,
}) {
  const fileRef = useRef(null)

  const locked = Boolean(busy) || disabled
  const heicPending = Boolean(pending) && !pending.url
  const shownUrl = pending ? pending.url : avatarUrl
  const hasPicture = Boolean(avatarUrl)
  const tone = note ? TONES[note.tone] : null

  const handleChange = (e) => {
    const picked = e.target.files?.[0]
    e.target.value = '' // lets the same file be chosen again
    if (picked) onPick(picked)
  }

  return (
    <Section icon={Camera} title="Profile picture">
      <input
        ref={fileRef}
        id="profile_photo"
        name="profile_photo"
        type="file"
        accept={PHOTO_ACCEPT}
        onChange={handleChange}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a profile picture"
      />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative h-24 w-24 shrink-0 self-start overflow-hidden rounded-full ring-2 ring-white/10 sm:self-center">
          {heicPending ? (
            <div className="grid h-full w-full place-items-center bg-[#1D3042] px-2 text-center text-[10px] leading-tight text-slate-300">
              HEIC photo ready
            </div>
          ) : (
            <PhotoPreview key={shownUrl || 'none'} url={shownUrl} />
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-black/55">
              <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {pending ? (
            <>
              <p className="text-sm font-medium text-white">Preview: not saved yet</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {pending.file.name} · {formatSize(pending.file.size)}
              </p>
              {heicPending && (
                <p className="mt-1 text-xs text-slate-500">
                  HEIC photos cannot be previewed in the browser, but this one can still be saved.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-white">
                {hasPicture ? 'Your profile picture' : 'No profile picture yet'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {hasPicture
                  ? 'Choose a new photo to replace it, or remove it.'
                  : 'Add a photo and it will show in your dashboard header.'}
              </p>
            </>
          )}

          <p className="mt-1.5 text-xs text-slate-500">
            JPG, PNG, WEBP or HEIC, up to {PHOTO_MAX_MB} MB. It is cropped to a square around your face and stored
            publicly.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {pending ? (
              <>
                <button
                  type="button"
                  onClick={onUpload}
                  disabled={locked || cooldown > 0}
                  className={`${photoBtn} bg-[#3DDC97] font-semibold text-[#06140E] hover:bg-[#5BEBAD]`}
                >
                  {busy === 'upload' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Uploading…
                    </>
                  ) : cooldown > 0 ? (
                    `Try again in ${cooldown}s`
                  ) : (
                    <>
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      Save photo
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={locked}
                  className={`${photoBtn} border border-white/15 text-slate-200 hover:border-white/30 hover:text-white`}
                >
                  Choose another
                </button>
                <button
                  type="button"
                  onClick={onCancelPending}
                  disabled={locked}
                  className={`${photoBtn} text-slate-400 hover:text-white`}
                >
                  Cancel
                </button>
              </>
            ) : confirmRemove ? (
              <>
                <p className="w-full text-sm text-slate-200">Remove your profile picture?</p>
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={locked}
                  className={`${photoBtn} bg-rose-500 font-semibold text-white hover:bg-rose-400`}
                >
                  {busy === 'remove' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Removing…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Yes, remove
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onCancelRemove}
                  disabled={locked}
                  className={`${photoBtn} border border-white/15 text-slate-200 hover:border-white/30 hover:text-white`}
                >
                  Keep it
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={locked}
                  className={`${photoBtn} bg-white/[0.07] text-slate-100 hover:bg-white/[0.12]`}
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  {hasPicture ? 'Change photo' : 'Add photo'}
                </button>
                {hasPicture && (
                  <button
                    type="button"
                    onClick={onAskRemove}
                    disabled={locked}
                    className={`${photoBtn} text-slate-400 hover:bg-[#F6465D]/10 hover:text-red-300`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {note && (
          <motion.div
            key={note.id}
            role={note.tone === 'error' || note.tone === 'warn' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ${tone.box}`}
          >
            <tone.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.icon}`} aria-hidden="true" />
            <p className="min-w-0 flex-1 break-words">{note.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  )
}

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function EditProfile() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [attempt, setAttempt] = useState(0)

  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Profile picture. A chosen file waits as { file, url } until the user saves it.
  const [pending, setPending] = useState(null)
  const [photoBusy, setPhotoBusy] = useState('') // '' | 'upload' | 'remove'
  const [photoNote, setPhotoNote] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [photoCooldown, setPhotoCooldown] = useState(0)

  const formRef = useRef(null)
  const bannerRef = useRef(null)
  const timerRef = useRef(null)
  const bannerId = useRef(0)
  const pendingRef = useRef(null)
  const noteId = useRef(0)

  // Load the current profile to pre-fill the form
  useEffect(() => {
    let alive = true
    api
      .get('/api/profile/')
      .then((res) => {
        const data = res.data?.data
        if (!alive || !data) return
        setProfile(data)
        setForm(toForm(data))
      })
      .catch((err) => {
        if (!alive) return
        setLoadErr(
          err?.response ? 'We could not load your profile.' : 'Network error. Check your connection and try again.',
        )
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [attempt])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  // Release the preview URL still held when the page goes away
  useEffect(
    () => () => {
      if (pendingRef.current?.url) URL.revokeObjectURL(pendingRef.current.url)
    },
    [],
  )

  // Counts down after a 429 on the picture upload
  useEffect(() => {
    if (photoCooldown <= 0) return undefined
    const id = setTimeout(() => setPhotoCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [photoCooldown])

  const base = useMemo(() => (profile ? toForm(profile) : null), [profile])
  const locked = useMemo(() => new Set(profile?.locked_fields || []), [profile])
  const dirty = Boolean(form && base) && Object.keys(buildPayload(form, base, locked)).length > 0
  const hasPendingPhoto = Boolean(pending)

  // Warn before a refresh or tab close while there are unsaved edits or an unsaved picture
  useEffect(() => {
    if (!dirty && !hasPendingPhoto) return undefined
    const onUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty, hasPendingPhoto])

  const retryLoad = () => {
    setLoadErr('')
    setLoading(true)
    setAttempt((a) => a + 1)
  }

  const showBanner = (tone, text, lines = []) => {
    bannerId.current += 1
    setBanner({ id: bannerId.current, tone, text, lines })
  }

  // Bring the first problem (or the banner) into view
  const reveal = () => {
    requestAnimationFrame(() => {
      const bad = formRef.current?.querySelector('[aria-invalid="true"]')
      const target = bad || bannerRef.current
      if (!target) return
      target.focus?.({ preventScroll: true })
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    })
  }

  const setField = (key) => (valueOrEvent) => {
    const value = valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /* ── Profile picture handlers ── */

  const showPhotoNote = (tone, text) => {
    noteId.current += 1
    setPhotoNote({ id: noteId.current, tone, text })
  }

  // Swaps the chosen file and releases the preview URL of the one it replaces
  const commitPending = (next) => {
    if (pendingRef.current?.url) URL.revokeObjectURL(pendingRef.current.url)
    pendingRef.current = next
    setPending(next)
  }

  // Only the picture changes here: the form fields keep any edits the user has not saved yet
  const applyAvatar = (url) => {
    setProfile((p) => (p ? { ...p, avatar_url: url } : p))
    try {
      window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { url } }))
    } catch {
      /* not critical */
    }
  }

  const pickPhoto = (file) => {
    const problem = photoProblem(file)
    if (problem) {
      showPhotoNote('error', problem)
      return
    }
    commitPending({ file, url: isHeic(file) ? '' : URL.createObjectURL(file) })
    setConfirmRemove(false)
    setPhotoNote(null)
  }

  const cancelPending = () => {
    commitPending(null)
    setPhotoNote(null)
  }

  const handlePhotoError = (err) => {
    const res = err?.response
    if (!res) {
      showPhotoNote(
        'error',
        err?.code === 'ECONNABORTED'
          ? 'The upload took too long. Check your connection and try again.'
          : 'Network error. Check your connection and try again.',
      )
      return
    }

    const { status, data } = res
    const message = data?.message

    if (status === 400) {
      const fieldMsg = flatten(data?.errors?.profile_photo)[0]
      showPhotoNote('error', fieldMsg || message || 'We could not use this image. Please try another one.')
      return
    }
    if (status === 401) {
      showPhotoNote('error', 'Your session has expired. Please sign in again to continue.')
      return
    }
    if (status === 415) {
      showPhotoNote('error', 'Your request could not be read. Please refresh the page and try again.')
      return
    }
    if (status === 429) {
      const wait = Number(data?.data?.retry_after_seconds)
      if (Number.isFinite(wait) && wait > 0) setPhotoCooldown(Math.min(Math.ceil(wait), 300))
      showPhotoNote('warn', message || 'Too many requests. Please wait a moment and try again.')
      return
    }
    // The image host failed. Nothing changed and the old picture is kept.
    if (status === 502) {
      showPhotoNote('warn', message || 'We could not upload your image. Your current picture is unchanged, please try again.')
      return
    }
    if (status === 503) {
      showPhotoNote('warn', message || 'Image uploads are temporarily unavailable. Please try again later.')
      return
    }
    showPhotoNote('error', 'Something went wrong on our side. Please try again in a moment.')
  }

  const uploadPhoto = async () => {
    if (!pending || photoBusy || photoCooldown > 0) return
    setPhotoBusy('upload')
    setPhotoNote(null)

    try {
      const fd = new FormData()
      fd.append('profile_photo', pending.file, pending.file.name)
      // No Content-Type header here: the browser adds multipart/form-data with the boundary
      const res = await api.post('/api/profile/photo/', fd, { timeout: PHOTO_UPLOAD_TIMEOUT_MS })
      applyAvatar(res.data?.data?.avatar_url ?? null)
      commitPending(null)
      showPhotoNote('success', res.data?.message || 'Profile picture updated.')
    } catch (err) {
      handlePhotoError(err)
    } finally {
      setPhotoBusy('')
    }
  }

  const removePhoto = async () => {
    if (photoBusy) return
    setPhotoBusy('remove')
    setPhotoNote(null)

    try {
      const res = await api.delete('/api/profile/photo/')
      applyAvatar(res.data?.data?.avatar_url ?? null)
      setConfirmRemove(false)
      showPhotoNote('success', res.data?.message || 'Profile picture removed.')
    } catch (err) {
      handlePhotoError(err)
    } finally {
      setPhotoBusy('')
    }
  }

  /* ── Profile details ── */

  const handleError = (err) => {
    const res = err?.response
    if (!res) {
      showBanner('error', 'Network error. Check your connection and try again.')
      return
    }

    const { status, data } = res
    const message = data?.message

    if (status === 400 || status === 403) {
      const { fields, general } = mapServerErrors(data?.errors)
      setErrors(fields)
      if (status === 403) {
        showBanner(
          'warn',
          message || 'These details were verified during KYC and can no longer be edited. Contact support to request a change.',
          general,
        )
      } else if (Object.keys(fields).length) {
        showBanner('error', message || 'Please correct the highlighted fields.', general)
      } else {
        showBanner('error', message || 'We could not save your changes.', general)
      }
      return
    }

    if (status === 401) {
      showBanner('error', 'Your session has expired. Please sign in again to continue.')
      return
    }

    if (status === 405) {
      showBanner('error', 'This update method is not supported. Please contact support if this keeps happening.')
      return
    }

    if (status === 429) {
      showBanner('warn', message || 'Too many requests. Please wait a moment and try again.')
      return
    }

    showBanner('error', 'Something went wrong on our side. Please try again in a moment.')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (saving || saved || !form || !base) return

    const clientErrors = validate(form, base, locked)
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      showBanner('error', 'Please correct the highlighted fields.')
      reveal()
      return
    }

    const payload = buildPayload(form, base, locked)
    if (!Object.keys(payload).length) {
      showBanner('info', 'There are no changes to save yet.')
      reveal()
      return
    }

    setSaving(true)
    setBanner(null)
    setErrors({})

    try {
      const res = await api.patch('/api/profile/', payload)
      const data = res.data?.data
      const message = res.data?.message || 'Profile updated successfully.'
      if (data) {
        setProfile(data)
        setForm(toForm(data))
      }

      if (/no changes/i.test(message)) {
        showBanner('info', message)
      } else {
        showBanner('success', message)
        setSaved(true)
        timerRef.current = setTimeout(() => navigate(PROFILE_URL), 1400)
      }
    } catch (err) {
      handleError(err)
    } finally {
      setSaving(false)
      reveal()
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5" aria-hidden="true">
        <div className="space-y-2">
          <div className="h-6 w-32 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-56 animate-pulse rounded bg-white/[0.06]" />
        </div>
        <Block className="h-40" />
        <Block className="h-80" />
        <Block className="h-48" />
        <Block className="h-72" />
      </div>
    )
  }

  if (loadErr || !profile || !form) {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <InlineError message={loadErr || 'We could not load your profile.'} onRetry={retryLoad} />
      </div>
    )
  }

  const lockedNames = (profile.locked_fields || []).map((f) => LABELS[f] || humanize(f))
  const isLocked = (key) => locked.has(key)
  const addressError = errors.address

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate>
      <motion.div
        className="mx-auto max-w-3xl space-y-5"
        variants={container}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        <Banner banner={banner} innerRef={bannerRef} />

        {/* ── Profile picture (saved on its own, separate from the Save changes button) ── */}
        <PhotoSection
          avatarUrl={profile.avatar_url || null}
          pending={pending}
          busy={photoBusy}
          disabled={saving || saved}
          cooldown={photoCooldown}
          confirmRemove={confirmRemove}
          note={photoNote}
          onPick={pickPhoto}
          onUpload={uploadPhoto}
          onCancelPending={cancelPending}
          onAskRemove={() => {
            setConfirmRemove(true)
            setPhotoNote(null)
          }}
          onCancelRemove={() => setConfirmRemove(false)}
          onRemove={removePhoto}
        />

        <fieldset disabled={saving || saved} className="min-w-0 space-y-5 border-0 p-0">
          {/* ── Personal information ── */}
          <Section icon={User} title="Personal information">
            {lockedNames.length > 0 && (
              <p className="mb-4 flex items-start gap-2 rounded-xl bg-white/[0.04] px-3.5 py-3 text-xs leading-relaxed text-slate-400">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                <span>
                  {lockedNames.join(', ')} were verified during KYC and can no longer be edited. Contact support to
                  request a change.
                </span>
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextInput
                  id="full_name"
                  label="Full name"
                  value={form.full_name}
                  onChange={setField('full_name')}
                  error={errors.full_name}
                  locked={isLocked('full_name')}
                  autoComplete="name"
                  placeholder="As it appears on your ID"
                />
              </div>

              <TextInput
                id="date_of_birth"
                label="Date of birth"
                type="date"
                value={form.date_of_birth}
                onChange={setField('date_of_birth')}
                error={errors.date_of_birth}
                locked={isLocked('date_of_birth')}
                max={maxDob()}
                min="1900-01-01"
                autoComplete="bday"
                style={{ colorScheme: 'dark' }}
              />

              <SexPicker
                value={form.sex}
                onChange={setField('sex')}
                locked={isLocked('sex')}
                error={errors.sex}
                reduce={reduce}
              />

              <div className="sm:col-span-2">
                <CountrySelect
                  id="nationality"
                  label="Nationality"
                  value={form.nationality}
                  onChange={setField('nationality')}
                  error={errors.nationality}
                  locked={isLocked('nationality')}
                />
              </div>
            </div>
          </Section>

          {/* ── Contact ── */}
          <Section icon={Phone} title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <Field id="email" label="Email" hint="Your email cannot be changed here." locked>
                  <div className="relative">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={profile.email || ''}
                      readOnly
                      aria-readonly="true"
                      aria-describedby="email-hint"
                      className={`${inputCls(false, true)} pr-10`}
                    />
                    <Mail
                      className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    />
                  </div>
                </Field>
              </div>

              <TextInput
                id="phone_number"
                label="Phone number"
                type="tel"
                inputMode="tel"
                value={form.phone_number}
                onChange={setField('phone_number')}
                error={errors.phone_number}
                hint="Include the country code, e.g. +2348012345678"
                autoComplete="tel"
                placeholder="+234 801 234 5678"
              />
            </div>
          </Section>

          {/* ── Address ── */}
          <Section icon={MapPin} title="Address">
            <AnimatePresence initial={false}>
              {addressError && (
                <motion.p
                  key="address-error"
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 flex items-start gap-2 rounded-xl bg-[#F6465D]/10 px-3.5 py-3 text-sm text-red-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#F6465D]" aria-hidden="true" />
                  <span className="min-w-0 break-words">{addressError}</span>
                </motion.p>
              )}
            </AnimatePresence>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextInput
                  id="line1"
                  label="Address line 1"
                  value={form.line1}
                  onChange={setField('line1')}
                  error={errors.line1}
                  autoComplete="address-line1"
                  placeholder="Street address"
                />
              </div>
              <div className="sm:col-span-2">
                <TextInput
                  id="line2"
                  label="Address line 2 (optional)"
                  value={form.line2}
                  onChange={setField('line2')}
                  error={errors.line2}
                  autoComplete="address-line2"
                  placeholder="Apartment, suite, unit"
                />
              </div>
              <TextInput
                id="city"
                label="City"
                value={form.city}
                onChange={setField('city')}
                error={errors.city}
                autoComplete="address-level2"
              />
              <TextInput
                id="state"
                label="State / Region"
                value={form.state}
                onChange={setField('state')}
                error={errors.state}
                autoComplete="address-level1"
              />
              <TextInput
                id="postal_code"
                label="Postal code"
                value={form.postal_code}
                onChange={setField('postal_code')}
                error={errors.postal_code}
                autoComplete="postal-code"
              />
              <CountrySelect
                id="country"
                label="Country"
                value={form.country}
                onChange={setField('country')}
                error={errors.country}
                locked={false}
              />
            </div>
          </Section>
        </fieldset>

        {/* ── Save bar ── */}
        <motion.div
          variants={item}
          className="sticky bottom-0 z-20 -mx-4 border-t border-white/10 bg-[#0E1822]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:bottom-4 sm:mx-0 sm:rounded-2xl sm:border-0 sm:bg-[#14212D] sm:p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-slate-400" aria-live="polite">
              <motion.span
                className={`h-2 w-2 rounded-full ${saved ? 'bg-[#3DDC97]' : dirty ? 'bg-amber-400' : 'bg-slate-600'}`}
                animate={dirty && !saved && !reduce ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                transition={dirty && !saved ? { duration: 1.4, repeat: Infinity } : { duration: 0 }}
                aria-hidden="true"
              />
              {saved ? 'Changes saved' : dirty ? 'You have unsaved changes' : 'No changes yet'}
            </p>

            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Link
                to={PROFILE_URL}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70"
              >
                Cancel
              </Link>

              <motion.button
                type="submit"
                disabled={!dirty || saving || saved}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3DDC97] px-6 text-sm font-semibold text-[#06140E] transition-colors hover:bg-[#5BEBAD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1822] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving…
                  </>
                ) : saved ? (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      aria-hidden="true"
                    >
                      <motion.path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={reduce ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.35 }}
                      />
                    </svg>
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save changes
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </form>
  )
}