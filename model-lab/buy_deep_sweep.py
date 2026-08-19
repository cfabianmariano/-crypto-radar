import importlib.util
import itertools
import statistics
from pathlib import Path

spec = importlib.util.spec_from_file_location('base', 'model-lab/iteration09_11.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

OUT = Path('model-lab/results/buy_deep_sweep.md')


def sma(v,n):
    out=[None]*len(v); s=0.0
    for i,x in enumerate(v):
        s += x
        if i>=n: s -= v[i-n]
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
def ev(xs,c,h): return base.evaluate(xs,c,h,'BUY')
def pct(x): return '—' if x is None else f'{100*x:.1f}%'


def enrich(btc, feats):
    c=[r['close'] for r in btc]
    ma20=sma(c,20); ma50=sma(c,50); ma200=sma(c,200); rs=rsi(c,14)
    for i,x in enumerate(feats):
        if i<200 or 'btc7' not in x: continue
        x['vs20']=c[i]/ma20[i]-1
        x['vs50']=c[i]/ma50[i]-1
        x['vs200']=c[i]/ma200[i]-1
        x['rsi']=rs[i]
        x['ret14']=c[i]/c[i-14]-1
        x['ret30']=c[i]/c[i-30]-1
        x['ret60']=c[i]/c[i-60]-1
        hi20=max(c[i-19:i+1]); lo20=min(c[i-19:i+1])
        hi60=max(c[i-59:i+1]); lo60=min(c[i-59:i+1])
        x['dd20']=c[i]/hi20-1
        x['run20']=c[i]/lo20-1
        x['dd60']=c[i]/hi60-1
        x['run60']=c[i]/lo60-1
        x['dist_low20']=c[i]/lo20-1
        x['dist_high20']=c[i]/hi20-1
        vols=[btc[k]['volume'] for k in range(i-19,i+1)]
        mu=sum(vols)/20; sd=stdev(vols)
        x['volz']=(btc[i]['volume']-mu)/sd if sd else 0
        x['range_pct']=(btc[i]['high']-btc[i]['low'])/btc[i]['open']
        x['body_pct']=(btc[i]['close']-btc[i]['open'])/btc[i]['open']
        x['lower_wick']=(min(btc[i]['open'],btc[i]['close'])-btc[i]['low'])/btc[i]['open']
        x['upper_wick']=(btc[i]['high']-max(btc[i]['open'],btc[i]['close']))/btc[i]['open']
        x['recovery3']=c[i]/min(c[i-2:i+1])-1 if i>=2 else None
        x['recovery7']=c[i]/min(c[i-6:i+1])-1 if i>=6 else None
    return c


def thresholds(rows, names):
    return {k:{'lo':q([x[k] for x in rows if x.get(k) is not None],.20),
               'hi':q([x[k] for x in rows if x.get(k) is not None],.80)} for k in names}


def match(x, conds, th):
    for k,tail in conds:
        v=x.get(k)
        if v is None: return False
        t=th[k][tail]
        if tail=='lo' and not v<=t: return False
        if tail=='hi' and not v>=t: return False
    return True


def candidate_label(conds):
    return '+'.join(f'{k}:{tail}' for k,tail in conds)


def main():
    btc,feats=base.build(); c=enrich(btc,feats)
    base.residual_model(feats,int(len(feats)*.65))

    names=['resid','macro_support','btc3','btc7','ret14','ret30','ret60','vs20','vs50','vs200','rsi','dd20','run20','dd60','run60','closepos','range_pct','body_pct','lower_wick','upper_wick','volz','recovery3','recovery7']
    usable=[x for x in feats if all(x.get(k) is not None for k in names)]
    hold_start=int(len(btc)*.65)
    discovery=[x for x in usable if x['i']<hold_start]
    hold=[x for x in usable if x['i']>=hold_start]
    th=thresholds(discovery,names)

    # Build predeclared BUY-only search space. One- and two-factor extremes,
    # plus a limited set of three-family combinations capturing stress + exhaustion + recovery/context.
    defs=[]
    for k in names:
        for tail in ('lo','hi'):
            defs.append(((k,tail),))
    for a,b in itertools.combinations(names,2):
        for ta,tb in itertools.product(('lo','hi'),repeat=2):
            defs.append(((a,ta),(b,tb)))

    stress=['ret30','ret60','vs200','dd20','dd60','resid']
    exhaustion=['rsi','volz','range_pct','lower_wick','closepos']
    recovery=['body_pct','recovery3','recovery7','vs20','macro_support']
    for a in stress:
        for b in exhaustion:
            for d in recovery:
                for ta,tb,td in [('lo','lo','hi'),('lo','hi','hi'),('lo','lo','lo')]:
                    defs.append(((a,ta),(b,tb),(d,td)))

    # Discovery ranking only on early 65%, using two sequential internal windows.
    disc_cut=int(hold_start*.62)
    scored=[]
    for conds in defs:
        label=candidate_label(conds)
        idxs=distinct([x['i'] for x in discovery if match(x,conds,th)],7)
        for h in (7,14,30,60):
            a=ev([i for i in idxs if i<disc_cut],c,h)
            b=ev([i for i in idxs if i>=disc_cut],c,h)
            if a['n']<6 or b['n']<6 or a['hit'] is None or b['hit'] is None: continue
            stability=1-abs(a['hit']-b['hit'])
            avg=((a['avg'] or 0)+(b['avg'] or 0))/2
            score=.35*a['hit']+.40*b['hit']+.15*stability+.10*(1 if avg>0 else 0)
            scored.append((score,label,conds,h,a,b))
    scored.sort(reverse=True,key=lambda z:z[0])

    # Freeze top non-duplicate definitions from discovery, then evaluate untouched final 35%.
    frozen=[]; seen=set()
    for z in scored:
        key=(z[1],z[3])
        if key in seen: continue
        seen.add(key); frozen.append(z)
        if len(frozen)>=30: break

    results=[]
    for score,label,conds,h,a,b in frozen:
        idxs=distinct([x['i'] for x in hold if match(x,conds,th)],7)
        st=ev(idxs,c,h)
        results.append((st['hit'] if st['hit'] is not None else -1, st['n'], st['avg'] or -999, score,label,conds,h,a,b,st))
    results.sort(reverse=True,key=lambda z:(z[0],z[1],z[2]))

    lines=['# Crypto Radar — Deep BUY Sweep','',
           'Búsqueda asimétrica exclusivamente BUY. El 65% inicial se usa para descubrir y fijar umbrales/reglas; el 35% final queda totalmente fuera de la selección y se usa como holdout. Se exige muestra interna antes de congelar candidatos.','',
           '## Holdout final — candidatos congelados','',
           '| Rank | Setup | H | Disc A N/acierto | Disc B N/acierto | Hold N | Hold acierto | Hold >5% | Avg hold |','|---:|---|---:|---|---|---:|---:|---:|---:|']
    for rank,z in enumerate(results[:20],1):
        _,_,_,score,label,conds,h,a,b,st=z
        lines.append(f'| {rank} | {label} | {h}d | {a["n"]}/{pct(a["hit"])} | {b["n"]}/{pct(b["hit"])} | {st["n"]} | {pct(st["hit"])} | {pct(st["sig5"])} | {pct(st["avg"])} |')

    qualified=[]
    for z in results:
        _,_,_,score,label,conds,h,a,b,st=z
        if st['n']>=10 and st['hit'] is not None and st['hit']>=.70 and (st['avg'] or 0)>0 and a['hit']>=.55 and b['hit']>=.55:
            qualified.append(z)
    lines += ['', '## BUY que pasan criterio', '']
    if not qualified:
        lines.append('Ninguno pasó simultáneamente holdout >=70%, N>=10, retorno medio positivo y ambos subtramos de descubrimiento >=55%.')
    else:
        for z in qualified[:10]:
            _,_,_,score,label,conds,h,a,b,st=z
            lines.append(f'- **BUY {label} / {h}d** — holdout {pct(st["hit"])} (N={st["n"]}), >5% {pct(st["sig5"])}, avg {pct(st["avg"])}; discovery A {pct(a["hit"])} N={a["n"]}, B {pct(b["hit"])} N={b["n"]}.')

    lines += ['', '## Nota metodológica',
              '- BUY se busca independientemente del modelo SELL.',
              '- El holdout no participa en selección ni en umbrales.',
              '- Un 100% con N pequeño no se promueve.',
              '- Si hay candidato, el siguiente paso es walk-forward congelado de ese setup específico antes de llevarlo a la app.','']
    OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text('\n'.join(lines),encoding='utf-8')

if __name__=='__main__': main()
