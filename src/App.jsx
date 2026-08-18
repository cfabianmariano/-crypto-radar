import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Activity, RefreshCw, Wifi, WifiOff, ChevronDown, Target, CandlestickChart as CandleIcon, Maximize2, Minimize2, TrendingUp } from 'lucide-react'
import { COINS } from './data/coins'
import { fetchBtcCandles, fetchCoinHistory, fetchCoinSnapshot } from './lib/api'
import { buildIndicators, scoreLabel } from './lib/indicators'
import { buildBtcSignalModel, rollingSma } from './lib/signalModel'
import Gauge from './components/Gauge'
import IndicatorCard from './components/IndicatorCard'
import './chart-controls.css'

const DAY = 24 * 60 * 60 * 1000
const MAX_RANGE_DAYS = { '1h': 180, '4h': 365, '1d': 1825, '1w': 3650 }
const INTERVAL_LABELS = { '1h': '1 hora', '4h': '4 horas', '1d': '1 día', '1w': '1 semana' }

const fmtPrice = (n) => {
  if (n == null) return '—'
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n >= 1) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
}
const pctNum = (n) => n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
const toInputDate = (date) => date.toISOString().slice(0, 10)

function RingStat({ label, value, cases, tone = 'buy' }) {
  const safe = value == null ? 0 : Math.max(0, Math.min(100, value * 100))
  return (
    <div className="ringStat">
      <div className={`ring ${tone}`} style={{ '--ring': `${safe * 3.6}deg` }}>
        <div><strong>{value == null ? '—' : `${safe.toFixed(0)}%`}</strong><span>acierto</span></div>
      </div>
      <div className="ringText"><b>{label}</b><small>{cases} casos históricos</small></div>
    </div>
  )
}

