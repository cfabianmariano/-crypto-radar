import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Minimize2, TrendingUp } from 'lucide-react'
import { rollingSma } from '../lib/signalModel'

const DAY = 24 * 60 * 60 * 1000

const fmtPrice = (n) => {
  if (n == null) return '—'
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (n >= 1) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
}

function mapStudyToCandles(source, series, candles) {
  if (!source.length || !candles.length) return candles.map(() => null)
  const out = []
  let j = 0
  for (const candle of candles) {
    while (j + 1 < source.length && source[j + 1].timestamp <= candle.timestamp) j += 1
    out.push(series[j] ?? null)
  }
  return out
}

export default function CandleChartV2({ data, signals = [], trendSource = [], initialStartTime = null, initialEndTime = null, lang = 'es' }) {
  const wrapRef = useRef(null)
  const dragRef = useRef(null)
  const touchRef = useRef(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const [viewStart, setViewStart] = useState(0)
  const [viewEnd, setViewEnd] = useState(Math.max(0, data.length - 1))
  const [showTrend, setShowTrend] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!data.length) { setViewStart(0); setViewEnd(0); return }
    let start = 0
    let end = data.length - 1
    if (Number.isFinite(initialStartTime) && Number.isFinite(initialEndTime)) {
      const first = data.findIndex((d) => d.timestamp >= initialStartTime)
      if (first >= 0) start = first
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].timestamp <= initialEndTime) { end = i; break }
      }
    }
    setViewStart(start)
    setViewEnd(Math.max(start, end))
    setHoverIndex(null)
  }, [data, initialStartTime, initialEndTime])

  useEffect(() => {
    document.body.classList.toggle('chartOverlayOpen', expanded)
    return () => document.body.classList.remove('chartOverlayOpen')
  }, [expanded])

  const studies = useMemo(() => {
    const ownCloses = data.map((d) => d.close ?? d.price)
    if (data.length >= 200) return { sma50: rollingSma(ownCloses, 50), sma200: rollingSma(ownCloses, 200) }
    const source = trendSource.length ? trendSource : data
    const sourceCloses = source.map((d) => d.close ?? d.price)
    return {
      sma50: mapStudyToCandles(source, rollingSma(sourceCloses, 50), data),
      sma200: mapStudyToCandles(source, rollingSma(sourceCloses, 200), data),
    }
  }, [data, trendSource])

  const visibleData = useMemo(() => data.slice(viewStart, viewEnd + 1), [data, viewStart, viewEnd])
  const geometry = useMemo(() => {
    if (!visibleData.length) return null
    const W = 1000
    const H = expanded ? 620 : 500
    const left = 70, right = 20, top = 24, bottom = 36, volumeH = 82, volumeGap = 16
    const priceBottom = H - bottom - volumeH - volumeGap
    const plotW = W - left - right
    const priceH = priceBottom - top
    const min = Math.min(...visibleData.map((d) => d.low))
    const max = Math.max(...visibleData.map((d) => d.high))
    const pad = Math.max((max - min) * 0.08, max * 0.002)
    const yMin = min - pad, yMax = max + pad
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
    let s = Math.round(start), e = Math.round(end)
    if (e - s + 1 < minBars) e = s + minBars - 1
    if (s < 0) { e -= s; s = 0 }
    if (e > data.length - 1) { s -= e - (data.length - 1); e = data.length - 1 }
    setViewStart(Math.max(0, s)); setViewEnd(Math.min(data.length - 1, e))
  }

  const zoomAt = (factor, ratio = .5) => {
    const size = viewEnd - viewStart + 1
    const newSize = Math.max(Math.min(8, data.length), Math.min(data.length, Math.round(size * factor)))
    const anchor = viewStart + ratio * (size - 1)
    const nextStart = anchor - ratio * (newSize - 1)
    setWindow(nextStart, nextStart + newSize - 1)
  }

  if (!geometry) return <div className="chartEmpty">{lang === 'es' ? 'Sin datos para este período.' : 'No data for this period.'}</div>
  const g = geometry
  const yTicks = Array.from({ length: 5 }, (_, i) => g.yMin + ((g.yMax - g.yMin) * i) / 4)
  const xTickIndexes = Array.from(new Set([0, Math.floor((visibleData.length - 1) * .25), Math.floor((visibleData.length - 1) * .5), Math.floor((visibleData.length - 1) * .75), visibleData.length - 1]))
  const hovered = hoverIndex == null ? null : visibleData[hoverIndex]
  const visibleSma50 = studies.sma50.slice(viewStart, viewEnd + 1)
  const visibleSma200 = studies.sma200.slice(viewStart, viewEnd + 1)
  const linePath = (series) => {
    let path = '', started = false
    series.forEach((v, i) => { if (v == null) { started = false; return }; path += `${started ? ' L' : ' M'} ${g.x(i).toFixed(2)} ${g.y(v).toFixed(2)}`; started = true })
    return path
  }
  const signalPoints = signals.map((s) => {
    const targetTs = s.timestamp
    if (!targetTs || !visibleData.length || targetTs < visibleData[0].timestamp || targetTs > visibleData.at(-1).timestamp + 7 * DAY) return null
    let best = 0, bestDiff = Math.abs(visibleData[0].timestamp - targetTs)
    for (let i = 1; i < visibleData.length; i++) { const diff = Math.abs(visibleData[i].timestamp - targetTs); if (diff < bestDiff) { best = i; bestDiff = diff } }
    return { ...s, i: best }
  }).filter(Boolean)

  const pointerToIndex = (clientX) => {
    const rect = wrapRef.current?.getBoundingClientRect(); if (!rect) return null
    const px = ((clientX - rect.left) / rect.width) * g.W
    return Math.max(0, Math.min(visibleData.length - 1, Math.floor(((px - g.left) / g.plotW) * visibleData.length)))
  }
  const resetZoom = () => {
    if (Number.isFinite(initialStartTime) && Number.isFinite(initialEndTime)) {
      let start = data.findIndex((d) => d.timestamp >= initialStartTime); if (start < 0) start = 0
      let end = data.length - 1; for (let i = data.length - 1; i >= 0; i--) { if (data[i].timestamp <= initialEndTime) { end = i; break } }
      setWindow(start, end)
    } else setWindow(0, data.length - 1)
  }

  return <div className={expanded ? 'chartExpanded' : ''}>
    <div className="chartToolbar">
      <div className="simpleLegend"><span><b className="arrowLegend buyArrowLegend">↓</b>{lang === 'es' ? 'Comprar' : 'Buy'}</span><span><b className="arrowLegend sellArrowLegend">↑</b>{lang === 'es' ? 'Vender' : 'Sell'}</span></div>
      <div className="chartActions"><button className={showTrend ? 'toolBtn active' : 'toolBtn'} onClick={() => setShowTrend((v) => !v)}><TrendingUp size={15}/>{lang === 'es' ? 'Tendencia' : 'Trend'}</button><button className="toolBtn" onClick={() => setExpanded((v) => !v)}>{expanded ? <Minimize2 size={15}/> : <Maximize2 size={15}/>} {expanded ? (lang === 'es' ? 'Cerrar' : 'Close') : (lang === 'es' ? 'Ampliar' : 'Expand')}</button></div>
    </div>
    {showTrend && <div className="trendLegend"><span><i className="trendLine ma50"/>SMA50</span><span><i className="trendLine ma200"/>SMA200</span></div>}
    <div className="gestureHint">{lang === 'es' ? 'Arrastrá para recorrer · rueda/pellizco para zoom · mantené pulsado para medir' : 'Drag to pan · wheel/pinch to zoom · long press to measure'}</div>
    <div className="candleCanvas interactiveChart" ref={wrapRef}
      onPointerDown={(e) => { if (e.pointerType === 'touch') return; e.currentTarget.setPointerCapture?.(e.pointerId); dragRef.current = { x:e.clientX,start:viewStart,end:viewEnd } }}
      onPointerMove={(e) => { if (e.pointerType === 'touch') return; if (dragRef.current) { const rect=wrapRef.current?.getBoundingClientRect(); if(!rect)return; const bars=Math.round((-(e.clientX-dragRef.current.x)/rect.width)*(dragRef.current.end-dragRef.current.start+1)); const size=dragRef.current.end-dragRef.current.start; setWindow(dragRef.current.start+bars,dragRef.current.start+bars+size); return } const i=pointerToIndex(e.clientX); if(i!=null)setHoverIndex(i) }}
      onPointerUp={() => { dragRef.current=null }} onPointerCancel={() => { dragRef.current=null }} onPointerLeave={() => { setHoverIndex(null); dragRef.current=null }}
      onWheel={(e) => { e.preventDefault(); const rect=wrapRef.current?.getBoundingClientRect(); if(!rect)return; const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)); zoomAt(e.deltaY>0?1.22:.82,ratio) }} onDoubleClick={resetZoom}
      onTouchStart={(e) => { if(e.touches.length===2){const[a,b]=e.touches;touchRef.current={type:'pinch',distance:Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY),start:viewStart,end:viewEnd}}else if(e.touches.length===1){touchRef.current={type:'pan',x:e.touches[0].clientX,start:viewStart,end:viewEnd}} }}
      onTouchMove={(e) => { const s=touchRef.current;if(!s)return;if(s.type==='pinch'&&e.touches.length===2){e.preventDefault();const[a,b]=e.touches;const distance=Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);const oldSize=s.end-s.start+1;const newSize=Math.max(Math.min(8,data.length),Math.min(data.length,Math.round(oldSize*(s.distance/Math.max(distance,1)))));const center=(s.start+s.end)/2;setWindow(center-(newSize-1)/2,center+(newSize-1)/2)}else if(s.type==='pan'&&e.touches.length===1){e.preventDefault();const rect=wrapRef.current?.getBoundingClientRect();if(!rect)return;const bars=Math.round((-(e.touches[0].clientX-s.x)/rect.width)*(s.end-s.start+1));const size=s.end-s.start;setWindow(s.start+bars,s.start+bars+size)} }}
      onTouchEnd={() => { touchRef.current=null }} onTouchCancel={() => { touchRef.current=null }}>
      <svg viewBox={`0 0 ${g.W} ${g.H}`} role="img" aria-label="Candlestick chart">
        {yTicks.map((tick) => <g key={tick}><line x1={g.left} x2={g.W-g.right} y1={g.y(tick)} y2={g.y(tick)} stroke="#1d2a3c"/><text x={g.left-9} y={g.y(tick)+4} textAnchor="end" fill="#75849a" fontSize="12">{fmtPrice(tick)}</text></g>)}
        {visibleData.map((d,i)=>{const up=d.close>=d.open,x=g.x(i),yo=g.y(d.open),yc=g.y(d.close),yh=g.y(d.high),yl=g.y(d.low),bodyY=Math.min(yo,yc),bodyH=Math.max(1.4,Math.abs(yc-yo)),color=up?'#22c55e':'#ef4444';return <g key={`${d.timestamp}-${i}`}><line x1={x} x2={x} y1={yh} y2={yl} stroke={color} strokeWidth={Math.max(1,g.candleWidth*.22)}/><rect x={x-g.candleWidth/2} y={bodyY} width={g.candleWidth} height={bodyH} fill={color} rx=".7"/><rect x={x-g.candleWidth/2} y={g.volumeY(d.volume)} width={g.candleWidth} height={Math.max(1,g.H-g.bottom-g.volumeY(d.volume))} fill={color} opacity=".42" rx=".5"/></g>})}
        <text x={g.left} y={g.volumeTop-4} fill="#71829a" fontSize="11">VOLUME</text><line x1={g.left} x2={g.W-g.right} y1={g.volumeTop} y2={g.volumeTop} stroke="#1d2a3c"/>
        {showTrend && <><path d={linePath(visibleSma50)} fill="none" stroke="#f59e0b" strokeWidth="2.2"/><path d={linePath(visibleSma200)} fill="none" stroke="#38bdf8" strokeWidth="2.4"/></>}
        {signalPoints.map((s,idx)=>{const candle=visibleData[s.i],isBuy=s.side==='BUY',cy=isBuy?g.y(candle.low)+28:g.y(candle.high)-20;return <text key={`${s.side}-${idx}`} x={g.x(s.i)} y={cy} textAnchor="middle" dominantBaseline="middle" fill={isBuy?'#22c55e':'#ef4444'} stroke="#f8fafc" strokeWidth="1.6" paintOrder="stroke" fontSize="28" fontWeight="950">{isBuy?'↓':'↑'}</text>})}
        {hoverIndex!=null&&<line x1={g.x(hoverIndex)} x2={g.x(hoverIndex)} y1={g.top} y2={g.H-g.bottom} stroke="#94a3b8" strokeDasharray="4 5" strokeOpacity=".65"/>}
        {xTickIndexes.map((i)=><text key={i} x={g.x(i)} y={g.H-9} textAnchor="middle" fill="#75849a" fontSize="12">{visibleData[i]?.date}</text>)}
      </svg>
      {hovered && <div className="candleTooltip v2Tooltip" style={{ left:`${Math.min(78,Math.max(3,(g.x(hoverIndex)/g.W)*100))}%`, top:hoverIndex!=null&&g.y(hovered.close)>g.H*.48?'8px':'auto', bottom:hoverIndex!=null&&g.y(hovered.close)<=g.H*.48?'18px':'auto' }}><strong>{hovered.date}</strong><span>O {fmtPrice(hovered.open)}</span><span>H {fmtPrice(hovered.high)}</span><span>L {fmtPrice(hovered.low)}</span><span>C {fmtPrice(hovered.close)}</span><span>Vol {(hovered.volume||0).toLocaleString('en-US',{maximumFractionDigits:0})}</span></div>}
    </div>
    {(viewStart>0||viewEnd<data.length-1)&&<button className="resetZoomBtn" onClick={resetZoom}>{lang==='es'?'Volver al período':'Reset period'}</button>}
  </div>
}
