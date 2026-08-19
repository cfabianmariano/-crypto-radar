# Crypto Radar Model Lab — Iteración 17

Objetivo: desarrollar **un modelo alcista diferente**. Se parte de debilidad anormal frente al contexto y se exige capitulación o recuperación observable del precio. Horizonte: 30 días.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY negative decoupling + capitulation | 4 | 50.0% | 4 | 75.0% | 50.0% | 5.7% |
| BUY negative decoupling + reclaim | 3 | 33.3% | 1 | 0.0% | 0.0% | -21.0% |
| BUY negative decoupling + both | 0 | — | 0 | — | — | — |

## Lectura profesional
- La lógica BUY busca estrés + absorción/reclaim, no la inversa mecánica del SELL.
- Se conserva 64.7% como baseline: una variante debe mejorarlo con una muestra defendible.
- Si capitulación funciona pero reclaim no, ambos se mantendrán como familias distintas.
