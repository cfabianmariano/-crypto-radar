# Crypto Radar Model Lab — Iteración 02

Período: 2024-08-20 → 2026-08-19.
Nueva capa: **contexto fundamental programado (CPI + FOMC) + reacción de precio al evento**.
Las fechas FOMC provienen del calendario oficial de la Reserva Federal; las CPI del calendario/archivo de BLS.
No se usa el resultado futuro para decidir la señal: la señal se forma al cierre del día del evento.
Validación temporal: mismo split 70/30. Horizonte principal: 30 días.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY macro_positive_reaction | 6 | 16.7% | 4 | 50.0% | 50.0% | -3.6% |
| SELL macro_negative_reaction | 3 | 33.3% | 3 | 66.7% | 33.3% | 4.6% |
| BUY macro_shock_rejection | 4 | 50.0% | 0 | — | — | — |
| SELL macro_shock_rejection | 1 | 0.0% | 0 | — | — | — |

## Resultado automático
- **BUY macro_positive_reaction**: OBSERVAR — validación 50.0% (N=4).
- **SELL macro_negative_reaction**: OBSERVAR — validación 66.7% (N=3).
- **BUY macro_shock_rejection**: OBSERVAR — validación — (N=0).
- **SELL macro_shock_rejection**: OBSERVAR — validación — (N=0).

## Qué aprendemos
- Esta iteración prueba si un movimiento fuerte o un rechazo intradiario **en días de información macro conocida** tiene más capacidad predictiva que un patrón técnico genérico.
- Todavía no clasifica el contenido de la noticia como buena/mala ni la sorpresa contra consenso. Esa será la siguiente capa; aquí medimos primero si el contexto de evento + reacción aporta señal.
