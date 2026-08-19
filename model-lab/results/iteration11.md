# Crypto Radar Model Lab — Iteración 11

Objetivo: combinar **información relativa + estructura de precio**. La anomalía macro no dispara sola: debe coincidir con resiliencia (BUY) o incapacidad (SELL).

Período BTC: 2024-08-20 → 2026-08-19. Split temporal 70/30. Horizonte: 30 días. Cooldown: 7 días.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY resilient_higher_structure | 25 | 44.0% | 9 | 55.6% | 33.3% | -2.3% |
| SELL weak_lower_structure | 29 | 41.4% | 12 | 33.3% | 33.3% | 0.4% |

## Lectura profesional
- No se optimizan docenas de indicadores: solo desacople + MA20 + estructura de 20 días.
- Buscamos si el mercado “sabe algo” antes de que una tendencia clásica sea evidente.
- Si mejora frente a Iteración 09 sin destruir N, la estructura aporta información incremental.
