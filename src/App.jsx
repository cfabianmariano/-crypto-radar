import { useEffect, useMemo, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Activity, RefreshCw, Wifi, WifiOff, ChevronDown } from 'lucide-react'
import { COINS } from './data/coins'
import { fetchCoinHistory, fetchCoinSnapshot } from './lib/api'
import { buildIndicators, scoreLabel } from './lib/indicators'
import Gauge from './components/Gauge'
import IndicatorCard from './components/IndicatorCard'

const fmtPrice = (n) => {
  if (n == null) return '—'
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n >= 1) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
}

function App() {
  const [coinId, setCoinId] = useState(COINS[0].id)
  const [snapshot, setSnapshot] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const coin = COINS.find((c) => c.id === coinId) || COINS[0]

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [s, h] = await Promise.all([
        fetchCoinSnapshot(coinId),
        fetchCoinHistory(coinId, 365),
      ])
      setSnapshot(s)
      setHistory(h)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message || 'No se pudieron cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [coinId])

  const indicators = useMemo(() => {
    if (!snapshot || history.length < 30) return null
    return buildIndicators(snapshot, history)
  }, [snapshot, history])

  const chartData = useMemo(() => {
    if (!history.length || !indicators) return []
    return history.map((row) => ({
      ...row,
      ma200: indicators.ma200,
      ma50: indicators.ma50,
    }))
  }, [history, indicators])

  const change24 = snapshot?.price_change_percentage_24h || 0

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <div className="brand"><Activity size={22} /> CRYPTO RADAR</div>
          <div className="brandSub">Bottom · Trend · Risk</div>
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
          <RefreshCw size={17} className={loading ? 'spin' : ''} />
          Actualizar
        </button>
      </section>

      {error && (
        <div className="errorBox">
          {error}. CoinGecko keyless puede limitar temporalmente las solicitudes. Reintenta en unos segundos.
        </div>
      )}

      {indicators && (
        <>
          <section className="scoreGrid">
            <Gauge
              value={indicators.bottomScore}
              label="BOTTOM SCORE"
              subtitle={scoreLabel(indicators.bottomScore, 'bottom')}
              tone="green"
            />
            <Gauge
              value={indicators.trendScore}
              label="TREND SCORE"
              subtitle={scoreLabel(indicators.trendScore, 'trend')}
              tone="blue"
            />

            <div className="glass signalSummary">
              <span className="eyebrow">LECTURA OPERATIVA</span>
              <h2>
                {indicators.bottomScore >= 65 && indicators.trendScore < 60
                  ? 'Valor atractivo, giro aún sin confirmar'
                  : indicators.bottomScore >= 65 && indicators.trendScore >= 60
                    ? 'Valor + tendencia empiezan a converger'
                    : indicators.trendScore >= 65
                      ? 'Tendencia positiva, vigilar valoración'
                      : 'Mercado sin convergencia fuerte'}
              </h2>
              <p>
                Bottom Score mide estrés/valor relativo. Trend Score mide confirmación de tendencia.
                Separarlos evita confundir “está barato” con “ya está subiendo”.
              </p>
              <div className="miniStats">
                <div><span>ATH</span><strong>{fmtPrice(snapshot?.ath)}</strong></div>
                <div><span>Drawdown</span><strong>-{indicators.drawdown.toFixed(1)}%</strong></div>
                <div><span>RSI</span><strong>{indicators.rsi?.toFixed(1)}</strong></div>
              </div>
            </div>
          </section>

          <section className="chartCard glass">
            <div className="sectionTitle">
              <div>
                <span className="eyebrow">12 MESES</span>
                <h2>Precio + zonas de tendencia</h2>
              </div>
              <div className="legend">
                <span><i className="dot priceDot"/>Precio</span>
                <span><i className="dot ma50Dot"/>MA50</span>
                <span><i className="dot ma200Dot"/>MA200</span>
              </div>
            </div>

            <div className="chartWrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.48}/>
                      <stop offset="55%" stopColor="#38bdf8" stopOpacity={0.14}/>
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1d2a3c" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#7f8da3', fontSize: 11 }} minTickGap={45} axisLine={false} tickLine={false}/>
                  <YAxis
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v.toFixed(2)}`}
                    tick={{ fill: '#7f8da3', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0c1727', border: '1px solid #26374f', borderRadius: 12 }}
                    labelStyle={{ color: '#a8b5c8' }}
                    formatter={(v, name) => [fmtPrice(v), name === 'price' ? 'Precio' : name.toUpperCase()]}
                  />
                  <Area type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2.3} fill="url(#priceGradient)" dot={false}/>
                  <Line type="monotone" dataKey="ma50" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 5" dot={false}/>
                  <Line type="monotone" dataKey="ma200" stroke="#22c55e" strokeWidth={1.6} strokeDasharray="7 6" dot={false}/>
                  {snapshot?.ath && <ReferenceLine y={snapshot.ath} stroke="#ef4444" strokeOpacity={0.45} strokeDasharray="3 6" />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <div className="sectionTitle outside">
              <div>
                <span className="eyebrow">BOTTOM RADAR</span>
                <h2>Indicadores actuales</h2>
              </div>
              <span className="hint">Más verde = mayor señal de estrés/acumulación</span>
            </div>

            <div className="indicatorsGrid">
              {indicators.rows.map((item) => <IndicatorCard key={item.label} item={item}/>)}
            </div>
          </section>

          <section className="marketStrip glass">
            <div>
              <span>Market Cap</span>
              <strong>${(snapshot.market_cap / 1e9).toFixed(1)}B</strong>
            </div>
            <div>
              <span>Volumen 24h</span>
              <strong>${(snapshot.total_volume / 1e9).toFixed(2)}B</strong>
            </div>
            <div>
              <span>7 días</span>
              <strong className={(snapshot.price_change_percentage_7d_in_currency || 0) >= 0 ? 'positive' : 'negative'}>
                {(snapshot.price_change_percentage_7d_in_currency || 0).toFixed(2)}%
              </strong>
            </div>
            <div>
              <span>30 días</span>
              <strong className={(snapshot.price_change_percentage_30d_in_currency || 0) >= 0 ? 'positive' : 'negative'}>
                {(snapshot.price_change_percentage_30d_in_currency || 0).toFixed(2)}%
              </strong>
            </div>
          </section>
        </>
      )}

      {!indicators && !error && <div className="loadingState">Construyendo radar de {coin.symbol}…</div>}

      <footer>
        V0.1 · Datos de mercado vía CoinGecko · Scores heurísticos para análisis, no recomendación financiera.
      </footer>
    </main>
  )
}

export default App
