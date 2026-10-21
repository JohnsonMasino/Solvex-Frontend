import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import { Activity, AlertTriangle, ArrowLeft, ArrowUp, ChevronDown, Clock, Layers, List, Server, TrendingDown } from 'lucide-react'

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
const RED = '#F6465D'

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
   RISK DISCLOSURE CONTENT
──────────────────────────────────────────────── */

const SECTIONS = [
  {
    id: 'purpose',
    title: 'Purpose of This Disclosure',
    body: (
      <>
        <P>
          This Risk Disclosure explains the main risks of trading cryptocurrencies and foreign exchange (forex) through
          the {COMPANY.name} platform. {COMPANY.name} was founded and registered in {COMPANY.founded} and has its head
          office at {COMPANY.address}.
        </P>
        <P>
          It is not possible to list every risk, and this document does not replace professional advice. You should read it
          carefully together with our <L to="/terms-of-service">Terms of Service</L> before opening an account or placing
          any trade. If you do not understand the risks, you should not trade.
        </P>
      </>
    ),
  },
  {
    id: 'general',
    title: 'General Risk Warning',
    body: (
      <>
        <P>
          Trading cryptocurrencies and forex is highly speculative and carries a high level of risk. It is not suitable for
          everyone. You can lose some or all of the money you put in, and in some circumstances you may lose more than your
          initial deposit if leveraged products are involved.
        </P>
        <P>
          Only trade with money you can afford to lose. Do not use funds you need for living expenses, debts, savings or
          emergencies. Profits are never guaranteed, and no one can reliably predict market movements.
        </P>
      </>
    ),
  },
  {
    id: 'market',
    title: 'Market Risk and Volatility',
    body: (
      <>
        <P>
          Prices can rise and fall quickly and without warning. Market prices are affected by many factors that are outside
          our control and difficult to predict, including:
        </P>
        <Ul
          items={[
            'economic data, interest-rate decisions and central-bank policy;',
            'political events, elections, conflicts and changes in government policy;',
            'news, social media sentiment and market rumours;',
            'changes in supply and demand, and the actions of large market participants;',
            'unexpected events such as natural disasters, cyber-attacks or financial-institution failures.',
          ]}
        />
        <P>
          Sudden price moves can cause large losses within seconds, particularly around major news announcements and when
          markets are thin, such as weekends and holidays for some crypto assets.
        </P>
      </>
    ),
  },
  {
    id: 'leverage',
    title: 'Leverage and Margin Risk',
    body: (
      <>
        <P>
          Where leveraged trading is available, leverage lets you control a position larger than the funds you deposit.
          This works in both directions: it can magnify profits, but it also magnifies losses, and a small adverse price
          move can result in a loss greater than your margin.
        </P>
        <Ul
          items={[
            'You may be required to add funds quickly to keep positions open (a margin call).',
            'If your margin falls below the required level, positions may be closed automatically, often at a loss and without prior notice.',
            'Losses can exceed the amount you deposited, depending on the product and the protections that apply to you.',
          ]}
        />
        <P>
          Higher leverage means higher risk. Many traders reduce risk by using lower leverage than the maximum available.
        </P>
      </>
    ),
  },
  {
    id: 'crypto',
    title: 'Cryptocurrency Risks',
    body: (
      <>
        <P>Cryptocurrencies carry additional risks beyond those of traditional markets:</P>
        <Dl
          items={[
            ['Extreme volatility', 'values can fall by large amounts in a short time, and may drop to zero.'],
            ['Limited regulation and protection', 'crypto assets are largely unregulated in many places, and you may not be protected by investor-compensation or ombudsman schemes if something goes wrong.'],
            ['Irreversible transactions', 'transfers on blockchain networks usually cannot be reversed. Sending to a wrong address may mean permanent loss.'],
            ['Technology risk', 'software bugs, network congestion, forks, protocol changes and security breaches can affect an asset’s value or usability.'],
            ['Liquidity risk', 'some assets can be hard to sell at a fair price, especially in large amounts or in stressed markets.'],
            ['Market manipulation', 'smaller crypto markets can be more exposed to manipulation, false information and sudden price swings.'],
            ['Regulatory change', 'new laws, bans or restrictions in any country can sharply affect prices and your ability to trade.'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'forex',
    title: 'Forex Risks',
    body: (
      <>
        <P>Currency prices are influenced by many global factors, and forex trading carries its own specific risks:</P>
        <Dl
          items={[
            ['Interest-rate and policy changes', 'central-bank decisions can move currencies sharply and unexpectedly.'],
            ['Geopolitical events', 'political instability, sanctions and conflicts can cause rapid currency moves.'],
            ['Price gaps', 'prices can jump from one level to another with no trading in between, especially over weekends and after major news.'],
            ['Overnight financing', 'holding positions overnight may involve financing charges that reduce returns or add to losses.'],
            ['Currency conversion', 'if your account currency differs from the currency of a pair, exchange-rate movements can affect your results.'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'liquidity',
    title: 'Liquidity Risk',
    body: (
      <>
        <P>
          In some market conditions it may be difficult or impossible to open or close a position at your chosen price.
          Liquidity can dry up during news events, market stress, holidays or technical problems, causing wider spreads and
          larger price differences between the price you expected and the price you receive.
        </P>
      </>
    ),
  },
  {
    id: 'execution',
    title: 'Slippage and Order Risk',
    body: (
      <>
        <P>
          Orders may be filled at a different price from the one you saw when you placed them, which is known as slippage.
          Fast markets can make slippage significant.
        </P>
        <Ul
          items={[
            'A stop-loss order does not guarantee that your loss will be limited to the level you set. In a gap or fast market, it may fill at a worse price.',
            'A limit order may not be filled at all if the market does not reach your price, or reaches it only briefly.',
            'Market orders execute at the best available price, which may be far from the last price displayed.',
            'Once an order is executed it generally cannot be reversed.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'technology',
    title: 'Technology and System Risk',
    body: (
      <>
        <P>
          Online trading depends on technology that can fail. Risks include interruptions or delays in the internet, your
          device, our platform, data feeds or third-party providers, as well as software errors and scheduled or emergency
          maintenance. During such events you may be unable to open, monitor or close positions, and prices shown may be
          delayed or wrong.
        </P>
        <P>
          You are responsible for keeping suitable equipment and a reliable connection, and for monitoring your open
          positions. We are not liable for losses caused by events outside our reasonable control, as set out in our{' '}
          <L to="/terms-of-service">Terms of Service</L>.
        </P>
      </>
    ),
  },
  {
    id: 'counterparty',
    title: 'Counterparty and Platform Risk',
    body: (
      <>
        <P>
          Your trading depends on the financial and operational strength of the platform, its payment providers, banks and
          liquidity or market-data suppliers. If any of these fail, become insolvent, are subject to restrictions, or are
          affected by fraud or a security breach, you may experience delays, restrictions or loss. You should understand how
          your funds are held and what protections, if any, apply to you before depositing.
        </P>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Cybersecurity and Account Risk',
    body: (
      <>
        <P>
          Fraudsters target traders with phishing messages, fake support agents, cloned websites and unrealistic investment
          offers. If your credentials are stolen or you are tricked into sending funds, you may lose money permanently.
        </P>
        <Ul
          items={[
            'Use a strong, unique password and enable two-factor authentication.',
            'Never share your password, verification codes or account access with anyone.',
            'Be cautious of anyone who promises guaranteed returns or pressures you to act quickly.',
            'Always check you are on the official website before logging in.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'regulatory',
    title: 'Regulatory, Legal and Tax Risk',
    body: (
      <>
        <P>
          Laws and regulations that apply to cryptocurrencies and forex differ between countries and can change quickly.
          New rules may restrict, tax or prohibit certain products or activities, or affect our ability to offer services in
          your location. You are responsible for knowing and following the laws that apply to you.
        </P>
        <P>
          Trading profits and losses may have tax consequences. We do not provide tax advice, and you should consult a
          qualified tax professional about your own situation.
        </P>
      </>
    ),
  },
  {
    id: 'performance',
    title: 'Past Performance and No Guarantee',
    body: (
      <>
        <P>
          Past performance is not a reliable indicator of future results. Examples, charts, sample data and any trading
          scenarios shown on our website or in educational material are for illustration only. They are not live prices and
          do not guarantee, predict or represent any result you might achieve.
        </P>
      </>
    ),
  },
  {
    id: 'advice',
    title: 'No Investment Advice',
    body: (
      <>
        <P>
          {COMPANY.name} provides access to trading and general educational information only. Nothing on our platform or
          website is investment, financial, legal or tax advice, or a recommendation to buy or sell any instrument. All
          trading decisions are yours alone, and you are responsible for any gains or losses.
        </P>
      </>
    ),
  },
  {
    id: 'psychology',
    title: 'Behavioural and Emotional Risk',
    body: (
      <>
        <P>
          Fear, greed, overconfidence and the urge to win back losses are common causes of poor decisions in trading.
          Overtrading, ignoring a plan, moving or removing stop-losses and increasing position sizes after a loss can all
          turn manageable losses into serious ones. Trading can also become habit-forming. If trading is affecting your
          finances or wellbeing, stop and seek support.
        </P>
      </>
    ),
  },
  {
    id: 'suitability',
    title: 'Suitability and Your Responsibility',
    body: (
      <>
        <P>Before trading you should carefully consider:</P>
        <Ul
          items={[
            'your investment objectives, experience and knowledge of the markets;',
            'your financial situation and how much loss you could bear without hardship;',
            'whether trading, and especially leveraged trading, is appropriate for you.',
          ]}
        />
        <P>
          If you are unsure, seek advice from an independent, suitably qualified financial adviser before you trade.
        </P>
      </>
    ),
  },
  {
    id: 'managing',
    title: 'Managing Your Risk',
    body: (
      <>
        <P>You cannot remove risk, but you can manage it. Many experienced traders follow practices such as:</P>
        <Ul
          items={[
            'risking only a small percentage of their account, often 1 to 2%, on any single trade;',
            'planning entry, stop-loss and target before opening a position;',
            'using lower leverage and keeping enough free margin to absorb price swings;',
            'diversifying rather than putting everything into one position;',
            'keeping a trading journal and reviewing results regularly;',
            'starting small while learning, and never trading with borrowed money.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'acknowledgement',
    title: 'Your Acknowledgement',
    body: (
      <>
        <P>By opening an account and trading with us, you confirm that you:</P>
        <Ul
          items={[
            'have read and understood this Risk Disclosure;',
            'understand that you can lose some or all of your capital;',
            'are trading with money you can afford to lose;',
            'accept that you are solely responsible for your trading decisions.',
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
        <P>If you have questions about the risks described here, please contact us before you trade:</P>
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

// Illustrative risk levels (out of 5) shown as animated meters
const GLANCE = [
  { icon: TrendingDown, title: 'Volatility', level: 5, label: 'Very high', text: 'Prices can move sharply in seconds.' },
  { icon: Layers, title: 'Leverage', level: 5, label: 'Magnifies losses', text: 'Small moves can mean large losses.' },
  { icon: Activity, title: 'Liquidity', level: 3, label: 'Variable', text: 'Exits may be hard in stressed markets.' },
  { icon: Server, title: 'Technology', level: 3, label: 'Moderate', text: 'Outages and delays can affect trades.' },
]

const RELATED = [
  { label: 'Terms of Service', to: '/terms-of-service' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Cookie Policy', to: '/cookie-policy' },
  { label: 'AML Policy', to: '/aml-policy' },
]

/* ────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────── */

export default function RiskDisclosure() {
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
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#F6465D]/10 blur-3xl"
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
            <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F6465D]/10 text-[#F6465D] ring-1 ring-[#F6465D]/25 sm:flex">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">Risk Disclosure</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
                The risks of trading crypto and forex with {COMPANY.name}, explained plainly. Please read before you trade.
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
            <nav aria-label="Risk disclosure contents" className="sticky top-24 hidden rounded-2xl border border-white/10 bg-[#0B141B] p-3 lg:block">
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

          {/* Disclosure text */}
          <main className="min-w-0">
            {/* Capital at risk banner */}
            <motion.div
              {...fade(0.15)}
              role="note"
              className="relative mb-6 overflow-hidden rounded-2xl border border-[#F6465D]/40 bg-gradient-to-br from-[#F6465D]/[0.14] to-[#F6465D]/[0.04] p-5 sm:p-6"
            >
              <motion.span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1 bg-[#F6465D]"
                animate={reduce ? undefined : { opacity: [1, 0.4, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="flex gap-3.5">
                <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[#F6465D]" aria-hidden="true" />
                <div>
                  <p className="text-base font-bold text-white sm:text-lg">Your capital is at risk</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                    Trading crypto and forex carries a high level of risk and may not be suitable for everyone. You can
                    lose some or all of your capital. Never trade with money you cannot afford to lose, and make sure you
                    fully understand the risks involved.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Risks at a glance */}
            <motion.div {...fade(0.22)} className="mb-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Key risks at a glance (illustrative)</p>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {GLANCE.map((g, gi) => {
                  const Icon = g.icon
                  return (
                    <div key={g.title} className="rounded-2xl border border-white/10 bg-[#0B141B] p-4">
                      <div className="flex items-center justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F6465D]/10 text-[#F6465D] ring-1 ring-[#F6465D]/20">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="text-[0.7rem] font-medium text-slate-400">{g.label}</span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-white">{g.title}</p>
                      <div className="mt-2 flex gap-1" aria-label={`${g.title} risk level ${g.level} out of 5`} role="img">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <motion.span
                            key={n}
                            className="h-1.5 flex-1 origin-left rounded-full"
                            style={{ background: n <= g.level ? (g.level >= 5 ? RED : '#F59E0B') : 'rgba(255,255,255,0.08)' }}
                            initial={reduce ? false : { scaleX: 0 }}
                            whileInView={{ scaleX: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: gi * 0.1 + n * 0.08 }}
                          />
                        ))}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">{g.text}</p>
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