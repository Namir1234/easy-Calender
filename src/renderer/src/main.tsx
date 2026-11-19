import '@fontsource-variable/schibsted-grotesk'
import '@fontsource-variable/instrument-sans'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import '@fontsource-variable/figtree'
import '@fontsource/geist-mono/400.css'
import '@fontsource-variable/syne'
import '@fontsource-variable/onest'
import '@fontsource-variable/jetbrains-mono'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyStoredDesign } from './design'

// Das gewählte Design vor dem ersten Bild setzen, damit nichts flackert.
applyStoredDesign()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
