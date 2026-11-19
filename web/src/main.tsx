import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/schibsted-grotesk'
import '@fontsource-variable/instrument-sans'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import '@fontsource-variable/figtree'
import '@fontsource/geist-mono/400.css'
import '@fontsource-variable/syne'
import '@fontsource-variable/onest'
import '@fontsource-variable/jetbrains-mono'
import '../../src/renderer/src/assets/main.css'
import './web.css'
import App from './App'
import { applyStoredDesign } from '../../src/renderer/src/design'

// Das gewählte Design vor dem ersten Bild setzen, damit nichts flackert.
applyStoredDesign()

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
