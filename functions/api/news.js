const QUERY = 'bitcoin OR BTC OR XRP OR Ripple OR Ethereum OR crypto OR "Federal Reserve" OR "US Treasury" OR "Treasury yields" OR CPI OR inflation OR DXY OR SEC'
const FIVE_HOURS = 5 * 60 * 60 * 1000

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

function normalizeDate(value) {
  if (!value) return null
  const raw = String(value).trim()
  const gdelt = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/)
  if (gdelt) {
    const [, y, m, d, hh, mm, ss] = gdelt
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`
  }
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

function relevant(title = '') {
  const t = title.toLowerCase()
  return /(bitcoin|\bbtc\b|xrp|ripple|ethereum|ether|crypto|federal reserve|\bfed\b|u\.s\. treasury|us treasury|treasury yield|\bcpi\b|inflation|\bdxy\b|sec |sec\b|interest rate|liquidity)/i.test(t)
}

function readableLatin(title = '') {
  const letters = title.match(/\p{L}/gu) || []
  if (!letters.length) return false
  const latin = title.match(/\p{Script=Latin}/gu) || []
  return latin.length / letters.length >= 0.8
}

function recentOnly(articles) {
  const cutoff = Date.now() - FIVE_HOURS
  return articles
    .map((a) => ({ ...a, seendate: normalizeDate(a.seendate) }))
    .filter((a) => relevant(a.title) && readableLatin(a.title))
    .filter((a) => a.seendate && new Date(a.seendate).getTime() >= cutoff)
    .sort((a, b) => new Date(b.seendate).getTime() - new Date(a.seendate).getTime())
    .slice(0, 20)
}

async function fetchGoogleNews() {
  const params = new URLSearchParams({ q: `(${QUERY}) when:5h`, hl: 'en-US', gl: 'US', ceid: 'US:en' })
  const response = await fetch(`https://news.google.com/rss/search?${params}`, { headers: { 'user-agent': 'Mozilla/5.0 CryptoRadar/1.0' } })
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
    articles.push({ title, url, domain: source || 'Google News', seendate: pubDate, language: 'English', sourcecountry: 'US' })
  }
  const recent = recentOnly(articles)
  if (!recent.length) throw new Error('Google News sin resultados recientes')
  return { articles: recent, source: 'Google News' }
}

async function fetchGdelt() {
  const params = new URLSearchParams({ query: `(${QUERY})`, mode: 'ArtList', maxrecords: '40', format: 'json', sort: 'DateDesc', timespan: '5h' })
  const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, { headers: { 'user-agent': 'crypto-radar/1.0' } })
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
    .map((a) => ({ title: a.title, url: a.url, domain: a.domain, seendate: a.seendate, language: a.language, sourcecountry: a.sourcecountry }))
  const recent = recentOnly(articles)
  if (!recent.length) throw new Error('GDELT sin resultados recientes')
  return { articles: recent, source: 'GDELT' }
}

export async function onRequestGet() {
  const failures = []
  for (const provider of [fetchGoogleNews, fetchGdelt]) {
    try {
      const result = await provider()
      return Response.json({ ...result, generatedAt: new Date().toISOString(), windowHours: 5 }, { headers: { 'cache-control': 'public, max-age=180' } })
    } catch (error) {
      failures.push(error.message || 'unknown_error')
    }
  }
  return Response.json({ articles: [], error: 'news_sources_unavailable', details: failures, generatedAt: new Date().toISOString(), windowHours: 5 }, { status: 200, headers: { 'cache-control': 'no-store' } })
}
