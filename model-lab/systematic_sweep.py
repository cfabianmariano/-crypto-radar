import importlib.util
import itertools
import statistics
from pathlib import Path

spec = importlib.util.spec_from_file_location('base', 'model-lab/iteration09_11.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

OUT = Path('model-lab/results/systematic_sweep.md')


def sma(v,n):
    out=[None]*len(v); s=0.0
    for i,x in enumerate(v):
        s+=x
        if i>=n: s-=v[i-n]
        if i>=n-1: out[i]=s/n
    return out


def rsi(v,n=14):
    out=[None]*len(v)
    for i in range(n,len(v)):
        g=l=0.0
        for j in range(i-n+1,i+1):
            d=v[j]-v[j-1]
            if d>=0:g+=d
            else:l-=d
        out[i]=100 if l==0 else 100-100/(1+(g/n)/(l/n))
    return out


def stdev(xs): return statistics.pstdev(xs) if len(xs)>1 else 0.0

def q(xs,p): return base.qtile([x for x in xs if x is not None],p)

def distinct(xs,cool=7): return base.distinct(sorted(xs),cool)

def eval_idx(idxs,closes,h,side): return base.evaluate(idxs,closes,h,side)

def pct(x): return '—' if x is None else f'{x*100:.1f}%'


def main():
    btc, feats = base.build()
    c=[r['close'] for r in btc]
    split=int(len(btc)*.70)
    base.residual_model(feats,split)
    ma20=sma(c,20); ma50=sma(c,50); ma200=sma(c,200); rs=rsi(c,14)

    # enrich with purely as-of technical/context features
    for i,x in enumerate(feats):
        if i<200 or 'btc7' not in x: continue
        x['vs20']=c[i]/ma20[i]-1 if ma20[i] else None
        x['vs50']=c[i]/ma50[i]-1 if ma50[i] else None
        x['vs200']=c[i]/ma200[i]-1 if ma200[i] else None
        x['rsi']=rs[i]
        x['ret14']=c[i]/c[i-14]-1
        x['ret30']=c[i]/c[i-30]-1
        x['dd20']=c[i]/max(c[i-19:i+1])-1
        x['run20']=c[i]/min(c[i-19:i+1])-1
        x['dist_low20']=c[i]/min(c[i-19:i+1])-1
        x['dist_high20']=c[i]/max(c[i-19:i+1])-1
        vols=[btc[k]['volume'] for k in range(i-19,i+1)]
        mu=sum(vols)/20; sd=stdev(vols)
        x['volz']=(btc[i]['volume']-mu)/sd if sd else 0
        x['range_pct']=(btc[i]['high']-btc[i]['low'])/btc[i]['open']

    feature_names=['resid','macro_support','btc3','btc7','ret14','ret30','vs20','vs50','vs200','rsi','dd20','run20','dist_low20','dist_high20','closepos','range_pct','volz']
    train=[x for x in feats[:split] if 'vs200' in x and all(x.get(k) is not None for k in feature_names)]
    thresholds={k:{'lo':q([x[k] for x in train],.20),'hi':q([x[k] for x in train],.80)} for k in feature_names}

    candidates=[]
    # univariate extremes, both BUY and SELL, both low/high orientation
    for k in feature_names:
        for tail in ('lo','hi'):
            thr=thresholds[k][tail]
            idxs=[x['i'] for x in feats if x.get(k) is not None and ((x[k]<=thr) if tail=='lo' else (x[k]>=thr))]
            idxs=distinct(idxs,7)
            for side in ('BUY','SELL'):
                for h in (7,14,30,90):
                    tr=eval_idx([i for i in idxs if i<split],c,h,side)
                    va=eval_idx([i for i in idxs if i>=split],c,h,side)
                    if va['n']>=10:
                        candidates.append((f'{k}:{tail}',side,h,tr,va))

    # pairwise confluence only among distinct families; fixed extreme thresholds from train
    pairs=[('resid','rsi'),('resid','vs200'),('resid','volz'),('macro_support','resid'),('btc7','rsi'),('ret30','vs200'),('dd20','rsi'),('run20','rsi'),('dist_low20','volz'),('dist_high20','volz')]
    for a,b in pairs:
        for ta,tb in itertools.product(('lo','hi'),repeat=2):
            aa=thresholds[a][ta]; bb=thresholds[b][tb]
            idxs=[]
            for x in feats:
                if x.get(a) is None or x.get(b) is None: continue
                ca=x[a]<=aa if ta=='lo' else x[a]>=aa
                cb=x[b]<=bb if tb=='lo' else x[b]>=bb
                if ca and cb: idxs.append(x['i'])
            idxs=distinct(idxs,7)
            for side in ('BUY','SELL'):
                for h in (7,14,30,90):
                    tr=eval_idx([i for i in idxs if i<split],c,h,side)
                    va=eval_idx([i for i in idxs if i>=split],c,h,side)
                    if va['n']>=10:
                        candidates.append((f'{a}:{ta}+{b}:{tb}',side,h,tr,va))

    # rank for robustness, not raw hit rate only
    scored=[]
    for name,side,h,tr,va in candidates:
        if tr['n']<10 or va['n']<10 or tr['hit'] is None or va['hit'] is None: continue
        stability=1-abs(tr['hit']-va['hit'])
        score=0.50*va['hit']+0.20*tr['hit']+0.15*stability+0.10*(va['sig5'] or 0)+0.05*(1 if (va['avg'] or 0)>0 else 0)
        scored.append((score,name,side,h,tr,va))
    scored.sort(reverse=True,key=lambda z:z[0])

    lines=['# Crypto Radar — Systematic Hypothesis Sweep','',
           'Barrido amplio, predefinido y asimétrico de factores técnicos + contexto macro. Umbrales 20/80 se calculan **solo con el 70% de entrenamiento** y luego quedan congelados. Se exige **N validación >=10** y **N entrenamiento >=10**. BUY y SELL se evalúan por separado.','',
           '## Top candidatos robustos','',
           '| Rank | Setup | Lado | Horizonte | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Avg valid | Score |',
           '|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|']
    for rank,(score,name,side,h,tr,va) in enumerate(scored[:25],1):
        lines.append(f'| {rank} | {name} | {side} | {h}d | {tr["n"]} | {pct(tr["hit"])} | {va["n"]} | {pct(va["hit"])} | {pct(va["sig5"])} | {pct(va["avg"])} | {score:.3f} |')

    qualified=[z for z in scored if z[5]['hit']>=.70 and z[4]['hit']>=.55 and z[5]['n']>=10 and (z[5]['avg'] or 0)>0]
    lines += ['', '## Candidatos que pasan filtro mínimo', '']
    if not qualified:
        lines.append('Ninguno pasó simultáneamente: validación >=70%, train >=55%, N>=10 y retorno medio validación positivo.')
    else:
        for score,name,side,h,tr,va in qualified[:10]:
            lines.append(f'- **{side} {name} / {h}d** — Train {pct(tr["hit"])} (N={tr["n"]}), Valid {pct(va["hit"])} (N={va["n"]}), >5% {pct(va["sig5"])}, avg {pct(va["avg"])}.')

    lines += ['', '## Regla de lectura',
              '- No se considera “descubrimiento” una combinación con N pequeño.',
              '- Un resultado alto solo en validación pero débil en entrenamiento se trata como régimen/hipótesis, no como ley.',
              '- BUY y SELL no necesitan compartir factores ni horizontes.',
              '- Este barrido reduce prueba artesanal; los siguientes pasos deben concentrarse solo en los 2–3 candidatos que sobrevivan.','']
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text('\n'.join(lines),encoding='utf-8')

if __name__=='__main__': main()
