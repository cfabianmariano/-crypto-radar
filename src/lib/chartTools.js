const SVG_NS = 'http://www.w3.org/2000/svg'

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]

function svgPoint(svg, clientX, clientY) {
  const rect = svg.getBoundingClientRect()
  const vb = svg.viewBox.baseVal
  return {
    x: vb.x + ((clientX - rect.left) / rect.width) * vb.width,
    y: vb.y + ((clientY - rect.top) / rect.height) * vb.height,
  }
}

function parsePrice(text) {
  const n = Number(String(text || '').replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : null
}

function buildPriceMapper(svg) {
  const ticks = [...svg.querySelectorAll('text')]
    .map((el) => ({ price: parsePrice(el.textContent), y: Number(el.getAttribute('y')) }))
    .filter((x) => Number.isFinite(x.price) && Number.isFinite(x.y))
    .sort((a, b) => a.y - b.y)
  if (ticks.length < 2) return null
  const a = ticks[0]
  const b = ticks[ticks.length - 1]
  const slope = (b.price - a.price) / (b.y - a.y)
  return {
    priceAt: (y) => a.price + slope * (y - a.y),
    yAt: (price) => a.y + (price - a.price) / slope,
  }
}

function candleGeometry(svg) {
  const groups = [...svg.querySelectorAll('g')]
  const candles = []
  for (const g of groups) {
    const lines = [...g.children].filter((x) => x.tagName?.toLowerCase() === 'line')
    const rects = [...g.children].filter((x) => x.tagName?.toLowerCase() === 'rect')
    if (lines.length !== 1 || rects.length < 2) continue
    const wick = lines[0]
    const x = Number(wick.getAttribute('x1'))
    const y1 = Number(wick.getAttribute('y1'))
    const y2 = Number(wick.getAttribute('y2'))
    if (![x, y1, y2].every(Number.isFinite)) continue
    candles.push({ x, highY: Math.min(y1, y2), lowY: Math.max(y1, y2) })
  }
  return candles.sort((a, b) => a.x - b.x)
}

function fmtPrice(n) {
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 0 : 3 })}`
}

function fmtPct(n) {
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  return node
}

function addText(group, x, y, value, anchor = 'start', cls = '') {
  const t = el('text', { x, y, 'text-anchor': anchor, class: cls })
  t.textContent = value
  group.appendChild(t)
  return t
}

function makeOverlay(canvas, svg) {
  const overlay = document.createElementNS(SVG_NS, 'svg')
  const vb = svg.viewBox.baseVal
  overlay.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`)
  overlay.setAttribute('preserveAspectRatio', 'none')
  overlay.classList.add('chartAnalysisOverlay')
  canvas.appendChild(overlay)
  return overlay
}

function drawMeasure(state) {
  const { overlay, mapper, a, b } = state
  overlay.innerHTML = ''
  if (!mapper || !a || !b) return
  const pa = mapper.priceAt(a.y)
  const pb = mapper.priceAt(b.y)
  const pct = ((pb / pa) - 1) * 100
  const group = el('g', { class: pct >= 0 ? 'measure positive' : 'measure negative' })
  group.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'measureLine' }))
  group.appendChild(el('circle', { cx: a.x, cy: a.y, r: 5, class: 'measurePoint' }))
  group.appendChild(el('circle', { cx: b.x, cy: b.y, r: 5, class: 'measurePoint' }))
  group.appendChild(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: a.y, class: 'measureGuide' }))
  group.appendChild(el('line', { x1: a.x, y1: b.y, x2: b.x, y2: b.y, class: 'measureGuide' }))
  const mx = (a.x + b.x) / 2
  const my = Math.max(28, Math.min(a.y, b.y) - 16)
  const label = el('g', { class: 'measureLabel' })
  label.appendChild(el('rect', { x: mx - 78, y: my - 21, width: 156, height: 29, rx: 8 }))
  addText(label, mx, my, `${fmtPct(pct)} · ${fmtPrice(pb - pa)}`, 'middle', 'measureMain')
  group.appendChild(label)
  addText(group, a.x + 8, a.y - 8, fmtPrice(pa), 'start', 'measurePrice')
  addText(group, b.x + 8, b.y - 8, fmtPrice(pb), 'start', 'measurePrice')
  overlay.appendChild(group)
  state.readout.textContent = `${fmtPrice(pa)} → ${fmtPrice(pb)} · ${fmtPct(pct)}`
  state.readout.dataset.tone = pct >= 0 ? 'positive' : 'negative'
}

