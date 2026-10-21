import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import { ArrowLeft, ArrowUp, ChevronDown, Clock, Eye, List, Lock, Scale, ShieldCheck } from 'lucide-react'

/* ────────────────────────────────────────────────
   DOCUMENT DETAILS  (edit here)
──────────────────────────────────────────────── */

const COMPANY = {
  name: 'Solvexmarketinc',
  founded: 2012,
  address: '5 Quinton Road, Coventry, CV1 2WT, United Kingdom',
}
// PLACEHOLDER: replace with your real privacy / data protection contact email
const PRIVACY_EMAIL = 'privacy@solvexmarketinc.com'
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

const Ext = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-[#3DDC97] underline-offset-2 hover:underline">
    {children}
  </a>
)

/* ────────────────────────────────────────────────
   PRIVACY POLICY CONTENT
──────────────────────────────────────────────── */

const SECTIONS = [
  {
    id: 'introduction',
    title: 'Introduction and Who We Are',
    body: (
      <>
        <P>
          {COMPANY.name} (“we”, “us”, “our”) was founded and registered in {COMPANY.founded} and has its head office at{' '}
          {COMPANY.address}. We respect your privacy and are committed to protecting your personal data.
        </P>
        <P>
          This Privacy Policy explains what personal data we collect when you use our website and trading platform, how we
          use it, who we share it with, and the rights you have. We are the “data controller” of your personal data, which
          means we decide how and why it is processed. We process personal data in line with the UK General Data Protection
          Regulation (UK GDPR) and the Data Protection Act 2018.
        </P>
        <P>
          This policy should be read together with our <L to="/terms-of-service">Terms of Service</L> and{' '}
          <L to="/cookie-policy">Cookie Policy</L>.
        </P>
      </>
    ),
  },
  {
    id: 'collect',
    title: 'Information We Collect',
    body: (
      <>
        <P>Depending on how you use our services, we may collect and process the following categories of personal data:</P>
        <Dl
          items={[
            ['Identity data', 'full name, date of birth, nationality, gender where required, and identity document details.'],
            ['Contact data', 'email address, telephone number, and residential or billing address.'],
            ['Verification data', 'copies of passports, driving licences or ID cards, proof of address, selfies or video for identity checks, and source-of-funds information.'],
            ['Financial data', 'payment method details, bank account information, wallet and deposit or withdrawal records.'],
            ['Trading data', 'orders placed, positions, transaction history, account balances and trading activity.'],
            ['Technical data', 'IP address, device type, browser type and version, operating system, time zone, login data and security logs.'],
            ['Usage data', 'how you navigate and use our website and platform, pages viewed and features used.'],
            ['Communications data', 'messages you send us by email or live chat, and your communication preferences.'],
          ]}
        />
        <P>
          We do not intentionally collect special-category data (such as health or political opinions). If you volunteer it
          to us, we will only use it where permitted by law.
        </P>
      </>
    ),
  },
  {
    id: 'how-collected',
    title: 'How We Collect Your Information',
    body: (
      <>
        <Dl
          items={[
            ['Directly from you', 'when you register, complete verification, fund your wallet, trade, or contact our support team.'],
            ['Automatically', 'through cookies and similar technologies as you use our website and platform.'],
            ['From third parties', 'such as identity-verification providers, payment processors, fraud-prevention services and publicly available sources.'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'use',
    title: 'How We Use Your Information',
    body: (
      <>
        <P>We use your personal data for the following purposes:</P>
        <Ul
          items={[
            'to create and manage your account and verify your identity;',
            'to process deposits, withdrawals and trades, and to provide our services;',
            'to meet our legal and regulatory obligations, including anti-money-laundering and sanctions checks;',
            'to detect, investigate and prevent fraud, market abuse and other unlawful activity;',
            'to secure our platform, monitor for suspicious logins and protect your account;',
            'to provide customer support and respond to your enquiries and complaints;',
            'to improve our website, services and user experience through analysis of how they are used;',
            'to send you service notices and, where permitted, marketing communications.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'legal-bases',
    title: 'Legal Bases for Processing',
    body: (
      <>
        <P>We only process your personal data where we have a lawful basis under the UK GDPR. The bases we rely on are:</P>
        <Dl
          items={[
            ['Contract', 'where processing is necessary to provide the services you have asked for, such as opening your account and executing trades.'],
            ['Legal obligation', 'where we must process data to comply with the law, such as identity checks and record-keeping for anti-money-laundering rules.'],
            ['Legitimate interests', 'where processing is necessary for our legitimate business interests, such as fraud prevention, platform security and service improvement, and your interests do not override them.'],
            ['Consent', 'where you have given clear consent, for example for certain marketing or non-essential cookies. You can withdraw consent at any time.'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'kyc',
    title: 'Identity Verification and AML',
    body: (
      <>
        <P>
          Providing a trading service means we are required to verify your identity and monitor transactions to prevent
          money laundering, terrorist financing and fraud. To do this we may share your information with identity
          verification and screening providers, and check it against sanctions, politically exposed person (PEP) and fraud
          databases.
        </P>
        <P>
          Where the law requires, we may report suspicious activity to the relevant authorities without informing you. Our{' '}
          <L to="/aml-policy">AML Policy</L> gives more detail on these measures.
        </P>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who We Share Your Information With',
    body: (
      <>
        <P>We do not sell your personal data. We share it only where needed, with:</P>
        <Ul
          items={[
            'identity-verification, screening and fraud-prevention providers;',
            'payment processors, banks and other financial institutions that handle your deposits and withdrawals;',
            'technology, hosting, analytics and live-chat or customer-support providers who process data on our behalf;',
            'professional advisers such as lawyers, auditors and insurers;',
            'regulators, law enforcement, tax authorities and courts where we are legally required or permitted to do so;',
            'a buyer or successor if our business is sold or reorganised, who will be bound to protect your data.',
          ]}
        />
        <P>
          Where a provider processes data on our behalf, we require them to protect it and to use it only in line with our
          instructions.
        </P>
      </>
    ),
  },
  {
    id: 'transfers',
    title: 'International Transfers',
    body: (
      <>
        <P>
          Some of our service providers are located outside the United Kingdom. When we transfer personal data abroad, we
          make sure it is protected by an appropriate safeguard, such as an adequacy decision recognising equivalent
          protection, or standard contractual clauses and the UK International Data Transfer Addendum. You can contact us
          for more information about the safeguards we use.
        </P>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'Data Retention',
    body: (
      <>
        <P>
          We keep personal data only for as long as necessary for the purposes in this policy. Anti-money-laundering and
          financial regulations generally require us to keep identity and transaction records for at least five years after
          our relationship with you ends. Other data is kept for as long as needed to provide our services, resolve
          disputes and meet legal or accounting requirements.
        </P>
        <P>When data is no longer needed, we delete it or anonymise it so that it can no longer identify you.</P>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Data Security',
    body: (
      <>
        <P>
          We use appropriate technical and organisational measures to protect your personal data against loss, misuse and
          unauthorised access, including encrypted connections, access controls and account-protection features. Only
          staff and providers who need your data to do their jobs can access it.
        </P>
        <P>
          No system is completely secure. Please protect your account by using a strong, unique password, enabling
          two-factor authentication, and telling us immediately if you suspect unauthorised access.
        </P>
      </>
    ),
  },
  {
    id: 'rights',
    title: 'Your Rights',
    body: (
      <>
        <P>Under data protection law you have the following rights over your personal data:</P>
        <Dl
          items={[
            ['Access', 'ask for a copy of the personal data we hold about you.'],
            ['Rectification', 'ask us to correct inaccurate or incomplete data.'],
            ['Erasure', 'ask us to delete your data in certain circumstances, subject to legal retention duties.'],
            ['Restriction', 'ask us to limit how we use your data in certain circumstances.'],
            ['Portability', 'ask for your data in a structured, commonly used format, or to have it sent to another provider.'],
            ['Objection', 'object to processing based on legitimate interests, and to direct marketing at any time.'],
            ['Withdraw consent', 'withdraw consent at any time where we rely on it, without affecting earlier processing.'],
          ]}
        />
        <P>
          To exercise any of these rights, contact us using the details below. We may need to verify your identity first. We
          aim to respond within one month. There is normally no charge, although some rights are subject to legal
          exceptions, for example where we must keep records to comply with anti-money-laundering law.
        </P>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and Similar Technologies',
    body: (
      <>
        <P>
          We use cookies and similar technologies to keep the platform secure, remember your preferences and understand how
          our website is used. You can control non-essential cookies through your browser or our cookie settings. Read our{' '}
          <L to="/cookie-policy">Cookie Policy</L> for the full details.
        </P>
      </>
    ),
  },
  {
    id: 'marketing',
    title: 'Marketing Communications',
    body: (
      <>
        <P>
          With your consent, or where otherwise permitted by law, we may send you news, educational content and offers.
          You can opt out at any time by using the unsubscribe link in any message or by contacting us. Opting out of
          marketing does not stop essential service messages, such as security alerts and account notices.
        </P>
      </>
    ),
  },
  {
    id: 'automated',
    title: 'Automated Decision-Making',
    body: (
      <>
        <P>
          We may use automated tools to help with fraud prevention, security monitoring and identity checks. Where an
          automated decision significantly affects you, such as declining an account, you can ask us for a human review of
          that decision and to explain how it was reached.
        </P>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children’s Privacy',
    body: (
      <>
        <P>
          Our services are for people aged 18 and over. We do not knowingly collect personal data from anyone under 18. If
          you believe a child has provided us with personal data, please contact us and we will delete it promptly.
        </P>
      </>
    ),
  },
  {
    id: 'links',
    title: 'Third-Party Links',
    body: (
      <>
        <P>
          Our website may link to third-party websites, such as social media networks. We do not control these sites and
          are not responsible for their privacy practices. We encourage you to read the privacy policy of every site you
          visit.
        </P>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    body: (
      <>
        <P>
          We may update this Privacy Policy from time to time. The latest version will always be available on our website
          with the “last updated” date shown at the top. Where changes are significant, we will take reasonable steps to
          tell you.
        </P>
      </>
    ),
  },
  {
    id: 'complaints',
    title: 'Complaints',
    body: (
      <>
        <P>
          We would like the chance to resolve any concern first, so please contact us using the details below. You also
          have the right to complain to the UK’s data protection regulator, the Information Commissioner’s Office (ICO):
        </P>
        <Ul
          items={[
            'Website: ico.org.uk/make-a-complaint',
            'Telephone: 0303 123 1113',
          ]}
        />
        <P>
          <Ext href="https://ico.org.uk/make-a-complaint/">Make a complaint to the ICO</Ext>
        </P>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Contact Us',
    body: (
      <>
        <P>For any question about this policy or to use your rights, please contact us:</P>
        <Ul
          items={[
            `Company: ${COMPANY.name}`,
            `Head office: ${COMPANY.address}`,
            `Email: ${PRIVACY_EMAIL}`,
            'Live chat: available through the chat widget on our website',
          ]}
        />
      </>
    ),
  },
]

const GLANCE = [
  { icon: Eye, title: 'Only what we need', text: 'We collect data to run your account, verify you and meet legal duties.' },
  { icon: Lock, title: 'Protected', text: 'Encrypted connections and access controls guard your information.' },
  { icon: ShieldCheck, title: 'Not sold', text: 'We do not sell your personal data to anyone.' },
  { icon: Scale, title: 'Your rights', text: 'Access, correct, delete or move your data whenever you ask.' },
]

const RELATED = [
  { label: 'Terms of Service', to: '/terms-of-service' },
  { label: 'Risk Disclosure', to: '/risk-disclosure' },
  { label: 'Cookie Policy', to: '/cookie-policy' },
  { label: 'AML Policy', to: '/aml-policy' },
]

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function PrivacyPolicy() {
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
              <Lock className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">Privacy Policy</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
                How {COMPANY.name} collects, uses and protects your personal data, and the rights you have over it.
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
            <nav aria-label="Privacy policy contents" className="sticky top-24 hidden rounded-2xl border border-white/10 bg-[#0B141B] p-3 lg:block">
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
            {/* Privacy at a glance */}
            <motion.div {...fade(0.15)} className="mb-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Privacy at a glance</p>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {GLANCE.map((g) => {
                  const Icon = g.icon
                  return (
                    <div key={g.title} className="rounded-2xl border border-white/10 bg-[#0B141B] p-4">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/20">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-white">{g.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{g.text}</p>
                    </div>
                  )
                })}
              </div>
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