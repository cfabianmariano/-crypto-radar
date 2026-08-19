# Crypto Radar Model Lab — Iteración 10

Objetivo: probar **causa → reacción anómala**. BUY cuando el contexto es de presión macro pero BTC absorbe y cierra relativamente fuerte; SELL cuando el contexto ayuda pero BTC no puede aprovecharlo.

Período BTC: 2024-08-20 → 2026-08-19. Split temporal 70/30. Horizonte: 30 días. Cooldown: 7 días.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY macro_pressure_absorbed | 9 | 55.6% | 4 | 50.0% | 0.0% | 0.5% |
| SELL macro_tailwind_failed | 10 | 50.0% | 4 | 25.0% | 25.0% | -3.3% |

## Lectura profesional
- Versión cuantitativa de “mala noticia/contexto y BTC no cae” y su inversa.
- Se exige cierre coherente dentro de la vela para evitar llamar absorción a ruido.
- Si N queda pequeño, no se promueve aunque el porcentaje sea alto.
