import importlib.util
import statistics
from pathlib import Path

spec = importlib.util.spec_from_file_location('base', 'model-lab/iteration09_11.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

OUTDIR = Path('model-lab/results')


def pct(x): return base.pct(x)
def distinct(xs,cool=7): return base.distinct(sorted(xs),cool)
def evaluate(xs,closes,h,side): return base.evaluate(xs,closes,h,side)
def q(xs,p): return base.qtile(xs,p)


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
            if d>=0: gains+=d
            else: losses+=-d
        out[i]=100.0 if losses==0 else 100-100/(1+(gains/n)/(losses/n))
    return out


def write(name,objective,header,rows,notes):
    lines=[f'# Crypto Radar Model Lab — Iteración {name}','',objective,'',header[0],header[1],*rows,'','## Lectura profesional',*[f'- {n}' for n in notes],'']
    OUTDIR.mkdir(parents=True,exist_ok=True)
    (OUTDIR/f'iteration{name}.md').write_text('\n'.join(lines),encoding='utf-8')


def main():
    btc,feats=base.build(); closes=[r['close'] for r in btc]; vols=[r['volume'] for r in btc]
    split=int(len(btc)*.70)
    base.residual_model(feats,split)
    train=[x for x in feats[:split] if 'resid' in x]
    r20=q([x['resid'] for x in train],.20); r80=q([x['resid'] for x in train],.80)
    sell=distinct([x['i'] for x in feats if x.get('resid') is not None and x['resid']>=r80],7)
    buy=distinct([x['i'] for x in feats if x.get('resid') is not None and x['resid']<=r20],7)
    ma20=sma(closes,20); ma50=sma(closes,50); ma200=sma(closes,200); rs=rsi(closes,14)

    volmean=[None]*len(vols)
    for i in range(19,len(vols)): volmean[i]=sum(vols[i-19:i+1])/20

    # 15 — freeze asymmetric SELL 90d and inspect temporal stability.
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
    write('15','Objetivo: **congelar** la candidata bajista: fortaleza anormal de BTC frente a NASDAQ+dólar+10Y, evaluada solo como SELL a 90 días. No se cambia la regla; se estudia estabilidad temporal.',
          ('| Tramo | N | Acierto SELL 90d | >5% | Retorno firmado medio | Mediana |','|---|---:|---:|---:|---:|---:|'),rows15,[
              'No se busca mejorar el porcentaje, sino comprobar si la ventaja existe en más de un régimen.',
              'Si el 72.7% vive solo en el tramo reciente, no se trata como ley general.',
              'Se mantiene asimétrico: no se exige versión BUY.'
          ])

    # 16 — SELL-only confirmations: euphoria/overextension and failed close.
    sell_over=[]; sell_reject=[]; sell_combo=[]
    for i in sell:
        if i<50 or ma20[i] is None or ma50[i] is None or rs[i] is None: continue
        ret30=closes[i]/closes[i-30]-1
        closepos=(btc[i]['close']-btc[i]['low'])/(btc[i]['high']-btc[i]['low']) if btc[i]['high']>btc[i]['low'] else .5
        over=(ret30>.08 and closes[i]>ma20[i] and closes[i]>ma50[i] and rs[i]>=58)
        reject=(closepos<.55 and vols[i]>=(volmean[i] or vols[i]))
        if over: sell_over.append(i)
        if reject: sell_reject.append(i)
        if over and reject: sell_combo.append(i)
    rows16=[]
    for label,idxs in [('SELL decoupling + overextension',sell_over),('SELL decoupling + weak high-volume close',sell_reject),('SELL decoupling + both',sell_combo)]:
        tr=evaluate([i for i in idxs if i<split],closes,90,'SELL'); va=evaluate([i for i in idxs if i>=split],closes,90,'SELL')
        rows16.append(f'| {label} | {tr["n"]} | {pct(tr["hit"])} | {va["n"]} | {pct(va["hit"])} | {pct(va["sig5"])} | {pct(va["avg"])} |')
    write('16','Objetivo: mejorar **solo el modelo bajista** con confirmaciones propias de techo: sobreextensión/euforia y cierre débil con volumen. Horizonte congelado: 90 días.',
          ('| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |','|---|---:|---:|---:|---:|---:|---:|'),rows16,[
              'No se usa la inversa del modelo BUY: son mecanismos específicos de distribución/techo.',
              'RSI y medias actúan como contexto de sobreextensión, no como señal autónoma.',
              'Una mejora con N demasiado pequeño no se promueve.'
          ])

    # 17 — BUY-only model: negative decoupling + capitulation/reclaim, independent logic.
    buy_cap=[]; buy_reclaim=[]; buy_combo=[]
    for i in buy:
        if i<50 or ma20[i] is None or rs[i] is None: continue
        ret7=closes[i]/closes[i-7]-1
        closepos=(btc[i]['close']-btc[i]['low'])/(btc[i]['high']-btc[i]['low']) if btc[i]['high']>btc[i]['low'] else .5
        cap=(ret7<-.05 and rs[i]<45 and vols[i]>=(volmean[i] or vols[i]))
        reclaim=(closes[i]>closes[i-1] and closepos>.60 and closes[i]>=ma20[i]*.97)
        if cap: buy_cap.append(i)
        if reclaim: buy_reclaim.append(i)
        if cap and reclaim: buy_combo.append(i)
    rows17=[]
    for label,idxs in [('BUY negative decoupling + capitulation',buy_cap),('BUY negative decoupling + reclaim',buy_reclaim),('BUY negative decoupling + both',buy_combo)]:
        tr=evaluate([i for i in idxs if i<split],closes,30,'BUY'); va=evaluate([i for i in idxs if i>=split],closes,30,'BUY')
        rows17.append(f'| {label} | {tr["n"]} | {pct(tr["hit"])} | {va["n"]} | {pct(va["hit"])} | {pct(va["sig5"])} | {pct(va["avg"])} |')
    write('17','Objetivo: desarrollar **un modelo alcista diferente**. Se parte de debilidad anormal frente al contexto y se exige capitulación o recuperación observable del precio. Horizonte: 30 días.',
          ('| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |','|---|---:|---:|---:|---:|---:|---:|'),rows17,[
              'La lógica BUY busca estrés + absorción/reclaim, no la inversa mecánica del SELL.',
              'Se conserva 64.7% como baseline: una variante debe mejorarlo con una muestra defendible.',
              'Si capitulación funciona pero reclaim no, ambos se mantendrán como familias distintas.'
          ])

if __name__=='__main__': main()
