const TAB_LABELS = {
  ahora: 'Ahora',
  grafico: 'Gráfico',
  indicadores: 'Indicadores',
  noticias: 'Noticias',
}

function text(el) {
  return el?.textContent?.trim() || ''
}

function getLatestSummary() {
  const action = text(document.querySelector('.actionWord')) || 'ESPERAR'
  const reason = text(document.querySelector('.decisionMain p')) || 'Sin explicación disponible todavía.'
  const price = text(document.querySelector('.priceBlock strong')) || '—'
  const change = text(document.querySelector('.priceBlock .positive, .priceBlock .negative')) || ''
  return { action, reason, price, change }
}

function setTextIfChanged(el, value) {
  if (el && el.textContent !== value) el.textContent = value
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (error) {
    console.warn('No se pudo registrar el service worker', error)
    return null
  }
}

async function showSignalNotification(summary) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.ready
  const title = summary.action === 'COMPRA'
    ? 'Crypto Radar · señal de COMPRA'
    : summary.action === 'VENTA'
      ? 'Crypto Radar · señal de VENTA'
      : 'Crypto Radar · cambio relevante'
  await reg.showNotification(title, {
    body: `${summary.price}${summary.change ? ` · ${summary.change}` : ''}. Tocá para ver por qué.`,
    tag: `crypto-radar-${summary.action}`,
    renotify: true,
    data: { url: '/?tab=ahora' },
  })
}

function maybeNotifySignal() {
  const summary = getLatestSummary()
  if (!['COMPRA', 'VENTA'].includes(summary.action)) return
  const key = 'crypto-radar-last-signal'
  const fingerprint = `${summary.action}|${summary.reason}`
  const previous = localStorage.getItem(key)
  if (previous && previous !== fingerprint) showSignalNotification(summary)
  localStorage.setItem(key, fingerprint)
}

function makeLatestCard() {
  const card = document.createElement('section')
  card.className = 'latestEventCard glass cryptoRadarInjected tab-ahora'
  card.dataset.cryptoPanel = 'ahora'
  card.innerHTML = `
    <div class="latestEventHeader">
      <span>ÚLTIMO AHORA</span>
      <small data-latest-time></small>
    </div>
    <div class="latestEventBody">
      <strong data-latest-action>—</strong>
      <div data-latest-price>—</div>
      <p data-latest-reason>Analizando…</p>
    </div>
  `
  return card
}

function refreshLatestCard(card) {
  const s = getLatestSummary()
  setTextIfChanged(card.querySelector('[data-latest-action]'), s.action)
  setTextIfChanged(card.querySelector('[data-latest-price]'), `${s.price}${s.change ? ` · ${s.change}` : ''}`)
  setTextIfChanged(card.querySelector('[data-latest-reason]'), s.reason)
  const action = s.action.toLowerCase()
  if (card.dataset.action !== action) card.dataset.action = action
}