function CandleChart({ data, signals = [] }) {
  const wrapRef = useRef(null)
  const dragRef = useRef(null)
  const touchRef = useRef(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const [viewStart, setViewStart] = useState(0)
  const [viewEnd, setViewEnd] = useState(Math.max(0, data.length - 1))
  const [showTrend, setShowTrend] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setViewStart(0)
    setViewEnd(Math.max(0, data.length - 1))
    setHoverIndex(null)
  }, [data])

  useEffect(() => {
    document.body.classList.toggle('chartOverlayOpen', expanded)
    return () => document.body.classList.remove('chartOverlayOpen')
  }, [expanded])

  const studies = useMemo(() => {
    const closes = data.map((d) => d.close)
    return { sma50: rollingSma(closes, 50), sma200: rollingSma(closes, 200) }
  }, [data])

  const visibleData = useMemo(() => {
    if (!data.length) return []
    return data.slice(viewStart, viewEnd + 1)
  }, [data, viewStart, viewEnd])

  const geometry = useMemo(() => {
    if (!visibleData.length) return null
    const W = 1000
    const H = expanded ? 620 : 540
    const left = 72
    const right = 18
    const top = 18
    const bottom = 40
    const volumeH = 95
    const volumeGap = 18
    const priceBottom = H - bottom - volumeH - volumeGap
    const plotW = W - left - right
    const priceH = priceBottom - top
    const min = Math.min(...visibleData.map((d) => d.low))
    const max = Math.max(...visibleData.map((d) => d.high))
    const pad = Math.max((max - min) * 0.05, max * 0.002)
    const yMin = min - pad
    const yMax = max + pad
    const y = (v) => top + ((yMax - v) / (yMax - yMin || 1)) * priceH
    const x = (i) => left + ((i + 0.5) / visibleData.length) * plotW
    const candleWidth = Math.min(15, Math.max(1.5, (plotW / visibleData.length) * 0.66))
    const maxVolume = Math.max(1, ...visibleData.map((d) => d.volume || 0))
    const volumeTop = priceBottom + volumeGap
    const volumeY = (v) => H - bottom - ((v || 0) / maxVolume) * volumeH
    return { W, H, left, right, top, bottom, plotW, priceBottom, yMin, yMax, y, x, candleWidth, volumeTop, volumeY }
  }, [visibleData, expanded])

  const setWindow = (start, end) => {
    if (!data.length) return
    const minBars = Math.min(8, data.length)
    let s = Math.round(start)
    let e = Math.round(end)
    if (e - s + 1 < minBars) e = s + minBars - 1
    if (s < 0) { e -= s; s = 0 }
    if (e > data.length - 1) { s -= e - (data.length - 1); e = data.length - 1 }
    s = Math.max(0, s)
    e = Math.min(data.length - 1, e)
    setViewStart(s)
    setViewEnd(e)
  }

  const zoomAt = (factor, ratio = 0.5) => {
    const size = viewEnd - viewStart + 1
    const newSize = Math.max(Math.min(8, data.length), Math.min(data.length, Math.round(size * factor)))
    const anchor = viewStart + ratio * (size - 1)
    const nextStart = anchor - ratio * (newSize - 1)
    setWindow(nextStart, nextStart + newSize - 1)
  }

  if (!geometry) return <div className="chartEmpty">Sin datos para este período.</div>

  const g = geometry
  const yTicks = Array.from({ length: 5 }, (_, i) => g.yMin + ((g.yMax - g.yMin) * i) / 4)
  const xTickIndexes = Array.from(new Set([0, Math.floor((visibleData.length - 1) * .25), Math.floor((visibleData.length - 1) * .5), Math.floor((visibleData.length - 1) * .75), visibleData.length - 1]))
  const hovered = hoverIndex == null ? null : visibleData[hoverIndex]

  const visibleSma50 = studies.sma50.slice(viewStart, viewEnd + 1)
  const visibleSma200 = studies.sma200.slice(viewStart, viewEnd + 1)
  const linePath = (series) => {
    let path = ''
    let started = false
    series.forEach((v, i) => {
      if (v == null) { started = false; return }
      path += `${started ? ' L' : ' M'} ${g.x(i).toFixed(2)} ${g.y(v).toFixed(2)}`
      started = true
    })
    return path
  }

  const signalPoints = signals.map((s) => {
    const targetTs = s.timestamp
    if (!targetTs || !visibleData.length || targetTs < visibleData[0].timestamp || targetTs > visibleData[visibleData.length - 1].timestamp + 7 * DAY) return null
    let best = 0
    let bestDiff = Math.abs(visibleData[0].timestamp - targetTs)
    for (let i = 1; i < visibleData.length; i++) {
      const diff = Math.abs(visibleData[i].timestamp - targetTs)
      if (diff < bestDiff) { best = i; bestDiff = diff }
    }
    return { ...s, i: best }
  }).filter(Boolean)

  const pointerToIndex = (clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return null
    const px = ((clientX - rect.left) / rect.width) * g.W
    const ratio = (px - g.left) / g.plotW
    return Math.max(0, Math.min(visibleData.length - 1, Math.floor(ratio * visibleData.length)))
  }

  const handlePointerDown = (event) => {
    if (event.pointerType === 'touch') return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = { x: event.clientX, start: viewStart, end: viewEnd }
  }

  const handlePointerMove = (event) => {
    if (event.pointerType === 'touch') return
    if (dragRef.current) {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = event.clientX - dragRef.current.x
      const bars = Math.round((-dx / rect.width) * (dragRef.current.end - dragRef.current.start + 1))
      const size = dragRef.current.end - dragRef.current.start
      setWindow(dragRef.current.start + bars, dragRef.current.start + bars + size)
      return
    }
    const i = pointerToIndex(event.clientX)
    if (i != null) setHoverIndex(i)
  }

  const handleWheel = (event) => {
    event.preventDefault()
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    zoomAt(event.deltaY > 0 ? 1.22 : 0.82, ratio)
  }

  const handleTouchStart = (event) => {
    if (event.touches.length === 2) {
      const [a, b] = event.touches
      touchRef.current = { type: 'pinch', distance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), start: viewStart, end: viewEnd }
    } else if (event.touches.length === 1) {
      touchRef.current = { type: 'pan', x: event.touches[0].clientX, start: viewStart, end: viewEnd }
    }
  }

  const handleTouchMove = (event) => {
    const state = touchRef.current
    if (!state) return
    if (state.type === 'pinch' && event.touches.length === 2) {
      event.preventDefault()
      const [a, b] = event.touches
      const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
      const oldSize = state.end - state.start + 1
      const newSize = Math.max(Math.min(8, data.length), Math.min(data.length, Math.round(oldSize * (state.distance / Math.max(distance, 1)))))
      const center = (state.start + state.end) / 2
      setWindow(center - (newSize - 1) / 2, center + (newSize - 1) / 2)
    } else if (state.type === 'pan' && event.touches.length === 1) {
      event.preventDefault()
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = event.touches[0].clientX - state.x
      const bars = Math.round((-dx / rect.width) * (state.end - state.start + 1))
      const size = state.end - state.start
      setWindow(state.start + bars, state.start + bars + size)
    }
  }

  const resetZoom = () => setWindow(0, data.length - 1)

  return (
    <div className={expanded ? 'chartExpanded' : ''}>
      <div className="chartToolbar">
        <div className="simpleLegend">
          <span><b className="legendBadge buyBadge">B</b> Comprar</span>
          <span><b className="legendBadge sellBadge">S</b> Vender</span>
        </div>
        <div className="chartActions">
          <button className={showTrend ? 'toolBtn active' : 'toolBtn'} onClick={() => setShowTrend((v) => !v)}><TrendingUp size={15}/> Tendencia</button>
          <button className="toolBtn" onClick={() => setExpanded((v) => !v)}>{expanded ? <Minimize2 size={15}/> : <Maximize2 size={15}/>} {expanded ? 'Cerrar' : 'Ampliar'}</button>
        </div>
      </div>
      {showTrend && <div className="trendLegend"><span><i className="trendLine ma50"/> SMA50</span><span><i className="trendLine ma200"/> SMA200</span></div>}
      <div className="gestureHint">Arrastrá para mover · pellizcá o usá la rueda para zoom</div>

      <div
        className="candleCanvas interactiveChart"
        ref={wrapRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => { dragRef.current = null }}
        onPointerCancel={() => { dragRef.current = null }}
        onPointerLeave={() => { setHoverIndex(null); dragRef.current = null }}
        onWheel={handleWheel}
        onDoubleClick={resetZoom}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => { touchRef.current = null }}
      >
        <svg viewBox={`0 0 ${g.W} ${g.H}`} role="img" aria-label="Gráfico de velas BTC">
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={g.left} x2={g.W - g.right} y1={g.y(tick)} y2={g.y(tick)} stroke="#1d2a3c" strokeWidth="1" />
              <text x={g.left - 9} y={g.y(tick) + 4} textAnchor="end" fill="#75849a" fontSize="12">{fmtPrice(tick)}</text>
            </g>
          ))}

          {visibleData.map((d, i) => {
            const up = d.close >= d.open
            const x = g.x(i)
            const yOpen = g.y(d.open)
            const yClose = g.y(d.close)
            const yHigh = g.y(d.high)
            const yLow = g.y(d.low)
            const bodyY = Math.min(yOpen, yClose)
            const bodyH = Math.max(1.4, Math.abs(yClose - yOpen))
            const color = up ? '#22c55e' : '#ef4444'
            return (
              <g key={`${d.timestamp}-${i}`}>
                <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth={Math.max(1, g.candleWidth * .22)} />
                <rect x={x - g.candleWidth / 2} y={bodyY} width={g.candleWidth} height={bodyH} fill={color} rx={.7} />
                <rect x={x - g.candleWidth / 2} y={g.volumeY(d.volume)} width={g.candleWidth} height={Math.max(1, g.H - g.bottom - g.volumeY(d.volume))} fill={color} opacity=".45" rx={.5} />
              </g>
            )
          })}

          <text x={g.left} y={g.volumeTop - 4} fill="#71829a" fontSize="11">VOLUMEN</text>
          <line x1={g.left} x2={g.W - g.right} y1={g.volumeTop} y2={g.volumeTop} stroke="#1d2a3c" strokeWidth="1" />

          {showTrend && <>
            <path d={linePath(visibleSma50)} fill="none" stroke="#f59e0b" strokeWidth="2" opacity=".9" />
            <path d={linePath(visibleSma200)} fill="none" stroke="#38bdf8" strokeWidth="2.2" opacity=".95" />
          </>}

          {signalPoints.map((s, idx) => {
            const candle = visibleData[s.i]
            const cy = s.side === 'BUY' ? g.y(candle.low) + 15 : g.y(candle.high) - 15
            const fill = s.side === 'BUY' ? '#16a34a' : '#dc2626'
            return (
              <g key={`${s.side}-${idx}`}>
                <circle cx={g.x(s.i)} cy={cy} r="10" fill={fill} stroke="#fff" strokeWidth="2.2" />
                <text x={g.x(s.i)} y={cy + 3.5} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="900">{s.side === 'BUY' ? 'B' : 'S'}</text>
              </g>
            )
          })}

          {hoverIndex != null && <line x1={g.x(hoverIndex)} x2={g.x(hoverIndex)} y1={g.top} y2={g.H - g.bottom} stroke="#94a3b8" strokeDasharray="4 5" strokeOpacity=".65" />}
          {xTickIndexes.map((i) => <text key={i} x={g.x(i)} y={g.H - 10} textAnchor="middle" fill="#75849a" fontSize="12">{visibleData[i]?.date}</text>)}
        </svg>

        {hovered && (
          <div className="candleTooltip">
            <strong>{hovered.date}</strong>
            <span>Apertura {fmtPrice(hovered.open)}</span>
            <span>Máximo {fmtPrice(hovered.high)}</span>
            <span>Mínimo {fmtPrice(hovered.low)}</span>
            <span>Cierre {fmtPrice(hovered.close)}</span>
            <span>Volumen {(hovered.volume || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
        )}
      </div>
      {(viewStart > 0 || viewEnd < data.length - 1) && <button className="resetZoomBtn" onClick={resetZoom}>Ver período completo</button>}
      {expanded && <div className="landscapeHint">En celular, girá el teléfono para verlo apaisado.</div>}
    </div>
  )
}

