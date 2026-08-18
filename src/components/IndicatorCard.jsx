export default function IndicatorCard({ item }) {
  const score = Math.max(0, Math.min(100, Number(item.score) || 0))
  const tone =
    score >= 80 ? 'heatStrongBuy' :
    score >= 60 ? 'heatBuy' :
    score >= 40 ? 'heatNeutral' :
    score >= 20 ? 'heatSell' : 'heatStrongSell'

  return (
    <div className={`indicatorCard heatTile ${tone}`}>
      <div className="indicatorTop">
        <div>
          <span className="family">{item.family}</span>
          <h3>{item.label}</h3>
        </div>
        <strong>{item.value}</strong>
      </div>
      <div className="heatScore">{score.toFixed(0)}</div>
      <div className="heatCaption">Señal /100</div>
    </div>
  )
}
