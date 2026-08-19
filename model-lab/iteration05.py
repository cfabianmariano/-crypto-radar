import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('it1', 'model-lab/iteration01.py')
it1 = importlib.util.module_from_spec(spec); spec.loader.exec_module(it1)
OUT = Path('model-lab/results/iteration05.md')

FOMC = {
'2024-09-18','2024-11-07','2024-12-18',
'2025-01-29','2025-03-19','2025-05-07','2025-06-18','2025-07-30','2025-09-17','2025-10-29','2025-12-10',
'2026-01-28','2026-03-18','2026-04-29','2026-06-17','2026-07-29'
}
CPI = {
'2024-09-11','2024-10-10','2024-11-13','2024-12-11',
'2025-01-15','2025-02-12','2025-03-12','2025-04-10','2025-05-13','2025-06-11','2025-07-15','2025-08-12','2025-09-11','2025-10-24','2025-12-18',
'2026-01-13','2026-02-13','2026-03-11','2026-04-10','2026-05-12','2026-06-10','2026-07-14','2026-08-12'
}
# Large, exogenous fundamental dates with polarity defined by event content, not BTC outcome.
# +1 = broadly supportive to crypto/risk; -1 = broadly adverse to crypto/risk.
NEWS = {
'2024-09-18': +1, # Fed 50bp cut
'2024-11-06': +1, # US election result, crypto-friendly policy expectations
'2024-12-18': -1, # hawkish repricing after Fed meeting
'2025-03-06': +1, # US Strategic Bitcoin Reserve executive order
'2025-04-02': -1, # broad tariff announcement / risk-off shock
'2025-05-12': +1, # US-China tariff de-escalation
'2025-06-13': -1, # Israel-Iran escalation
'2025-06-22': -1, # US strikes on Iranian nuclear sites
}


def main():
    rows=it1.fetch_klines(); closes=[r['close'] for r in rows]; split=int(len(rows)*.70)
    date_to_i={r['date']:i for i,r in enumerate(rows)}
    macro=FOMC|CPI
    cand={'BUY bad_news_not_falling':[],'SELL good_news_not_rising':[],'BUY macro_reversal':[],'SELL macro_reversal':[]}
    for i,r in enumerate(rows):
        if i<30: continue
        dayret=r['close']/r['open']-1
        closepos=(r['close']-r['low'])/(r['high']-r['low']) if r['high']>r['low'] else .5
        ret7=r['close']/rows[i-7]['close']-1
        # Explicit news-reaction asymmetry: event polarity is exogenous; reaction is observed only through same-day close.
        pol=NEWS.get(r['date'])
        if pol == -1 and dayret > -.005 and closepos > .55:
            cand['BUY bad_news_not_falling'].append(i)
        if pol == +1 and dayret < .005 and closepos < .45:
            cand['SELL good_news_not_rising'].append(i)
        # Broader scheduled macro reversal: event day reverses prior 7d direction.
        if r['date'] in macro:
            if ret7 < -.03 and dayret > .012 and closepos>.62:
                cand['BUY macro_reversal'].append(i)
            if ret7 > .03 and dayret < -.012 and closepos<.38:
                cand['SELL macro_reversal'].append(i)
    cand={k:it1.distinct(v,7) for k,v in cand.items()}
    lines=['# Crypto Radar Model Lab — Iteración 05','',
      'Objetivo: combinar **contexto fundamental + reacción del precio**. Se prueba especialmente la asimetría: noticia mala que no logra hacer caer a BTC y noticia buena que no logra hacerlo subir.','La polaridad de los eventos NEWS se define por el contenido del acontecimiento, no por lo que BTC hizo después. Las señales se forman al cierre del mismo día.','',
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
    lines += ['','## Limitación consciente','- La lista NEWS es todavía pequeña: esta iteración sirve para comprobar la lógica, no para declarar una ventaja estadística definitiva.','- Si aparece una señal prometedora, la próxima tanda debe ampliar noticias con un corpus más completo y clasificar sorpresa/consenso en CPI, empleo y Fed.','']
    OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_text('\n'.join(lines),encoding='utf-8'); print('\n'.join(lines))

if __name__=='__main__': main()
