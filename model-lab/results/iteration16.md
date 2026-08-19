# Crypto Radar Model Lab — Iteración 16

Objetivo: mejorar **solo el modelo bajista** con confirmaciones propias de techo: sobreextensión/euforia y cierre débil con volumen. Horizonte congelado: 90 días.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| SELL decoupling + overextension | 7 | 28.6% | 3 | 100.0% | 100.0% | 19.5% |
| SELL decoupling + weak high-volume close | 0 | — | 1 | 100.0% | 100.0% | 9.5% |
| SELL decoupling + both | 0 | — | 0 | — | — | — |

## Lectura profesional
- No se usa la inversa del modelo BUY: son mecanismos específicos de distribución/techo.
- RSI y medias actúan como contexto de sobreextensión, no como señal autónoma.
- Una mejora con N demasiado pequeño no se promueve.
