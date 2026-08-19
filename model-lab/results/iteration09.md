# Crypto Radar Model Lab — Iteración 09

Objetivo: medir un indicador propio de **desacople**: BTC rinde mucho mejor o peor de lo esperable frente a NASDAQ + dólar amplio + Treasury 10Y. El modelo esperado se estima solo en entrenamiento.

Período BTC: 2024-08-20 → 2026-08-19. Split temporal 70/30. Horizonte: 30 días. Cooldown: 7 días.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY positive_decoupling | 34 | 58.8% | 13 | 46.2% | 30.8% | -1.3% |
| SELL negative_decoupling | 37 | 40.5% | 17 | 35.3% | 35.3% | 1.6% |

## Lectura profesional
- Beta estimada BTC3d vs macro_support: 0.0061.
- NASDAQCOM, DTWEXBGS y DGS10 se obtienen de FRED; forward-fill solo usa el último dato conocido en fines de semana/feriados.
- Un residual extremo no presupone continuación: la validación decide persistencia o reversión.
