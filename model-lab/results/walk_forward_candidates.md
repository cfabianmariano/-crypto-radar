# Crypto Radar — Walk-forward de candidatos SELL

Validación prospectiva simulada dentro de los 730 días: cada fold calcula su umbral **solo con datos anteriores**, lo congela y evalúa los siguientes 90 días. Horizonte de resultado: 90 días. Cooldown: 7 días.

| Candidato | Fold | Test | N | Acierto | >5% | Retorno medio |
|---|---|---|---:|---:|---:|---:|
| SELL volz:lo | Fold 1 | 2025-08-20 → 2025-11-17 | 8 | 100.0% | 100.0% | 19.5% |
| SELL volz:lo | Fold 2 | 2025-11-18 → 2026-02-15 | 10 | 100.0% | 100.0% | 21.5% |
| SELL volz:lo | Fold 3 | 2026-02-16 → 2026-05-16 | 11 | 90.9% | 90.9% | 10.7% |
| SELL volz:hi | Fold 1 | 2025-08-20 → 2025-11-17 | 10 | 100.0% | 100.0% | 22.6% |
| SELL volz:hi | Fold 2 | 2025-11-18 → 2026-02-15 | 8 | 87.5% | 87.5% | 13.8% |
| SELL volz:hi | Fold 3 | 2026-02-16 → 2026-05-16 | 7 | 85.7% | 85.7% | 11.7% |
| SELL vs200:lo | Fold 1 | 2025-08-20 → 2025-11-17 | 4 | 100.0% | 100.0% | 22.1% |
| SELL vs200:lo | Fold 2 | 2025-11-18 → 2026-02-15 | 13 | 84.6% | 84.6% | 16.4% |
| SELL vs200:lo | Fold 3 | 2026-02-16 → 2026-05-16 | 9 | 66.7% | 66.7% | 2.7% |
| SELL macro_support:hi | Fold 1 | 2025-08-20 → 2025-11-17 | 7 | 100.0% | 100.0% | 24.4% |
| SELL macro_support:hi | Fold 2 | 2025-11-18 → 2026-02-15 | 5 | 80.0% | 80.0% | 13.1% |
| SELL macro_support:hi | Fold 3 | 2026-02-16 → 2026-05-16 | 8 | 100.0% | 100.0% | 13.7% |
| SELL resid:hi | Fold 1 | 2025-08-20 → 2025-11-17 | 4 | 100.0% | 100.0% | 20.3% |
| SELL resid:hi | Fold 2 | 2025-11-18 → 2026-02-15 | 6 | 66.7% | 66.7% | 11.5% |
| SELL resid:hi | Fold 3 | 2026-02-16 → 2026-05-16 | 7 | 85.7% | 85.7% | 8.6% |

## Resumen walk-forward

| Candidato | N total | Acierto total | >5% total | Retorno medio | Folds >=60% |
|---|---:|---:|---:|---:|---:|
| SELL volz:lo | 29 | 96.6% | 96.6% | 16.8% | 3/3 |
| SELL volz:hi | 25 | 92.0% | 92.0% | 16.7% | 3/3 |
| SELL vs200:lo | 26 | 80.8% | 80.8% | 12.5% | 3/3 |
| SELL macro_support:hi | 20 | 95.0% | 95.0% | 17.3% | 3/3 |
| SELL resid:hi | 17 | 82.4% | 82.4% | 12.4% | 3/3 |

## Criterio
- No se promueve por un único fold excelente.
- Un candidato serio debe sostener dirección y retorno en varios folds, con muestra acumulada defendible.
- BUY sigue siendo un modelo separado; este archivo valida únicamente candidatos SELL de 90 días.
