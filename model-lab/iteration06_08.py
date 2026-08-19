import csv
import io
import json
import math
import statistics
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DAY = 24*60*60*1000
BINANCE = 'https://data-api.binance.vision/api/v3/klines'
OUTDIR = Path('model-lab/results')

FOMC = {
'2024-09-18','2024-11-07','2024-12-18',
'2025-01-29','2025-03-19','2025-05-07','2025-06-18','2025-07-30','2025-09-17','2025-10-29','2025-12-10',
'2026-01-28','2026-03-18','2026-04-29','2026-06-17','2026-07-29'}
CPI = {
'2024-09-11','2024-10-10','2024-11-13','2024-12-11',
'2025-01-15','2025-02-12','2025-03-12','2025-04-10','2025-05-13','2025-06-11','2025-07-15','2025-08-12','2025-09-11','2025-10-24','2025-12-18',
'2026-01-13','2026-02-13','2026-03-11','2026-04-10','2026-05-12','2026-06-10','2026-07-14','2026-08-12'}
MACRO_DAYS = FOMC | CPI


def get_json(url):
    req=urllib.request.Request(url,headers={'User-Agent':'crypto-radar-model-lab/1.0'})
    with urllib.request.urlopen(req,timeout=30) as r:
        return json.loads(r.read().decode())


def fetch_btc(days=760):
    end=int(datetime.now(timezone.utc).timestamp()*1000); start=end-days*DAY
    q=urllib.parse.urlencode({'symbol':'BTCUSDT','interval':'1d','startTime':start,'endTime':end,'limit':1000})
    rows=get_json(f'{BINANCE}?{q}')
    out=[]
    for x in rows:
        ts=int(x[0]); out.append({'date':datetime.fromtimestamp(ts/1000,timezone.utc).date().isoformat(),'open':float(x[1]),'high':float(x[2]),'low':float(x[3]),'close':float(x[4]),'volume':float(x[5])})
    return out[-730:]


def fetch_stooq(symbol):
    url=f'https://stooq.com/q/d/l/?s={urllib.parse.quote(symbol)}&i=d'
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=30) as r: text=r.read().decode('utf-8','ignore')
    out={}
    for row in csv.DictReader(io.StringIO(text)):
        try: out[row['Date']] = float(row['Close'])
        except Exception: pass
    return out


def pct(x): return '—' if x is None else f'{x*100:.1f}%'
def ret(a,b): return b/a-1 if a else 0

def distinct(idxs,cool=7):
    z=[]; last=-9999
    for i in idxs:
        if i-last>=cool: z.append(i); last=i
    return z


def evaluate(idxs, closes, horizon, side):
    vals=[]
    for i in idxs:
        if i+horizon>=len(closes): continue
        r=closes[i+horizon]/closes[i]-1
        vals.append(r if side=='BUY' else -r)
    if not vals:return {'n':0,'hit':None,'sig5':None,'avg':None}
    return {'n':len(vals),'hit':sum(x>0 for x in vals)/len(vals),'sig5':sum(x>.05 for x in vals)/len(vals),'avg':sum(vals)/len(vals)}


def write_result(num,title,objective,rows,items,notes):
    split=int(len(rows)*.70); closes=[r['close'] for r in rows]
    lines=[f'# Crypto Radar Model Lab — Iteración {num:02d}','',objective,'',f'Período BTC: {rows[0]["date"]} → {rows[-1]["date"]}. Split temporal 70/30. Horizonte: 30 días. Cooldown: 7 días.','',
           '| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |','|---|---:|---:|---:|---:|---:|---:|']
    verdicts=[]
    for name,side,idxs in items:
        idxs=distinct(sorted(idxs),7)
        tr=evaluate([i for i in idxs if i<split],closes,30,side)
        va=evaluate([i for i in idxs if i>=split],closes,30,side)
        lines.append(f'| {name} | {tr["n"]} | {pct(tr["hit"])} | {va["n"]} | {pct(va["hit"])} | {pct(va["sig5"])} | {pct(va["avg"])} |')
        if va['n']>=5 and va['hit'] is not None and va['hit']>=.70 and (tr['hit'] is None or tr['hit']>=.55): v='PROMOVER'
        elif va['n']>=5 and va['hit'] is not None and va['hit']<.60: v='DESCARTAR/CORREGIR'
        else:v='OBSERVAR'
        verdicts.append((name,v,va))
    lines+=['','## Resultado']
    for n,v,va in verdicts: lines.append(f'- **{n}**: {v} — {pct(va["hit"])} (N={va["n"]}).')
    lines+=['','## Lectura profesional']+[f'- {x}' for x in notes]+['']
    OUTDIR.mkdir(parents=True,exist_ok=True); (OUTDIR/f'iteration{num:02d}.md').write_text('\n'.join(lines),encoding='utf-8')
    print('\n'.join(lines))


