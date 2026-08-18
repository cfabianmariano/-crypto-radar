const COINGECKO = 'https://api.coingecko.com/api/v3'
const BINANCE = 'https://data-api.binance.vision/api/v3'

async function getJSON(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Fuente de datos respondió ${response.status}`)
  return response.json()
}

async function fetchBtcKlines() {
  const rows = await getJSON(`${BINANCE}/klines?symbol=BTCUSDT&interval=1d&limit=1000`)
  return rows.slice(-730).map((x) => ({
    timestamp: Number(x[0]),
    date: new Date(Number(x[0])).toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: '2-digit' }),
    price: Number(x[4]),
    open: Number(x[1]),
    high: Number(x[2]),
    low: Number(x[3]),
    volume: Number(x[5]),
  }))
}

export async function fetchCoinSnapshot(id) {
  if (id === 'bitcoin') {
    const h = await fetchBtcKlines()
    const current = h[h.length - 1]
    const prev = h[h.length - 2]
    const p7 = h[h.length - 8]?.price ?? current.price
    const p30 = h[h.length - 31]?.price ?? current.price
    const high2y = Math.max(...h.map((x) => x.high ?? x.price))
    return {
      id: 'bitcoin',
      symbol: 'btc',
      current_price: current.price,
      price_change_percentage_24h: ((current.price / prev.price) - 1) * 100,
      price_change_percentage_7d_in_currency: ((current.price / p7) - 1) * 100,
      price_change_percentage_30d_in_currency: ((current.price / p30) - 1) * 100,
      ath: high2y,
      ath_change_percentage: ((current.price / high2y) - 1) * 100,
      total_volume: null,
      market_cap: null,
      source: 'Binance BTCUSDT',
    }
  }

  const params = new URLSearchParams({
    vs_currency: 'usd', ids: id,
    price_change_percentage: '24h,7d,30d', sparkline: 'false',
  })
  const rows = await getJSON(`${COINGECKO}/coins/markets?${params}`)
  if (!rows?.length) throw new Error('No se encontró la moneda')
  return { ...rows[0], source: 'CoinGecko' }
}

export async function fetchCoinHistory(id, days = 365) {
  if (id === 'bitcoin') return fetchBtcKlines()

  const params = new URLSearchParams({ vs_currency: 'usd', days: String(days), interval: 'daily' })
  const data = await getJSON(`${COINGECKO}/coins/${id}/market_chart?${params}`)
  return data.prices.map(([timestamp, price]) => ({
    timestamp,
    date: new Date(timestamp).toLocaleDateString('es-US', { month: 'short', day: 'numeric' }),
    price,
  }))
}
