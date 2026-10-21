import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import { AlertTriangle, ArrowLeft, ArrowUp, ChevronDown, Clock, FileSearch, List, ShieldCheck, UserCheck, Activity, Archive } from 'lucide-react'

/* ────────────────────────────────────────────────
   DOCUMENT DETAILS  (edit here)
──────────────────────────────────────────────── */

const COMPANY = {
  name: 'Solvexmarketinc',
  founded: 2012,
  address: '5 Quinton Road, Coventry, CV1 2WT, United Kingdom',
}
// PLACEHOLDER: replace with your real compliance email
const CONTACT_EMAIL = 'support@solvexmarketinc.com'
const LAST_UPDATED = '21 October 2026'
const EFFECTIVE_DATE = '21 October 2026'

/* ────────────────────────────────────────────────
   SMALL TEXT HELPERS
──────────────────────────────────────────────── */

const P = ({ children }) => <p className="mt-3 first:mt-0">{children}</p>

const Ul = ({ items }) => (
  <ul className="mt-3 space-y-2">
    {items.map((item) => (
      <li key={item} className="flex gap-2.5">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3DDC97]" aria-hidden="true" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
)

// Bold term followed by a description
const Dl = ({ items }) => (
  <ul className="mt-3 space-y-2.5">
    {items.map(([term, desc]) => (
      <li key={term} className="flex gap-2.5">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3DDC97]" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-white">{term}: </strong>
          {desc}
        </span>
      </li>
    ))}
  </ul>
)

const L = ({ to, children }) => (
  <Link to={to} className="font-medium text-[#3DDC97] underline-offset-2 hover:underline">
    {children}
  </Link>
)

/* ────────────────────────────────────────────────
   AML POLICY CONTENT
──────────────────────────────────────────────── */

const SECTIONS = [
  {
    id: 'purpose',
    title: 'Purpose and Scope',
    body: (
      <>
        <P>
          This Anti-Money Laundering (“AML”) and Counter-Terrorist Financing (“CTF”) Policy explains how {COMPANY.name}{' '}
          (“we”, “us”, “our”), founded and registered in {COMPANY.founded} with its head office at {COMPANY.address},
          prevents its platform from being used for money laundering, terrorist financing, fraud or sanctions evasion.
        </P>
        <P>
          It applies to every user of our cryptocurrency and forex services, and should be read together with our{' '}
          <L to="/terms-of-service">Terms of Service</L>, <L to="/privacy-policy">Privacy Policy</L> and{' '}
          <L to="/risk-disclosure">Risk Disclosure</L>.
        </P>
      </>
    ),
  },
  {
    id: 'commitment',
    title: 'Our Commitment',
    body: (
      <>
        <P>
          We are committed to operating lawfully and transparently. We apply a risk-based approach that follows
          applicable laws and recognised standards, including the UK Proceeds of Crime Act 2002, the Terrorism Act 2000,
          the Money Laundering Regulations 2017 and guidance from the Financial Action Task Force (FATF).
        </P>
        <P>
          Our policies are approved by senior management, reviewed regularly, and apply to all staff, who receive
          ongoing AML training.
        </P>
      </>
    ),
  },
  {
    id: 'ml-definition',
    title: 'What Is Money Laundering?',
    body: (
      <>
        <P>Money laundering is the process of making money from crime appear to come from a legitimate source. It typically involves three stages:</P>
        <Dl
          items={[
            ['Placement', 'illegal funds are introduced into the financial system.'],
            ['Layering', 'funds are moved or converted through many transactions to hide their origin.'],
            ['Integration', 'the funds re-enter the economy as apparently legitimate wealth.'],
          ]}
        />
        <P>
          Terrorist financing is the provision or collection of funds, from legal or illegal sources, to support
          terrorism. Both are criminal offences.
        </P>
      </>
    ),
  },
  {
    id: 'governance',
    title: 'Compliance Officer and Governance',
    body: (
      <>
        <P>
          We have appointed a Money Laundering Reporting Officer (“MLRO”) who is responsible for overseeing this Policy,
          receiving internal reports of suspicious activity, deciding whether to report to the authorities, and acting
          as our contact for regulators and law enforcement.
        </P>
        <P>
          The MLRO has the authority, independence and resources needed to carry out these duties, and reports directly
          to senior management.
        </P>
      </>
    ),
  },
  {
    id: 'risk-based',
    title: 'Risk-Based Approach',
    body: (
      <>
        <P>We assess the money-laundering risk of each customer and adjust our controls accordingly. Factors we consider include:</P>
        <Ul
          items={[
            'the customer’s country of residence, nationality and any links to higher-risk jurisdictions;',
            'the customer’s occupation, source of funds and expected activity;',
            'the products used, transaction sizes, frequency and payment methods;',
            'whether the customer is a politically exposed person (PEP) or linked to one;',
            'adverse media, sanctions or other screening results.',
          ]}
        />
        <P>Higher-risk customers receive enhanced scrutiny, while lower-risk customers may be subject to simplified measures where the law allows.</P>
      </>
    ),
  },
  {
    id: 'cip',
    title: 'Customer Identification (KYC)',
    body: (
      <>
        <P>Before you can fund your Wallet, trade or withdraw, you must complete identity verification. We may ask for:</P>
        <Ul
          items={[
            'full name, date of birth, nationality and residential address;',
            'a valid government-issued photo ID, such as a passport, national ID card or driving licence;',
            'proof of address, such as a recent utility bill or bank statement dated within the last three months;',
            'a selfie or liveness check to confirm that the ID belongs to you.',
          ]}
        />
        <P>
          Documents must be genuine, clear, valid and in your own name. We may use trusted third-party verification
          providers to carry out these checks. Providing false or altered documents will lead to Account closure and may
          be reported to the authorities.
        </P>
      </>
    ),
  },
  {
    id: 'edd',
    title: 'Enhanced Due Diligence',
    body: (
      <>
        <P>
          Where a customer presents a higher risk, we apply enhanced due diligence (“EDD”). This may include requesting
          further documents, verifying the source of funds and source of wealth, obtaining senior-management approval to
          continue the relationship, and applying closer, more frequent monitoring.
        </P>
        <P>
          EDD is always applied to PEPs, to customers connected to high-risk or sanctioned jurisdictions, and where
          unusual or suspicious behaviour is detected.
        </P>
      </>
    ),
  },
  {
    id: 'sanctions',
    title: 'Sanctions and PEP Screening',
    body: (
      <>
        <P>
          We screen customers at onboarding and on an ongoing basis against international sanctions lists and
          watchlists, including those of the United Kingdom (OFSI), the United Nations, the European Union and the
          United States (OFAC), as well as PEP and adverse-media databases.
        </P>
        <P>
          We do not provide services to sanctioned persons or to residents of comprehensively sanctioned territories. A
          match may result in the immediate freezing of an Account and a report to the competent authority.
        </P>
      </>
    ),
  },
  {
    id: 'monitoring',
    title: 'Transaction Monitoring',
    body: (
      <>
        <P>We monitor deposits, withdrawals and trading activity to detect unusual or suspicious behaviour. Examples of warning signs include:</P>
        <Ul
          items={[
            'large or frequent deposits that do not match the customer’s profile;',
            'deposits followed by withdrawals with little or no trading;',
            'use of multiple payment methods, or payments from third parties;',
            'rapid movement of funds in and out of an Account, or structuring transactions to avoid limits;',
            'use of VPNs, shared devices or inconsistent locations to hide identity;',
            'reluctance to provide information or documents, or providing inconsistent details.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'funds',
    title: 'Deposits and Withdrawals',
    body: (
      <>
        <P>To reduce the risk of laundering, we apply the following rules to all payments:</P>
        <Ul
          items={[
            'deposits must come from a bank account, card or wallet held in your own name;',
            'withdrawals are paid back to a verified payment method in your name, generally the one used to deposit;',
            'we do not accept payments from third parties or anonymous sources;',
            'we may delay, hold or refuse a transaction while we carry out checks, and may ask for source-of-funds evidence.',
          ]}
        />
        <P>See the <L to="/terms-of-service">Terms of Service</L> for more on payments.</P>
      </>
    ),
  },
  {
    id: 'reporting',
    title: 'Suspicious Activity Reporting',
    body: (
      <>
        <P>
          Staff must report any suspicion of money laundering or terrorist financing to the MLRO without delay. Where
          the MLRO has reasonable grounds to suspect, we file a Suspicious Activity Report (“SAR”) with the National
          Crime Agency (NCA) or the relevant authority.
        </P>
        <P>
          By law we may not tell you that a report has been made or that an investigation is under way (“tipping off”).
          We may also have to freeze funds, restrict an Account or refuse to carry out a transaction if instructed by a
          competent authority.
        </P>
      </>
    ),
  },
  {
    id: 'records',
    title: 'Record Keeping',
    body: (
      <>
        <P>
          We keep identification records, transaction records, verification results and monitoring and reporting
          decisions for at least five years after the end of our relationship with you, or for longer where the law or a
          regulator requires. Records are stored securely and handled in line with our{' '}
          <L to="/privacy-policy">Privacy Policy</L>.
        </P>
      </>
    ),
  },
  {
    id: 'training',
    title: 'Training and Awareness',
    body: (
      <>
        <P>
          All relevant employees receive AML and CTF training when they join and regular refresher training afterwards.
          Training covers how to identify red flags, how to escalate concerns, and the legal consequences of failing to
          comply.
        </P>
      </>
    ),
  },
  {
    id: 'prohibited',
    title: 'Prohibited Customers and Activity',
    body: (
      <>
        <P>We do not onboard, and will close the Accounts of, anyone who:</P>
        <Ul
          items={[
            'refuses or fails to complete identity verification;',
            'is sanctioned, or resident in or connected to a prohibited jurisdiction;',
            'uses false, forged or stolen documents or identities;',
            'opens multiple Accounts or uses another person’s Account or payment method;',
            'uses the Platform for fraud, laundering, terrorist financing or any other unlawful purpose.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'cooperation',
    title: 'Your Responsibilities and Cooperation',
    body: (
      <>
        <P>You agree to:</P>
        <Ul
          items={[
            'provide accurate, complete and up-to-date information, and tell us promptly if your details change;',
            'respond to our requests for information or documents within a reasonable time;',
            'only use funds that come from legitimate sources;',
            'cooperate with any review, and accept that we may restrict an Account while checks are in progress.',
          ]}
        />
        <P>
          We may share information with regulators, law enforcement and other authorities where we are legally required
          or permitted to do so.
        </P>
      </>
    ),
  },
  {
    id: 'consequences',
    title: 'Consequences of Non-Compliance',
    body: (
      <>
        <P>
          If we suspect a breach of this Policy, or if you do not provide the information we require, we may suspend or
          close your Account, cancel pending transactions, freeze or withhold funds where legally required, and report
          the matter to the relevant authorities. We are not liable for any loss caused by actions we take in good faith
          to comply with our legal obligations.
        </P>
      </>
    ),
  },
  {
    id: 'review',
    title: 'Policy Review and Changes',
    body: (
      <>
        <P>
          We review this Policy at least once a year and whenever laws or our business change. Updates are posted on the
          Platform with a new “last updated” date. Continued use of our Services after an update means you accept the
          revised Policy.
        </P>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Contact Us',
    body: (
      <>
        <P>If you have questions about this Policy or about a verification request, please get in touch:</P>
        <Ul
          items={[
            `Company: ${COMPANY.name}`,
            `Head office: ${COMPANY.address}`,
            `Email: ${CONTACT_EMAIL}`,
            'Live chat: available through the chat widget on our website',
          ]}
        />
      </>
    ),
  },
]

// How our AML process works, shown as an ordered strip
const PROCESS = [
  { icon: UserCheck, title: 'Verify', text: 'Identity and address checked before you trade.' },
  { icon: FileSearch, title: 'Screen', text: 'Sanctions, PEP and adverse-media checks.' },
  { icon: Activity, title: 'Monitor', text: 'Ongoing review of deposits and trading.' },
  { icon: Archive, title: 'Report & record', text: 'Suspicious activity reported; records kept 5 years.' },
]

const RELATED = [
  { label: 'Terms of Service', to: '/terms-of-service' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Risk Disclosure', to: '/risk-disclosure' },
  { label: 'Cookie Policy', to: '/cookie-policy' },
]

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function AmlPolicy() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })
  const [active, setActive] = useState(SECTIONS[0].id)
  const [tocOpen, setTocOpen] = useState(false)

  // Scroll-spy: highlight the section currently in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -70% 0px' },
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const goTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    setActive(id)
    setTocOpen(false)
  }
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
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">AML Policy</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
                How {COMPANY.name} prevents money laundering and terrorist financing, and what we need from you.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-[#3DDC97]" aria-hidden="true" />
                  Last updated: {LAST_UPDATED}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
                  Effective: {EFFECTIVE_DATE}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[17rem_1fr] lg:gap-12">
          {/* Contents: collapsible on mobile, sticky on desktop */}
          <aside className="lg:self-start">
            {/* Mobile */}
            <div className="rounded-2xl border border-white/10 bg-[#0B141B] lg:hidden">
              <button
                type="button"
                onClick={() => setTocOpen((v) => !v)}
                aria-expanded={tocOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3DDC97]/70"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <List className="h-4 w-4 text-[#3DDC97]" aria-hidden="true" />
                  Contents
                </span>
                <motion.span animate={{ rotate: tocOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
                  <ChevronDown className="h-5 w-5 text-[#3DDC97]" aria-hidden="true" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {tocOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <ol className="max-h-[55vh] space-y-0.5 overflow-y-auto border-t border-white/10 p-2">
                      {SECTIONS.map((s, i) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => goTo(s.id)}
                            className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                              active === s.id ? 'bg-[#3DDC97]/10 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className="w-5 shrink-0 text-xs tabular-nums text-[#3DDC97]">{i + 1}.</span>
                            {s.title}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop */}
            <nav aria-label="AML policy contents" className="sticky top-24 hidden rounded-2xl border border-white/10 bg-[#0B141B] p-3 lg:block">
              <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Contents</p>
              <ol className="max-h-[calc(100vh-10rem)] space-y-0.5 overflow-y-auto pr-1">
                {SECTIONS.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => goTo(s.id)}
                      aria-current={active === s.id ? 'true' : undefined}
                      className={`relative flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[0.82rem] leading-snug transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3DDC97]/70 ${
                        active === s.id ? 'text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {active === s.id && (
                        <motion.span
                          layoutId="toc-active"
                          className="absolute inset-0 rounded-lg bg-[#3DDC97]/10 ring-1 ring-[#3DDC97]/30"
                          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                        />
                      )}
                      <span className="relative w-5 shrink-0 text-xs tabular-nums text-[#3DDC97]">{i + 1}.</span>
                      <span className="relative">{s.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          {/* Policy text */}
          <main className="min-w-0">
            <motion.div
              {...fade(0.15)}
              className="mb-6 flex gap-3 rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.07] p-4 sm:p-5"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#F59E0B]" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-slate-300">
                <span className="font-semibold text-white">Verification is required. </span>
                We must verify your identity before you can deposit, trade or withdraw. Accounts that fail verification or
                raise compliance concerns may be restricted or closed.
              </p>
            </motion.div>

            {/* How it works */}
            <motion.div {...fade(0.22)} className="mb-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">How our AML process works</p>
              <ol className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {PROCESS.map((p, pi) => {
                  const Icon = p.icon
                  return (
                    <li key={p.title} className="rounded-2xl border border-white/10 bg-[#0B141B] p-4">
                      <div className="flex items-center justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/25">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="text-xs font-bold tabular-nums text-slate-500">{pi + 1}</span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-white">{p.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{p.text}</p>
                    </li>
                  )
                })}
              </ol>
            </motion.div>

            <div className="space-y-5">
              {SECTIONS.map((s, i) => (
                <motion.section
                  key={s.id}
                  id={s.id}
                  className="scroll-mt-24 rounded-2xl border border-white/10 bg-[#0B141B] p-5 sm:p-7"
                  initial={reduce ? false : { opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                  <h2 className="flex items-start gap-3 text-lg font-semibold text-white sm:text-xl">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3DDC97]/10 text-sm font-bold text-[#3DDC97] ring-1 ring-[#3DDC97]/25">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{s.title}</span>
                  </h2>
                  <div className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">{s.body}</div>
                </motion.section>
              ))}
            </div>

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
          </main>
        </div>
      </div>
    </div>
  )
}