def align_external(rows, spx, dxy):
    out=[]; last_spx=last_dxy=None
    for i,r in enumerate(rows):
        if r['date'] in spx:last_spx=spx[r['date']]
        if r['date'] in dxy:last_dxy=dxy[r['date']]
        out.append((last_spx,last_dxy))
    return out


def main():
    rows=fetch_btc(); closes=[r['close'] for r in rows]
    try: spx=fetch_stooq('^spx')
    except Exception: spx={}
    try: dxy=fetch_stooq('dx.f')
    except Exception: dxy={}
    ext=align_external(rows,spx,dxy)

    # 06 — Absorción: entorno risk-off, pero BTC resiste y cierra fuerte.
    buy=[]; sell=[]
    for i in range(20,len(rows)):
        s0,d0=ext[i-3]; s1,d1=ext[i]
        if None in (s0,d0,s1,d1): continue
        spx3=ret(s0,s1); dxy3=ret(d0,d1); btc3=ret(closes[i-3],closes[i])
        cp=(rows[i]['close']-rows[i]['low'])/(rows[i]['high']-rows[i]['low']) if rows[i]['high']>rows[i]['low'] else .5
        low10=min(r['low'] for r in rows[i-9:i+1]); high10=max(r['high'] for r in rows[i-9:i+1])
        stress=spx3<-.018 and dxy3>.006
        tailwind=spx3>.018 and dxy3<-.006
        if stress and btc3>-.02 and rows[i]['close']>low10*1.025 and cp>.62: buy.append(i)
        if tailwind and btc3<.012 and rows[i]['close']<high10*.985 and cp<.42: sell.append(i)
    write_result(6,'Absorción y fracaso contextual','Objetivo: medir si la **reacción anómala de BTC frente a un contexto macro de mercado** contiene más información que la dirección de la noticia por sí sola.',rows,[('BUY riskoff_absorption','BUY',buy),('SELL riskon_failure','SELL',sell)],['La hipótesis es contraria: fortaleza bajo presión y debilidad bajo viento de cola.','SPX y DXY actúan como proxy objetivo del contexto fundamental diario; no se usa futuro para formar la señal.'])

    # 07 — Evento macro + estado previo + reacción 48h. La noticia importa, pero se exige comportamiento posterior inmediato observable.
    buy=[]; sell=[]
    dates={r['date']:i for i,r in enumerate(rows)}
    for d in MACRO_DAYS:
        i=dates.get(d)
        if i is None or i<30 or i+2>=len(rows): continue
        pre7=ret(closes[i-7],closes[i-1]); r0=ret(rows[i]['open'],rows[i]['close']); r2=ret(closes[i],closes[i+2])
        prior_low=min(r['low'] for r in rows[i-14:i]); prior_high=max(r['high'] for r in rows[i-14:i])
        # absorption after a weak setup: bad/weak immediate tape, then no new low + recovery
        if pre7<-.025 and r0<.012 and min(rows[i]['low'],rows[i+1]['low'],rows[i+2]['low'])>=prior_low*.985 and r2>.012: buy.append(i+2)
        # distribution after strong setup: good tape fails to extend and loses support
        if pre7>.025 and r0>-.012 and max(rows[i]['high'],rows[i+1]['high'],rows[i+2]['high'])<=prior_high*1.02 and r2<-.012: sell.append(i+2)
    write_result(7,'Secuencia macro + reacción','Objetivo: dejar de evaluar un solo día. Se observa una secuencia: **estado previo → evento CPI/FOMC → reacción durante 48h → confirmación**, y recién entonces se dispara.',rows,[('BUY macro_absorption_48h','BUY',buy),('SELL macro_distribution_48h','SELL',sell)],['La señal se fecha dos días después del evento: es más tardía, pero evita inferir sentimiento con una sola vela.','Si mejora la tasa sin destruir la muestra, la secuencia tiene más valor que el evento aislado.'])

    # 08 — Residual/decoupling: aprender relación BTC~SPX+DXY solo en entrenamiento y detectar desacoples extremos.
    split=int(len(rows)*.70)
    X=[];Y=[]
    for i in range(1,split):
        s0,d0=ext[i-1]; s1,d1=ext[i]
        if None in (s0,d0,s1,d1): continue
        X.append((ret(s0,s1),ret(d0,d1))); Y.append(ret(closes[i-1],closes[i]))
    # simple OLS 2 variables + intercept via normal equations 3x3
    def solve3(A,b):
        M=[A[0][:]+[b[0]],A[1][:]+[b[1]],A[2][:]+[b[2]]]
        for c in range(3):
            p=max(range(c,3),key=lambda r:abs(M[r][c])); M[c],M[p]=M[p],M[c]
            if abs(M[c][c])<1e-12:return [0,0,0]
            q=M[c][c]; M[c]=[v/q for v in M[c]]
            for r in range(3):
                if r==c:continue
                q=M[r][c]; M[r]=[M[r][j]-q*M[c][j] for j in range(4)]
        return [M[i][3] for i in range(3)]
    n=len(X); sx=sum(x for x,_ in X); sd=sum(d for _,d in X); sy=sum(Y)
    A=[[n,sx,sd],[sx,sum(x*x for x,_ in X),sum(x*d for x,d in X)],[sd,sum(x*d for x,d in X),sum(d*d for _,d in X)]]
    b=[sy,sum(x*y for (x,_),y in zip(X,Y)),sum(d*y for (_,d),y in zip(X,Y))]
    a,bx,bd=solve3(A,b)
    train_res=[y-(a+bx*x+bd*d) for (x,d),y in zip(X,Y)]
    sig=statistics.pstdev(train_res) if len(train_res)>2 else .02
    buy=[]; sell=[]
    for i in range(20,len(rows)):
        s0,d0=ext[i-1]; s1,d1=ext[i]
        if None in (s0,d0,s1,d1): continue
        x=ret(s0,s1); d=ret(d0,d1); y=ret(closes[i-1],closes[i]); resid=y-(a+bx*x+bd*d)
        mom5=ret(closes[i-5],closes[i]); cp=(rows[i]['close']-rows[i]['low'])/(rows[i]['high']-rows[i]['low']) if rows[i]['high']>rows[i]['low'] else .5
        # extreme unexplained strength/weakness + price-action confirmation
        if resid>1.25*sig and mom5<.035 and cp>.58: buy.append(i)
        if resid<-1.25*sig and mom5>-.035 and cp<.42: sell.append(i)
    write_result(8,'Desacople / residual de mercado','Objetivo: crear un indicador propio: **cuánto más fuerte o débil estuvo BTC de lo que el contexto SPX+DXY hacía esperar**. La relación esperada se estima solo en entrenamiento; el residual extremo se valida después.',rows,[('BUY positive_decoupling','BUY',buy),('SELL negative_decoupling','SELL',sell)],['Este es un indicador de información relativa, no un RSI disfrazado.','Si BTC se niega a comportarse como debería frente al contexto, ese error puede revelar acumulación o distribución latente.','La regresión se ajusta solo con el 70% inicial para evitar mirar el futuro.'])

if __name__=='__main__': main()