function drawFib(state, start, end, auto = false) {
  const { overlay, mapper } = state
  if (!mapper || !start || !end) return
  overlay.innerHTML = ''
  const p0 = mapper.priceAt(start.y)
  const p1 = mapper.priceAt(end.y)
  const x1 = Math.min(start.x, end.x)
  const x2 = Math.max(start.x, end.x)
  const group = el('g', { class: 'fibGroup' })
  for (const level of FIB_LEVELS) {
    const price = p1 + (p0 - p1) * level
    const y = mapper.yAt(price)
    group.appendChild(el('line', { x1, y1: y, x2, y2: y, class: `fibLine fib-${String(level).replace('.', '-')}` }))
    addText(group, x1 + 5, y - 4, `${(level * 100).toFixed(level === 0 || level === 1 ? 0 : 1)}% · ${fmtPrice(price)}`, 'start', 'fibLabel')
  }
  group.appendChild(el('line', { x1: start.x, y1: start.y, x2: end.x, y2: end.y, class: 'fibImpulse' }))
  overlay.appendChild(group)
  const direction = p1 > p0 ? 'alcista' : 'bajista'
  state.readout.textContent = `${auto ? 'Fibonacci automático' : 'Fibonacci'} · impulso ${direction} · ${fmtPrice(p0)} → ${fmtPrice(p1)}`
  state.readout.dataset.tone = 'neutral'
}

function autoFib(state) {
  const candles = candleGeometry(state.svg)
  if (candles.length < 6 || !state.mapper) return
  const recent = candles.slice(Math.max(0, candles.length - 60))
  const high = recent.reduce((best, c) => c.highY < best.highY ? c : best, recent[0])
  const low = recent.reduce((best, c) => c.lowY > best.lowY ? c : best, recent[0])
  const bullish = low.x < high.x
  const start = bullish ? { x: low.x, y: low.lowY } : { x: high.x, y: high.highY }
  const end = bullish ? { x: high.x, y: high.highY } : { x: low.x, y: low.lowY }
  state.a = start
  state.b = end
  drawFib(state, start, end, true)
}

function drawLevels(state) {
  const candles = candleGeometry(state.svg)
  if (candles.length < 6 || !state.mapper) return
  const recent = candles.slice(Math.max(0, candles.length - 40))
  const high = recent.reduce((best, c) => c.highY < best.highY ? c : best, recent[0])
  const low = recent.reduce((best, c) => c.lowY > best.lowY ? c : best, recent[0])
  state.overlay.innerHTML = ''
  const vb = state.svg.viewBox.baseVal
  const g = el('g', { class: 'levelGroup' })
  for (const item of [
    { y: high.highY, label: 'Resistencia', price: state.mapper.priceAt(high.highY) },
    { y: low.lowY, label: 'Soporte', price: state.mapper.priceAt(low.lowY) },
  ]) {
    g.appendChild(el('line', { x1: 70, y1: item.y, x2: vb.width - 18, y2: item.y, class: 'levelLine' }))
    addText(g, vb.width - 22, item.y - 5, `${item.label} ${fmtPrice(item.price)}`, 'end', 'levelLabel')
  }
  state.overlay.appendChild(g)
  state.readout.textContent = `Rango visible · soporte ${fmtPrice(state.mapper.priceAt(low.lowY))} · resistencia ${fmtPrice(state.mapper.priceAt(high.highY))}`
  state.readout.dataset.tone = 'neutral'
}

