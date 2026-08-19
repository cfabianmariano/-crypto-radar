# Crypto Radar Model Lab — Iteración 07

Objetivo: dejar de evaluar un solo día. Se observa una secuencia: **estado previo → evento CPI/FOMC → reacción durante 48h → confirmación**, y recién entonces se dispara.

Período BTC: 2024-08-20 → 2026-08-19. Split temporal 70/30. Horizonte: 30 días. Cooldown: 7 días.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY macro_absorption_48h | 1 | 100.0% | 1 | 100.0% | 0.0% | 0.3% |
| SELL macro_distribution_48h | 1 | 100.0% | 1 | 0.0% | 0.0% | -13.8% |

## Resultado
- **BUY macro_absorption_48h**: OBSERVAR — 100.0% (N=1).
- **SELL macro_distribution_48h**: OBSERVAR — 0.0% (N=1).

## Lectura profesional
- La señal se fecha dos días después del evento: es más tardía, pero evita inferir sentimiento con una sola vela.
- Si mejora la tasa sin destruir la muestra, la secuencia tiene más valor que el evento aislado.
