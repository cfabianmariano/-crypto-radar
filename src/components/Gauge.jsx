export default function Gauge({ value, label, subtitle, tone = 'blue' }) {
  const safe = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="glass gaugeCard">
      <div className="gaugeTitle">{label}</div>
      <div className={`gauge gauge-${tone}`} style={{ '--score': `${safe * 3.6}deg` }}>
        <div className="gaugeInner">
          <strong>{safe}</strong>
          <span>/100</span>
        </div>
      </div>
      <div className="gaugeSubtitle">{subtitle}</div>
    </div>
  )
}
