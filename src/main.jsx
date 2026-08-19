import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './mobile-chart-compact.css'
import './dashboard-heatmap.css'
import './app-shell.css'
import './chart-analysis-tools.css'
import { enhanceCryptoRadar } from './lib/appEnhancer'
import { enhanceChartAnalysis } from './lib/chartTools'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

enhanceCryptoRadar()
enhanceChartAnalysis()
