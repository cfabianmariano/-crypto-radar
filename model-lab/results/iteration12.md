# Crypto Radar Model Lab — Iteración 12

Objetivo: invertir la interpretación del desacople. Si BTC fue anormalmente débil frente al contexto, probar **reversión alcista**; si fue anormalmente fuerte, probar **reversión bajista**.

| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |
|---|---:|---:|---:|---:|---:|---:|
| BUY negative_decoupling_reversal | 37 | 59.5% | 17 | 64.7% | 41.2% | -1.6% |
| SELL positive_decoupling_reversal | 34 | 41.2% | 13 | 53.8% | 23.1% | 1.3% |

## Lectura profesional
- Es exactamente la hipótesis sugerida por el fracaso de la Iteración 09 como señal de continuación.
- Los umbrales extremos (20/80 percentiles) se fijan usando solo entrenamiento.
- Si mejora claramente, el desacople se interpreta como sobrerreacción/agotamiento, no como momentum.
