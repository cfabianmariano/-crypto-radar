const SYMBOLS = {
  bitcoin: 'BTCUSDT',
  ripple: 'XRPUSDT',
  ethereum: 'ETHUSDT',
  binancecoin: 'BNBUSDT',
  'theta-network': 'THETAUSDT',
}

const META = {
  bitcoin: { symbol: 'BTC', name: 'Bitcoin' },
  ripple: { symbol: 'XRP', name: 'XRP' },
  ethereum: { symbol: 'ETH', name: 'Ethereum' },
  binancecoin: { symbol: 'BNB', name: 'BNB' },
  'theta-network': { symbol: 'THETA', name: 'Theta Network' },
}

function pair(base, quote) {
  if (!base?.price || !quote?.price) return null
  const value = base.price / quote.price
  const a = Number(base.change24 || 0) / 100
  const b = Number(quote.change24 || 0) / 100
  return { value, change24: ((1 + a) / (1 + b) - 1) * 100 }
}

async function json(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`${response.status}`)
  return response.json()
}

async function binanceAsset(id, symbol) {
  const base = 'https://data-api.binance.vision/api/v3'
  const [ticker, klines] = await Promise.all([
    json(`${base}/ticker/24hr?symbol=${symbol}`),
    json(`${base}/klines?symbol=${symbol}&interval=1d&limit=32`),
  ])
  const price = Number(ticker.lastPrice)
  const closes = klines.map((r) => Number(r[4])).filter(Number.isFinite)
  const p7 = closes.at(-8) ?? closes[0] ?? price
  const p30 = closes.at(-31) ?? closes[0] ?? price
  return {
    id,
    symbol: META[id].symbol,
    name: META[id].name,
    price,
    change24: Number(ticker.priceChangePercent),
    change7d: p7 ? (price / p7 - 1) * 100 : null,
    change30d: p30 ? (price / p30 - 1) * 100 : null,
    volume24: Number(ticker.quoteVolume),
  }
}

async function fetchGlobalOptional() {
  try {
    const g = await json('https://api.coingecko.com/api/v3/global')
    return {
      btcDominance: Number(g?.data?.market_cap_percentage?.btc),
      marketCapChange24: Number(g?.data?.market_cap_change_percentage_24h_usd),
      totalMarketCap: Number(g?.data?.total_market_cap?.usd),
    }
  } catch {
    return null
  }
}

export async function onRequestGet() {
  try {
    const entries = Object.entries(SYMBOLS)
    const settled = await Promise.allSettled(entries.map(([id, symbol]) => binanceAsset(id, symbol)))
    const assets = settled.filter((x) => x.status === 'fulfilled').map((x) => x.value)
    if (assets.length < 3) throw new Error('No hay suficientes cotizaciones disponibles')

    const byId = Object.fromEntries(assets.map((a) => [a.id, a]))
    const btc = byId.bitcoin
    const xrp = byId.ripple
    const eth = byId.ethereum
    const bnb = byId.binancecoin
    const theta = byId['theta-network']
    const global = await fetchGlobalOptional()

    return Response.json({
      assets,
      pairs: {
        'XRP/BTC': pair(xrp, btc),
        'ETH/BTC': pair(eth, btc),
        'BNB/BTC': pair(bnb, btc),
        'THETA/BTC': pair(theta, btc),
        'BTC/XRP': pair(btc, xrp),
      },
      global,
      generatedAt: new Date().toISOString(),
      source: 'Binance public data',
    }, { headers: { 'cache-control': 'public, max-age=120' } })
  } catch (error) {
    return Response.json({ assets: [], pairs: {}, global: null, error: error.message || 'market_overview_failed', generatedAt: new Date().toISOString() }, {
      status: 200,
      headers: { 'cache-control': 'no-store' },
    })
  }
}
