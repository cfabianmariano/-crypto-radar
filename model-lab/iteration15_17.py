import importlib.util
import json
import math
import statistics
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location('base', 'model-lab/iteration09_11.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

OUTDIR = Path('model-lab/results')
DAY = 24*60*60*1000
FUNDING = 'https://fapi.binance.com/fapi/v1/fundingRate'


def pct(x): return base.pct(x)
def distinct(xs,cool=7): return base.distinct(sorted(xs),cool)
def evaluate(xs,closes,h,side): return base.evaluate(xs,closes,h,side)


def sma(values,n):
    out=[None]*len(values); s=0.0
    for i,v in enumerate(values):
        s+=v
        if i>=n: s-=values[i-n]
        if i>=n-1: out[i]=s/n
    return out


def rsi(values,n=14):
    out=[None]*len(values)
    for i in range(n,len(values)):
        gains=losses=0.0
        for j in range(i-n+1,i+1):
            d=values[j]-values[j-1]
            if d>=0:gains+=d
            else: losses-=d
        out[i]=100.0 if losses==0 else 100-100/(1+(gains/n)/(losses/n))
    return out


def fetch_funding(start_ms,end_ms):
    rows=[]; cursor=start_ms
    while cursor<=end_ms:
        qs=urllib.parse.urlencode({'symbol':'BTCUSDT','startTime':cursor,'endTime':end_ms,'limit':1000})
        req=urllib.request.Request(f'{FUNDING}?{qs}',headers={'User-Agent':'crypto-radar-model-lab/1.0'})
        with urllib.request.urlopen(req,timeout=30) as r:
            part=json.loads(r.read().decode())
        if not part: break
        rows.extend(part)
        last=int(part[-1]['fundingTime'])
        nxt=last+1
        if nxt<=cursor or len(part)<1000: break
        cursor=nxt
    daily=defaultdict(list)
    for x in rows:
        d=datetime.fromtimestamp(int(x['fundingTime'])/1000,timezone.utc).date().isoformat()
        daily[d].append(float(x['fundingRate']))
    return {d:sum(v) for d,v in daily.items()}


def write(name,objective,header,rows,notes):
    lines=[f'# Crypto Radar Model Lab — Iteración {name}','',objective,'',header[0],header[1],*rows,'','## Lectura profesional',*[f'- {n}' for n in notes],'']
    OUTDIR.mkdir(parents=True,exist_ok=True)
    (OUTDIR/f'iteration{name}.md').write_text('\n'.join(lines),encoding='utf-8')


def q(xs,q): return base.qtile(xs,q)


def main():
    btc,feats=base.build(); closes=[r['close'] for r in btc]; split=int(len(btc)*.70)
    base.residual_model(feats,split)
    train=[x for x in feats[:split] if 'resid' in x]
    r20=q([x['resid'] for x in train],.20); r80=q([x['resid'] for x in train],.80)
    sell=distinct([x['i'] for x in feats if x.get('resid') is not None and x['resid']>=r80],7)
    buy=distinct([x['i'] for x in feats if x.get('resid') is not None and x['resid']<=r20],7)

    # 15 — freeze the asymmetric SELL hypothesis and inspect time robustness, no new threshold tuning.
    rows15=[]
    for label,pred in [
        ('Train 70%',lambda i:i<split),
        ('Validation 30%',lambda i:i>=split),
        ('2025 H1',lambda i:'2025-01-01'<=btc[i]['date']<='2025-06-30'),
        ('2025 H2',lambda i:'2025-07-01'<=btc[i]['date']<='2025-12-31'),
        ('2026 YTD',lambda i:btc[i]['date']>='2026-01-01'),
    ]:
        st=evaluate([i for i in sell if pred(i)],closes,90,'SELL')
        rows15.append(f'| {label} | {st["n"]} | {pct(st["hit"])} | {pct(st["sig5"])} | {pct(st["avg"])} | {pct(st["median"])} |')
    write('15','Objetivo: **congelar** la candidata bajista descubierta antes: fortaleza anormal de BTC frente a NASDAQ+dólar+10Y, evaluada exclusivamente como señal SELL a 90 días. No se cambia la regla; se estudia si el 72.7% reciente es estable o un fenómeno de régimen.',
          ('| Tramo | N | Acierto SELL 90d | >5% | Retorno firmado medio | Mediana |','|---|---:|---:|---:|---:|---:|'),rows15,[
              'Esta iteración no busca mejorar el porcentaje: busca detectar si la ventaja es estable en el tiempo.',
              'Si entrenamiento y validación difieren mucho, el patrón puede depender del régimen reciente y no ser una ley general.',
              'Se mantiene asimétrico: no se exige una versión BUY equivalente.'
          ])

    # funding data for 16/17; only information known on each day.
    start_ms=int(datetime.fromisoformat(btc[0]['date']).replace(tzinfo=timezone.utc).timestamp()*1000)
    end_ms=int(datetime.now(timezone.utc).timestamp()*1000)
    funding=fetch_funding(start_ms,end_ms)
    fundvals=[funding.get(btc[i]['date']) for i in range(split) if funding.get(btc[i]['date']) is not None]
    f30=q(fundvals,.30); f70=q(fundvals,.70)
    ma20=sma(closes,20); ma50=sma(closes,50); rs=rsi(closes,14)

    # 16 — SELL-only confirmation: anomalous strength + crowded longs / overextension.
    # Filters are predeclared, not chosen from validation.
    sell_funding=[]; sell_structure=[]; sell_both=[]
    for i in sell:
        f=funding.get(btc[i]['date'])
        if f is None or ma20[i] is None or ma50[i] is None: continue
        crowded=f>=f70
        overextended=(closes[i]>ma20[i] and closes[i]>ma50[i] and (rs[i] or 50)>=58)
        if crowded: sell_funding.append(i)
        if overextended: sell_structure.append(i)
        if crowded and overextended: sell_both.append(i)
    rows16=[]
    for label,idxs in [('SELL decoupling + high funding',sell_funding),('SELL decoupling + price overextension',sell_structure),('SELL decoupling + both confirmations',sell_both)]:
        tr=evaluate([i for i in idxs if i<split],closes,90,'SELL'); va=evaluate([i for i in idxs if i>=split],closes,90,'SELL')
        rows16.append(f'| {label} | {tr["n"]} | {pct(tr["hit"])} | {va["n"]} | {pct(va["hit"])} | {pct(va["sig5"])} | {pct(va["avg"])} |')
    write('16','Objetivo: mejorar **solo el modelo bajista**. La señal base de fortaleza anormal se confirma por dos mecanismos plausibles de techo: derivados demasiado largos (funding alto) y sobreextensión de precio. Horizonte congelado: 90 días.',
          ('| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |','|---|---:|---:|---:|---:|---:|---:|'),rows16,[
              'Funding alto no es por sí mismo una venta: aquí funciona solo como confirmación de una anomalía macro-precio.',
              'La sobreextensión usa MA20/MA50 y RSI únicamente como contexto, no como señal autónoma.',
              'Si la confluencia sube el porcentaje pero deja 1-2 casos, no se considera validada.'
          ])

    # 17 — BUY-only model, intentionally independent from SELL logic.
    # Negative decoupling is combined with stressed funding or actual price reclaim.
    buy_funding=[]; buy_reclaim=[]; buy_both=[]
    for i in buy:
        f=funding.get(btc[i]['date'])
        if f is None or i<3 or ma20[i] is None: continue
        stressed=f<=f30
        reclaim=(closes[i]>closes[i-1] and closes[i]>=ma20[i]*.97 and btc[i]['close']>(btc[i]['low']+0.60*(btc[i]['high']-btc[i]['low'])))
        if stressed: buy_funding.append(i)
        if reclaim: buy_reclaim.append(i)
        if stressed and reclaim: buy_both.append(i)
    rows17=[]
    for label,idxs in [('BUY negative decoupling + low funding',buy_funding),('BUY negative decoupling + reclaim',buy_reclaim),('BUY negative decoupling + both confirmations',buy_both)]:
        tr=evaluate([i for i in idxs if i<split],closes,30,'BUY'); va=evaluate([i for i in idxs if i>=split],closes,30,'BUY')
        rows17.append(f'| {label} | {tr["n"]} | {pct(tr["hit"])} | {va["n"]} | {pct(va["hit"])} | {pct(va["sig5"])} | {pct(va["avg"])} |')
    write('17','Objetivo: desarrollar **un modelo alcista distinto**, sin imponer simetría. Se parte de debilidad anormal frente al contexto y se exige evidencia de estrés en derivados o recuperación real del precio. Horizonte: 30 días.',
          ('| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |','|---|---:|---:|---:|---:|---:|---:|'),rows17,[
              'La lógica BUY busca capitulación/estrés + recuperación; no es la inversa mecánica de la señal SELL.',
              'El funding bajo representa posicionamiento estresado; el reclaim exige que el precio empiece a absorber la presión.',
              'Se conserva el 64.7% anterior como baseline: una nueva variante debe mejorarlo sin destruir la muestra.'
          ])

if __name__=='__main__': main()
