# Crypto Radar — V0.1

Dashboard multi-asset para BTC, XRP, BNB, ETH y THETA.

## Qué funciona ahora
- Selector de activo.
- Datos de mercado desde CoinGecko.
- Actualización automática cada 60 segundos.
- Precio, ATH, drawdown, market cap, volumen y variaciones.
- Gráfico de 12 meses con área, MA50 y MA200.
- RSI diario, volatilidad 30d y posición contra MA200.
- Bottom Score y Trend Score separados.
- Diseño responsive para celular y escritorio.

## Ejecutar localmente
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
La salida se genera en `dist/`.

## Importante
La V0.1 usa la API pública de CoinGecko sin clave. En una siguiente etapa pasaremos las solicitudes por Cloudflare Worker con caché para reducir rate limits y proteger cualquier credencial futura.

## Próximo corte
- Comparador de 2–5 monedas.
- Histórico de Bottom Score / Trend Score.
- Heatmap 7d / 30d / 90d.
- Fear & Greed.
- Funding y Open Interest.
- Indicadores on-chain disponibles por activo.
- Backend Cloudflare Worker + cache.
- Alertas.
