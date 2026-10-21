import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import { ArrowLeft, ArrowUp, BarChart3, ChevronDown, Clock, Cookie, List, Settings, ShieldCheck, Target } from 'lucide-react'

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
   COOKIE TABLE (cards on mobile, table on desktop)
──────────────────────────────────────────────── */

// REVIEW: run a cookie scan of your live site and make this list match what is really set.
const COOKIE_ROWS = [
  {
    category: 'Strictly necessary',
    purpose: 'Keep you logged in, protect your account, balance traffic and remember essential choices.',
    examples: 'Session and login cookies, security and fraud-prevention cookies, load balancing',
    duration: 'Session or up to 12 months',
    consent: 'Not required',
  },
  {
    category: 'Functional',
    purpose: 'Remember your settings and enable features such as live chat support.',
    examples: 'Language and display preferences, live-chat widget (Smartsupp)',
    duration: 'Session or up to 12 months',
    consent: 'Required',
  },
  {
    category: 'Analytics',
    purpose: 'Help us understand how visitors use the site so we can improve it. Data is aggregated.',
    examples: 'Page views, visit counts, feature usage, error reports',
    duration: 'Up to 24 months',
    consent: 'Required',
  },
  {
    category: 'Marketing',
    purpose: 'Measure the effectiveness of campaigns and show relevant content or offers.',
    examples: 'Advertising and campaign-measurement cookies, referral tracking',
    duration: 'Up to 12 months',
    consent: 'Required',
  },
]

