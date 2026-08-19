import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bell, ChevronDown, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { COINS } from './data/coins'
import { fetchBtcCandles, fetchCoinHistory, fetchCoinSnapshot } from './lib/api'
import { buildIndicators } from './lib/indicators'
import { buildBtcSignalModel } from './lib/signalModel'
import CandleChartV2 from './components/CandleChartV2'

const DAY = 24 * 60 * 60 * 1000
const MAX_RANGE_DAYS = { '1h': 180, '4h': 365, '1d': 1825, '1w': 3650 }
const PAN_BUFFER_DAYS = { '1h': 7, '4h': 30, '1d': 120, '1w': 365 }
const INTERVAL_LABELS = { es:{'1h':'1 hora','4h':'4 horas','1d':'1 día','1w':'1 semana'}, en:{'1h':'1 hour','4h':'4 hours','1d':'1 day','1w':'1 week'} }
const LANG_KEY = 'crypto-radar-lang-v2'

const COPY = {
  es: {
    radar:'Radar', chart:'Gráfico', indicators:'Indicadores', news:'Noticias', alerts:'Alertas', refresh:'Actualizar', asset:'Activo', signal:'Señal actual', wait:'ESPERAR', buy:'COMPRAR', sell:'VENDER',
    why:'Por qué', triggers:'Próximos gatillos', buyIf:'Vigilar compra si', sellIf:'Vigilar venta si', keyIndicators:'Indicadores clave', relative:'Fuerza relativa', marketContext:'Contexto del mercado', recentNews:'Noticias recientes', latest5:'últimas 5 horas', allMarket:'Mercado seguido', technical:'Técnico', trend:'Tendencia', momentum:'Momentum', volatility:'Volatilidad', rsi:'RSI (14)', ma200:'Precio vs MA200', ma50:'Precio vs MA50', dominance:'Dominancia BTC', breadth:'Amplitud', from:'Desde', to:'Hasta', candles:'Velas', current:'Precio actual', support:'Soporte', resistance:'Resistencia', range:'Rango 24h', noNews:'Sin noticias relevantes recientes', source:'Fuente', updated:'Actualizado', model:'Modelo', noPattern:'No hay un patrón validado activo hoy.', historical:'Validación histórica', notSignal:'dato oculto, no señal actual', loading:'Cargando…', unavailable:'Dato no disponible', open:'Abrir fuente', language:'Idioma'
  },
  en: {
    radar:'Radar', chart:'Chart', indicators:'Indicators', news:'News', alerts:'Alerts', refresh:'Refresh', asset:'Asset', signal:'Current signal', wait:'WAIT', buy:'BUY', sell:'SELL',
    why:'Why', triggers:'Next triggers', buyIf:'Watch buy if', sellIf:'Watch sell if', keyIndicators:'Key indicators', relative:'Relative strength', marketContext:'Market context', recentNews:'Recent news', latest5:'last 5 hours', allMarket:'Tracked market', technical:'Technical', trend:'Trend', momentum:'Momentum', volatility:'Volatility', rsi:'RSI (14)', ma200:'Price vs MA200', ma50:'Price vs MA50', dominance:'BTC dominance', breadth:'Breadth', from:'From', to:'To', candles:'Candles', current:'Current price', support:'Support', resistance:'Resistance', range:'24h range', noNews:'No relevant recent news', source:'Source', updated:'Updated', model:'Model', noPattern:'No validated pattern is active today.', historical:'Historical validation', notSignal:'hidden stat, not current signal', loading:'Loading…', unavailable:'Data unavailable', open:'Open source', language:'Language'
  }
}

const fmtPrice = (n) => {
  if (!Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  if (v >= 1000) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (v >= 1) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 3 })}`
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 7 })}`
}
const fmtPct = (n, d=2) => Number.isFinite(Number(n)) ? `${Number(n)>0?'+':''}${Number(n).toFixed(d)}%` : '—'
const toInputDate = (date) => date.toISOString().slice(0, 10)

function Logo() {
  return <div className="v2Brand"><span className="v2Logo" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="22" cy="25" r="14"/><path d="M10 25a12 12 0 0 1 20-9"/><path d="M15 25a7 7 0 0 1 11-5"/><line x1="22" y1="25" x2="37" y2="10"/><circle cx="22" cy="25" r="3"/><circle cx="37" cy="10" r="2.5"/></svg></span><div><b>CRYPTO RADAR</b><small>Signal · Validation · Risk</small></div></div>
}

