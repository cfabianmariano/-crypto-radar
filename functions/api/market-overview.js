const IDS = ['bitcoin','ripple','ethereum','binancecoin','theta-network']

function pair(base, quote) {
  if (!base?.current_price || !quote?.current_price) return null
  const value = base.current_price / quote.current_price
  const a = Number(base.price_change_percentage_24h || 0) / 100
  const b = Number(quote.price_change_percentage_24h || 0) / 100
  const change24 = ((1 + a) / (1 + b) - 1) * 100
  return { value, change24 }
}

export async function onRequestGet() {
  const params = new URLSearchParams({
    vs_currency: 'usd',
    ids: IDS.join(','),
    price_change_percentage: '24h,7d,30d',
    sparkline: 'false',
  })

  try {
    const [marketsResponse, globalResponse] = await Promise.all([
      fetch(`https://api.coingecko.com/api/v3/coins/markets?${params}`, { headers: { accept: 'application/json' } }),
      fetch('https://api.coingecko.com/api/v3/global', { headers: { accept: 'application/json' } }),
    ])

    if (!marketsResponse.ok) throw new Error(`CoinGecko markets ${marketsResponse.status}`)
    const rows = await marketsResponse.json()
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]))

    let global = null
    if (globalResponse.ok) {
      const g = await globalResponse.json()
      global = {
        btcDominance: Number(g?.data?.market_cap_percentage?.btc),
        marketCapChange24: Number(g?.data?.market_cap_change_percentage_24h_usd),
        totalMarketCap: Number(g?.data?.total_market_cap?.usd),
      }
    }

    const compact = rows.map((row) => ({
      id: row.id,
      symbol: String(row.symbol || '').toUpperCase(),
      name: row.name,
      price: Number(row.current_price),
      change24: Number(row.price_change_percentage_24h),
      change7d: Number(row.price_change_percentage_7d_in_currency),
      change30d: Number(row.price_change_percentage_30d_in_currency),
      marketCap: Number(row.market_cap),
      volume24: Number(row.total_volume),
    }))

    const btc = byId.bitcoin
    const xrp = byId.ripple
    const eth = byId.ethereum
    const bnb = byId.binancecoin
    const theta = byId['theta-network']

    return Response.json({
      assets: compact,
      pairs: {
        'XRP/BTC': pair(xrp, btc),
        'ETH/BTC': pair(eth, btc),
        'BNB/BTC': pair(bnb, btc),
        'THETA/BTC': pair(theta, btc),
        'BTC/XRP': pair(btc, xrp),
      },
      global,
      generatedAt: new Date().toISOString(),
      source: 'CoinGecko',
    }, { headers: { 'cache-control': 'public, max-age=120' } })
  } catch (error) {
    return Response.json({ error: error.message || 'market_overview_failed', generatedAt: new Date().toISOString() }, {
      status: 502,
      headers: { 'cache-control': 'no-store' },
    })
  }
}
