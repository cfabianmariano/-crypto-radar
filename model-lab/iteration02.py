import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('it1', 'model-lab/iteration01.py')
it1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(it1)

OUT = Path('model-lab/results/iteration02.md')

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


def main():
    rows = it1.fetch_klines()
    closes = [r['close'] for r in rows]
    split = int(len(rows)*.70)
    macro_days = FOMC | CPI

    cand = {
      'BUY macro_positive_reaction': [],
      'SELL macro_negative_reaction': [],
      'BUY macro_shock_rejection': [],
      'SELL macro_shock_rejection': [],
    }
    for i,r in enumerate(rows):
        if r['date'] not in macro_days or i < 1:
            continue
        dayret = r['close']/r['open']-1
        rng = (r['high']-r['low'])/r['open']
        closepos = (r['close']-r['low'])/(r['high']-r['low']) if r['high']>r['low'] else .5
        if dayret >= .015 and closepos >= .62:
            cand['BUY macro_positive_reaction'].append(i)
        if dayret <= -.015 and closepos <= .38:
            cand['SELL macro_negative_reaction'].append(i)
        if rng >= .04 and closepos >= .72 and r['low'] < r['open']*.985:
            cand['BUY macro_shock_rejection'].append(i)
        if rng >= .04 and closepos <= .28 and r['high'] > r['open']*1.015:
            cand['SELL macro_shock_rejection'].append(i)

    cand = {k: it1.distinct(v,7) for k,v in cand.items()}
    lines = [
      '# Crypto Radar Model Lab — Iteración 02', '',
      f'Período: {rows[0]["date"]} → {rows[-1]["date"]}.',
      'Nueva capa: **contexto fundamental programado (CPI + FOMC) + reacción de precio al evento**.',
      'Las fechas FOMC provienen del calendario oficial de la Reserva Federal; las CPI del calendario/archivo de BLS.',
      'No se usa el resultado futuro para decidir la señal: la señal se forma al cierre del día del evento.',
      'Validación temporal: mismo split 70/30. Horizonte principal: 30 días.', '',
      '| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |',
      '|---|---:|---:|---:|---:|---:|---:|'
    ]
    verdicts=[]
    for name,idxs in cand.items():
        side='BUY' if name.startswith('BUY') else 'SELL'
        tr=it1.evaluate([i for i in idxs if i<split],closes,30,side)
        va=it1.evaluate([i for i in idxs if i>=split],closes,30,side)
        lines.append(f'| {name} | {tr["n"]} | {it1.pct(tr["hit"])} | {va["n"]} | {it1.pct(va["hit"])} | {it1.pct(va["sig5"])} | {it1.pct(va["avg"])} |')
        if va['n']>=5 and va['hit'] is not None and va['hit']>=.70 and (tr['hit'] is None or tr['hit']>=.55): v='PROMOVER'
        elif va['n']>=5 and va['hit'] is not None and va['hit']<.60: v='DESCARTAR/CORREGIR'
        else: v='OBSERVAR'
        verdicts.append((name,v,va))
    lines += ['', '## Resultado automático']
    for name,v,va in verdicts:
        lines.append(f'- **{name}**: {v} — validación {it1.pct(va["hit"])} (N={va["n"]}).')
    lines += ['', '## Qué aprendemos',
      '- Esta iteración prueba si un movimiento fuerte o un rechazo intradiario **en días de información macro conocida** tiene más capacidad predictiva que un patrón técnico genérico.',
      '- Todavía no clasifica el contenido de la noticia como buena/mala ni la sorpresa contra consenso. Esa será la siguiente capa; aquí medimos primero si el contexto de evento + reacción aporta señal.', '']
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text('\n'.join(lines),encoding='utf-8')
    print('\n'.join(lines))

if __name__=='__main__':
    main()
