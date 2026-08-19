# Crypto Radar — Systematic Hypothesis Sweep

Barrido amplio, predefinido y asimétrico de factores técnicos + contexto macro. Umbrales 20/80 se calculan **solo con el 70% de entrenamiento** y luego quedan congelados. Se exige **N validación >=10** y **N entrenamiento >=10**. BUY y SELL se evalúan por separado.

## Top candidatos robustos

| Rank | Setup | Lado | Horizonte | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Avg valid | Score |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | volz:lo | SELL | 90d | 33 | 60.6% | 14 | 92.9% | 92.9% | 12.0% | 0.830 |
| 2 | volz:hi | SELL | 90d | 25 | 68.0% | 11 | 81.8% | 81.8% | 9.0% | 0.806 |
| 3 | macro_support:hi | SELL | 90d | 33 | 54.5% | 10 | 90.0% | 90.0% | 10.8% | 0.796 |
| 4 | vs200:lo | SELL | 90d | 10 | 90.0% | 15 | 73.3% | 73.3% | 4.3% | 0.795 |
| 5 | macro_support:lo | SELL | 90d | 39 | 53.8% | 11 | 81.8% | 81.8% | 9.3% | 0.757 |
| 6 | resid:lo | SELL | 90d | 35 | 54.3% | 11 | 72.7% | 72.7% | 2.1% | 0.717 |
| 7 | closepos:lo | SELL | 90d | 45 | 51.1% | 12 | 75.0% | 75.0% | 6.0% | 0.716 |
| 8 | btc3:hi | SELL | 90d | 39 | 46.2% | 14 | 78.6% | 78.6% | 9.0% | 0.715 |
| 9 | btc3:lo | SELL | 90d | 34 | 55.9% | 10 | 70.0% | 70.0% | 3.0% | 0.711 |
| 10 | dd20:lo | SELL | 7d | 12 | 58.3% | 12 | 75.0% | 33.3% | 3.3% | 0.700 |
| 11 | dist_high20:lo | SELL | 7d | 12 | 58.3% | 12 | 75.0% | 33.3% | 3.3% | 0.700 |
| 12 | resid:hi | SELL | 90d | 40 | 47.5% | 11 | 72.7% | 72.7% | 6.5% | 0.694 |
| 13 | range_pct:hi | SELL | 90d | 23 | 52.2% | 12 | 66.7% | 66.7% | 2.2% | 0.683 |
| 14 | dd20:lo | SELL | 14d | 12 | 58.3% | 12 | 66.7% | 33.3% | 4.2% | 0.671 |
| 15 | dist_high20:lo | SELL | 14d | 12 | 58.3% | 12 | 66.7% | 33.3% | 4.2% | 0.671 |
| 16 | ret30:lo | SELL | 14d | 11 | 90.9% | 10 | 60.0% | 30.0% | 2.3% | 0.665 |
| 17 | closepos:hi | SELL | 90d | 41 | 46.3% | 12 | 66.7% | 66.7% | 5.7% | 0.662 |
| 18 | ret30:lo | SELL | 7d | 11 | 81.8% | 10 | 60.0% | 30.0% | 2.5% | 0.661 |
| 19 | range_pct:lo | SELL | 7d | 32 | 53.1% | 15 | 66.7% | 20.0% | 2.2% | 0.639 |
| 20 | dd20:hi | SELL | 30d | 15 | 53.3% | 10 | 60.0% | 40.0% | 5.1% | 0.637 |
| 21 | dist_high20:hi | SELL | 30d | 15 | 53.3% | 10 | 60.0% | 40.0% | 5.1% | 0.637 |
| 22 | range_pct:lo | SELL | 30d | 32 | 43.8% | 12 | 66.7% | 50.0% | 8.1% | 0.636 |
| 23 | resid:lo | BUY | 30d | 35 | 57.1% | 16 | 68.8% | 43.8% | -0.7% | 0.634 |
| 24 | range_pct:hi | BUY | 7d | 23 | 65.2% | 18 | 66.7% | 22.2% | -0.4% | 0.634 |
| 25 | run20:hi | SELL | 30d | 12 | 41.7% | 10 | 70.0% | 40.0% | 3.2% | 0.631 |

## Candidatos que pasan filtro mínimo

- **SELL volz:lo / 90d** — Train 60.6% (N=33), Valid 92.9% (N=14), >5% 92.9%, avg 12.0%.
- **SELL volz:hi / 90d** — Train 68.0% (N=25), Valid 81.8% (N=11), >5% 81.8%, avg 9.0%.
- **SELL vs200:lo / 90d** — Train 90.0% (N=10), Valid 73.3% (N=15), >5% 73.3%, avg 4.3%.
- **SELL btc3:lo / 90d** — Train 55.9% (N=34), Valid 70.0% (N=10), >5% 70.0%, avg 3.0%.
- **SELL dd20:lo / 7d** — Train 58.3% (N=12), Valid 75.0% (N=12), >5% 33.3%, avg 3.3%.
- **SELL dist_high20:lo / 7d** — Train 58.3% (N=12), Valid 75.0% (N=12), >5% 33.3%, avg 3.3%.

## Regla de lectura
- No se considera “descubrimiento” una combinación con N pequeño.
- Un resultado alto solo en validación pero débil en entrenamiento se trata como régimen/hipótesis, no como ley.
- BUY y SELL no necesitan compartir factores ni horizontes.
- Este barrido reduce prueba artesanal; los siguientes pasos deben concentrarse solo en los 2–3 candidatos que sobrevivan.
