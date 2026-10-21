import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import { AlertTriangle, ArrowLeft, ArrowUp, ChevronDown, Clock, FileText, List } from 'lucide-react'

/* ────────────────────────────────────────────────
   DOCUMENT DETAILS  (edit here)
──────────────────────────────────────────────── */

const COMPANY = {
  name: 'Solvexmarketinc',
  founded: 2012,
  address: '5 Quinton Road, Coventry, CV1 2WT, United Kingdom',
}
// PLACEHOLDER: replace with your real support email
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

const L = ({ to, children }) => (
  <Link to={to} className="font-medium text-[#3DDC97] underline-offset-2 hover:underline">
    {children}
  </Link>
)

/* ────────────────────────────────────────────────
   TERMS CONTENT
──────────────────────────────────────────────── */

const SECTIONS = [
  {
    id: 'acceptance',
    title: 'Acceptance of Terms',
    body: (
      <>
        <P>
          These Terms of Service (the “Terms”) form a legally binding agreement between you and {COMPANY.name}{' '}
          (“we”, “us”, “our”), a company founded and registered in {COMPANY.founded} with its head office at{' '}
          {COMPANY.address}.
        </P>
        <P>
          By creating an account, accessing the website or using any of our services, you confirm that you have read,
          understood and agree to be bound by these Terms, together with our <L to="/privacy-policy">Privacy Policy</L>,{' '}
          <L to="/risk-disclosure">Risk Disclosure</L>, <L to="/cookie-policy">Cookie Policy</L> and{' '}
          <L to="/aml-policy">AML Policy</L>. If you do not agree, you must not use our services.
        </P>
      </>
    ),
  },
  {
    id: 'definitions',
    title: 'Definitions',
    body: (
      <>
        <P>In these Terms, the following words have the meanings below:</P>
        <Ul
          items={[
            '“Platform” means our website, web application and any related software or interfaces.',
            '“Services” means the account, wallet, market access and trading functionality we provide through the Platform.',
            '“Account” means the personal account registered by you on the Platform.',
            '“Wallet” means the balance of funds recorded in your Account.',
            '“Instruments” means the cryptocurrency and foreign exchange (forex) pairs made available for trading.',
            '“You” means the individual who registers for and uses an Account.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Eligibility',
    body: (
      <>
        <P>To use our Services you must:</P>
        <Ul
          items={[
            'be at least 18 years old and have full legal capacity to enter into a binding contract;',
            'be acting on your own behalf and not on behalf of any other person or entity;',
            'not be a resident of, or located in, a country or region where our Services are prohibited or restricted by law;',
            'not be subject to any sanctions or listed on any government restricted-party list.',
          ]}
        />
        <P>We may refuse or close an Account where we reasonably believe these conditions are not met.</P>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Account Registration and Security',
    body: (
      <>
        <P>
          You must provide accurate, complete and current information when registering and keep it up to date. Each
          person may hold only one Account unless we agree otherwise in writing.
        </P>
        <P>
          You are responsible for keeping your login credentials confidential and for all activity carried out through
          your Account. You must enable any security features we provide, such as two-factor authentication, and notify
          us immediately if you suspect unauthorised access. We are not liable for losses caused by your failure to
          safeguard your credentials.
        </P>
      </>
    ),
  },
  {
    id: 'kyc',
    title: 'Identity Verification and Compliance',
    body: (
      <>
        <P>
          To comply with applicable anti-money-laundering, counter-terrorist-financing and sanctions laws, we require
          you to complete identity verification (“KYC”) before you can fund your Wallet, trade or withdraw. We may
          request additional information or documents at any time, including proof of identity, address and source of
          funds.
        </P>
        <P>
          We may delay, restrict or refuse any transaction or Account where verification is incomplete or where we
          suspect unlawful activity. We may be required by law to report suspicious activity without notifying you. See
          our <L to="/aml-policy">AML Policy</L> for more detail.
        </P>
      </>
    ),
  },
  {
    id: 'services',
    title: 'Description of Services',
    body: (
      <>
        <P>
          We provide an online platform that allows eligible users to access cryptocurrency and forex markets, view
          market information and place trades. The Instruments available, and the features offered for each, may change
          from time to time.
        </P>
        <P>
          Unless expressly stated otherwise, we do not provide investment, tax, legal or financial advice. Any
          educational material, analysis or market commentary is general information only and is not a recommendation to
          buy or sell any Instrument. You are solely responsible for your trading decisions.
        </P>
      </>
    ),
  },
  {
    id: 'funds',
    title: 'Deposits and Withdrawals',
    body: (
      <>
        <P>
          You may deposit funds into your Wallet using the payment methods we make available. Deposits must come from an
          account or payment method held in your own name. We may reject, reverse or return deposits that do not meet
          this requirement.
        </P>
        <P>
          Withdrawals are made to a verified payment method in your name. We may apply security, compliance and
          verification checks before processing a withdrawal, which can affect processing times. Third-party providers
          such as banks and payment processors may charge their own fees and apply their own timings, for which we are
          not responsible.
        </P>
      </>
    ),
  },
  {
    id: 'trading',
    title: 'Trading Rules and Orders',
    body: (
      <>
        <P>By placing an order you confirm that you understand and accept the following:</P>
        <Ul
          items={[
            'Orders are executed at the prices available when they are processed, which may differ from the price displayed when you placed the order (slippage).',
            'Prices in fast-moving or illiquid markets can gap, and stop-loss or limit orders are not guaranteed to fill at the level you set.',
            'We may reject, cancel or amend an order where it breaches these Terms, exceeds risk limits, results from a pricing error, or is placed during a system or market disruption.',
            'Where leveraged products are offered, you may be required to maintain minimum margin, and positions may be closed automatically if your margin falls below the required level.',
            'Once an order has been executed it generally cannot be cancelled or reversed.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'fees',
    title: 'Fees and Charges',
    body: (
      <>
        <P>
          Fees, spreads and other charges that apply to your use of the Services are shown on the Platform and form part
          of these Terms. They may include trading costs, financing or overnight charges, and withdrawal or inactivity
          fees where applicable.
        </P>
        <P>
          We may change our fees from time to time. Changes will be published on the Platform, and will apply to
          transactions made after the change takes effect. You are responsible for any taxes that arise from your
          trading activity.
        </P>
      </>
    ),
  },
  {
    id: 'risk',
    title: 'Risk Warning',
    body: (
      <>
        <P>
          Trading cryptocurrencies and foreign exchange carries a high level of risk and may not be suitable for
          everyone. Prices can move rapidly and unpredictably, and you can lose some or all of your capital. Leverage
          can magnify both profits and losses. Past performance is not a reliable indicator of future results, and
          profits are never guaranteed.
        </P>
        <P>
          You should only trade with money you can afford to lose and seek independent advice if you are unsure. Please
          read our full <L to="/risk-disclosure">Risk Disclosure</L> before trading.
        </P>
      </>
    ),
  },
  {
    id: 'prohibited',
    title: 'Prohibited Activities',
    body: (
      <>
        <P>You agree not to use the Platform to:</P>
        <Ul
          items={[
            'engage in fraud, money laundering, terrorist financing or any other unlawful activity;',
            'manipulate markets, including wash trading, spoofing or coordinated abusive trading;',
            'open multiple Accounts, or use another person’s Account, identity or payment method;',
            'exploit pricing errors, system faults or latency, or use unauthorised bots or scrapers;',
            'attempt to gain unauthorised access to the Platform, other accounts or our systems, or introduce malware;',
            'circumvent any restriction, limit or security control, including by using a VPN to hide your location.',
          ]}
        />
        <P>
          Breach of this section may result in immediate suspension or closure of your Account, cancellation of trades
          and withholding of related profits, and referral to the relevant authorities.
        </P>
      </>
    ),
  },
  {
    id: 'ip',
    title: 'Intellectual Property',
    body: (
      <>
        <P>
          The Platform, including its design, software, text, graphics, logos and trademarks, is owned by or licensed to{' '}
          {COMPANY.name} and is protected by intellectual property laws. We grant you a limited, non-exclusive,
          non-transferable, revocable licence to use the Platform for your personal trading purposes in line with these
          Terms.
        </P>
        <P>
          You may not copy, modify, distribute, reverse engineer or create derivative works from any part of the
          Platform without our written permission.
        </P>
      </>
    ),
  },
  {
    id: 'third-party',
    title: 'Third-Party Services and Market Data',
    body: (
      <>
        <P>
          The Platform may rely on, display or link to data, tools and services provided by third parties, such as price
          feeds, payment providers and charting tools. We do not control these third parties and do not guarantee the
          accuracy, completeness or timeliness of any third-party content. Your use of third-party services is subject to
          their own terms.
        </P>
      </>
    ),
  },
  {
    id: 'privacy',
    title: 'Privacy and Data Protection',
    body: (
      <>
        <P>
          We collect and process personal data in accordance with applicable data protection laws, including the UK GDPR
          and the Data Protection Act 2018. Details of what we collect, why, and your rights are set out in our{' '}
          <L to="/privacy-policy">Privacy Policy</L> and <L to="/cookie-policy">Cookie Policy</L>.
        </P>
      </>
    ),
  },
  {
    id: 'termination',
    title: 'Suspension and Termination',
    body: (
      <>
        <P>
          You may close your Account at any time by contacting us, provided any open positions have been closed and any
          amounts owed have been settled. On closure, we will return your remaining Wallet balance to your verified
          payment method, subject to the checks described in these Terms.
        </P>
        <P>
          We may suspend, restrict or terminate your Account or access to the Services immediately, with or without
          notice, where we reasonably believe you have breached these Terms, where required by law or a regulator, to
          protect the security of the Platform or other users, or where your Account has been inactive for an extended
          period. Provisions that by their nature should survive termination will continue to apply.
        </P>
      </>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    body: (
      <>
        <P>
          The Platform and Services are provided on an “as is” and “as available” basis. To the fullest extent
          permitted by law, we do not warrant that the Platform will be uninterrupted, error-free or secure, that
          market data will be accurate or complete, or that you will achieve any particular trading result. We make no
          representation that trading will be profitable.
        </P>
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of Liability',
    body: (
      <>
        <P>
          Nothing in these Terms excludes or limits our liability for death or personal injury caused by our negligence,
          for fraud or fraudulent misrepresentation, or for any other liability that cannot be excluded or limited by
          law.
        </P>
        <P>
          Subject to the above, and to the fullest extent permitted by law, we are not liable for any indirect or
          consequential loss, loss of profit, loss of opportunity, or trading losses arising from market movements,
          your own decisions, third-party failures, or events outside our reasonable control. Our total aggregate
          liability to you for any claim arising from these Terms or the Services is limited to the amount of fees you
          paid to us in the twelve months before the event giving rise to the claim.
        </P>
      </>
    ),
  },
  {
    id: 'indemnity',
    title: 'Indemnification',
    body: (
      <>
        <P>
          You agree to indemnify and hold harmless {COMPANY.name}, its directors, employees and partners from any
          claims, losses, liabilities and reasonable expenses (including legal fees) arising from your breach of these
          Terms, your misuse of the Platform, or your violation of any law or third-party right.
        </P>
      </>
    ),
  },
  {
    id: 'force-majeure',
    title: 'Force Majeure',
    body: (
      <>
        <P>
          We are not liable for any failure or delay in performing our obligations where caused by events beyond our
          reasonable control, including natural disasters, war, terrorism, civil unrest, government action, power or
          telecommunications failures, cyber-attacks, exchange or liquidity-provider outages, or extreme market
          conditions.
        </P>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to These Terms',
    body: (
      <>
        <P>
          We may update these Terms from time to time to reflect changes in law, our Services or our business. We will
          post the updated Terms on the Platform with a new “last updated” date and, where changes are material, take
          reasonable steps to notify you. Your continued use of the Services after the changes take effect constitutes
          acceptance of the updated Terms. If you do not agree, you must stop using the Services and close your Account.
        </P>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Governing Law and Disputes',
    body: (
      <>
        <P>
          These Terms and any dispute or claim arising out of or in connection with them are governed by the laws of
          England and Wales. Subject to any mandatory consumer rights you may have, the courts of England and Wales have
          exclusive jurisdiction.
        </P>
        <P>
          If you have a complaint, please contact us first using the details below. We will acknowledge it promptly,
          investigate it fairly and aim to resolve it as quickly as we reasonably can.
        </P>
      </>
    ),
  },
  {
    id: 'general',
    title: 'General Provisions',
    body: (
      <>
        <Ul
          items={[
            'Entire agreement: these Terms and the policies referred to in them are the entire agreement between you and us on their subject matter.',
            'Severability: if any provision is found to be invalid or unenforceable, the remaining provisions stay in full effect.',
            'No waiver: a failure or delay in enforcing any right is not a waiver of that right.',
            'Assignment: you may not transfer your rights or obligations under these Terms without our consent. We may assign ours to a successor or affiliate.',
            'Language: these Terms are provided in English, which prevails over any translation.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Contact Us',
    body: (
      <>
        <P>If you have any questions about these Terms, please get in touch:</P>
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

const RELATED = [
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Risk Disclosure', to: '/risk-disclosure' },
  { label: 'Cookie Policy', to: '/cookie-policy' },
  { label: 'AML Policy', to: '/aml-policy' },
]

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function TermsOfService() {
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
              <FileText className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">Terms of Service</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
                The rules that apply when you open an account and trade crypto and forex with {COMPANY.name}.
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
            <nav aria-label="Terms contents" className="sticky top-24 hidden rounded-2xl border border-white/10 bg-[#0B141B] p-3 lg:block">
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

          {/* Terms text */}
          <main className="min-w-0">
            <motion.div
              {...fade(0.15)}
              className="mb-8 flex gap-3 rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.07] p-4 sm:p-5"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#F59E0B]" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-slate-300">
                <span className="font-semibold text-white">Please read carefully. </span>
                Trading crypto and forex carries a high level of risk and you can lose some or all of your capital. By
                using our services you agree to these Terms.
              </p>
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