function Sparkline({ values=[], tone='up' }) {
  const safe = values.filter(Number.isFinite)
  if (safe.length < 2) return <div className="v2Sparkline empty"/>
  const min=Math.min(...safe), max=Math.max(...safe), span=max-min||1
  const pts=safe.map((v,i)=>`${(i/(safe.length-1))*100},${35-((v-min)/span)*31}`).join(' ')
  return <svg className={`v2Sparkline ${tone}`} viewBox="0 0 100 38" preserveAspectRatio="none"><polyline points={pts}/></svg>
}

function Tone({ value, children }) { return <span className={Number(value)>0?'v2Up':Number(value)<0?'v2Down':'v2Flat'}>{children}</span> }

function NewsCard({ item, lang }) {
  const date = item?.seendate ? new Date(item.seendate) : null
  const t = item?.title?.toLowerCase() || ''
  const tag = /fed|treasury|yield|inflation|cpi|rate|dollar|liquidity/.test(t) ? 'MACRO' : /sec|regulat|etf|congress|trump|law/.test(t) ? 'REG' : /xrp|ripple/.test(t) ? 'XRP' : /bitcoin|btc/.test(t) ? 'BTC' : 'CRYPTO'
  return <article className="v2NewsItem"><div className="v2NewsMeta"><span>{tag}</span><time>{date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—'}</time></div><h4>{item.title}</h4><p>{item.domain || COPY[lang].source}</p><a href={item.url} target="_blank" rel="noreferrer">{COPY[lang].open}</a></article>
}

export default function AppV2() {
  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime()-30*DAY)
  const [lang,setLang] = useState(()=>localStorage.getItem(LANG_KEY)==='en'?'en':'es')
  const [mobileTab,setMobileTab] = useState('radar')
  const [coinId,setCoinId] = useState('bitcoin')
  const [snapshot,setSnapshot] = useState(null)
  const [history,setHistory] = useState([])
  const [chartHistory,setChartHistory] = useState([])
  const [loading,setLoading] = useState(true)
  const [chartLoading,setChartLoading] = useState(false)
  const [error,setError] = useState('')
  const [chartError,setChartError] = useState('')
  const [lastUpdated,setLastUpdated] = useState(null)
  const [chartFrom,setChartFrom] = useState(toInputDate(thirtyDaysAgo))
  const [chartTo,setChartTo] = useState(toInputDate(today))
  const [candleInterval,setCandleInterval] = useState('1h')
  const [market,setMarket] = useState({assets:[],pairs:{},global:null})
  const [news,setNews] = useState([])
  const [newsUpdated,setNewsUpdated] = useState(null)
  const [newsError,setNewsError] = useState('')
  const requestId=useRef(0), chartRequestId=useRef(0)
  const t=COPY[lang]
  const coin=COINS.find(c=>c.id===coinId)||COINS[0]

  useEffect(()=>{ localStorage.setItem(LANG_KEY,lang); document.documentElement.lang=lang==='en'?'en':'es' },[lang])

  async function loadBase(){
    const my=++requestId.current; setLoading(true); setError('')
    try{ const days=coinId==='bitcoin'?730:365; const [s,h]=await Promise.all([fetchCoinSnapshot(coinId),fetchCoinHistory(coinId,days)]); if(my!==requestId.current)return; setSnapshot(s);setHistory(h);if(coinId!=='bitcoin')setChartHistory(h);setLastUpdated(new Date()) }
    catch(e){if(my===requestId.current)setError(e.message||'Data error')}
    finally{if(my===requestId.current)setLoading(false)}
  }

  async function loadBtcChart(){
    if(coinId!=='bitcoin')return
    const my=++chartRequestId.current; setChartLoading(true);setChartError('')
    try{ const selectedStart=new Date(`${chartFrom}T00:00:00`).getTime(), selectedEnd=new Date(`${chartTo}T23:59:59`).getTime(); if(!Number.isFinite(selectedStart)||!Number.isFinite(selectedEnd)||selectedStart>=selectedEnd)throw new Error(lang==='es'?'Rango de fechas inválido':'Invalid date range'); const rangeDays=Math.ceil((selectedEnd-selectedStart)/DAY); if(rangeDays>MAX_RANGE_DAYS[candleInterval])throw new Error(`Max ${MAX_RANGE_DAYS[candleInterval]} days`); const buffer=PAN_BUFFER_DAYS[candleInterval]*DAY; const candles=await fetchBtcCandles({interval:candleInterval,startTime:Math.max(0,selectedStart-buffer),endTime:Math.min(Date.now(),selectedEnd+buffer),maxCandles:6000}); if(my!==chartRequestId.current)return;if(!candles.length)throw new Error('No data');setChartHistory(candles)}
    catch(e){if(my===chartRequestId.current)setChartError(e.message||'Chart error')}
    finally{if(my===chartRequestId.current)setChartLoading(false)}
  }

  async function loadMarket(){
    try{ const r=await fetch('/api/market-overview',{headers:{accept:'application/json'}}); const d=await r.json(); if(Array.isArray(d.assets)&&d.assets.length)setMarket(d) }catch{}
  }
  async function loadNews(){
    setNewsError('')
    try{ const r=await fetch('/api/news',{headers:{accept:'application/json'}}); const d=await r.json(); setNews(Array.isArray(d.articles)?d.articles:[]);setNewsUpdated(new Date(d.generatedAt||Date.now()));if(d.error)setNewsError(d.error) }
    catch(e){setNewsError(e.message||'news error')}
  }

  useEffect(()=>{setSnapshot(null);setHistory([]);setChartHistory([]);loadBase();const timer=setInterval(loadBase,5*60_000);return()=>clearInterval(timer)},[coinId])
  useEffect(()=>{if(coinId!=='bitcoin')return;const timer=setTimeout(loadBtcChart,250);return()=>clearTimeout(timer)},[coinId,chartFrom,chartTo,candleInterval])
  useEffect(()=>{loadMarket();loadNews();const timer=setInterval(()=>{loadMarket();loadNews()},5*60_000);return()=>clearInterval(timer)},[])

  const indicators=useMemo(()=>snapshot&&history.length>=30?buildIndicators(snapshot,history):null,[snapshot,history])
  const btcModel=useMemo(()=>coinId==='bitcoin'?buildBtcSignalModel(history):null,[coinId,history])
  const btcSignals=useMemo(()=>btcModel?btcModel.chartSignals.map(s=>({...s,timestamp:history[s.index]?.timestamp})):[],[btcModel,history])
  const lineChartData=useMemo(()=>coinId==='bitcoin'?[]:chartHistory.map(r=>({...r,ma50:indicators?.ma50,ma200:indicators?.ma200})),[coinId,chartHistory,indicators])
  const selectedStart=useMemo(()=>new Date(`${chartFrom}T00:00:00`).getTime(),[chartFrom])
  const selectedEnd=useMemo(()=>new Date(`${chartTo}T23:59:59`).getTime(),[chartTo])
  const change24=Number(snapshot?.price_change_percentage_24h||0)
  const change7=Number(snapshot?.price_change_percentage_7d_in_currency||0)
  const change30=Number(snapshot?.price_change_percentage_30d_in_currency||0)
  const action=btcModel?.action||t.wait
  const actionLabel=action==='COMPRA'?(lang==='es'?'COMPRAR':'BUY'):action==='VENTA'?(lang==='es'?'VENDER':'SELL'):(lang==='es'?'ESPERAR':'WAIT')
  const actionTone=action==='COMPRA'?'buy':action==='VENTA'?'sell':'wait'
  const recentCloses=chartHistory.slice(-13).map(x=>Number(x.close??x.price)).filter(Number.isFinite)
  const trend12=recentCloses.length>1?(recentCloses.at(-1)/recentCloses[0]-1)*100:null
  const sparkTone=Number(trend12)>=0?'up':'down'
  const levels=useMemo(()=>{const rows=(chartHistory||[]).slice(-40);if(!rows.length)return{support:null,resistance:null};return{support:Math.min(...rows.map(x=>Number(x.low??x.price))),resistance:Math.max(...rows.map(x=>Number(x.high??x.price))) }},[chartHistory])
  const trackedAssets=market.assets||[]
  const green=trackedAssets.filter(a=>Number(a.change24)>0).length, red=trackedAssets.filter(a=>Number(a.change24)<0).length
  const topUp=[...trackedAssets].sort((a,b)=>Number(b.change24)-Number(a.change24)).slice(0,3)
  const topDown=[...trackedAssets].sort((a,b)=>Number(a.change24)-Number(b.change24)).slice(0,3)
  const pairEntries=Object.entries(market.pairs||{}).filter(([,v])=>v)
  const desktopGo=(id)=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})

  const tabs=[['radar','⌾',t.radar],['chart','⌁',t.chart],['indicators','≋',t.indicators],['news','◇',t.news]]

  return <main className="v2Shell">
    <header className="v2Topbar">
      <Logo/>
      <nav className="v2DesktopNav">{tabs.map(([id,icon,label])=><button key={id} onClick={()=>desktopGo(`v2-${id}`)}>{icon}<span>{label}</span></button>)}</nav>
      <div className="v2TopActions">
        <div className="v2Lang" aria-label={t.language}><button className={lang==='es'?'active':''} onClick={()=>setLang('es')}>🇪🇸<span>Español</span></button><button className={lang==='en'?'active':''} onClick={()=>setLang('en')}>🇺🇸<span>USA</span></button></div>
        <div className="v2Live">{error?<WifiOff size={15}/>:<Wifi size={15}/>}<b>{error?'OFF':'LIVE'}</b>{lastUpdated&&<small>{lastUpdated.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small>}</div>
        <button className="v2IconBtn" title={t.alerts} onClick={async()=>{if('Notification'in window){const p=await Notification.requestPermission();if(p==='granted')new Notification('Crypto Radar',{body:lang==='es'?'Alertas locales activadas':'Local alerts enabled'})}}}><Bell size={16}/></button>
      </div>
    </header>

    <nav className="v2MobileTabs">{tabs.map(([id,icon,label])=><button key={id} className={mobileTab===id?'active':''} onClick={()=>setMobileTab(id)}><span>{icon}</span>{label}</button>)}</nav>

    <div className={`v2MobilePane ${mobileTab==='radar'?'show':''}`} id="v2-radar">
      <section className="v2Hero v2Card">
        <div className="v2AssetTop"><div className="v2AssetBadge">₿</div><div className="v2AssetTitle"><label>{t.asset}</label><div className="v2Select"><select value={coinId} onChange={e=>setCoinId(e.target.value)}>{COINS.map(c=><option key={c.id} value={c.id}>{c.symbol} · {c.name}</option>)}</select><ChevronDown size={15}/></div></div><span className={`v2SignalPill ${actionTone}`}>{actionLabel}</span></div>
        <div className="v2HeroMain"><div><strong className="v2BigPrice">{fmtPrice(snapshot?.current_price)}</strong><div className="v2ChangeRow"><Tone value={change24}>{fmtPct(change24)} · 24h</Tone><Tone value={change7}>{fmtPct(change7)} · 7d</Tone><Tone value={change30}>{fmtPct(change30)} · 30d</Tone></div></div><div className="v2HeroTrend"><Sparkline values={recentCloses} tone={sparkTone}/><Tone value={trend12}>{fmtPct(trend12)}</Tone><small>12h</small></div></div>
        <div className="v2HeroStats"><div><span>{t.signal}</span><b className={`signal-${actionTone}`}>{actionLabel}</b></div><div><span>{t.rsi}</span><b>{indicators?.rsi?.toFixed(1)??'—'}</b></div><div><span>{t.ma200}</span><b>{indicators?fmtPct(indicators.priceVs200,1):'—'}</b></div><div><span>{t.volatility}</span><b>{indicators?`${indicators.vol30.toFixed(0)}%`:'—'}</b></div></div>
      </section>

      <section className="v2DecisionGrid">
        <article className="v2Card v2Why"><span className="v2Eyebrow">{t.model}</span><h3>{t.why}: {actionLabel}</h3><p>{btcModel?.reason||t.noPattern}</p><details><summary>{t.historical}</summary><small>{t.buy}: {btcModel?.buyStats?.n??0} · {t.sell}: {btcModel?.sellStats?.n??0} · {t.notSignal}</small></details></article>
        <article className="v2Card v2Triggers"><span className="v2Eyebrow">{t.triggers}</span><div className="v2TriggerCols"><div><b className="v2Up">✓ {t.buyIf}</b><p>{levels.resistance?`${lang==='es'?'rompe':'breaks'} ${fmtPrice(levels.resistance)} ${lang==='es'?'con volumen y sostiene':'with volume and holds'}`:t.unavailable}</p></div><div><b className="v2Down">○ {t.sellIf}</b><p>{levels.support?`${lang==='es'?'pierde':'loses'} ${fmtPrice(levels.support)} ${lang==='es'?'con aceleración bajista':'with bearish acceleration'}`:t.unavailable}</p></div></div></article>
      </section>
    </div>

    <section className={`v2ChartSection v2Card v2MobilePane ${mobileTab==='chart'?'show':''}`} id="v2-chart">
      <div className="v2SectionHead"><div><span className="v2Eyebrow">{coin.symbol}/USD</span><h2>{t.chart}</h2></div><button className="v2Refresh" onClick={()=>{loadBase();if(coinId==='bitcoin')loadBtcChart()}}><RefreshCw size={15} className={loading||chartLoading?'spin':''}/>{t.refresh}</button></div>
      {coinId==='bitcoin'&&<div className="v2ChartControls"><label>{t.from}<input type="date" value={chartFrom} onChange={e=>setChartFrom(e.target.value)}/></label><label>{t.to}<input type="date" value={chartTo} onChange={e=>setChartTo(e.target.value)}/></label><label>{t.candles}<select value={candleInterval} onChange={e=>setCandleInterval(e.target.value)}><option value="1h">{INTERVAL_LABELS[lang]['1h']}</option><option value="4h">{INTERVAL_LABELS[lang]['4h']}</option><option value="1d">{INTERVAL_LABELS[lang]['1d']}</option><option value="1w">{INTERVAL_LABELS[lang]['1w']}</option></select></label></div>}
      {chartError&&<div className="v2Error">{chartError}</div>}
      <div className="v2ChartBody">{coinId==='bitcoin'?<CandleChartV2 data={chartHistory} signals={btcSignals} trendSource={history} initialStartTime={selectedStart} initialEndTime={selectedEnd} lang={lang}/>:<ResponsiveContainer width="100%" height="100%"><AreaChart data={lineChartData}><CartesianGrid stroke="#1b2a3d" vertical={false}/><XAxis dataKey="date" tick={{fill:'#71829a',fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'#71829a',fontSize:10}} axisLine={false} tickLine={false} width={58}/><Tooltip contentStyle={{background:'#091522',border:'1px solid #26374f',borderRadius:10}}/><Area type="monotone" dataKey="price" stroke="#35d4ff" fill="#35d4ff" fillOpacity={.08} dot={false}/><Line type="monotone" dataKey="ma50" stroke="#f59e0b" dot={false}/><Line type="monotone" dataKey="ma200" stroke="#38bdf8" dot={false}/></AreaChart></ResponsiveContainer>}</div>
      <div className="v2ChartBottom"><div><span>{t.trend}</span><b>{indicators?.trendScore>=60?(lang==='es'?'Alcista':'Bullish'):indicators?.trendScore<40?(lang==='es'?'Débil':'Weak'):(lang==='es'?'Mixta':'Mixed')}</b></div><div><span>{t.support}</span><b>{fmtPrice(levels.support)}</b></div><div><span>{t.resistance}</span><b>{fmtPrice(levels.resistance)}</b></div><div><span>{t.range}</span><b>{snapshot?`${fmtPrice(snapshot.low_24h)} – ${fmtPrice(snapshot.high_24h)}`:'—'}</b></div></div>
    </section>

    <section className={`v2Indicators v2MobilePane ${mobileTab==='indicators'?'show':''}`} id="v2-indicators">
      <div className="v2Card v2KeyPanel"><div className="v2SectionHead"><div><span className="v2Eyebrow">{t.technical}</span><h2>{t.keyIndicators}</h2></div></div><div className="v2IndicatorGrid">
        <div><span>{t.rsi}</span><b>{indicators?.rsi?.toFixed(1)??'—'}</b><small>{indicators?.rsi>70?(lang==='es'?'Sobrecomprado':'Overbought'):indicators?.rsi<30?(lang==='es'?'Sobrevendido':'Oversold'):(lang==='es'?'Neutral':'Neutral')}</small></div>
        <div><span>{t.ma50}</span><b>{indicators?fmtPct(indicators.priceVs50,1):'—'}</b><small>{Number(indicators?.priceVs50)>=0?(lang==='es'?'Sobre media':'Above average'):(lang==='es'?'Bajo media':'Below average')}</small></div>
        <div><span>{t.ma200}</span><b>{indicators?fmtPct(indicators.priceVs200,1):'—'}</b><small>{Number(indicators?.priceVs200)>=0?(lang==='es'?'Régimen fuerte':'Strong regime'):(lang==='es'?'Régimen débil':'Weak regime')}</small></div>
        <div><span>{t.volatility}</span><b>{indicators?`${indicators.vol30.toFixed(0)}%`:'—'}</b><small>{lang==='es'?'Anualizada aprox.':'Approx. annualized'}</small></div>
        <div><span>{t.momentum}</span><b>{fmtPct(change30,1)}</b><small>30d</small></div>
        <div><span>{t.trend}</span><b>{indicators?.trendScore??'—'}</b><small>/100</small></div>
      </div></div>

      <div className="v2Card v2MarketPanel"><div className="v2SectionHead"><div><span className="v2Eyebrow">24H</span><h2>{t.allMarket}</h2></div></div><div className="v2AssetTiles">{trackedAssets.map(a=><div key={a.symbol} className={Number(a.change24)>=0?'up':'down'}><span>{a.symbol}/USD</span><strong>{fmtPrice(a.price)}</strong><Tone value={a.change24}>{fmtPct(a.change24)}</Tone><small>7d {fmtPct(a.change7d,1)} · 30d {fmtPct(a.change30d,1)}</small></div>)}</div></div>

      <div className="v2Card v2PairPanel"><div className="v2SectionHead"><div><span className="v2Eyebrow">BTC</span><h2>{t.relative}</h2></div></div><div className="v2PairGrid">{pairEntries.map(([name,p])=><div key={name}><span>{name}</span><b>{Number(p.value)>=1?Number(p.value).toFixed(4):Number(p.value).toFixed(8)}</b><Tone value={p.change24}>{fmtPct(p.change24)}</Tone></div>)}</div></div>

      <div className="v2Card v2ContextPanel"><div className="v2SectionHead"><div><span className="v2Eyebrow">GLOBAL</span><h2>{t.marketContext}</h2></div></div><div className="v2ContextGrid"><div><span>{t.dominance}</span><b>{Number.isFinite(Number(market.global?.btcDominance))?`${Number(market.global.btcDominance).toFixed(1)}%`:'—'}</b></div><div><span>{t.breadth}</span><b><span className="v2Up">{green}↑</span> / <span className="v2Down">{red}↓</span></b></div><div><span>{lang==='es'?'Mercado total 24h':'Total market 24h'}</span><b><Tone value={market.global?.marketCapChange24}>{fmtPct(market.global?.marketCapChange24)}</Tone></b></div></div><div className="v2Movers"><div><span>{lang==='es'?'Mayores subidas':'Top gainers'}</span>{topUp.map(a=><small key={a.symbol}>{a.symbol} <Tone value={a.change24}>{fmtPct(a.change24,1)}</Tone></small>)}</div><div><span>{lang==='es'?'Mayores bajadas':'Top losers'}</span>{topDown.map(a=><small key={a.symbol}>{a.symbol} <Tone value={a.change24}>{fmtPct(a.change24,1)}</Tone></small>)}</div></div></div>
    </section>

    <section className={`v2News v2Card v2MobilePane ${mobileTab==='news'?'show':''}`} id="v2-news">
      <div className="v2SectionHead"><div><span className="v2Eyebrow">{t.latest5}</span><h2>{t.recentNews}</h2></div><div className="v2NewsActions">{newsUpdated&&<small>{t.updated} {newsUpdated.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small>}<button onClick={loadNews}>{t.refresh}</button></div></div>
      {newsError&&<div className="v2SubtleError">{newsError}</div>}
      <div className="v2NewsList">{news.length?news.slice(0,8).map((n,i)=><NewsCard key={`${n.url}-${i}`} item={n} lang={lang}/>):<div className="v2Empty">{t.noNews}</div>}</div>
    </section>

    {!snapshot&&!error&&<div className="v2Loading">{t.loading}</div>}
    {error&&<div className="v2Error global">{error}</div>}
    <footer className="v2Footer">Crypto Radar · {lang==='es'?'Señal, validación y riesgo. No constituye asesoramiento financiero.':'Signal, validation and risk. Not financial advice.'}</footer>
  </main>
}
