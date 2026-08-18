function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

export function rollingSma(values, period) {
  const out = Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export function rsiAt(values, i, period = 14) {
  if (i < period) return null
  let gains = 0
  let losses = 0
  for (let j = i - period + 1; j <= i; j++) {
    const d = values[j] - values[j - 1]
    if (d >= 0) gains += d
    else losses += -d
  }
  const g = gains / period
  const l = losses / period
  if (!l) return 100
  return 100 - 100 / (1 + g / l)
}

function technicalSellScore(prices, ma50, ma200, i) {
  if (i < 200 || !ma50[i] || !ma200[i]) return null
  const p = prices[i]
  const rsi = rsiAt(prices, i)
  const ret20 = p / prices[i - 20] - 1
  const ret60 = p / prices[i - 60] - 1
  const clamp = (x) => Math.max(-1, Math.min(1, x))
  const trend200 = clamp((p / ma200[i] - 1) / 0.15)
  const trendCross = clamp((ma50[i] / ma200[i] - 1) / 0.08)
  const mom20 = clamp(ret20 / 0.15)
  const mom60 = clamp(ret60 / 0.30)
  const rsiVote = clamp(((rsi ?? 50) - 50) / 20)
  return 25 * trend200 + 20 * trendCross + 20 * mom20 + 20 * mom60 + 15 * rsiVote
}

function distinct(events, cooldown = 7) {
  const out = []
  let last = -999
  for (const e of events) {
    if (e.index - last >= cooldown) {
      out.push(e)
      last = e.index
    }
  }
  return out
}

function evaluate(events, prices, horizon, side) {
  const usable = events.filter((e) => e.index + horizon < prices.length)
  if (!usable.length) return { n: 0, hits: 0, hitRate: null, avgReturn: null, medianReturn: null }
  const signed = usable.map((e) => {
    const raw = prices[e.index + horizon] / prices[e.index] - 1
    return side === 'BUY' ? raw : -raw
  })
  const sorted = [...signed].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const hits = signed.filter((x) => x > 0).length
  return {
    n: usable.length,
    hits,
    hitRate: hits / usable.length,
    avgReturn: mean(signed),
    medianReturn: median,
  }
}

export function buildBtcSignalModel(history) {
  if (!history || history.length < 260) return null
  const prices = history.map((x) => x.price)
  const ma50 = rollingSma(prices, 50)
  const ma200 = rollingSma(prices, 200)

  const buyEvents = []
  const sellEvents = []
  const chartSignals = []

  for (let i = 200; i < prices.length; i++) {
    const rsi = rsiAt(prices, i)
    const ret7 = prices[i] / prices[i - 7] - 1
    const vs200 = prices[i] / ma200[i] - 1

    // Pattern discovered in the 2-year BTC study: pullback inside an established bull regime.
    // It is deliberately selective; no signal is better than a weak signal.
    const buy = vs200 > 0.05 && ret7 < -0.05 && rsi < 45
    if (buy) buyEvents.push({ index: i, date: history[i].date, price: prices[i] })

    // Structural deterioration model used in the first 2-year backtest.
    const sellScore = technicalSellScore(prices, ma50, ma200, i)
    const sell = sellScore != null && sellScore <= -35
    if (sell) sellEvents.push({ index: i, date: history[i].date, price: prices[i], score: sellScore })
  }

  const buys = distinct(buyEvents, 7)
  const sells = distinct(sellEvents, 7)
  const buyStats = evaluate(buys, prices, 14, 'BUY')
  const sellStats = evaluate(sells, prices, 90, 'SELL')

  for (const e of buys) chartSignals.push({ ...e, side: 'BUY' })
  for (const e of sells) chartSignals.push({ ...e, side: 'SELL' })
  chartSignals.sort((a, b) => a.index - b.index)

  const i = prices.length - 1
  const currentRsi = rsiAt(prices, i)
  const ret7 = prices[i] / prices[i - 7] - 1
  const ret30 = prices[i] / prices[i - 30] - 1
  const vs200 = prices[i] / ma200[i] - 1
  const sellScore = technicalSellScore(prices, ma50, ma200, i)
  const buyActive = vs200 > 0.05 && ret7 < -0.05 && currentRsi < 45
  const sellActive = sellScore != null && sellScore <= -35

  let action = 'ESPERAR'
  let effectiveness = null
  let evidenceN = 0
  let horizon = null
  let reason = 'No hay un patrón con ventaja histórica suficiente activo hoy.'

  if (buyActive && buyStats.hitRate != null && buyStats.hitRate >= 0.70) {
    action = 'COMPRA'
    effectiveness = buyStats.hitRate
    evidenceN = buyStats.n
    horizon = 14
    reason = 'Pullback fuerte dentro de régimen alcista: precio >5% sobre MA200, caída semanal >5% y RSI <45.'
  } else if (sellActive && sellStats.hitRate != null && sellStats.hitRate >= 0.70) {
    action = 'VENTA'
    effectiveness = sellStats.hitRate
    evidenceN = sellStats.n
    horizon = 90
    reason = 'Deterioro estructural confirmado por tendencia, momentum y pérdida de medias.'
  }

  return {
    action,
    effectiveness,
    evidenceN,
    horizon,
    reason,
    buyStats,
    sellStats,
    chartSignals,
    current: { rsi: currentRsi, ret7, ret30, vs200, sellScore },
    ma50,
    ma200,
  }
}
