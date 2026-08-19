# Crypto Radar — Deep BUY Sweep

Búsqueda asimétrica exclusivamente BUY. El 65% inicial se usa para descubrir y fijar umbrales/reglas; el 35% final queda totalmente fuera de la selección y se usa como holdout. Se exige muestra interna antes de congelar candidatos.

## Holdout final — candidatos congelados

| Rank | Setup | H | Disc A N/acierto | Disc B N/acierto | Hold N | Hold acierto | Hold >5% | Avg hold |
|---:|---|---:|---|---|---:|---:|---:|---:|
| 1 | resid:lo+recovery3:lo | 7d | 7/57.1% | 14/57.1% | 18 | 72.2% | 27.8% | -0.5% |
| 2 | upper_wick:hi+recovery3:lo | 7d | 6/83.3% | 9/66.7% | 14 | 71.4% | 21.4% | 0.8% |
| 3 | upper_wick:hi+recovery3:lo | 14d | 6/100.0% | 9/44.4% | 13 | 69.2% | 23.1% | 0.7% |
| 4 | range_pct:hi+recovery3:lo | 14d | 6/66.7% | 9/55.6% | 13 | 69.2% | 15.4% | -1.6% |
| 5 | range_pct:hi | 14d | 8/75.0% | 13/53.8% | 20 | 65.0% | 25.0% | -0.3% |
| 6 | range_pct:hi | 7d | 8/87.5% | 13/53.8% | 20 | 65.0% | 20.0% | -0.4% |
| 7 | resid:lo+recovery3:lo | 30d | 7/85.7% | 14/50.0% | 17 | 64.7% | 41.2% | -2.4% |
| 8 | closepos:lo+recovery3:lo | 7d | 9/77.8% | 16/50.0% | 23 | 60.9% | 21.7% | 0.1% |
| 9 | recovery7:lo | 14d | 6/83.3% | 15/60.0% | 22 | 59.1% | 27.3% | -1.3% |
| 10 | recovery3:lo+recovery7:lo | 14d | 6/83.3% | 15/60.0% | 22 | 59.1% | 27.3% | -1.3% |
| 11 | body_pct:lo+recovery7:lo | 7d | 6/83.3% | 12/58.3% | 17 | 58.8% | 23.5% | -0.5% |
| 12 | lower_wick:lo+recovery3:lo | 14d | 6/83.3% | 8/50.0% | 9 | 55.6% | 11.1% | -5.5% |
| 13 | body_pct:lo+recovery7:lo | 14d | 6/100.0% | 12/58.3% | 17 | 52.9% | 29.4% | -2.0% |
| 14 | resid:lo | 14d | 7/57.1% | 14/64.3% | 19 | 52.6% | 31.6% | -1.3% |
| 15 | btc3:lo | 14d | 6/66.7% | 13/61.5% | 19 | 52.6% | 15.8% | -1.8% |
| 16 | btc3:lo+recovery3:lo | 14d | 6/66.7% | 13/61.5% | 19 | 52.6% | 15.8% | -1.8% |
| 17 | lower_wick:lo | 14d | 8/62.5% | 18/55.6% | 21 | 52.4% | 9.5% | -1.5% |
| 18 | resid:lo+recovery3:lo | 14d | 7/71.4% | 14/64.3% | 18 | 50.0% | 27.8% | -2.2% |
| 19 | body_pct:lo | 7d | 8/75.0% | 16/56.2% | 25 | 48.0% | 16.0% | -0.6% |
| 20 | body_pct:lo+recovery3:lo | 7d | 7/71.4% | 16/56.2% | 25 | 48.0% | 16.0% | -0.6% |

## BUY que pasan criterio

- **BUY upper_wick:hi+recovery3:lo / 7d** — holdout 71.4% (N=14), >5% 21.4%, avg 0.8%; discovery A 83.3% N=6, B 66.7% N=9.

## Nota metodológica
- BUY se busca independientemente del modelo SELL.
- El holdout no participa en selección ni en umbrales.
- Un 100% con N pequeño no se promueve.
- Si hay candidato, el siguiente paso es walk-forward congelado de ese setup específico antes de llevarlo a la app.
