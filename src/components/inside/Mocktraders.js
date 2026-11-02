// src/data/mockTraders.js
// SIMULATED DATA: every profile below is generated from a seeded formula. These are not real people and the
// numbers are not real performance. Every UI that shows them must label them "Simulated".

const seed = (n) => { const x = Math.sin(n + 1) * 10000; return x - Math.floor(x) }
const rnd = (min, max, n) => min + seed(n) * (max - min)
const pick = (arr, n) => arr[Math.floor(seed(n) * arr.length)]
const fmt2 = (n) => parseFloat(n.toFixed(2))

const TAGS1 = ['Precision Hunter', 'Newbie', 'Veteran', 'Momentum King', 'Grid Master', 'Swing Expert', 'Scalper', 'Macro Trader']
const TAGS2 = ['Neutral', 'Short Bias', 'Long Bias', 'Contrarian', 'Trend Follower', 'Mean Reversion', 'News Driven', 'Algo Based']
const TAGS3 = ['Mid-Large Cap', 'Small Cap', 'Blue Chip', 'DeFi Focus', 'Forex Only', 'Multi-Asset', 'Crypto Native', 'Macro Global']
const MEMBERS = ['Pro Trader', 'Standard', 'Elite', 'Rising Star']
const AVATARS = ['🧑‍💼', '👩‍💻', '🧑‍🚀', '👨‍🎓', '👩‍🔬', '🦸', '🧙', '👨‍💻', '🥷', '👩‍🏫']
const DURATIONS = [6, 12, 24]

// Only pairs that exist in the Trade page pair list, so the backend accepts them.
const ASSETS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'AVAX/USDT', 'ADA/USDT', 'MATIC/USDT', 'LINK/USDT',
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
  'EUR/CHF', 'GBP/CHF', 'AUD/JPY', 'CHF/JPY', 'CAD/JPY', 'EUR/AUD', 'GBP/AUD', 'AUD/CAD', 'NZD/JPY',
]

function genSparkline(n, length, bullish) {
  const points = []
  let v = 50 + rnd(-10, 10, n)
  for (let i = 0; i < length; i++) {
    const drift = bullish ? 0.15 : -0.15
    const noise = (seed(n * 100 + i) - 0.5) * 8
    v = Math.max(10, Math.min(90, v + drift + noise))
    points.push(fmt2(v))
  }
  return points
}

export const TRADERS = Array.from({ length: 60 }, (_, i) => {
  const s = i * 17 + 3
  const winRate = fmt2(rnd(45, 92, s))
  const longWin = fmt2(Math.min(95, Math.max(20, winRate + rnd(-12, 12, s + 1))))
  const shortWin = fmt2(Math.min(95, Math.max(20, winRate + rnd(-18, 8, s + 2))))
  const totalPnl = fmt2(rnd(12000, 980000, s + 3))
  const longPnl = fmt2(totalPnl * rnd(0.3, 0.85, s + 4))
  const shortPnl = fmt2(totalPnl - longPnl)
  const leverage = fmt2(rnd(1.5, 25, s + 5))
  const trades = Math.floor(rnd(30, 420, s + 9))
  const pnlPct = fmt2(rnd(-8, 42, s + 13))
  const bullish = pnlPct >= 0
  const favAsset = pick(ASSETS, s + 18)

  return {
    id: i + 1,
    simulated: false,
    handle: `USER-${String(i + 1).padStart(3, '0')}`,
    avatar: pick(AVATARS, s + 25),
    membership: pick(MEMBERS, s + 14),
    stars: fmt2(rnd(2.5, 5.0, s + 12)),
    tags: [pick(TAGS1, s + 22), pick(TAGS2, s + 23), pick(TAGS3, s + 24)],
    favAsset,
    followers: Math.floor(rnd(12, 8400, s + 16)),
    totalPnl, longPnl, shortPnl,
    leverage,
    winRate, longWin, shortWin,
    avgProfit: fmt2(rnd(0.8, 24.5, s + 15)),
    maxDD: fmt2(rnd(2, 48, s + 17)),
    trades,
    wins: Math.floor(trades * (winRate / 100)),
    pnlPct,
    bullish,
    charts: {
      '1H': genSparkline(s + 30, 30, seed(s + 30) > 0.4),
      '4H': genSparkline(s + 31, 32, seed(s + 31) > 0.4),
      '1D': genSparkline(s + 32, 36, bullish),
      '1W': genSparkline(s + 33, 40, bullish),
      '1M': genSparkline(s + 34, 44, bullish),
    },
    // The trade setup a user copies. The amount is not fixed: it is suggested from riskPct of the user's balance.
    setup: {
      pair: favAsset,
      side: seed(s + 40) > 0.5 ? 'buy' : 'sell',
      leverage: Math.max(1, Math.round(leverage)),
      takeProfit: fmt2(rnd(2, 12, s + 41)),
      stopLoss: fmt2(rnd(1, 5, s + 42)),
      durationHours: pick(DURATIONS, s + 43),
      riskPct: Math.round(rnd(5, 25, s + 44)),
    },
  }
})