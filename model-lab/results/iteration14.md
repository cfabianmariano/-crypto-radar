# Crypto Radar Model Lab — Iteración 14

Objetivo: comprobar si la reversión por desacople depende del **régimen estructural**. Bull = BTC en/arriba de MA200; Bear = debajo de MA200. MA200 usa solo información disponible hasta cada día.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY weak_vs_macro in bull regime | 12 | 50.0% | 0 | — | — | — |
| BUY weak_vs_macro in bear regime | 12 | 66.7% | 17 | 64.7% | 41.2% | -1.6% |
| SELL strong_vs_macro in bull regime | 12 | 50.0% | 0 | — | — | — |
| SELL strong_vs_macro in bear regime | 6 | 66.7% | 13 | 53.8% | 23.1% | 1.3% |

## Lectura profesional
- Una misma anomalía puede significar buy-the-dip en bull market y continuación de debilidad en bear market.
- Separar régimen reduce mezcla de distribuciones distintas sin añadir decenas de indicadores.
- No se promoverá una celda con porcentaje alto si la muestra es pequeña.
