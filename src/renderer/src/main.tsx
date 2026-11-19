import '@fontsource-variable/schibsted-grotesk'
import '@fontsource-variable/instrument-sans'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
