export async function onRequestGet() {
  const query = '(bitcoin OR cryptocurrency OR crypto OR Federal Reserve OR Treasury OR inflation OR yields OR dollar OR SEC OR Ripple OR XRP)'
  const params = new URLSearchParams({
    query,
    mode: 'ArtList',
    maxrecords: '30',
    format: 'json',
    sort: 'HybridRel',
    timespan: '1d',
  })

  try {
    const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'user-agent': 'crypto-radar/1.0' },
    })
    if (!response.ok) {
      return Response.json({ articles: [], error: `GDELT ${response.status}` }, { status: 502 })
    }
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

    return Response.json({ articles, source: 'GDELT', generatedAt: new Date().toISOString() }, {
      headers: { 'cache-control': 'public, max-age=300' },
    })
  } catch (error) {
    return Response.json({ articles: [], error: error.message || 'news_fetch_failed' }, { status: 500 })
  }
}
