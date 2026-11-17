import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Die App lädt nur sich selbst und spricht nur mit Google. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "connect-src 'self' https://www.googleapis.com https://accounts.google.com/gsi/",
  'frame-src https://accounts.google.com/gsi/',
  "img-src 'self' data:"
].join('; ')

/**
 * Die Handy-Version als Web-App. Sie läuft ganz im Browser und spricht
 * direkt mit Google. Gebaut wird nach `out-web/`, für GitHub Pages unter
 * `/easy-Calender/`.
 */
export default defineConfig({
  root: resolve(__dirname),
  base: './',
  // Nur Variablen mit WEB_ kommen in die Web-App. Die MAIN_VITE_-Werte der
  // Desktop-App (Client-Secret, Supabase) bleiben so sicher draussen.
  envDir: resolve(__dirname, '..'),
  envPrefix: 'WEB_',
  plugins: [
    react(),
    {
      // Content-Security-Policy nur im fertigen Build: Der Entwicklungsserver
      // braucht Inline-Skripte, die sie verbieten würde.
      name: 'csp',
      apply: 'build',
      transformIndexHtml: (html) =>
        html.replace(
          '<!-- CSP -->',
          `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`
        )
    }
  ],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  build: {
    outDir: resolve(__dirname, '../out-web'),
    emptyOutDir: true
  }
})
