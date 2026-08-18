const COINGECKO = 'https://api.coingecko.com/api/v3'
const BINANCE = 'https://data-api.binance.vision/api/v3'

async function getJSON(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Fuente de datos respondió ${response.status}`)
  return response.json()
}

function mapKline(x) {
  return {
    timestamp: Number(x[0]),
    date: new Date(Number(x[0])).toLocaleDateString('es-US', {
      month: 'short', day: 'numeric', year: '2-digit',
    }),
    open: Number(x[1]),
    high: Number(x[2]),
    low: Number(x[3]),
    close: Number(x[4]),
    price: Number(x[4]),
    volume: Number(x[5]),
  }
}

export async function fetchBtcCandles({ interval = '1d', startTime, endTime, maxCandles = 6000 } = {}) {
  const end = endTime ?? Date.now()
  const start = startTime ?? (end - 730 * 24 * 60 * 60 * 1000)
  const result = []
  let cursor = start

  while (cursor < end && result.length < maxCandles) {
    const params = new URLSearchParams({
      symbol: 'BTCUSDT',
      interval,
      limit: '1000',
      startTime: String(cursor),
      endTime: String(end),
    })
    const rows = await getJSON(`${BINANCE}/klines?${params}`)
    if (!rows?.length) break

    for (const row of rows) {
      if (result.length >= maxCandles) break
      result.push(mapKline(row))
    }

    const lastOpenTime = Number(rows[rows.length - 1][0])
    if (!Number.isFinite(lastOpenTime) || lastOpenTime <= cursor) break
    cursor = lastOpenTime + 1
    if (rows.length < 1000) break
  }

  return result
}

async function fetchBtcDailyModelHistory() {
  const end = Date.now()
  const start = end - 760 * 24 * 60 * 60 * 1000
  const rows = await fetchBtcCandles({ interval: '1d', startTime: start, endTime: end, maxCandles: 760 })
  return rows.slice(-730)
}

export async function fetchCoinSnapshot(id) {
  if (id === 'bitcoin') {
    const h = await fetchBtcDailyModelHistory()
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
  if (id === 'bitcoin') return fetchBtcDailyModelHistory()

  const params = new URLSearchParams({ vs_currency: 'usd', days: String(days), interval: 'daily' })
  const data = await getJSON(`${COINGECKO}/coins/${id}/market_chart?${params}`)
  return data.prices.map(([timestamp, price]) => ({
    timestamp,
    date: new Date(timestamp).toLocaleDateString('es-US', { month: 'short', day: 'numeric' }),
    price,
  }))
}
