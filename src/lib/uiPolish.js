const LABELS = {
  ahora: '◉ Radar',
  grafico: '⌁ Gráfico',
  indicadores: '≋ Indicadores',
  noticias: '◇ Noticias',
}

function polish() {
  document.querySelectorAll('.cryptoTabs button[data-tab]').forEach((button) => {
    const next = LABELS[button.dataset.tab]
    if (next && button.textContent !== next) button.textContent = next
  })

  const latestLabel = document.querySelector('.latestEventHeader span')
  if (latestLabel && latestLabel.textContent !== 'RADAR AHORA') latestLabel.textContent = 'RADAR AHORA'

  const alerts = document.querySelector('.cryptoTabs .alertsButton')
  if (alerts) {
    const on = /ON/.test(alerts.textContent || '')
    alerts.textContent = on ? '🔔 ON' : '🔔 Alertas'
  }
}

export function polishCryptoRadar() {
  polish()
  let queued = false
  const observer = new MutationObserver(() => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      polish()
    })
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
