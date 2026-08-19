# Crypto Radar Model Lab — Iteración 08

Objetivo: crear un indicador propio: **cuánto más fuerte o débil estuvo BTC de lo que el contexto SPX+DXY hacía esperar**. La relación esperada se estima solo en entrenamiento; el residual extremo se valida después.

Período BTC: 2024-08-20 → 2026-08-19. Split temporal 70/30. Horizonte: 30 días. Cooldown: 7 días.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY positive_decoupling | 0 | — | 0 | — | — | — |
| SELL negative_decoupling | 0 | — | 0 | — | — | — |

## Resultado
- **BUY positive_decoupling**: OBSERVAR — — (N=0).
- **SELL negative_decoupling**: OBSERVAR — — (N=0).

## Lectura profesional
- Este es un indicador de información relativa, no un RSI disfrazado.
- Si BTC se niega a comportarse como debería frente al contexto, ese error puede revelar acumulación o distribución latente.
- La regresión se ajusta solo con el 70% inicial para evitar mirar el futuro.
