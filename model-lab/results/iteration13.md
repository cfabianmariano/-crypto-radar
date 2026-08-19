# Crypto Radar Model Lab — Iteración 13

Objetivo: comprobar **en qué horizonte vive la anomalía**. Se usan exactamente los mismos eventos de la Iteración 12; no se cambian reglas, solo se mide 7/14/30/90 días.

| Setup | Horizonte | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|---:|
| BUY negative_decoupling_reversal | 7d | 37 | 54.1% | 18 | 55.6% | 16.7% | -0.8% |
| BUY negative_decoupling_reversal | 14d | 37 | 59.5% | 18 | 55.6% | 33.3% | -1.5% |
| BUY negative_decoupling_reversal | 30d | 37 | 59.5% | 17 | 64.7% | 41.2% | -1.6% |
| BUY negative_decoupling_reversal | 90d | 37 | 45.9% | 12 | 25.0% | 25.0% | -4.1% |
| SELL positive_decoupling_reversal | 7d | 34 | 38.2% | 13 | 61.5% | 7.7% | -0.0% |
| SELL positive_decoupling_reversal | 14d | 34 | 41.2% | 13 | 46.2% | 15.4% | 0.1% |
| SELL positive_decoupling_reversal | 30d | 34 | 41.2% | 13 | 53.8% | 23.1% | 1.3% |
| SELL positive_decoupling_reversal | 90d | 34 | 44.1% | 11 | 72.7% | 72.7% | 6.6% |

## Lectura profesional
- Un fenómeno de sobrerreacción debería tener más fuerza a corto/medio plazo que a 90 días.
- Si solo un horizonte sale bien, no se optimiza retrospectivamente: se toma como pista para una nueva hipótesis.
- La comparación evita desechar un indicador por evaluarlo en un plazo equivocado.
