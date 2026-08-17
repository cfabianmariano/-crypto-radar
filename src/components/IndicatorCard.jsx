export default function IndicatorCard({ item }) {
  const level =
    item.score >= 75 ? 'good' :
    item.score >= 50 ? 'warn' : 'soft'

  return (
    <div className="indicatorCard glass">
      <div className="indicatorTop">
        <div>
          <span className="family">{item.family}</span>
          <h3>{item.label}</h3>
        </div>
        <strong>{item.value}</strong>
      </div>

      <div className="bar">
        <div className={`barFill ${level}`} style={{ width: `${item.score}%` }} />
      </div>

      <div className="indicatorBottom">
        <span>Señal {item.score}/100</span>
        <span>{item.help}</span>
      </div>
    </div>
  )
}
