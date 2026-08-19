import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('it1', 'model-lab/iteration01.py')
it1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(it1)
OUT = Path('model-lab/results/iteration04.md')


def main():
    rows=it1.fetch_klines(); closes=[r['close'] for r in rows]; split=int(len(rows)*.70)
    feats=it1.build_features(rows)
    cand={'BUY reversal_confirmed':[],'BUY breakout_confirmed':[],'SELL reversal_confirmed':[],'SELL breakdown_confirmed':[]}
    for i in range(205,len(rows)):
        x=feats[i]
        if 'rsi' not in x: continue
        c=rows[i]['close']; prev=rows[i-1]['close']
        # confirmed reversal: weakness first, then reclaim / strong close. Signal only after confirmation close.
        recent5=[r['close'] for r in rows[i-5:i]]
        prior10=[r['close'] for r in rows[i-15:i-5]]
        prior_high=max(r['high'] for r in rows[i-10:i])
        prior_low=min(r['low'] for r in rows[i-10:i])
        bull_reclaim = c > prior_high and x['closepos']>.62 and x['rsi']>42 and min(recent5) < min(prior10)*.985
        bear_reject = c < prior_low and x['closepos']<.38 and x['rsi']<58 and max(recent5) > max(prior10)*1.015
        # breakout/breakdown with next-day confirmation encoded at today's close (yesterday broke, today held)
        y=rows[i-1]; hi20=max(r['high'] for r in rows[i-22:i-2]); lo20=min(r['low'] for r in rows[i-22:i-2])
        breakout = y['close']>hi20 and rows[i]['low']>=hi20*.985 and c>hi20 and x['rsi']<72
        breakdown = y['close']<lo20 and rows[i]['high']<=lo20*1.015 and c<lo20 and x['rsi']>28
        if bull_reclaim: cand['BUY reversal_confirmed'].append(i)
        if breakout: cand['BUY breakout_confirmed'].append(i)
        if bear_reject: cand['SELL reversal_confirmed'].append(i)
        if breakdown: cand['SELL breakdown_confirmed'].append(i)
    cand={k:it1.distinct(v,7) for k,v in cand.items()}
    lines=['# Crypto Radar Model Lab — Iteración 04','',
      'Objetivo: exigir **confirmación de acción del precio** antes de disparar. En lugar de comprar por sobreventa o vender por debilidad, la señal aparece cuando el precio recupera/rompe estructura y confirma al cierre.','',
      '| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |','|---|---:|---:|---:|---:|---:|---:|']
    verdicts=[]
    for name,ids in cand.items():
        side='BUY' if name.startswith('BUY') else 'SELL'
        tr=it1.evaluate([i for i in ids if i<split],closes,30,side); va=it1.evaluate([i for i in ids if i>=split],closes,30,side)
        lines.append(f'| {name} | {tr["n"]} | {it1.pct(tr["hit"])} | {va["n"]} | {it1.pct(va["hit"])} | {it1.pct(va["sig5"])} | {it1.pct(va["avg"])} |')
        v='PROMOVER' if va['n']>=5 and va['hit'] is not None and va['hit']>=.70 and (tr['hit'] is None or tr['hit']>=.55) else ('DESCARTAR/CORREGIR' if va['n']>=5 and va['hit'] is not None and va['hit']<.60 else 'OBSERVAR')
        verdicts.append((name,v,va))
    lines += ['','## Resultado']
    for name,v,va in verdicts: lines.append(f'- **{name}**: {v} — {it1.pct(va["hit"])} (N={va["n"]}).')
    lines += ['','## Interpretación','- Esta iteración prueba una hipótesis concreta: la **confirmación** debería filtrar falsas señales de RSI/Fibonacci/estructura.','- Si reduce demasiado la muestra, no se promueve aunque el porcentaje sea alto.','']
    OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text('\n'.join(lines),encoding='utf-8'); print('\n'.join(lines))

if __name__=='__main__': main()
