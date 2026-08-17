const BASE = 'https://api.coingecko.com/api/v3'

async function getJSON(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`CoinGecko respondió ${response.status}`)
  }
  return response.json()
}

export async function fetchCoinSnapshot(id) {
  const params = new URLSearchParams({
    vs_currency: 'usd',
    ids: id,
    price_change_percentage: '24h,7d,30d',
    sparkline: 'false',
  })
  const rows = await getJSON(`${BASE}/coins/markets?${params}`)
  if (!rows?.length) throw new Error('No se encontró la moneda')
  return rows[0]
}

export async function fetchCoinHistory(id, days = 365) {
  const params = new URLSearchParams({
    vs_currency: 'usd',
    days: String(days),
    interval: 'daily',
  })
  const data = await getJSON(`${BASE}/coins/${id}/market_chart?${params}`)
  return data.prices.map(([timestamp, price]) => ({
    timestamp,
    date: new Date(timestamp).toLocaleDateString('es-US', {
      month: 'short',
      day: 'numeric',
    }),
    price,
  }))
}
