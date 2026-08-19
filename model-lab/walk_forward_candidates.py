import importlib.util
import statistics
from pathlib import Path

spec = importlib.util.spec_from_file_location('sweep', 'model-lab/systematic_sweep.py')
sweep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sweep)

base = sweep.base
OUT = Path('model-lab/results/walk_forward_candidates.md')


def pct(x):
    return '—' if x is None else f'{100*x:.1f}%'


def enrich(btc, feats):
    c=[r['close'] for r in btc]
    ma20=sweep.sma(c,20); ma50=sweep.sma(c,50); ma200=sweep.sma(c,200); rs=sweep.rsi(c,14)
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
        mu=sum(vols)/20; sd=statistics.pstdev(vols) if len(vols)>1 else 0
        x['volz']=(btc[i]['volume']-mu)/sd if sd else 0
        x['range_pct']=(btc[i]['high']-btc[i]['low'])/btc[i]['open']
    return c


def eval_fold(name, feature, tail, train_end, test_start, test_end, btc, feats, closes):
    train=[x for x in feats[:train_end] if x.get(feature) is not None]
    thr=base.qtile([x[feature] for x in train], .20 if tail=='lo' else .80)
    idxs=[]
    for x in feats[test_start:test_end]:
        if x.get(feature) is None: continue
        ok=x[feature] <= thr if tail=='lo' else x[feature] >= thr
        if ok: idxs.append(x['i'])
    idxs=base.distinct(sorted(idxs),7)
    st=base.evaluate(idxs,closes,90,'SELL')
    return thr, st


def main():
    btc, feats=base.build(); closes=enrich(btc,feats)
    base.residual_model(feats,365)

    # Three genuinely forward folds. Each test window is 90d, and 90d outcome must still fit in the 730d sample.
    folds=[
        ('Fold 1',365,365,455),
        ('Fold 2',455,455,545),
        ('Fold 3',545,545,635),
    ]
    candidates=[
        ('SELL volz:lo','volz','lo'),
        ('SELL volz:hi','volz','hi'),
        ('SELL vs200:lo','vs200','lo'),
        ('SELL macro_support:hi','macro_support','hi'),
        ('SELL resid:hi','resid','hi'),
    ]

    lines=['# Crypto Radar — Walk-forward de candidatos SELL','',
           'Validación prospectiva simulada dentro de los 730 días: cada fold calcula su umbral **solo con datos anteriores**, lo congela y evalúa los siguientes 90 días. Horizonte de resultado: 90 días. Cooldown: 7 días.','',
           '| Candidato | Fold | Test | N | Acierto | >5% | Retorno medio |',
           '|---|---|---|---:|---:|---:|---:|']

    summary=[]
    for label,feature,tail in candidates:
        total_n=total_hits=total_sig=0; vals=[]; fold_hits=[]
        for fold,train_end,test_start,test_end in folds:
            thr,st=eval_fold(label,feature,tail,train_end,test_start,test_end,btc,feats,closes)
            d1=btc[test_start]['date']; d2=btc[test_end-1]['date']
            lines.append(f'| {label} | {fold} | {d1} → {d2} | {st["n"]} | {pct(st["hit"])} | {pct(st["sig5"])} | {pct(st["avg"])} |')
            if st['n']:
                total_n += st['n']
                total_hits += round(st['hit']*st['n'])
                total_sig += round(st['sig5']*st['n'])
                fold_hits.append(st['hit'])
                # weighted avg reconstruction
                vals.append((st['avg'],st['n']))
        overall_hit=total_hits/total_n if total_n else None
        overall_sig=total_sig/total_n if total_n else None
        overall_avg=sum(a*n for a,n in vals)/total_n if total_n else None
        stable=sum(h>=.60 for h in fold_hits)
        summary.append((label,total_n,overall_hit,overall_sig,overall_avg,stable,len(fold_hits)))

    lines += ['', '## Resumen walk-forward','',
              '| Candidato | N total | Acierto total | >5% total | Retorno medio | Folds >=60% |',
              '|---|---:|---:|---:|---:|---:|']
    for label,n,hit,sig,avg,stable,nf in summary:
        lines.append(f'| {label} | {n} | {pct(hit)} | {pct(sig)} | {pct(avg)} | {stable}/{nf} |')

    lines += ['', '## Criterio',
              '- No se promueve por un único fold excelente.',
              '- Un candidato serio debe sostener dirección y retorno en varios folds, con muestra acumulada defendible.',
              '- BUY sigue siendo un modelo separado; este archivo valida únicamente candidatos SELL de 90 días.','']
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text('\n'.join(lines),encoding='utf-8')

if __name__=='__main__':
    main()