function stampLatestTime(card) {
  setTextIfChanged(card.querySelector('[data-latest-time]'), new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
}

function makeNewsPanel() {
  const panel = document.createElement('section')
  panel.className = 'newsPanel glass cryptoRadarInjected tab-noticias'
  panel.dataset.cryptoPanel = 'noticias'
  panel.innerHTML = `
    <div class="newsPanelHeader">
      <div><span class="eyebrow">CATALIZADORES · ÚLTIMAS 5 HORAS</span><h2>Noticias y reacción del mercado</h2></div>
      <button type="button" class="newsRefresh">Actualizar</button>
    </div>
    <p class="newsIntro">Se priorizan noticias capaces de mover liquidez, tasas, dólar, regulación o criptomonedas. La pestaña se actualiza al abrirla y mientras permanece visible.</p>
    <div class="newsStatus">Cargando noticias recientes…</div>
    <div class="newsList"></div>
  `
  return panel
}

function classifyHeadline(title = '') {
  const t = title.toLowerCase()
  if (/fed|treasury|yield|bond|rate|inflation|cpi|jobs|payroll|dollar|liquidity/.test(t)) return 'MACRO'
  if (/sec|regulat|etf|congress|white house|trump|law|reserve/.test(t)) return 'REGULACIÓN'
  if (/bitcoin|btc/.test(t)) return 'BTC'
  if (/xrp|ripple/.test(t)) return 'XRP'
  if (/ethereum|ether|solana|crypto/.test(t)) return 'CRIPTO'
  return 'MERCADO'
}

async function loadNews(panel) {
  if (panel.dataset.loading === '1') return
  panel.dataset.loading = '1'
  const status = panel.querySelector('.newsStatus')
  const list = panel.querySelector('.newsList')
  status.textContent = 'Buscando noticias de las últimas 5 horas…'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch('/api/news', { headers: { accept: 'application/json' }, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const cutoff = Date.now() - 5 * 60 * 60 * 1000
    const articles = (Array.isArray(data.articles) ? data.articles : [])
      .filter((a) => !a.seendate || new Date(a.seendate).getTime() >= cutoff)
      .sort((a, b) => new Date(b.seendate || 0).getTime() - new Date(a.seendate || 0).getTime())
      .slice(0, 16)

    list.innerHTML = ''
    if (!articles.length) {
      status.textContent = 'No encontré noticias relevantes publicadas en las últimas 5 horas.'
      return
    }

    status.textContent = `${articles.length} noticias · actualizado ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    for (const article of articles) {
      const item = document.createElement('article')
      item.className = 'newsItem'
      const category = classifyHeadline(article.title)
      const time = article.seendate ? new Date(article.seendate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
      item.innerHTML = `<div class="newsMeta"><span>${category}</span><small>${time}</small></div><h3></h3><p></p><a target="_blank" rel="noreferrer">Abrir fuente</a>`
      item.querySelector('h3').textContent = article.title || 'Sin título'
      item.querySelector('p').textContent = article.domain ? `Fuente: ${article.domain}` : 'Fuente externa'
      item.querySelector('a').href = article.url || '#'
      list.appendChild(item)
    }
  } catch (error) {
    status.textContent = error.name === 'AbortError' ? 'La fuente tardó demasiado. Reintentaré automáticamente.' : `No pude cargar noticias: ${error.message}`
  } finally {
    clearTimeout(timer)
    panel.dataset.loading = '0'
  }
}

function makeMarketPanel() {
  const panel = document.createElement('section')
  panel.className = 'marketDashboard cryptoRadarInjected tab-indicadores'
  panel.dataset.cryptoPanel = 'indicadores'
  panel.innerHTML = `
    <div class="marketDashboardHead">
      <div><span class="eyebrow">MERCADO AHORA</span><h2>Indicadores, fuerza relativa y pares</h2></div>
      <div class="marketUpdated" data-market-updated>Cargando…</div>
    </div>
    <div class="marketInsight" data-market-insight>Construyendo lectura de mercado…</div>
    <div class="marketTiles" data-market-assets></div>
    <div class="marketSectionTitle"><span>FUERZA RELATIVA</span><small>Variación del par en 24 h</small></div>
    <div class="pairTiles" data-market-pairs></div>
    <div class="marketSectionTitle"><span>CONTEXTO GENERAL</span><small>Datos de amplitud y capitalización</small></div>
    <div class="globalTiles" data-market-global></div>
    <p class="marketNote">El drawdown desde ATH queda como dato de contexto, no como señal diaria. Verde = mejora en 24 h, rojo = deterioro, neutro = sin variación material.</p>
  `
  return panel
}

function tone(change) {
  if (!Number.isFinite(change) || Math.abs(change) < 0.005) return 'flat'
  return change > 0 ? 'up' : 'down'
}

function fmtPct(value, digits = 2) {
  if (!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

function fmtPrice(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 7 })}`
}

function fmtPair(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (value >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
  return value.toLocaleString('en-US', { maximumFractionDigits: 8 })
}

function marketTile({ eyebrow, label, value, change, extra = '' }) {
  const el = document.createElement('article')
  el.className = `marketTile ${tone(change)}`
  el.innerHTML = `<div class="marketTileTop"><span>${eyebrow}</span><b>${fmtPct(change)}</b></div><h3>${label}</h3><strong>${value}</strong><small>${extra}</small>`
  return el
}

async function loadMarketOverview(panel) {
  if (panel.dataset.loading === '1') return
  panel.dataset.loading = '1'
  const updated = panel.querySelector('[data-market-updated]')
  const assetsEl = panel.querySelector('[data-market-assets]')
  const pairsEl = panel.querySelector('[data-market-pairs]')
  const globalEl = panel.querySelector('[data-market-global]')
  const insight = panel.querySelector('[data-market-insight]')
  updated.textContent = 'Actualizando…'

  try {
    const response = await fetch('/api/market-overview', { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const assets = Array.isArray(data.assets) ? data.assets : []
    assetsEl.innerHTML = ''
    pairsEl.innerHTML = ''
    globalEl.innerHTML = ''

    for (const asset of assets) {
      assetsEl.appendChild(marketTile({
        eyebrow: asset.symbol,
        label: `${asset.symbol}/USD`,
        value: fmtPrice(asset.price),
        change: asset.change24,
        extra: `7d ${fmtPct(asset.change7d, 1)} · 30d ${fmtPct(asset.change30d, 1)}`,
      }))
    }

    for (const [name, pair] of Object.entries(data.pairs || {})) {
      if (!pair) continue
      pairsEl.appendChild(marketTile({
        eyebrow: 'PAR',
        label: name,
        value: fmtPair(pair.value),
        change: Number(pair.change24),
        extra: pair.change24 > 0 ? `${name.split('/')[0]} gana fuerza relativa` : pair.change24 < 0 ? `${name.split('/')[0]} pierde fuerza relativa` : 'Sin cambio relativo',
      }))
    }

    const global = data.global || {}
    if (Number.isFinite(global.btcDominance)) {
      globalEl.appendChild(marketTile({ eyebrow: 'DOMINANCIA', label: 'BTC dominance', value: `${global.btcDominance.toFixed(1)}%`, change: NaN, extra: 'Participación de BTC en el mercado cripto' }))
    }
    if (Number.isFinite(global.marketCapChange24)) {
      globalEl.appendChild(marketTile({ eyebrow: 'MERCADO TOTAL', label: 'Capitalización cripto', value: fmtPct(global.marketCapChange24), change: global.marketCapChange24, extra: 'Variación total en 24 h' }))
    }

    const green = assets.filter((a) => Number(a.change24) > 0).length
    const red = assets.filter((a) => Number(a.change24) < 0).length
    globalEl.appendChild(marketTile({ eyebrow: 'AMPLITUD', label: 'Activos seguidos', value: `${green} ↑ / ${red} ↓`, change: green === red ? 0 : green > red ? 1 : -1, extra: `${assets.length} activos en el radar` }))

    const btc = assets.find((a) => a.symbol === 'BTC')
    const xrpBtc = data.pairs?.['XRP/BTC']
    const ethBtc = data.pairs?.['ETH/BTC']
    const parts = []
    if (btc) parts.push(`BTC ${fmtPct(btc.change24)}`)
    if (xrpBtc) parts.push(`XRP/BTC ${fmtPct(xrpBtc.change24)}`)
    if (ethBtc) parts.push(`ETH/BTC ${fmtPct(ethBtc.change24)}`)
    insight.textContent = parts.length ? `Lectura rápida · ${parts.join(' · ')}` : 'Lectura de mercado actualizada.'
    updated.textContent = `Actualizado ${new Date(data.generatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } catch (error) {
    updated.textContent = 'Sin actualización'
    insight.textContent = `No pude cargar el panel de mercado: ${error.message}`
  } finally {
    panel.dataset.loading = '0'
  }
}

function labelPanels(main) {
  const directSections = [...main.children].filter((x) => x.tagName === 'SECTION')
  for (const section of directSections) {
    if (section.classList.contains('cryptoRadarInjected')) continue
    let panel = 'indicadores'
    if (section.classList.contains('hero') || section.classList.contains('decisionCard')) panel = 'ahora'
    else if (section.classList.contains('chartCard')) panel = 'grafico'
    if (section.dataset.cryptoPanel !== panel) section.dataset.cryptoPanel = panel

    if (panel === 'indicadores' && (section.classList.contains('scoreGrid') || section.querySelector('.indicatorsGrid'))) {
      section.classList.add('legacyIndicatorSection')
    }
  }
}

function applyPanelVisibility(main, active) {
  main.querySelectorAll('[data-crypto-panel]').forEach((panel) => {
    const shouldHide = panel.dataset.cryptoPanel !== active
    if (panel.hidden !== shouldHide) panel.hidden = shouldHide
  })
}

function setTab(tab, nav, main) {
  const target = TAB_LABELS[tab] ? tab : 'ahora'
  nav.querySelectorAll('button[data-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === target))
  applyPanelVisibility(main, target)
  const url = new URL(location.href)
  url.searchParams.set('tab', target)
  history.replaceState(null, '', url)
  window.scrollTo({ top: 0, behavior: 'smooth' })
  return target
}

function makeNav(main, latest, news, market) {
  const nav = document.createElement('nav')
  nav.className = 'cryptoTabs'
  nav.setAttribute('aria-label', 'Secciones de Crypto Radar')
  for (const [key, label] of Object.entries(TAB_LABELS)) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.tab = key
    button.textContent = label
    button.addEventListener('click', () => {
      const active = setTab(key, nav, main)
      if (active === 'noticias') loadNews(news)
      if (active === 'indicadores') loadMarketOverview(market)
      if (active === 'ahora') { refreshLatestCard(latest); stampLatestTime(latest) }
    })
    nav.appendChild(button)
  }

  const alerts = document.createElement('button')
  alerts.type = 'button'
  alerts.className = 'alertsButton'
  alerts.textContent = ('Notification' in window && Notification.permission === 'granted') ? '🔔 Alertas ON' : '🔔 Alertas'
  alerts.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      alerts.textContent = 'Alertas no disponibles'
      return
    }
    const permission = await Notification.requestPermission()
    alerts.textContent = permission === 'granted' ? '🔔 Alertas ON' : '🔕 Sin permiso'
    if (permission === 'granted') {
      const s = getLatestSummary()
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('Crypto Radar · alertas activadas', {
        body: 'Listo. Te avisaré cuando la app detecte una señal nueva mientras está ejecutándose.',
        tag: 'crypto-radar-ready',
        data: { url: '/?tab=ahora' },
      })
      localStorage.setItem('crypto-radar-last-signal', `${s.action}|${s.reason}`)
    }
  })
  nav.appendChild(alerts)
  return nav
}

function setupTooltipFollow(main) {
  main.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return
    const canvas = event.target.closest?.('.candleCanvas')
    if (!canvas) return
    requestAnimationFrame(() => {
      const tooltip = canvas.querySelector('.candleTooltip')
      if (!tooltip) return
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const w = tooltip.offsetWidth || 180
      const h = tooltip.offsetHeight || 120
      const left = Math.max(8, Math.min(rect.width - w - 8, x - w / 2))
      const top = y > rect.height * 0.55 ? Math.max(8, y - h - 18) : Math.min(rect.height - h - 8, y + 18)
      tooltip.style.left = `${left}px`
      tooltip.style.top = `${top}px`
      tooltip.style.right = 'auto'
    })
  }, { passive: true })
}

export function enhanceCryptoRadar() {
  registerServiceWorker()

  const boot = () => {
    const main = document.querySelector('main.appShell')
    const header = main?.querySelector('header.topbar')
    if (!main || !header || main.dataset.enhanced === '1') return false
    main.dataset.enhanced = '1'

    const latest = makeLatestCard()
    const market = makeMarketPanel()
    const news = makeNewsPanel()
    main.insertBefore(latest, header.nextSibling)
    main.appendChild(market)
    main.appendChild(news)
    labelPanels(main)

    const nav = makeNav(main, latest, news, market)
    main.insertBefore(nav, latest)
    refreshLatestCard(latest)
    stampLatestTime(latest)
    news.querySelector('.newsRefresh').addEventListener('click', () => loadNews(news))
    setupTooltipFollow(main)

    const requested = new URL(location.href).searchParams.get('tab') || 'ahora'
    const active = setTab(requested, nav, main)
    if (active === 'noticias') loadNews(news)
    if (active === 'indicadores') loadMarketOverview(market)

    const liveRefresh = setInterval(() => {
      if (document.hidden) return
      const current = nav.querySelector('button[data-tab].active')?.dataset.tab
      if (current === 'noticias') loadNews(news)
      if (current === 'indicadores') loadMarketOverview(market)
    }, 5 * 60_000)
    window.addEventListener('pagehide', () => clearInterval(liveRefresh), { once: true })

    let scheduled = false
    const observer = new MutationObserver((records) => {
      const relevant = records.some((record) => {
        const el = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement
        return el && !el.closest('.cryptoRadarInjected, .cryptoTabs')
      })
      if (!relevant || scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        refreshLatestCard(latest)
        stampLatestTime(latest)
        maybeNotifySignal()
        labelPanels(main)
        const current = nav.querySelector('button[data-tab].active')?.dataset.tab || 'ahora'
        applyPanelVisibility(main, current)
      })
    })
    observer.observe(main, { childList: true, subtree: true, characterData: true })
    maybeNotifySignal()
    return true
  }

  if (boot()) return
  const observer = new MutationObserver(() => {
    if (boot()) observer.disconnect()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
