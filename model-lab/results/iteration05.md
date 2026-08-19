# Crypto Radar Model Lab — Iteración 05

Objetivo: combinar **contexto fundamental + reacción del precio**. Se prueba especialmente la asimetría: noticia mala que no logra hacer caer a BTC y noticia buena que no logra hacerlo subir.
La polaridad de los eventos NEWS se define por el contenido del acontecimiento, no por lo que BTC hizo después. Las señales se forman al cierre del mismo día.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY bad_news_not_falling | 1 | 100.0% | 0 | — | — | — |
| SELL good_news_not_rising | 2 | 50.0% | 0 | — | — | — |
| BUY macro_reversal | 0 | — | 0 | — | — | — |
| SELL macro_reversal | 1 | 0.0% | 1 | 100.0% | 0.0% | 0.9% |

## Resultado
- **BUY bad_news_not_falling**: OBSERVAR — — (N=0).
- **SELL good_news_not_rising**: OBSERVAR — — (N=0).
- **BUY macro_reversal**: OBSERVAR — — (N=0).
- **SELL macro_reversal**: OBSERVAR — 100.0% (N=1).

## Limitación consciente
- La lista NEWS es todavía pequeña: esta iteración sirve para comprobar la lógica, no para declarar una ventaja estadística definitiva.
- Si aparece una señal prometedora, la próxima tanda debe ampliar noticias con un corpus más completo y clasificar sorpresa/consenso en CPI, empleo y Fed.
