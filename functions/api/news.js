const QUERY = 'bitcoin OR cryptocurrency OR "Federal Reserve" OR Treasury OR inflation OR yields OR dollar OR SEC OR Ripple OR XRP'

function stripHtml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return stripHtml(match?.[1] || '')
}

async function fetchGoogleNews() {
  const params = new URLSearchParams({
    q: QUERY,
    hl: 'en-US',
    gl: 'US',
    ceid: 'US:en',
  })
  const response = await fetch(`https://news.google.com/rss/search?${params}`, {
    headers: { 'user-agent': 'Mozilla/5.0 CryptoRadar/1.0' },
  })
  if (!response.ok) throw new Error(`Google News ${response.status}`)
  const xml = await response.text()
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1])
  const seen = new Set()
  const articles = []
  for (const item of items) {
    const title = tag(item, 'title')
    const url = tag(item, 'link')
    const pubDate = tag(item, 'pubDate')
    const source = tag(item, 'source')
    if (!title || !url) continue
    const key = `${title}|${source}`
    if (seen.has(key)) continue
    seen.add(key)
    articles.push({
      title,
      url,
      domain: source || 'Google News',
      seendate: pubDate ? new Date(pubDate).toISOString() : null,
      language: 'English',
      sourcecountry: 'US',
    })
    if (articles.length >= 20) break
  }
  if (!articles.length) throw new Error('Google News sin resultados')
  return { articles, source: 'Google News' }
}

async function fetchGdelt() {
  const params = new URLSearchParams({
    query: `(${QUERY})`,
    mode: 'ArtList',
    maxrecords: '30',
    format: 'json',
    sort: 'HybridRel',
    timespan: '1d',
  })
  const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
    headers: { 'user-agent': 'crypto-radar/1.0' },
  })
  if (!response.ok) throw new Error(`GDELT ${response.status}`)
  const data = await response.json()
  const seen = new Set()
  const articles = (data.articles || [])
    .filter((a) => a.url && a.title)
    .filter((a) => {
      const key = a.url.replace(/\?.*$/, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 20)
    .map((a) => ({
      title: a.title,
      url: a.url,
      domain: a.domain,
      seendate: a.seendate,
      language: a.language,
      sourcecountry: a.sourcecountry,
    }))
  if (!articles.length) throw new Error('GDELT sin resultados')
  return { articles, source: 'GDELT' }
}

export async function onRequestGet() {
  const failures = []
  for (const provider of [fetchGoogleNews, fetchGdelt]) {
    try {
      const result = await provider()
      return Response.json({
        ...result,
        generatedAt: new Date().toISOString(),
      }, {
        headers: { 'cache-control': 'public, max-age=300' },
      })
    } catch (error) {
      failures.push(error.message || 'unknown_error')
    }
  }

  return Response.json({
    articles: [],
    error: 'news_sources_unavailable',
    details: failures,
    generatedAt: new Date().toISOString(),
  }, {
    status: 200,
    headers: { 'cache-control': 'no-store' },
  })
}
