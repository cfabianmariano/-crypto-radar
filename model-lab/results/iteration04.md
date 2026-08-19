# Crypto Radar Model Lab — Iteración 04

Objetivo: exigir **confirmación de acción del precio** antes de disparar. En lugar de comprar por sobreventa o vender por debilidad, la señal aparece cuando el precio recupera/rompe estructura y confirma al cierre.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY reversal_confirmed | 1 | 100.0% | 1 | 100.0% | 0.0% | 0.7% |
| BUY breakout_confirmed | 1 | 0.0% | 4 | 25.0% | 25.0% | -10.3% |
| SELL reversal_confirmed | 0 | — | 0 | — | — | — |
| SELL breakdown_confirmed | 3 | 66.7% | 1 | 100.0% | 100.0% | 18.4% |

## Resultado
- **BUY reversal_confirmed**: OBSERVAR — 100.0% (N=1).
- **BUY breakout_confirmed**: OBSERVAR — 25.0% (N=4).
- **SELL reversal_confirmed**: OBSERVAR — — (N=0).
- **SELL breakdown_confirmed**: OBSERVAR — 100.0% (N=1).

## Interpretación
- Esta iteración prueba una hipótesis concreta: la **confirmación** debería filtrar falsas señales de RSI/Fibonacci/estructura.
- Si reduce demasiado la muestra, no se promueve aunque el porcentaje sea alto.
