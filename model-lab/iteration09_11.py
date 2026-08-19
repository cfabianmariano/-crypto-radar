import csv
import io
import json
import math
import statistics
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DAY = 24*60*60*1000
BINANCE = 'https://data-api.binance.vision/api/v3/klines'
FRED = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id={}'
OUTDIR = Path('model-lab/results')


def fetch_btc(days=760):
    end = int(datetime.now(timezone.utc).timestamp()*1000)
    start = end - days*DAY
    qs = urllib.parse.urlencode({'symbol':'BTCUSDT','interval':'1d','startTime':start,'endTime':end,'limit':1000})
    req = urllib.request.Request(f'{BINANCE}?{qs}', headers={'User-Agent':'crypto-radar-model-lab/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        rows = json.loads(r.read().decode())
    out=[]
    for x in rows[-730:]:
        ts=int(x[0]); out.append({'date':datetime.fromtimestamp(ts/1000, timezone.utc).date().isoformat(),'open':float(x[1]),'high':float(x[2]),'low':float(x[3]),'close':float(x[4]),'volume':float(x[5])})
    return out


def fetch_fred(series):
    # curl is more robust than urllib against FRED redirects/CDN behaviour on GitHub runners.
    text=subprocess.check_output(['curl','-fsSL','--retry','3',FRED.format(series)], text=True)
    reader=csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    out={}
    for row in reader:
        d=row.get('DATE') or row.get('observation_date')
        v=row.get(series)
        if not d or v in (None,'','.'):
            continue
        try: out[d]=float(v)
        except: pass
    if not out:
        raise RuntimeError(f'FRED {series} returned no usable observations')
    return out


def ffill(dates, mapping):
    out={}; last=None
    for d in dates:
        if d in mapping: last=mapping[d]
        out[d]=last
    return out


def pct(x): return '—' if x is None else f'{100*x:.1f}%'

def qtile(xs, q):
    ys=sorted(x for x in xs if x is not None)
    if not ys: return None
    p=(len(ys)-1)*q; a=int(math.floor(p)); b=int(math.ceil(p))
    return ys[a] if a==b else ys[a]+(ys[b]-ys[a])*(p-a)

def mean(xs): return sum(xs)/len(xs) if xs else None

def std(xs): return statistics.pstdev(xs) if len(xs)>1 else 1.0

def distinct(idxs,cool=7):
    out=[]; last=-9999
    for i in idxs:
        if i-last>=cool: out.append(i); last=i
    return out

def evaluate(idxs, closes, horizon, side):
    usable=[i for i in idxs if i+horizon<len(closes)]
    vals=[]
    for i in usable:
        raw=closes[i+horizon]/closes[i]-1
        vals.append(raw if side=='BUY' else -raw)
    if not vals: return {'n':0,'hit':None,'sig5':None,'avg':None,'median':None}
    return {'n':len(vals),'hit':sum(x>0 for x in vals)/len(vals),'sig5':sum(x>.05 for x in vals)/len(vals),'avg':mean(vals),'median':statistics.median(vals)}


def build():
    btc=fetch_btc(); dates=[r['date'] for r in btc]
    nas=ffill(dates,fetch_fred('NASDAQCOM'))
    usd=ffill(dates,fetch_fred('DTWEXBGS'))
    y10=ffill(dates,fetch_fred('DGS10'))
    c=[r['close'] for r in btc]
    rows=[]
    for i,r in enumerate(btc):
        x={'i':i,'date':r['date']}
        if i>=20 and all(nas.get(dates[k]) is not None and usd.get(dates[k]) is not None and y10.get(dates[k]) is not None for k in (i,i-1,i-3,i-5)):
            x.update({
                'btc1':c[i]/c[i-1]-1,'btc3':c[i]/c[i-3]-1,'btc7':c[i]/c[i-7]-1,
                'nas1':nas[dates[i]]/nas[dates[i-1]]-1,'nas3':nas[dates[i]]/nas[dates[i-3]]-1,'nas5':nas[dates[i]]/nas[dates[i-5]]-1,
                'usd1':usd[dates[i]]/usd[dates[i-1]]-1,'usd3':usd[dates[i]]/usd[dates[i-3]]-1,'usd5':usd[dates[i]]/usd[dates[i-5]]-1,
                'y1':y10[dates[i]]-y10[dates[i-1]],'y5':y10[dates[i]]-y10[dates[i-5]],
                'closepos':(r['close']-r['low'])/(r['high']-r['low']) if r['high']>r['low'] else .5,
                'range':(r['high']-r['low'])/r['open'],
                'low20':min(z['low'] for z in btc[i-19:i+1]),
                'high20':max(z['high'] for z in btc[i-19:i+1]),
                'ma20':sum(c[i-19:i+1])/20,
            })
        rows.append(x)
    return btc,rows


def residual_model(rows, split):
    tr=[x for x in rows[:split] if 'nas3' in x]
    mus={k:mean([x[k] for x in tr]) for k in ('nas3','usd3','y5')}
    sds={k:std([x[k] for x in tr]) or 1 for k in ('nas3','usd3','y5')}
    for x in rows:
        if 'nas3' not in x: continue
        x['macro_support']=(x['nas3']-mus['nas3'])/sds['nas3'] - (x['usd3']-mus['usd3'])/sds['usd3'] - (x['y5']-mus['y5'])/sds['y5']
    tr=[x for x in rows[:split] if 'macro_support' in x]
    mx=mean([x['macro_support'] for x in tr]); my=mean([x['btc3'] for x in tr])
    var=sum((x['macro_support']-mx)**2 for x in tr)
    beta=sum((x['macro_support']-mx)*(x['btc3']-my) for x in tr)/var if var else 0
    alpha=my-beta*mx
    for x in rows:
        if 'macro_support' in x:
            x['expected_btc3']=alpha+beta*x['macro_support']
            x['resid']=x['btc3']-x['expected_btc3']
    return alpha,beta


def report(name, objective, setups, btc, split, notes):
    closes=[r['close'] for r in btc]
    lines=[f'# Crypto Radar Model Lab — Iteración {name}','',objective,'',f'Período BTC: {btc[0]["date"]} → {btc[-1]["date"]}. Split temporal 70/30. Horizonte: 30 días. Cooldown: 7 días.','', '| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |','|---|---:|---:|---:|---:|---:|---:|']
    for label,(side,idxs) in setups.items():
        idxs=distinct(sorted(idxs),7)
        tr=evaluate([i for i in idxs if i<split],closes,30,side)
        va=evaluate([i for i in idxs if i>=split],closes,30,side)
        lines.append(f'| {label} | {tr["n"]} | {pct(tr["hit"])} | {va["n"]} | {pct(va["hit"])} | {pct(va["sig5"])} | {pct(va["avg"])} |')
    lines += ['', '## Lectura profesional'] + [f'- {n}' for n in notes] + ['']
    OUTDIR.mkdir(parents=True,exist_ok=True)
    (OUTDIR/f'iteration{name}.md').write_text('\n'.join(lines),encoding='utf-8')


def main():
    btc,rows=build(); split=int(len(btc)*.70)
    _,beta=residual_model(rows,split)
    tr=[x for x in rows[:split] if 'resid' in x]
    if len(tr)<100: raise RuntimeError(f'Insufficient macro-aligned train rows: {len(tr)}')
    r20=qtile([x['resid'] for x in tr],.20); r80=qtile([x['resid'] for x in tr],.80)
    m20=qtile([x['macro_support'] for x in tr],.20); m80=qtile([x['macro_support'] for x in tr],.80)

    s09={
      'BUY positive_decoupling':('BUY',[x['i'] for x in rows if x.get('resid') is not None and x['resid']>=r80]),
      'SELL negative_decoupling':('SELL',[x['i'] for x in rows if x.get('resid') is not None and x['resid']<=r20]),
    }
    report('09','Objetivo: medir un indicador propio de **desacople**: BTC rinde mucho mejor o peor de lo esperable frente a NASDAQ + dólar amplio + Treasury 10Y. El modelo esperado se estima solo en entrenamiento.',s09,btc,split,[f'Beta estimada BTC3d vs macro_support: {beta:.4f}.','NASDAQCOM, DTWEXBGS y DGS10 se obtienen de FRED; forward-fill solo usa el último dato conocido en fines de semana/feriados.','Un residual extremo no presupone continuación: la validación decide persistencia o reversión.'])

    s10={
      'BUY macro_pressure_absorbed':('BUY',[x['i'] for x in rows if x.get('resid') is not None and x['macro_support']<=m20 and x['resid']>=r80 and x['closepos']>=.55]),
      'SELL macro_tailwind_failed':('SELL',[x['i'] for x in rows if x.get('resid') is not None and x['macro_support']>=m80 and x['resid']<=r20 and x['closepos']<=.45]),
    }
    report('10','Objetivo: probar **causa → reacción anómala**. BUY cuando el contexto es de presión macro pero BTC absorbe y cierra relativamente fuerte; SELL cuando el contexto ayuda pero BTC no puede aprovecharlo.',s10,btc,split,['Versión cuantitativa de “mala noticia/contexto y BTC no cae” y su inversa.','Se exige cierre coherente dentro de la vela para evitar llamar absorción a ruido.','Si N queda pequeño, no se promueve aunque el porcentaje sea alto.'])

    s11={
      'BUY resilient_higher_structure':('BUY',[x['i'] for x in rows if x.get('resid') is not None and x['resid']>=r80 and btc[x['i']]['close']>=x['ma20'] and btc[x['i']]['low']>x['low20']*.985 and x['btc7']<.06]),
      'SELL weak_lower_structure':('SELL',[x['i'] for x in rows if x.get('resid') is not None and x['resid']<=r20 and btc[x['i']]['close']<x['ma20'] and btc[x['i']]['high']<x['high20']*1.01 and x['btc7']>-.08]),
    }
    report('11','Objetivo: combinar **información relativa + estructura de precio**. La anomalía macro no dispara sola: debe coincidir con resiliencia (BUY) o incapacidad (SELL).',s11,btc,split,['No se optimizan docenas de indicadores: solo desacople + MA20 + estructura de 20 días.','Buscamos si el mercado “sabe algo” antes de que una tendencia clásica sea evidente.','Si mejora frente a Iteración 09 sin destruir N, la estructura aporta información incremental.'])

if __name__=='__main__': main()
