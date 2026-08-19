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
      <div><span class="eyebrow">CATALIZADORES</span><h2>Noticias y reacción del mercado</h2></div>
      <button type="button" class="newsRefresh">Actualizar</button>
    </div>
    <p class="newsIntro">Se priorizan noticias capaces de mover liquidez, tasas, dólar, regulación o criptomonedas. La lectura final debe combinar noticia + reacción del precio.</p>
    <div class="newsStatus">Tocá Actualizar para buscar lo último.</div>
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
  const status = panel.querySelector('.newsStatus')
  const list = panel.querySelector('.newsList')
  status.textContent = 'Buscando lo último…'
  list.innerHTML = ''
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch('/api/news', { headers: { accept: 'application/json' }, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const articles = Array.isArray(data.articles) ? data.articles.slice(0, 12) : []
    if (!articles.length) throw new Error('Sin noticias relevantes en este momento')
    status.textContent = `Actualizado ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
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
    status.textContent = error.name === 'AbortError' ? 'La fuente de noticias tardó demasiado. Probá Actualizar.' : `No pude cargar noticias: ${error.message}`
  } finally {
    clearTimeout(timer)
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
}

function makeNav(main, latest, news) {
  const nav = document.createElement('nav')
  nav.className = 'cryptoTabs'
  nav.setAttribute('aria-label', 'Secciones de Crypto Radar')
  for (const [key, label] of Object.entries(TAB_LABELS)) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.tab = key
    button.textContent = label
    button.addEventListener('click', () => {
      setTab(key, nav, main)
      if (key === 'noticias') loadNews(news)
      if (key === 'ahora') { refreshLatestCard(latest); stampLatestTime(latest) }
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

export function enhanceCryptoRadar() {
  registerServiceWorker()

  const boot = () => {
    const main = document.querySelector('main.appShell')
    const header = main?.querySelector('header.topbar')
    if (!main || !header || main.dataset.enhanced === '1') return false
    main.dataset.enhanced = '1'

    const latest = makeLatestCard()
    const news = makeNewsPanel()
    main.insertBefore(latest, header.nextSibling)
    main.appendChild(news)
    labelPanels(main)

    const nav = makeNav(main, latest, news)
    main.insertBefore(nav, latest)
    refreshLatestCard(latest)
    stampLatestTime(latest)
    news.querySelector('.newsRefresh').addEventListener('click', () => loadNews(news))

    const requested = new URL(location.href).searchParams.get('tab') || 'ahora'
    setTab(requested, nav, main)

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
        const active = nav.querySelector('button[data-tab].active')?.dataset.tab || 'ahora'
        applyPanelVisibility(main, active)
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
