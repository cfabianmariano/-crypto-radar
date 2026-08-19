# Crypto Radar Model Lab — Iteración 03

Objetivo: reemplazar reglas únicas por un **score de confluencia**. Se combinan tendencia, momentum, rechazo de vela, volumen y ubicación dentro del rango de 60 días (proxy geométrico/Fibonacci).
El umbral se elige **solo con el 70% de entrenamiento**; después se congela y se prueba sobre el 30% final. Horizonte: 30 días; cooldown: 7 días.

| Lado | Umbral elegido | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|---:|
| BUY | 3 | 34 | 47.1% | 13 | 53.8% | 30.8% | -2.1% |
| SELL | 4 | 9 | 44.4% | 13 | 61.5% | 46.2% | 6.6% |

## Resultado
- **BUY**: DESCARTAR/CORREGIR — 53.8% en validación (N=13).
- **SELL**: OBSERVAR — 61.5% en validación (N=13).

## Interpretación
- Si la confluencia supera a las reglas individuales, conserva valor; si no, se elimina.
- Todavía no hay noticias ni macro aquí: esta iteración busca primero un baseline técnico más serio y menos frágil.
