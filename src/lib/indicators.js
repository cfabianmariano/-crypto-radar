function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n))
}

export function sma(values, period) {
  if (!values.length) return null
  const slice = values.slice(-Math.min(period, values.length))
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

export function rsi(values, period = 14) {
  if (values.length <= period) return null
  let gains = 0
  let losses = 0

  for (let i = values.length - period; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    if (change >= 0) gains += change
    else losses += Math.abs(change)
  }

  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function volatility(values, period = 30) {
  const slice = values.slice(-Math.min(period + 1, values.length))
  if (slice.length < 3) return 0

  const returns = []
  for (let i = 1; i < slice.length; i++) {
    returns.push((slice[i] - slice[i - 1]) / slice[i - 1])
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, x) => sum + (x - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance) * Math.sqrt(365) * 100
}

export function buildIndicators(snapshot, history) {
  const prices = history.map((x) => x.price)
  const current = snapshot.current_price
  const ma200 = sma(prices, 200)
  const ma50 = sma(prices, 50)
  const currentRsi = rsi(prices, 14)
  const vol30 = volatility(prices, 30)
  const drawdown = Math.abs(snapshot.ath_change_percentage || 0)
  const priceVs200 = ma200 ? ((current / ma200) - 1) * 100 : 0
  const priceVs50 = ma50 ? ((current / ma50) - 1) * 100 : 0

  // Bottom Score = mide condiciones de estrés/valor relativo.
  // NO pretende predecir el piso exacto.
  const drawdownScore = clamp((drawdown - 20) * 1.35)
  const rsiBottomScore = clamp((55 - (currentRsi ?? 55)) * 2.4)
  const ma200BottomScore = clamp((-priceVs200 + 8) * 3.2)
  const volatilityScore = clamp((vol30 - 35) * 1.25)

  const bottomScore = Math.round(
    drawdownScore * 0.38 +
    rsiBottomScore * 0.25 +
    ma200BottomScore * 0.25 +
    volatilityScore * 0.12
  )

  // Trend Score = mide confirmación de tendencia, no "baratura".
  const ma50Trend = clamp((priceVs50 + 10) * 3.4)
  const ma200Trend = clamp((priceVs200 + 15) * 2.6)
  const rsiTrend = clamp(((currentRsi ?? 50) - 30) * 2.1)
  const change30 = snapshot.price_change_percentage_30d_in_currency || 0
  const momentum = clamp((change30 + 25) * 2)

  const trendScore = Math.round(
    ma50Trend * 0.30 +
    ma200Trend * 0.25 +
    rsiTrend * 0.20 +
    momentum * 0.25
  )

  return {
    bottomScore,
    trendScore,
    rsi: currentRsi,
    ma50,
    ma200,
    priceVs50,
    priceVs200,
    vol30,
    drawdown,
    rows: [
      {
        label: 'Drawdown desde ATH',
        value: `${drawdown.toFixed(1)}%`,
        score: Math.round(drawdownScore),
        family: 'Ciclo',
        direction: 'bottom',
        help: 'Cuánto cayó desde su máximo histórico. Caídas profundas elevan el Bottom Score.',
      },
      {
        label: 'RSI diario',
        value: currentRsi ? currentRsi.toFixed(1) : '—',
        score: Math.round(rsiBottomScore),
        family: 'Momentum',
        direction: 'bottom',
        help: 'Busca sobreventa. Un RSI bajo puede acompañar capitulación, pero no confirma un piso por sí solo.',
      },
      {
        label: 'Precio vs MA200',
        value: `${priceVs200 >= 0 ? '+' : ''}${priceVs200.toFixed(1)}%`,
        score: Math.round(ma200BottomScore),
        family: 'Tendencia',
        direction: 'bottom',
        help: 'Compara el precio con la media móvil de 200 días.',
      },
      {
        label: 'Volatilidad 30d',
        value: `${vol30.toFixed(0)}%`,
        score: Math.round(volatilityScore),
        family: 'Riesgo',
        direction: 'bottom',
        help: 'Volatilidad anualizada aproximada de los últimos 30 días.',
      },
    ],
  }
}

export function scoreLabel(score, kind = 'bottom') {
  if (kind === 'trend') {
    if (score >= 75) return 'Tendencia fuerte'
    if (score >= 60) return 'Mejorando'
    if (score >= 40) return 'Mixta'
    return 'Débil'
  }
  if (score >= 80) return 'Capitulación'
  if (score >= 65) return 'Acumulación'
  if (score >= 45) return 'Vigilar'
  return 'Sin señal'
}