function App() {
  const today = new Date()
  const twoYearsAgo = new Date(today.getTime() - 730 * DAY)

  const [coinId, setCoinId] = useState(COINS[0].id)
  const [snapshot, setSnapshot] = useState(null)
  const [history, setHistory] = useState([])
  const [chartHistory, setChartHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [error, setError] = useState('')
  const [chartError, setChartError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [chartFrom, setChartFrom] = useState(toInputDate(twoYearsAgo))
  const [chartTo, setChartTo] = useState(toInputDate(today))
  const [candleInterval, setCandleInterval] = useState('1d')
  const requestId = useRef(0)
  const chartRequestId = useRef(0)

  const coin = COINS.find((c) => c.id === coinId) || COINS[0]

  async function loadBase() {
    const myRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const days = coinId === 'bitcoin' ? 730 : 365
      const [s, h] = await Promise.all([fetchCoinSnapshot(coinId), fetchCoinHistory(coinId, days)])
      if (myRequest !== requestId.current) return
      setSnapshot(s)
      setHistory(h)
      if (coinId !== 'bitcoin') setChartHistory(h)
      setLastUpdated(new Date())
    } catch (e) {
      if (myRequest !== requestId.current) return
      setError(e.message || 'No se pudieron cargar los datos')
    } finally {
      if (myRequest === requestId.current) setLoading(false)
    }
  }

  async function loadBtcChart() {
    if (coinId !== 'bitcoin') return
    const myRequest = ++chartRequestId.current
    setChartLoading(true)
    setChartError('')
    try {
      const startTime = new Date(`${chartFrom}T00:00:00`).getTime()
      const endTime = new Date(`${chartTo}T23:59:59`).getTime()
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime) throw new Error('El rango de fechas no es válido')
      const rangeDays = Math.ceil((endTime - startTime) / DAY)
      const maxDays = MAX_RANGE_DAYS[candleInterval]
      if (rangeDays > maxDays) throw new Error(`${INTERVAL_LABELS[candleInterval]} admite hasta ${maxDays} días`)
      const candles = await fetchBtcCandles({ interval: candleInterval, startTime, endTime, maxCandles: 6000 })
      if (myRequest !== chartRequestId.current) return
      if (!candles.length) throw new Error('No hay datos en ese rango')
      setChartHistory(candles)
    } catch (e) {
      if (myRequest === chartRequestId.current) setChartError(e.message || 'No se pudo cargar el gráfico')
    } finally {
      if (myRequest === chartRequestId.current) setChartLoading(false)
    }
  }

  useEffect(() => {
    setSnapshot(null)
    setHistory([])
    setChartHistory([])
    loadBase()
    const timer = setInterval(loadBase, 5 * 60_000)
    return () => clearInterval(timer)
  }, [coinId])

  useEffect(() => {
    if (coinId !== 'bitcoin') return
    const timer = setTimeout(loadBtcChart, 350)
    return () => clearTimeout(timer)
  }, [coinId, chartFrom, chartTo, candleInterval])

  const indicators = useMemo(() => {
    if (!snapshot || history.length < 30) return null
    return buildIndicators(snapshot, history)
  }, [snapshot, history])

  const btcModel = useMemo(() => coinId === 'bitcoin' ? buildBtcSignalModel(history) : null, [coinId, history])
  const lineChartData = useMemo(() => {
    if (!chartHistory.length || !indicators || coinId === 'bitcoin') return []
    return chartHistory.map((row) => ({ ...row, ma50: indicators.ma50, ma200: indicators.ma200 }))
  }, [chartHistory, indicators, coinId])
  const btcSignalsForChart = useMemo(() => {
    if (!btcModel) return []
    return btcModel.chartSignals.map((s) => ({ ...s, timestamp: history[s.index]?.timestamp }))
  }, [btcModel, history])

  const change24 = snapshot?.price_change_percentage_24h || 0
  const actionClass = btcModel?.action === 'COMPRA' ? 'actionBuy' : btcModel?.action === 'VENTA' ? 'actionSell' : 'actionWait'

  return (
    <main className="appShell">
      <header className="topbar">
        <div><div className="brand"><Activity size={22} /> CRYPTO RADAR</div><div className="brandSub">Signal · Validation · Risk</div></div>
        <div className="live">{error ? <WifiOff size={16} /> : <Wifi size={16} />}<span>{error ? 'Sin datos' : 'LIVE'}</span>{lastUpdated && <small>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>}</div>
      </header>

      <section className="hero glass visualHero">
        <div className="coinSelectorWrap"><label>Activo</label><div className="selectShell"><select value={coinId} onChange={(e) => setCoinId(e.target.value)}>{COINS.map((c) => <option value={c.id} key={c.id}>{c.symbol} · {c.name}</option>)}</select><ChevronDown size={17} /></div></div>
        <div className="priceBlock"><span>{coin.symbol}</span><strong>{fmtPrice(snapshot?.current_price)}</strong><div className={change24 >= 0 ? 'positive' : 'negative'}>{change24 >= 0 ? '+' : ''}{change24.toFixed(2)}% · 24h</div></div>
        <button className="refreshBtn" onClick={() => { loadBase(); if (coinId === 'bitcoin') loadBtcChart() }} disabled={loading || chartLoading}><RefreshCw size={17} className={loading || chartLoading ? 'spin' : ''} /> Actualizar</button>
      </section>

      {error && <div className="errorBox">{error}</div>}

      {btcModel && (
        <section className={`decisionCard glass visualDecision ${actionClass}`}>
          <div className="decisionMain">
            <span className="eyebrow"><Target size={14}/> SEÑAL DEL MODELO</span>
            <div className="actionWord">{btcModel.action}</div>
            <div className="signalMeter"><span className="sellZone">VENDER</span><i className={`meterNeedle ${btcModel.action.toLowerCase()}`}/><span className="buyZone">COMPRAR</span></div>
            <p>{btcModel.reason}</p>
          </div>
          <div className="ringGrid">
            <RingStat label="Compra" value={btcModel.buyStats.hitRate} cases={btcModel.buyStats.n} tone="buy" />
            <RingStat label="Venta" value={btcModel.sellStats.hitRate} cases={btcModel.sellStats.n} tone="sell" />
          </div>
        </section>
      )}

      {indicators && (
        <>
          <section className="chartCard glass simpleChartCard">
            <div className="sectionTitle chartHeader">
              <div><span className="eyebrow">BTC</span><h2>Precio, señales y volumen</h2></div>
              {coinId === 'bitcoin' && <div className="chartMode"><CandleIcon size={16}/> {INTERVAL_LABELS[candleInterval]}</div>}
            </div>

            {coinId === 'bitcoin' && (
              <div className="chartControls simpleControls">
                <label><span>Desde</span><div className="dateShell"><input type="date" value={chartFrom} onChange={(e) => setChartFrom(e.target.value)} /></div></label>
                <label><span>Hasta</span><div className="dateShell"><input type="date" value={chartTo} onChange={(e) => setChartTo(e.target.value)} /></div></label>
                <label><span>Velas</span><select value={candleInterval} onChange={(e) => setCandleInterval(e.target.value)}><option value="1h">1 hora</option><option value="4h">4 horas</option><option value="1d">1 día</option><option value="1w">1 semana</option></select></label>
                {chartLoading && <span className="autoLoading">Actualizando…</span>}
              </div>
            )}

            {chartError && <div className="chartError">{chartError}</div>}
            <div className="chartWrap candleWrap">
              {coinId === 'bitcoin' ? <CandleChart data={chartHistory} signals={btcSignalsForChart} /> : (
                <ResponsiveContainer width="100%" height="100%"><AreaChart data={lineChartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}><CartesianGrid stroke="#1d2a3c" vertical={false} /><XAxis dataKey="date" tick={{ fill: '#7f8da3', fontSize: 11 }} minTickGap={65} axisLine={false} tickLine={false}/><YAxis domain={['auto', 'auto']} tickFormatter={(v) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v.toFixed(2)}`} tick={{ fill: '#7f8da3', fontSize: 11 }} axisLine={false} tickLine={false} width={60}/><Tooltip contentStyle={{ background: '#0c1727', border: '1px solid #26374f', borderRadius: 12 }} labelStyle={{ color: '#a8b5c8' }} formatter={(v, name) => [fmtPrice(v), name === 'price' ? 'Precio' : name.toUpperCase()]}/><Area type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2.3} fillOpacity={.12} fill="#38bdf8" dot={false}/><Line type="monotone" dataKey="ma50" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 5" dot={false}/><Line type="monotone" dataKey="ma200" stroke="#22c55e" strokeWidth={1.6} strokeDasharray="7 6" dot={false}/></AreaChart></ResponsiveContainer>
              )}
            </div>
            {coinId === 'bitcoin' && <div className="chartFoot simpleFoot">B = Comprar · S = Vender</div>}
          </section>

          <section className="scoreGrid restoredScores">
            <Gauge value={indicators.bottomScore} label="BOTTOM SCORE" subtitle={scoreLabel(indicators.bottomScore, 'bottom')} tone="green" />
            <Gauge value={indicators.trendScore} label="TREND SCORE" subtitle={scoreLabel(indicators.trendScore, 'trend')} tone="blue" />
            <div className="glass signalSummary compactSummary">
              <span className="eyebrow">DATOS ACTUALES</span>
              <div className="miniStats expandedStats">
                <div><span>Drawdown</span><strong>-{indicators.drawdown.toFixed(1)}%</strong></div>
                <div><span>RSI</span><strong>{indicators.rsi?.toFixed(1)}</strong></div>
                <div><span>7 días</span><strong className={(snapshot?.price_change_percentage_7d_in_currency || 0) >= 0 ? 'positive' : 'negative'}>{(snapshot?.price_change_percentage_7d_in_currency || 0).toFixed(1)}%</strong></div>
                <div><span>30 días</span><strong className={(snapshot?.price_change_percentage_30d_in_currency || 0) >= 0 ? 'positive' : 'negative'}>{(snapshot?.price_change_percentage_30d_in_currency || 0).toFixed(1)}%</strong></div>
              </div>
            </div>
          </section>

          <section>
            <div className="sectionTitle outside"><div><span className="eyebrow">DIAGNÓSTICO</span><h2>Indicadores actuales</h2></div></div>
            <div className="indicatorsGrid">{indicators.rows.map((item) => <IndicatorCard key={item.label} item={item}/>)}</div>
          </section>
        </>
      )}

      {!indicators && !error && <div className="loadingState">Construyendo radar de {coin.symbol}…</div>}
      <footer>BTC V0.7 · señal, efectividad, tendencia, volumen y gráfico interactivo.</footer>
    </main>
  )
}

export default App
