# Crypto Radar Model Lab — Iteración 06

Objetivo: medir si la **reacción anómala de BTC frente a un contexto macro de mercado** contiene más información que la dirección de la noticia por sí sola.

Período BTC: 2024-08-20 → 2026-08-19. Split temporal 70/30. Horizonte: 30 días. Cooldown: 7 días.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY riskoff_absorption | 0 | — | 0 | — | — | — |
| SELL riskon_failure | 0 | — | 0 | — | — | — |

## Resultado
- **BUY riskoff_absorption**: OBSERVAR — — (N=0).
- **SELL riskon_failure**: OBSERVAR — — (N=0).

## Lectura profesional
- La hipótesis es contraria: fortaleza bajo presión y debilidad bajo viento de cola.
- SPX y DXY actúan como proxy objetivo del contexto fundamental diario; no se usa futuro para formar la señal.
