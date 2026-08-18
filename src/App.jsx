import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Activity, RefreshCw, Wifi, WifiOff, ChevronDown, Target, CandlestickChart as CandleIcon } from 'lucide-react'
import { COINS } from './data/coins'
import { fetchBtcCandles, fetchCoinHistory, fetchCoinSnapshot } from './lib/api'
import { buildIndicators, scoreLabel } from './lib/indicators'
import { buildBtcSignalModel } from './lib/signalModel'
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

const pct = (n) => n == null ? '—' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`
const toInputDate = (date) => date.toISOString().slice(0, 10)

function rollingSmaLocal(values, period) {
  const out = Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function rsiSeries(values, period = 14) {
  const out = Array(values.length).fill(null)
  for (let i = period; i < values.length; i++) {
    let gains = 0
    let losses = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - values[j - 1]
      if (d >= 0) gains += d
      else losses += -d
    }
    if (!losses) out[i] = 100
    else {
      const rs = (gains / period) / (losses / period)
      out[i] = 100 - 100 / (1 + rs)
    }
  }
  return out
}

function CandleChart({ data, signals = [], intervalLabel = '' }) {
  const wrapRef = useRef(null)
  const [hoverIndex, setHoverIndex] = useState(null)

  const studies = useMemo(() => {
    const closes = data.map((d) => d.close)
    const sma20 = rollingSmaLocal(closes, 20)
    const sma50 = rollingSmaLocal(closes, 50)
    const rsi14 = rsiSeries(closes, 14)
    return { closes, sma20, sma50, rsi14 }
  }, [data])

  const geometry = useMemo(() => {
    if (!data.length) return null
    const W = 1000
    const H = 420
    const left = 70
    const right = 18
    const top = 16
    const bottom = 38
    const plotW = W - left - right
    const plotH = H - top - bottom
    const min = Math.min(...data.map((d) => d.low))
    const max = Math.max(...data.map((d) => d.high))
    const pad = Math.max((max - min) * 0.05, max * 0.002)
    const yMin = min - pad
    const yMax = max + pad
    const y = (v) => top + ((yMax - v) / (yMax - yMin || 1)) * plotH
    const x = (i) => left + ((i + 0.5) / data.length) * plotW
    const candleWidth = Math.min(9, Math.max(0.8, (plotW / data.length) * 0.68))
    return { W, H, left, right, top, bottom, plotW, plotH, yMin, yMax, y, x, candleWidth }
  }, [data])

  if (!geometry) return <div className="chartEmpty">Sin velas para este rango.</div>

  const g = geometry
  const yTicks = Array.from({ length: 5 }, (_, i) => g.yMin + ((g.yMax - g.yMin) * i) / 4)
  const xTickIndexes = Array.from(new Set([0, Math.floor((data.length - 1) * 0.25), Math.floor((data.length - 1) * 0.5), Math.floor((data.length - 1) * 0.75), data.length - 1]))
  const selectedIndex = hoverIndex == null ? data.length - 1 : hoverIndex
  const hovered = data[selectedIndex]

  const signalPoints = signals.map((s) => {
    const targetTs = s.timestamp
    if (!targetTs || targetTs < data[0].timestamp || targetTs > data[data.length - 1].timestamp + 7 * DAY) return null
    let best = 0
    let bestDiff = Math.abs(data[0].timestamp - targetTs)
    for (let i = 1; i < data.length; i++) {
      const diff = Math.abs(data[i].timestamp - targetTs)
      if (diff < bestDiff) { best = i; bestDiff = diff }
    }
    return { ...s, i: best }
  }).filter(Boolean)

  const linePath = (series) => {
    let d = ''
    let drawing = false
    for (let i = 0; i < series.length; i++) {
      const v = series[i]
      if (v == null) { drawing = false; continue }
      d += `${drawing ? ' L' : ' M'} ${g.x(i).toFixed(2)} ${g.y(v).toFixed(2)}`
      drawing = true
    }
    return d
  }

  const handlePointer = (event) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((event.clientX - rect.left) / rect.width) * g.W
    const ratio = (px - g.left) / g.plotW
    const i = Math.max(0, Math.min(data.length - 1, Math.floor(ratio * data.length)))
    setHoverIndex(i)
  }

  const currentClose = hovered?.close
  const currentSma20 = studies.sma20[selectedIndex]
  const currentSma50 = studies.sma50[selectedIndex]
  const currentRsi = studies.rsi14[selectedIndex]
  const momentumIndex = Math.max(0, selectedIndex - 7)
  const momentum7 = currentClose && studies.closes[momentumIndex] ? currentClose / studies.closes[momentumIndex] - 1 : null

  return (
    <div className="candleSection">
      <div className="chartIndicatorStrip">
        <div><span>Cierre</span><strong>{fmtPrice(currentClose)}</strong></div>
        <div><span>RSI 14 · {intervalLabel}</span><strong className={currentRsi != null && currentRsi < 35 ? 'positive' : currentRsi != null && currentRsi > 70 ? 'negative' : ''}>{currentRsi == null ? '—' : currentRsi.toFixed(1)}</strong></div>
        <div><span>vs SMA20</span><strong>{currentSma20 ? pct(currentClose / currentSma20 - 1) : '—'}</strong></div>
        <div><span>vs SMA50</span><strong>{currentSma50 ? pct(currentClose / currentSma50 - 1) : '—'}</strong></div>
        <div><span>Momentum 7 velas</span><strong className={momentum7 >= 0 ? 'positive' : 'negative'}>{pct(momentum7)}</strong></div>
      </div>

      <div className="chartSignalLegend">
        <span><i className="signalDot buySignal"/> COMPRA del modelo</span>
        <span><i className="signalDot sellSignal"/> VENTA del modelo</span>
        <span className="studyLegend"><i className="studyLine sma20Line"/> SMA20</span>
        <span className="studyLegend"><i className="studyLine sma50Line"/> SMA50</span>
      </div>

      <div className="candleCanvas" ref={wrapRef} onPointerMove={handlePointer} onPointerLeave={() => setHoverIndex(null)}>
        <svg viewBox={`0 0 ${g.W} ${g.H}`} role="img" aria-label="Gráfico de velas BTC">
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={g.left} x2={g.W - g.right} y1={g.y(tick)} y2={g.y(tick)} stroke="#1d2a3c" strokeWidth="1" />
              <text x={g.left - 9} y={g.y(tick) + 4} textAnchor="end" fill="#75849a" fontSize="12">{fmtPrice(tick)}</text>
            </g>
          ))}

          {data.map((d, i) => {
            const up = d.close >= d.open
            const x = g.x(i)
            const yOpen = g.y(d.open)
            const yClose = g.y(d.close)
            const yHigh = g.y(d.high)
            const yLow = g.y(d.low)
            const bodyY = Math.min(yOpen, yClose)
            const bodyH = Math.max(1.2, Math.abs(yClose - yOpen))
            const color = up ? '#22c55e' : '#ef4444'
            return (
              <g key={`${d.timestamp}-${i}`}>
                <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth={Math.max(0.8, g.candleWidth * 0.22)} />
                <rect x={x - g.candleWidth / 2} y={bodyY} width={g.candleWidth} height={bodyH} fill={color} rx={0.6} />
              </g>
            )
          })}

          <path d={linePath(studies.sma20)} fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.8" />
          <path d={linePath(studies.sma50)} fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8" />

          {signalPoints.map((s, idx) => {
            const candle = data[s.i]
            const cy = s.side === 'BUY' ? g.y(candle.low) + 11 : g.y(candle.high) - 11
            return (
              <g key={`${s.side}-${idx}`}>
                <circle cx={g.x(s.i)} cy={cy} r="8" fill={s.side === 'BUY' ? '#22c55e' : '#ef4444'} stroke="#ffffff" strokeWidth="2" />
                <text x={g.x(s.i)} y={cy + 3.2} textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900">{s.side === 'BUY' ? 'B' : 'S'}</text>
              </g>
            )
          })}

          {hoverIndex != null && <line x1={g.x(hoverIndex)} x2={g.x(hoverIndex)} y1={g.top} y2={g.H - g.bottom} stroke="#94a3b8" strokeDasharray="4 5" strokeOpacity="0.7" />}

          {xTickIndexes.map((i) => (
            <text key={i} x={g.x(i)} y={g.H - 10} textAnchor="middle" fill="#75849a" fontSize="12">{data[i]?.date}</text>
          ))}
        </svg>

        {hoverIndex != null && hovered && (
          <div className="candleTooltip">
            <strong>{hovered.date}</strong>
            <span>O {fmtPrice(hovered.open)}</span>
            <span>H {fmtPrice(hovered.high)}</span>
            <span>L {fmtPrice(hovered.low)}</span>
            <span>C {fmtPrice(hovered.close)}</span>
            <span>RSI {currentRsi == null ? '—' : currentRsi.toFixed(1)}</span>
          </div>
        )}
      </div>
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
    setChartLoading(true)
    setChartError('')
    try {
      const startTime = new Date(`${chartFrom}T00:00:00`).getTime()
      const endTime = new Date(`${chartTo}T23:59:59`).getTime()
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime) throw new Error('El rango de fechas no es válido')
      const rangeDays = Math.ceil((endTime - startTime) / DAY)
      const maxDays = MAX_RANGE_DAYS[candleInterval]
      if (rangeDays > maxDays) throw new Error(`${INTERVAL_LABELS[candleInterval]} admite hasta ${maxDays} días por visualización`)
      const candles = await fetchBtcCandles({ interval: candleInterval, startTime, endTime, maxCandles: 6000 })
      if (!candles.length) throw new Error('No hay datos en ese rango')
      setChartHistory(candles)
    } catch (e) {
      setChartError(e.message || 'No se pudo cargar el gráfico')
    } finally {
      setChartLoading(false)
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
    if (coinId === 'bitcoin') loadBtcChart()
  }, [coinId])

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
        <div className="live">{error ? <WifiOff size={16} /> : <Wifi size={16} />}<span>{error ? 'Sin conexión de datos' : 'LIVE'}</span>{lastUpdated && <small>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>}</div>
      </header>

      <section className="hero glass">
        <div className="coinSelectorWrap"><label>Activo</label><div className="selectShell"><select value={coinId} onChange={(e) => setCoinId(e.target.value)}>{COINS.map((c) => <option value={c.id} key={c.id}>{c.symbol} · {c.name}</option>)}</select><ChevronDown size={17} /></div></div>
        <div className="priceBlock"><span>{coin.symbol}</span><strong>{fmtPrice(snapshot?.current_price)}</strong><div className={change24 >= 0 ? 'positive' : 'negative'}>{change24 >= 0 ? '+' : ''}{change24.toFixed(2)}% · 24h</div></div>
        <button className="refreshBtn" onClick={() => { loadBase(); if (coinId === 'bitcoin') loadBtcChart() }} disabled={loading || chartLoading}><RefreshCw size={17} className={loading || chartLoading ? 'spin' : ''} /> Actualizar</button>
      </section>

      {error && <div className="errorBox">{error}. Reintentá en unos segundos.</div>}

      {btcModel && (
        <section className={`decisionCard glass ${actionClass}`}>
          <div className="decisionMain"><span className="eyebrow"><Target size={14}/> SEÑAL BTC · MODELO 2 AÑOS</span><div className="actionWord">{btcModel.action}</div><p>{btcModel.reason}</p></div>
          <div className="decisionMetrics"><div><span>Efectividad observada</span><strong>{btcModel.effectiveness == null ? '—' : `${(btcModel.effectiveness * 100).toFixed(0)}%`}</strong><small>{btcModel.effectiveness == null ? 'Sin patrón activo' : `${btcModel.evidenceN} casos · ${btcModel.horizon} días`}</small></div><div><span>Setup COMPRA</span><strong>{btcModel.buyStats.hitRate == null ? '—' : `${(btcModel.buyStats.hitRate * 100).toFixed(0)}%`}</strong><small>{btcModel.buyStats.n} señales · horizonte 14d</small></div><div><span>Setup VENTA</span><strong>{btcModel.sellStats.hitRate == null ? '—' : `${(btcModel.sellStats.hitRate * 100).toFixed(0)}%`}</strong><small>{btcModel.sellStats.n} señales · horizonte 90d</small></div></div>
          <div className="modelState"><span>RSI {btcModel.current.rsi?.toFixed(1)}</span><span>7d {pct(btcModel.current.ret7)}</span><span>30d {pct(btcModel.current.ret30)}</span><span>vs MA200 {pct(btcModel.current.vs200)}</span></div>
        </section>
      )}

      {indicators && (
        <>
          <section className="scoreGrid"><Gauge value={indicators.bottomScore} label="BOTTOM SCORE" subtitle={scoreLabel(indicators.bottomScore, 'bottom')} tone="green" /><Gauge value={indicators.trendScore} label="TREND SCORE" subtitle={scoreLabel(indicators.trendScore, 'trend')} tone="blue" /><div className="glass signalSummary"><span className="eyebrow">LECTURA OPERATIVA</span><h2>{indicators.bottomScore >= 65 && indicators.trendScore >= 60 ? 'Valor + tendencia convergen' : indicators.trendScore >= 65 ? 'Tendencia positiva; vigilar entrada' : indicators.bottomScore >= 65 ? 'Estrés alto; giro aún no confirmado' : 'Sin convergencia fuerte'}</h2><p>El indicador superior manda. Bottom y Trend quedan como diagnóstico para explicar la señal.</p><div className="miniStats"><div><span>{coinId === 'bitcoin' ? 'Máximo 2 años' : 'ATH'}</span><strong>{fmtPrice(snapshot?.ath)}</strong></div><div><span>Drawdown</span><strong>-{indicators.drawdown.toFixed(1)}%</strong></div><div><span>RSI</span><strong>{indicators.rsi?.toFixed(1)}</strong></div></div></div></section>

          <section className="chartCard glass">
            <div className="sectionTitle chartHeader"><div><span className="eyebrow">GRÁFICO CONFIGURABLE</span><h2>{coinId === 'bitcoin' ? 'Velas BTC + señales del modelo' : 'Precio + tendencia'}</h2></div>{coinId === 'bitcoin' && <div className="chartMode"><CandleIcon size={16}/> {INTERVAL_LABELS[candleInterval]}</div>}</div>
            {coinId === 'bitcoin' && <div className="chartControls"><label><span>Desde</span><div className="dateShell"><input type="date" value={chartFrom} onChange={(e) => setChartFrom(e.target.value)} /></div></label><label><span>Hasta</span><div className="dateShell"><input type="date" value={chartTo} onChange={(e) => setChartTo(e.target.value)} /></div></label><label><span>Vela</span><select value={candleInterval} onChange={(e) => setCandleInterval(e.target.value)}><option value="1h">1 hora</option><option value="4h">4 horas</option><option value="1d">1 día</option><option value="1w">1 semana</option></select></label><button className="applyChartBtn" onClick={loadBtcChart} disabled={chartLoading}>{chartLoading ? 'Cargando…' : 'Aplicar'}</button></div>}
            {chartError && <div className="chartError">{chartError}</div>}
            <div className="chartWrap candleWrap">{coinId === 'bitcoin' ? <CandleChart data={chartHistory} signals={btcSignalsForChart} intervalLabel={INTERVAL_LABELS[candleInterval]} /> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={lineChartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}><CartesianGrid stroke="#1d2a3c" vertical={false} /><XAxis dataKey="date" tick={{ fill: '#7f8da3', fontSize: 11 }} minTickGap={65} axisLine={false} tickLine={false}/><YAxis domain={['auto', 'auto']} tickFormatter={(v) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v.toFixed(2)}`} tick={{ fill: '#7f8da3', fontSize: 11 }} axisLine={false} tickLine={false} width={60}/><Tooltip contentStyle={{ background: '#0c1727', border: '1px solid #26374f', borderRadius: 12 }} labelStyle={{ color: '#a8b5c8' }} formatter={(v, name) => [fmtPrice(v), name === 'price' ? 'Precio' : name.toUpperCase()]}/><Area type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2.3} fillOpacity={0.12} fill="#38bdf8" dot={false}/><Line type="monotone" dataKey="ma50" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 5" dot={false}/><Line type="monotone" dataKey="ma200" stroke="#22c55e" strokeWidth={1.6} strokeDasharray="7 6" dot={false}/></AreaChart></ResponsiveContainer>}</div>
            {coinId === 'bitcoin' && <div className="chartFoot">{chartHistory.length.toLocaleString()} velas · {chartFrom} → {chartTo} · B/S = señales históricas diarias del modelo, ubicadas sobre la vela que contiene esa fecha.</div>}
          </section>

          <section><div className="sectionTitle outside"><div><span className="eyebrow">DIAGNÓSTICO</span><h2>Indicadores actuales</h2></div><span className="hint">La señal final solo se activa con ventaja histórica suficiente</span></div><div className="indicatorsGrid">{indicators.rows.map((item) => <IndicatorCard key={item.label} item={item}/>)}</div></section>
          <section className="marketStrip glass"><div><span>Fuente</span><strong>{snapshot.source || 'Mercado'}</strong></div><div><span>7 días</span><strong className={(snapshot.price_change_percentage_7d_in_currency || 0) >= 0 ? 'positive' : 'negative'}>{(snapshot.price_change_percentage_7d_in_currency || 0).toFixed(2)}%</strong></div><div><span>30 días</span><strong className={(snapshot.price_change_percentage_30d_in_currency || 0) >= 0 ? 'positive' : 'negative'}>{(snapshot.price_change_percentage_30d_in_currency || 0).toFixed(2)}%</strong></div><div><span>Modelo</span><strong>{coinId === 'bitcoin' ? 'V0.4 BTC' : 'V0.1'}</strong></div></section>
        </>
      )}

      {!indicators && !error && <div className="loadingState">Construyendo radar de {coin.symbol}…</div>}
      <footer>BTC V0.4 · modelo diario de 2 años + velas configurables + señales históricas + indicadores por timeframe.</footer>
    </main>
  )
}

export default App
