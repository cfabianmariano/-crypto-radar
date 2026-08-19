# Crypto Radar Model Lab — Iteración 01

Período: 2024-08-20 → 2026-08-19 (730 velas diarias).
Diseño: familias de price action/técnico definidas antes de mirar el tramo de validación.
División temporal: entrenamiento 70% hasta 2026-01-11; validación 30% desde 2026-01-12.
Confirmación principal: dirección correcta a 30 días. También se informa movimiento favorable >5%.
Cooldown: 7 días para no contar una misma secuencia como muchas señales.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY trend_pullback | 4 | 75.0% | 0 | — | — | — |
| BUY capitulation_reversal | 1 | 0.0% | 2 | 0.0% | 0.0% | -4.4% |
| BUY structural_reversal | 8 | 37.5% | 2 | 50.0% | 50.0% | 2.1% |
| BUY breakout_retest | 5 | 40.0% | 1 | 0.0% | 0.0% | -25.0% |
| SELL structural_breakdown | 5 | 40.0% | 12 | 33.3% | 16.7% | -0.7% |
| SELL failed_rally | 3 | 33.3% | 2 | 50.0% | 0.0% | -2.3% |
| SELL exhaustion_reversal | 0 | — | 0 | — | — | — |

## Criterio de decisión de esta iteración
- **Promover**: validación >=70% con al menos 5 casos, y entrenamiento no contradictorio.
- **Observar**: 60–69.9% o muestra demasiado pequeña.
- **Descartar/corregir**: <60% en validación con muestra suficiente.

## Resultado automático
- **BUY trend_pullback**: OBSERVAR — validación — (N=0).
- **BUY capitulation_reversal**: OBSERVAR — validación 0.0% (N=2).
- **BUY structural_reversal**: OBSERVAR — validación 50.0% (N=2).
- **BUY breakout_retest**: OBSERVAR — validación 0.0% (N=1).
- **SELL structural_breakdown**: DESCARTAR/CORREGIR — validación 33.3% (N=12).
- **SELL failed_rally**: OBSERVAR — validación 50.0% (N=2).
- **SELL exhaustion_reversal**: OBSERVAR — validación — (N=0).

## Nota metodológica
Esta iteración es deliberadamente un baseline de acción del precio + técnico. No incorpora aún noticias/macro/on-chain/derivados; esos bloques se agregan en iteraciones posteriores y se validan contra este baseline. No se debe interpretar ninguna tasa in-sample como certeza futura.