function CookieTable() {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
      <div className="hidden grid-cols-[1fr_1.8fr_1.5fr_1fr_0.8fr] gap-4 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 md:grid">
        <span>Category</span>
        <span>Purpose</span>
        <span>Examples</span>
        <span>Duration</span>
        <span>Consent</span>
      </div>
      <ul className="divide-y divide-white/10">
        {COOKIE_ROWS.map((r) => (
          <li key={r.category} className="grid gap-2 px-4 py-4 text-sm md:grid-cols-[1fr_1.8fr_1.5fr_1fr_0.8fr] md:gap-4">
            <span className="font-semibold text-white">{r.category}</span>
            <span>
              <span className="mr-1.5 text-xs font-semibold text-slate-500 md:hidden">Purpose:</span>
              {r.purpose}
            </span>
            <span className="text-slate-400">
              <span className="mr-1.5 text-xs font-semibold text-slate-500 md:hidden">Examples:</span>
              {r.examples}
            </span>
            <span className="text-slate-400">
              <span className="mr-1.5 text-xs font-semibold text-slate-500 md:hidden">Duration:</span>
              {r.duration}
            </span>
            <span>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  r.consent === 'Required' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' : 'bg-[#3DDC97]/15 text-[#3DDC97]'
                }`}
              >
                {r.consent}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ────────────────────────────────────────────────
   COOKIE POLICY CONTENT
──────────────────────────────────────────────── */

const SECTIONS = [
  {
    id: 'introduction',
    title: 'Introduction',
    body: (
      <>
        <P>
          This Cookie Policy explains how {COMPANY.name} (“we”, “us”, “our”) uses cookies and similar technologies on our
          website and trading platform. {COMPANY.name} was founded and registered in {COMPANY.founded} and has its head
          office at {COMPANY.address}.
        </P>
        <P>
          It should be read together with our <L to="/privacy-policy">Privacy Policy</L>, which explains how we handle
          personal data, and our <L to="/terms-of-service">Terms of Service</L>. By continuing to use our website after
          being shown our cookie notice, you agree to our use of essential cookies. Where consent is needed for other
          cookies, we ask for it first.
        </P>
      </>
    ),
  },
  {
    id: 'what-are-cookies',
    title: 'What Are Cookies?',
    body: (
      <>
        <P>
          Cookies are small text files placed on your device when you visit a website. They are widely used to make sites
          work, keep them secure, remember your preferences and provide information to the site owner.
        </P>
        <P>Cookies can be described in a few different ways:</P>
        <Dl
          items={[
            ['Session cookies', 'are temporary and deleted when you close your browser.'],
            ['Persistent cookies', 'stay on your device for a set period or until you delete them.'],
            ['First-party cookies', 'are set by us directly when you use our website.'],
            ['Third-party cookies', 'are set by other organisations whose services we use, such as live chat or analytics providers.'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'why-we-use',
    title: 'Why We Use Cookies',
    body: (
      <>
        <P>We use cookies and similar technologies to:</P>
        <Ul
          items={[
            'keep you signed in and your trading account secure;',
            'detect and prevent fraud, suspicious logins and other misuse;',
            'remember your settings and preferences;',
            'provide features such as live chat support;',
            'understand how visitors use our website so we can improve it;',
            'measure the performance of our content and, where you agree, our marketing.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'types',
    title: 'The Cookies We Use',
    body: (
      <>
        <P>
          The table below shows the categories of cookies that may be used on our website, what they do and whether we ask
          for your consent first. The exact cookies in use can change as our site and providers change.
        </P>
        <CookieTable />
      </>
    ),
  },
  {
    id: 'necessary',
    title: 'Strictly Necessary Cookies',
    body: (
      <>
        <P>
          These cookies are essential for the website and platform to work. They allow you to log in, move between pages
          securely, and protect your account and our systems from fraud and attacks. Because the service cannot function
          properly without them, they do not need your consent and cannot be switched off in our systems. You can block
          them in your browser, but parts of the site may then stop working.
        </P>
      </>
    ),
  },
  {
    id: 'optional',
    title: 'Functional, Analytics and Marketing Cookies',
    body: (
      <>
        <P>These cookies are optional, and we only use them with your consent where the law requires it:</P>
        <Dl
          items={[
            ['Functional', 'remember choices you make and support features such as live chat so you can reach our support team.'],
            ['Analytics', 'tell us which pages are visited, how long people stay and where errors occur, so we can make the site better. This information is aggregated and not used to identify you personally.'],
            ['Marketing', 'help us measure campaigns and show you content or offers that are more relevant to your interests.'],
          ]}
        />
        <P>You can change your mind and withdraw consent at any time, as explained in the “Managing Your Cookie Choices” section.</P>
      </>
    ),
  },
  {
    id: 'similar',
    title: 'Similar Technologies',
    body: (
      <>
        <P>
          Besides cookies, we may use other technologies that work in a similar way. These include local storage and
          session storage in your browser, which hold small amounts of data such as your preferences, as well as pixels and
          tags that help us measure activity. References to “cookies” in this policy include these technologies.
        </P>
      </>
    ),
  },
  {
    id: 'third-party',
    title: 'Third-Party Cookies',
    body: (
      <>
        <P>
          Some cookies are set by third parties whose services we use, such as live-chat, analytics, security and payment
          providers. These companies may collect information about your device and activity on our site and may combine it
          with information from other sites. We do not control these cookies, and their use is governed by the privacy and
          cookie policies of those providers.
        </P>
        <P>
          Our site may also contain links to social media and other external sites, which have their own cookies and
          policies.
        </P>
      </>
    ),
  },
  {
    id: 'consent',
    title: 'Consent and Legal Basis',
    body: (
      <>
        <P>
          Under UK law, including the Privacy and Electronic Communications Regulations (PECR), UK GDPR and the Data
          Protection Act 2018, we must get your consent before placing non-essential cookies on your device. We do not need
          consent for strictly necessary cookies.
        </P>
        <P>
          Where we ask for consent, you can accept or refuse non-essential cookies, and refusing will not stop you from
          using the essential parts of our service. Where cookies involve personal data, we handle that data as described
          in our <L to="/privacy-policy">Privacy Policy</L>.
        </P>
      </>
    ),
  },
  {
    id: 'managing',
    title: 'Managing Your Cookie Choices',
    body: (
      <>
        <P>
          You can manage cookies through your browser settings. Most browsers let you view, block or delete cookies, and
          you can usually choose to block third-party cookies only. Menu names vary by browser version, but you can
          generally find these controls here:
        </P>
        <Dl
          items={[
            ['Google Chrome', 'Settings, then Privacy and security, then Third-party cookies.'],
            ['Safari', 'Settings or Preferences, then Privacy.'],
            ['Mozilla Firefox', 'Settings, then Privacy & Security, then Cookies and Site Data.'],
            ['Microsoft Edge', 'Settings, then Cookies and site permissions.'],
          ]}
        />
        <P>
          Blocking all cookies may stop parts of the website, including secure login, from working. If you use several
          devices or browsers, you will need to adjust the settings on each one. You can also delete cookies that are
          already stored at any time.
        </P>
        <P>
          For clear, independent guidance on cookies, see the UK regulator’s advice:{' '}
          <Ext href="https://ico.org.uk/for-the-public/online/cookies/">ICO guidance on cookies</Ext>.
        </P>
      </>
    ),
  },
  {
    id: 'dnt',
    title: 'Do Not Track Signals',
    body: (
      <>
        <P>
          Some browsers offer a “Do Not Track” signal. There is currently no common standard for responding to these
          signals, so our site does not change how it works when one is received. We do respect the cookie choices you make
          in your browser and, where available, in our cookie settings.
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
          We may update this Cookie Policy from time to time, for example when we add or change the cookies we use or when
          the law changes. The latest version will always be on our website with the “last updated” date shown at the top.
          Where changes are significant, we will take reasonable steps to let you know and, if necessary, ask for your
          consent again.
        </P>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Contact Us',
    body: (
      <>
        <P>If you have questions about how we use cookies, please contact us:</P>
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
  { icon: ShieldCheck, title: 'Necessary', status: 'Always on', text: 'Login, security and core site functions.', required: true },
  { icon: Settings, title: 'Functional', status: 'With consent', text: 'Preferences and live chat support.', required: false },
  { icon: BarChart3, title: 'Analytics', status: 'With consent', text: 'Anonymous usage insights to improve the site.', required: false },
  { icon: Target, title: 'Marketing', status: 'With consent', text: 'Campaign measurement and relevant content.', required: false },
]

const RELATED = [
  { label: 'Terms of Service', to: '/terms-of-service' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Risk Disclosure', to: '/risk-disclosure' },
  { label: 'AML Policy', to: '/aml-policy' },
]

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function CookiePolicy() {
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
              <Cookie className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">Cookie Policy</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
                How {COMPANY.name} uses cookies and similar technologies, and how you can control them.
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
            <nav aria-label="Cookie policy contents" className="sticky top-24 hidden rounded-2xl border border-white/10 bg-[#0B141B] p-3 lg:block">
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
            {/* Cookie types at a glance */}
            <motion.div {...fade(0.15)} className="mb-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Cookie types at a glance</p>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {GLANCE.map((g) => {
                  const Icon = g.icon
                  return (
                    <div key={g.title} className="rounded-2xl border border-white/10 bg-[#0B141B] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3DDC97]/10 text-[#3DDC97] ring-1 ring-[#3DDC97]/20">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                            g.required ? 'bg-[#3DDC97]/15 text-[#3DDC97]' : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                          }`}
                        >
                          {g.status}
                        </span>
                      </div>
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