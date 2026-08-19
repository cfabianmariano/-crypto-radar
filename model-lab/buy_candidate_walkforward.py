import importlib.util
import statistics
from pathlib import Path

spec = importlib.util.spec_from_file_location('base', 'model-lab/iteration09_11.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

OUT=Path('model-lab/results/buy_candidate_walkforward.md')


def q(xs,p): return base.qtile(xs,p)
def distinct(xs,cool=7): return base.distinct(sorted(xs),cool)
def pct(x): return '—' if x is None else f'{100*x:.1f}%'


def enrich(btc,feats):
    c=[r['close'] for r in btc]
    for i,x in enumerate(feats):
        if i<3: continue
        r=btc[i]
        x['upper_wick']=(r['high']-max(r['open'],r['close']))/r['open']
        x['recovery3']=c[i]/min(c[i-2:i+1])-1
    return c


def eval_idx(idxs,c,h=7):
    return base.evaluate(idxs,c,h,'BUY')


def main():
    btc,feats=base.build(); c=enrich(btc,feats)
    # Frozen semantic rule from deep sweep: upper_wick high + recovery3 low.
    # Each fold re-estimates only the 20/80 percentile thresholds from prior history.
    folds=[
        ('Fold 1','2025-05-01','2025-08-31'),
        ('Fold 2','2025-09-01','2025-12-31'),
        ('Fold 3','2026-01-01','2026-04-30'),
        ('Fold 4','2026-05-01','2026-08-12'),
    ]
    rows=[]; allvals=[]; total_hits=total_n=total_sig=0
    weighted=0.0
    for label,start,end in folds:
        train=[x for x in feats if x['date']<start and x.get('upper_wick') is not None and x.get('recovery3') is not None]
        uw80=q([x['upper_wick'] for x in train],.80)
        rec20=q([x['recovery3'] for x in train],.20)
        idxs=distinct([x['i'] for x in feats if start<=x['date']<=end and x.get('upper_wick') is not None and x.get('recovery3') is not None and x['upper_wick']>=uw80 and x['recovery3']<=rec20],7)
        st=eval_idx(idxs,c,7)
        rows.append((label,start,end,st))
        if st['n']:
            total_n += st['n']; total_hits += st['hits']; total_sig += round((st['sig5'] or 0)*st['n']); weighted += (st['avg'] or 0)*st['n']
    hit=total_hits/total_n if total_n else None
    sig=total_sig/total_n if total_n else None
    avg=weighted/total_n if total_n else None
    lines=['# Crypto Radar — Frozen BUY Candidate Walk-forward','',
           'Candidato congelado: **BUY cuando upper_wick está en el 20% superior y recovery3 en el 20% inferior**. Horizonte fijo: 7 días. En cada fold los percentiles se calculan únicamente con fechas anteriores al test.','',
           '| Fold | Test | N | Acierto | >5% | Avg |','|---|---|---:|---:|---:|---:|']
    for label,start,end,st in rows:
        lines.append(f'| {label} | {start} → {end} | {st["n"]} | {pct(st["hit"])} | {pct(st["sig5"])} | {pct(st["avg"])} |')
    lines += ['', '## Resumen', '',
              f'- N total: **{total_n}**',
              f'- Acierto BUY 7d: **{pct(hit)}**',
              f'- Movimientos >5%: **{pct(sig)}**',
              f'- Retorno medio firmado: **{pct(avg)}**',
              f'- Criterio de promoción: N>=15, acierto>=70%, retorno medio positivo y al menos 3/4 folds >=60%.','']
    good=sum(1 for _,_,_,st in rows if st['n']>0 and (st['hit'] or 0)>=.60)
    promote=(total_n>=15 and hit is not None and hit>=.70 and (avg or 0)>0 and good>=3)
    lines += [f'## Decisión: {"PROMOVER" if promote else "NO PROMOVER"}','']
    OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text('\n'.join(lines),encoding='utf-8')

if __name__=='__main__': main()
