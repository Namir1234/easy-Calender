import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/renderer/src/assets/main.css'
import './web.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Damit die App vom Home-Bildschirm schnell startet. Nur im fertigen Build.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Ohne Service Worker geht alles, nur der Start ist etwas langsamer.
    })
  })
}