function attach(canvas) {
  if (canvas.dataset.analysisTools === '1') return
  const svg = canvas.querySelector(':scope > svg')
  if (!svg) return
  canvas.dataset.analysisTools = '1'
  canvas.classList.add('chartAnalysisHost')
  const overlay = makeOverlay(canvas, svg)
  const mapper = buildPriceMapper(svg)
  if (!mapper) return

  const toolbar = canvas.closest('.chartCard')?.querySelector('.chartToolbar') || canvas.parentElement?.querySelector('.chartToolbar')
  const controls = document.createElement('div')
  controls.className = 'analysisToolsBar'
  controls.innerHTML = `
    <button type="button" data-tool="measure">↔ Regla %</button>
    <button type="button" data-tool="fib">⌁ Fibonacci</button>
    <button type="button" data-tool="levels">═ Niveles</button>
    <button type="button" data-tool="clear">× Limpiar</button>
  `
  const readout = document.createElement('div')
  readout.className = 'analysisReadout'
  readout.textContent = 'Mantén pulsado sobre el gráfico para medir · o usa Regla %'
  const targetToolbar = toolbar || canvas.parentElement
  targetToolbar?.appendChild(controls)
  canvas.parentElement?.insertBefore(readout, canvas)

  const state = { canvas, svg, overlay, mapper, controls, readout, mode: 'pan', a: null, b: null, drawing: false, longTimer: null, longActive: false }

  const refreshMapper = () => { state.mapper = buildPriceMapper(state.svg) || state.mapper }

  controls.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tool]')
    if (!btn) return
    const tool = btn.dataset.tool
    controls.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn && tool !== 'clear'))
    if (tool === 'measure') {
      state.mode = 'measure'
      state.readout.textContent = 'Regla activa: toca y arrastra entre dos precios.'
    } else if (tool === 'fib') {
      state.mode = 'fib'
      refreshMapper()
      if (state.a && state.b) drawFib(state, state.a, state.b, false)
      else autoFib(state)
    } else if (tool === 'levels') {
      state.mode = 'levels'
      refreshMapper()
      drawLevels(state)
    } else if (tool === 'clear') {
      state.mode = 'pan'
      state.a = state.b = null
      state.overlay.innerHTML = ''
      state.readout.textContent = 'Mantén pulsado sobre el gráfico para medir · o usa Regla %'
      state.readout.dataset.tone = 'neutral'
      controls.querySelectorAll('button').forEach((b) => b.classList.remove('active'))
    }
  })

  const begin = (clientX, clientY, forced = false) => {
    if (state.mode !== 'measure' && !forced) return false
    refreshMapper()
    state.a = svgPoint(state.svg, clientX, clientY)
    state.b = state.a
    state.drawing = true
    drawMeasure(state)
    return true
  }
  const move = (clientX, clientY) => {
    if (!state.drawing) return
    state.b = svgPoint(state.svg, clientX, clientY)
    drawMeasure(state)
  }
  const end = () => { state.drawing = false; state.longActive = false }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && state.mode === 'measure') {
      e.preventDefault(); e.stopPropagation(); begin(e.clientX, e.clientY)
    }
  }, true)
  canvas.addEventListener('pointermove', (e) => {
    if (state.drawing && e.pointerType === 'mouse') {
      e.preventDefault(); e.stopPropagation(); move(e.clientX, e.clientY)
    }
  }, true)
  canvas.addEventListener('pointerup', (e) => {
    if (state.drawing && e.pointerType === 'mouse') { e.preventDefault(); e.stopPropagation(); end() }
  }, true)

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    if (state.mode === 'measure') {
      e.preventDefault(); e.stopPropagation(); begin(t.clientX, t.clientY); return
    }
    clearTimeout(state.longTimer)
    state.longTimer = setTimeout(() => {
      state.longActive = true
      state.mode = 'measure'
      controls.querySelector('[data-tool="measure"]')?.classList.add('active')
      begin(t.clientX, t.clientY, true)
      if (navigator.vibrate) navigator.vibrate(20)
    }, 420)
  }, { capture: true, passive: false })

  canvas.addEventListener('touchmove', (e) => {
    if (state.drawing || state.longActive || state.mode === 'measure') {
      e.preventDefault(); e.stopPropagation()
      const t = e.touches[0]
      if (t) move(t.clientX, t.clientY)
    } else {
      clearTimeout(state.longTimer)
    }
  }, { capture: true, passive: false })

  canvas.addEventListener('touchend', (e) => {
    clearTimeout(state.longTimer)
    if (state.drawing || state.longActive) {
      e.preventDefault(); e.stopPropagation(); end()
    }
  }, { capture: true, passive: false })

  const ro = new ResizeObserver(() => {
    const vb = state.svg.viewBox.baseVal
    state.overlay.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`)
  })
  ro.observe(canvas)
}

export function enhanceChartAnalysis() {
  const scan = () => document.querySelectorAll('.candleCanvas').forEach(attach)
  scan()
  const observer = new MutationObserver(scan)
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
