import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Line, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Activity, RefreshCw, Wifi, WifiOff, ChevronDown, Target } from 'lucide-react'
import { COINS } from './data/coins'
import { fetchCoinHistory, fetchCoinSnapshot } from './lib/api'
import { buildIndicators, scoreLabel } from './lib/indicators'
import { buildBtcSignalModel } from './lib/signalModel'
import Gauge from './components/Gauge'
import IndicatorCard from './components/IndicatorCard'

const fmtPrice = (n) => {
  if (n == null) return '—'
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n >= 1) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
}

const pct = (n) => n == null ? '—' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`

function App() {
  const [coinId, setCoinId] = useState(COINS[0].id)
  const [snapshot, setSnapshot] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const requestId = useRef(0)

  const coin = COINS.find((c) => c.id === coinId) || COINS[0]

  async function load() {
    const myRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const days = coinId === 'bitcoin' ? 730 : 365
      const [s, h] = await Promise.all([fetchCoinSnapshot(coinId), fetchCoinHistory(coinId, days)])
      if (myRequest !== requestId.current) return
      setSnapshot(s)
      setHistory(h)
      setLastUpdated(new Date())
    } catch (e) {
      if (myRequest !== requestId.current) return
      setError(e.message || 'No se pudieron cargar los datos')
    } finally {
      if (myRequest === requestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    setSnapshot(null)
    setHistory([])
    load()
    const timer = setInterval(load, 5 * 60_000)
    return () => clearInterval(timer)
  }, [coinId])

  const indicators = useMemo(() => {
    if (!snapshot || history.length < 30) return null
    return buildIndicators(snapshot, history)
  }, [snapshot, history])

  const btcModel = useMemo(() => coinId === 'bitcoin' ? buildBtcSignalModel(history) : null, [coinId, history])

  const chartData = useMemo(() => {
    if (!history.length || !indicators) return []
    return history.map((row, i) => ({
      ...row,
      ma50: btcModel?.ma50?.[i] ?? indicators.ma50,
      ma200: btcModel?.ma200?.[i] ?? indicators.ma200,
    }))
  }, [history, indicators, btcModel])

  const change24 = snapshot?.price_change_percentage_24h || 0
  const actionClass = btcModel?.action === 'COMPRA' ? 'actionBuy' : btcModel?.action === 'VENTA' ? 'actionSell' : 'actionWait'

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <div className="brand"><Activity size={22} /> CRYPTO RADAR</div>
          <div className="brandSub">Signal · Validation · Risk</div>
        </div>
        <div className="live">
          {error ? <WifiOff size={16} /> : <Wifi size={16} />}
          <span>{error ? 'Sin conexión de datos' : 'LIVE'}</span>
          {lastUpdated && <small>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>}
        </div>
      </header>

      <section className="hero glass">
        <div className="coinSelectorWrap">
          <label>Activo</label>
          <div className="selectShell">
            <select value={coinId} onChange={(e) => setCoinId(e.target.value)}>
              {COINS.map((c) => <option value={c.id} key={c.id}>{c.symbol} · {c.name}</option>)}
            </select>
            <ChevronDown size={17} />
          </div>
        </div>
        <div className="priceBlock">
          <span>{coin.symbol}</span>
          <strong>{fmtPrice(snapshot?.current_price)}</strong>
          <div className={change24 >= 0 ? 'positive' : 'negative'}>
            {change24 >= 0 ? '+' : ''}{change24.toFixed(2)}% · 24h
          </div>
        </div>
        <button className="refreshBtn" onClick={load} disabled={loading}>
          <RefreshCw size={17} className={loading ? 'spin' : ''} /> Actualizar
        </button>
      </section>

      {error && <div className="errorBox">{error}. Reintentá en unos segundos.</div>}

      {btcModel && (
        <section className={`decisionCard glass ${actionClass}`}>
          <div className="decisionMain">
            <span className="eyebrow"><Target size={14}/> SEÑAL BTC · MODELO 2 AÑOS</span>
            <div className="actionWord">{btcModel.action}</div>
            <p>{btcModel.reason}</p>
          </div>
          <div className="decisionMetrics">
            <div>
              <span>Efectividad observada</span>
              <strong>{btcModel.effectiveness == null ? '—' : `${(btcModel.effectiveness * 100).toFixed(0)}%`}</strong>
              <small>{btcModel.effectiveness == null ? 'Sin patrón activo' : `${btcModel.evidenceN} casos · ${btcModel.horizon} días`}</small>
            </div>
            <div>
              <span>Setup COMPRA</span>
              <strong>{btcModel.buyStats.hitRate == null ? '—' : `${(btcModel.buyStats.hitRate * 100).toFixed(0)}%`}</strong>
              <small>{btcModel.buyStats.n} señales · horizonte 14d</small>
            </div>
            <div>
              <span>Setup VENTA</span>
              <strong>{btcModel.sellStats.hitRate == null ? '—' : `${(btcModel.sellStats.hitRate * 100).toFixed(0)}%`}</strong>
              <small>{btcModel.sellStats.n} señales · horizonte 90d</small>
            </div>
          </div>
          <div className="modelState">
            <span>RSI {btcModel.current.rsi?.toFixed(1)}</span>
            <span>7d {pct(btcModel.current.ret7)}</span>
            <span>30d {pct(btcModel.current.ret30)}</span>
            <span>vs MA200 {pct(btcModel.current.vs200)}</span>
          </div>
        </section>
      )}

      {indicators && (
        <>
          <section className="scoreGrid">
            <Gauge value={indicators.bottomScore} label="BOTTOM SCORE" subtitle={scoreLabel(indicators.bottomScore, 'bottom')} tone="green" />
            <Gauge value={indicators.trendScore} label="TREND SCORE" subtitle={scoreLabel(indicators.trendScore, 'trend')} tone="blue" />
            <div className="glass signalSummary">
              <span className="eyebrow">LECTURA OPERATIVA</span>
              <h2>{indicators.bottomScore >= 65 && indicators.trendScore >= 60 ? 'Valor + tendencia convergen' : indicators.trendScore >= 65 ? 'Tendencia positiva; vigilar entrada' : indicators.bottomScore >= 65 ? 'Estrés alto; giro aún no confirmado' : 'Sin convergencia fuerte'}</h2>
              <p>El indicador superior manda. Bottom y Trend quedan como diagnóstico para explicar la señal.</p>
              <div className="miniStats">
                <div><span>{coinId === 'bitcoin' ? 'Máximo 2 años' : 'ATH'}</span><strong>{fmtPrice(snapshot?.ath)}</strong></div>
                <div><span>Drawdown</span><strong>-{indicators.drawdown.toFixed(1)}%</strong></div>
                <div><span>RSI</span><strong>{indicators.rsi?.toFixed(1)}</strong></div>
              </div>
            </div>
          </section>

          <section className="chartCard glass">
            <div className="sectionTitle">
              <div>
                <span className="eyebrow">{coinId === 'bitcoin' ? '2 AÑOS' : '12 MESES'}</span>
                <h2>Precio + tendencia + señales</h2>
              </div>
              <div className="legend">
                <span><i className="dot priceDot"/>Precio</span><span><i className="dot ma50Dot"/>MA50</span><span><i className="dot ma200Dot"/>MA200</span>
              </div>
            </div>
            <div className="chartWrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                  <defs><linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity={0.48}/><stop offset="55%" stopColor="#38bdf8" stopOpacity={0.14}/><stop offset="100%" stopColor="#38bdf8" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid stroke="#1d2a3c" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#7f8da3', fontSize: 11 }} minTickGap={65} axisLine={false} tickLine={false}/>
                  <YAxis domain={['auto', 'auto']} tickFormatter={(v) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v.toFixed(2)}`} tick={{ fill: '#7f8da3', fontSize: 11 }} axisLine={false} tickLine={false} width={60}/>
                  <Tooltip contentStyle={{ background: '#0c1727', border: '1px solid #26374f', borderRadius: 12 }} labelStyle={{ color: '#a8b5c8' }} formatter={(v, name) => [fmtPrice(v), name === 'price' ? 'Precio' : name.toUpperCase()]}/>
                  <Area type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2.3} fill="url(#priceGradient)" dot={false}/>
                  <Line type="monotone" dataKey="ma50" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 5" dot={false}/>
                  <Line type="monotone" dataKey="ma200" stroke="#22c55e" strokeWidth={1.6} strokeDasharray="7 6" dot={false}/>
                  {btcModel?.chartSignals.map((s, idx) => <ReferenceDot key={`${s.side}-${idx}`} x={history[s.index]?.date} y={s.price} r={4.5} fill={s.side === 'BUY' ? '#22c55e' : '#ef4444'} stroke="#07111f" strokeWidth={1.5}/>)}
                  {snapshot?.ath && <ReferenceLine y={snapshot.ath} stroke="#ef4444" strokeOpacity={0.30} strokeDasharray="3 6" />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <div className="sectionTitle outside"><div><span className="eyebrow">DIAGNÓSTICO</span><h2>Indicadores actuales</h2></div><span className="hint">La señal final solo se activa con ventaja histórica suficiente</span></div>
            <div className="indicatorsGrid">{indicators.rows.map((item) => <IndicatorCard key={item.label} item={item}/>)}</div>
          </section>

          <section className="marketStrip glass">
            <div><span>Fuente</span><strong>{snapshot.source || 'Mercado'}</strong></div>
            <div><span>7 días</span><strong className={(snapshot.price_change_percentage_7d_in_currency || 0) >= 0 ? 'positive' : 'negative'}>{(snapshot.price_change_percentage_7d_in_currency || 0).toFixed(2)}%</strong></div>
            <div><span>30 días</span><strong className={(snapshot.price_change_percentage_30d_in_currency || 0) >= 0 ? 'positive' : 'negative'}>{(snapshot.price_change_percentage_30d_in_currency || 0).toFixed(2)}%</strong></div>
            <div><span>Modelo</span><strong>{coinId === 'bitcoin' ? 'V0.2 BTC' : 'V0.1'}</strong></div>
          </section>
        </>
      )}

      {!indicators && !error && <div className="loadingState">Construyendo radar de {coin.symbol}…</div>}
      <footer>BTC V0.2 · 730 velas diarias Binance · eficacia observada en el mismo período histórico; desde hoy comienza validación prospectiva.</footer>
    </main>
  )
}

export default App
