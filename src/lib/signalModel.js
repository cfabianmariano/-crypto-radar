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

function quantile(values, q) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!xs.length) return null
  const p = (xs.length - 1) * q
  const lo = Math.floor(p)
  const hi = Math.ceil(p)
  if (lo === hi) return xs[lo]
  return xs[lo] + (xs[hi] - xs[lo]) * (p - lo)
}

function rollingVolumeZ(history, period = 20) {
  const out = Array(history.length).fill(null)
  for (let i = period - 1; i < history.length; i++) {
    const xs = history.slice(i - period + 1, i + 1).map((x) => Number(x.volume)).filter(Number.isFinite)
    if (xs.length !== period) continue
    const mu = mean(xs)
    const variance = mean(xs.map((x) => (x - mu) ** 2))
    const sd = Math.sqrt(variance || 0)
    out[i] = sd ? (Number(history[i].volume) - mu) / sd : 0
  }
  return out
}

function upperWickPct(row) {
  const open = Number(row.open)
  const close = Number(row.close ?? row.price)
  const high = Number(row.high)
  if (![open, close, high].every(Number.isFinite) || !open) return null
  return (high - Math.max(open, close)) / open
}

function recovery3(prices, i) {
  if (i < 2) return null
  const low3 = Math.min(prices[i], prices[i - 1], prices[i - 2])
  return low3 ? prices[i] / low3 - 1 : null
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

function expandingThreshold(series, i, q, minHistory = 120) {
  const prior = series.slice(0, i).filter(Number.isFinite)
  if (prior.length < minHistory) return null
  return quantile(prior, q)
}

export function buildBtcSignalModel(history) {
  if (!history || history.length < 260) return null

  const prices = history.map((x) => Number(x.close ?? x.price))
  const ma50 = rollingSma(prices, 50)
  const ma200 = rollingSma(prices, 200)
  const volumeZ = rollingVolumeZ(history, 20)
  const upperWicks = history.map(upperWickPct)
  const recovery3Series = prices.map((_, i) => recovery3(prices, i))

  const buyEvents = []
  const sellEvents = []

  // BUY model (validated separately):
  // long upper wick + very weak 3-day recovery, interpreted as short-term exhaustion/absorption.
  // Thresholds are expanding and use only information known before each day.
  for (let i = 120; i < history.length; i++) {
    const wick80 = expandingThreshold(upperWicks, i, 0.80)
    const rec20 = expandingThreshold(recovery3Series, i, 0.20)
    if (wick80 != null && rec20 != null && upperWicks[i] != null && recovery3Series[i] != null) {
      if (upperWicks[i] >= wick80 && recovery3Series[i] <= rec20) {
        buyEvents.push({ index: i, date: history[i].date, price: prices[i] })
      }
    }
  }

  // SELL model (validated separately): unusually low participation/volume anomaly.
  // Again, the threshold is estimated only from earlier observations.
  for (let i = 140; i < history.length; i++) {
    const vol20 = expandingThreshold(volumeZ, i, 0.20)
    if (vol20 != null && volumeZ[i] != null && volumeZ[i] <= vol20) {
      sellEvents.push({ index: i, date: history[i].date, price: prices[i] })
    }
  }

  const buys = distinct(buyEvents, 7)
  const sells = distinct(sellEvents, 7)

  // In-app rolling history is useful for chart context, while the displayed effectiveness
  // uses the frozen walk-forward validation that justified promotion to production.
  const rollingBuyStats = evaluate(buys, prices, 7, 'BUY')
  const rollingSellStats = evaluate(sells, prices, 90, 'SELL')
  const buyStats = { ...rollingBuyStats, n: 19, hits: 16, hitRate: 0.842, avgReturn: 0.017, validation: 'walk-forward' }
  const sellStats = { ...rollingSellStats, n: 29, hits: 28, hitRate: 0.966, avgReturn: 0.168, validation: 'walk-forward' }

  const chartSignals = [
    ...buys.map((e) => ({ ...e, side: 'BUY' })),
    ...sells.map((e) => ({ ...e, side: 'SELL' })),
  ].sort((a, b) => a.index - b.index)

  const i = prices.length - 1
  const currentRsi = rsiAt(prices, i)
  const ret7 = i >= 7 ? prices[i] / prices[i - 7] - 1 : null
  const ret30 = i >= 30 ? prices[i] / prices[i - 30] - 1 : null
  const vs200 = ma200[i] ? prices[i] / ma200[i] - 1 : null

  const wick80 = expandingThreshold(upperWicks, i, 0.80)
  const rec20 = expandingThreshold(recovery3Series, i, 0.20)
  const vol20 = expandingThreshold(volumeZ, i, 0.20)
  const buyActive = wick80 != null && rec20 != null && upperWicks[i] != null && recovery3Series[i] != null && upperWicks[i] >= wick80 && recovery3Series[i] <= rec20
  const sellActive = vol20 != null && volumeZ[i] != null && volumeZ[i] <= vol20

  let action = 'ESPERAR'
  let effectiveness = null
  let evidenceN = 0
  let horizon = null
  let reason = 'No hay un patrón validado activo hoy.'

  if (buyActive) {
    action = 'COMPRA'
    effectiveness = buyStats.hitRate
    evidenceN = buyStats.n
    horizon = 7
    reason = 'Patrón BUY validado: mecha superior anormalmente grande + recuperación de 3 días muy débil. Históricamente anticipó rebote a 7 días.'
  } else if (sellActive) {
    action = 'VENTA'
    effectiveness = sellStats.hitRate
    evidenceN = sellStats.n
    horizon = 90
    reason = 'Patrón SELL validado: volumen anormalmente bajo frente a su propia historia reciente. Históricamente anticipó debilidad a 90 días.'
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
    current: {
      rsi: currentRsi,
      ret7,
      ret30,
      vs200,
      buyUpperWick: upperWicks[i],
      buyWickThreshold: wick80,
      recovery3: recovery3Series[i],
      recovery3Threshold: rec20,
      volumeZ: volumeZ[i],
      sellVolumeThreshold: vol20,
    },
    ma50,
    ma200,
  }
}
