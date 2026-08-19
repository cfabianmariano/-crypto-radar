import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('it1', 'model-lab/iteration01.py')
it1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(it1)
OUT = Path('model-lab/results/iteration03.md')


def score_rows(rows, feats):
    out=[]
    for i in range(200,len(rows)):
        x=feats[i]
        if 'rsi' not in x: continue
        buy=sell=0
        # trend / regime
        if x['vs200'] > 0: buy += 1
        if x['vs200'] < 0: sell += 1
        if x['cross'] > 0: buy += 1
        if x['cross'] < 0: sell += 1
        # momentum exhaustion / recovery
        if x['rsi'] < 40: buy += 1
        if x['rsi'] > 65: sell += 1
        if x['ret7'] < -.05: buy += 1
        if x['ret7'] > .07: sell += 1
        # candle rejection
        if x['closepos'] > .65 and x['range'] > .025: buy += 1
        if x['closepos'] < .35 and x['range'] > .025: sell += 1
        # volume confirmation
        if x['volz'] > .5 and x['closepos'] > .55: buy += 1
        if x['volz'] > .5 and x['closepos'] < .45: sell += 1
        # 20d range location, Fibonacci-like pullback zones from recent range
        lo,hi=x['low60'],x['high60']; span=max(hi-lo,1e-9)
        pos=(rows[i]['close']-lo)/span
        if .18 <= pos <= .45: buy += 1
        if .58 <= pos <= .82: sell += 1
        out.append((i,buy,sell))
    return out


def choose_threshold(scored, closes, split, side):
    best=None
    for th in range(3,8):
        idx=[i for i,b,s in scored if i<split and (b if side=='BUY' else s)>=th]
        idx=it1.distinct(idx,7)
        st=it1.evaluate(idx,closes,30,side)
        if st['n'] < 8: continue
        key=(st['hit'], st['avg'] or -9, st['n'])
        if best is None or key>best[0]: best=(key,th,st)
    return best


def main():
    rows=it1.fetch_klines(); closes=[r['close'] for r in rows]; split=int(len(rows)*.70)
    feats=it1.build_features(rows); scored=score_rows(rows,feats)
    lines=['# Crypto Radar Model Lab — Iteración 03','',
      'Objetivo: reemplazar reglas únicas por un **score de confluencia**. Se combinan tendencia, momentum, rechazo de vela, volumen y ubicación dentro del rango de 60 días (proxy geométrico/Fibonacci).',
      'El umbral se elige **solo con el 70% de entrenamiento**; después se congela y se prueba sobre el 30% final. Horizonte: 30 días; cooldown: 7 días.','',
      '| Lado | Umbral elegido | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |','|---|---:|---:|---:|---:|---:|---:|---:|']
    conclusions=[]
    for side in ('BUY','SELL'):
        best=choose_threshold(scored,closes,split,side)
        if not best:
            lines.append(f'| {side} | — | 0 | — | 0 | — | — | — |'); continue
        _,th,tr=best
        ids=[i for i,b,s in scored if i>=split and (b if side=='BUY' else s)>=th]
        va=it1.evaluate(it1.distinct(ids,7),closes,30,side)
        lines.append(f'| {side} | {th} | {tr["n"]} | {it1.pct(tr["hit"])} | {va["n"]} | {it1.pct(va["hit"])} | {it1.pct(va["sig5"])} | {it1.pct(va["avg"])} |')
        verdict='PROMOVER' if va['n']>=5 and va['hit'] is not None and va['hit']>=.70 else ('DESCARTAR/CORREGIR' if va['n']>=5 and va['hit'] is not None and va['hit']<.60 else 'OBSERVAR')
        conclusions.append((side,verdict,va))
    lines += ['','## Resultado']
    for side,v,va in conclusions: lines.append(f'- **{side}**: {v} — {it1.pct(va["hit"])} en validación (N={va["n"]}).')
    lines += ['','## Interpretación','- Si la confluencia supera a las reglas individuales, conserva valor; si no, se elimina.','- Todavía no hay noticias ni macro aquí: esta iteración busca primero un baseline técnico más serio y menos frágil.','']
    OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text('\n'.join(lines),encoding='utf-8'); print('\n'.join(lines))

if __name__=='__main__': main()
