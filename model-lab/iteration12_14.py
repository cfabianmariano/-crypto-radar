import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('base', 'model-lab/iteration09_11.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

OUTDIR = Path('model-lab/results')


def sma(values, n):
    out=[None]*len(values); s=0.0
    for i,v in enumerate(values):
        s += v
        if i >= n: s -= values[i-n]
        if i >= n-1: out[i]=s/n
    return out


def evaluate(idxs, closes, horizon, side):
    return base.evaluate(idxs, closes, horizon, side)


def distinct(idxs, cool=7):
    return base.distinct(sorted(idxs), cool)


def pct(x):
    return base.pct(x)


def write_report(name, objective, headers, rows, notes):
    lines=[f'# Crypto Radar Model Lab — Iteración {name}','',objective,'']
    lines += [headers[0], headers[1]]
    lines += rows
    lines += ['', '## Lectura profesional'] + [f'- {n}' for n in notes] + ['']
    OUTDIR.mkdir(parents=True, exist_ok=True)
    (OUTDIR/f'iteration{name}.md').write_text('\n'.join(lines), encoding='utf-8')


def main():
    btc, feats = base.build()
    closes=[r['close'] for r in btc]
    split=int(len(btc)*.70)
    base.residual_model(feats, split)

    train=[x for x in feats[:split] if 'resid' in x]
    r20=base.qtile([x['resid'] for x in train], .20)
    r80=base.qtile([x['resid'] for x in train], .80)

    # Iteration 12: invert the interpretation of decoupling.
    buy12=distinct([x['i'] for x in feats if x.get('resid') is not None and x['resid'] <= r20], 7)
    sell12=distinct([x['i'] for x in feats if x.get('resid') is not None and x['resid'] >= r80], 7)
    rows12=[]
    for label,side,idxs in [('BUY negative_decoupling_reversal','BUY',buy12),('SELL positive_decoupling_reversal','SELL',sell12)]:
        tr=evaluate([i for i in idxs if i<split],closes,30,side)
        va=evaluate([i for i in idxs if i>=split],closes,30,side)
        rows12.append(f'| {label} | {tr["n"]} | {pct(tr["hit"])} | {va["n"]} | {pct(va["hit"])} | {pct(va["sig5"])} | {pct(va["avg"])} |')
    write_report('12','Objetivo: invertir la interpretación del desacople. Si BTC fue anormalmente débil frente al contexto, probar **reversión alcista**; si fue anormalmente fuerte, probar **reversión bajista**.',
        ('| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |','|---|---:|---:|---:|---:|---:|---:|'),rows12,[
        'Es exactamente la hipótesis sugerida por el fracaso de la Iteración 09 como señal de continuación.',
        'Los umbrales extremos (20/80 percentiles) se fijan usando solo entrenamiento.',
        'Si mejora claramente, el desacople se interpreta como sobrerreacción/agotamiento, no como momentum.'
    ])

    # Iteration 13: same frozen events, multiple horizons.
    rows13=[]
    for label,side,idxs in [('BUY negative_decoupling_reversal','BUY',buy12),('SELL positive_decoupling_reversal','SELL',sell12)]:
        for h in (7,14,30,90):
            tr=evaluate([i for i in idxs if i<split],closes,h,side)
            va=evaluate([i for i in idxs if i>=split],closes,h,side)
            rows13.append(f'| {label} | {h}d | {tr["n"]} | {pct(tr["hit"])} | {va["n"]} | {pct(va["hit"])} | {pct(va["sig5"])} | {pct(va["avg"])} |')
    write_report('13','Objetivo: comprobar **en qué horizonte vive la anomalía**. Se usan exactamente los mismos eventos de la Iteración 12; no se cambian reglas, solo se mide 7/14/30/90 días.',
        ('| Setup | Horizonte | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |','|---|---:|---:|---:|---:|---:|---:|---:|'),rows13,[
        'Un fenómeno de sobrerreacción debería tener más fuerza a corto/medio plazo que a 90 días.',
        'Si solo un horizonte sale bien, no se optimiza retrospectivamente: se toma como pista para una nueva hipótesis.',
        'La comparación evita desechar un indicador por evaluarlo en un plazo equivocado.'
    ])

    # Iteration 14: condition reversal on broad regime, using MA200 known at the time.
    ma200=sma(closes,200)
    buy_bull=[]; buy_bear=[]; sell_bull=[]; sell_bear=[]
    for i in buy12:
        if ma200[i] is None: continue
        (buy_bull if closes[i]>=ma200[i] else buy_bear).append(i)
    for i in sell12:
        if ma200[i] is None: continue
        (sell_bull if closes[i]>=ma200[i] else sell_bear).append(i)

    setups14=[
        ('BUY weak_vs_macro in bull regime','BUY',buy_bull),
        ('BUY weak_vs_macro in bear regime','BUY',buy_bear),
        ('SELL strong_vs_macro in bull regime','SELL',sell_bull),
        ('SELL strong_vs_macro in bear regime','SELL',sell_bear),
    ]
    rows14=[]
    for label,side,idxs in setups14:
        tr=evaluate([i for i in idxs if i<split],closes,30,side)
        va=evaluate([i for i in idxs if i>=split],closes,30,side)
        rows14.append(f'| {label} | {tr["n"]} | {pct(tr["hit"])} | {va["n"]} | {pct(va["hit"])} | {pct(va["sig5"])} | {pct(va["avg"])} |')
    write_report('14','Objetivo: comprobar si la reversión por desacople depende del **régimen estructural**. Bull = BTC en/arriba de MA200; Bear = debajo de MA200. MA200 usa solo información disponible hasta cada día.',
        ('| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |','|---|---:|---:|---:|---:|---:|---:|'),rows14,[
        'Una misma anomalía puede significar buy-the-dip en bull market y continuación de debilidad en bear market.',
        'Separar régimen reduce mezcla de distribuciones distintas sin añadir decenas de indicadores.',
        'No se promoverá una celda con porcentaje alto si la muestra es pequeña.'
    ])

if __name__=='__main__':
    main()
