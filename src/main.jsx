import React from 'react'
import ReactDOM from 'react-dom/client'
import AppV2 from './AppV2'
import './styles.css'
import './mobile-chart-compact.css'
import './dashboard-heatmap.css'
import './chart-controls.css'
import './chart-analysis-tools.css'
import './dashboard-v2.css'
import './dashboard-v2-layout-fix.css'
import { enhanceChartAnalysis } from './lib/chartTools'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppV2 />
  </React.StrictMode>,
)

enhanceChartAnalysis()
