// Service Worker: hält die App selbst bereit, damit sie vom Home-Bildschirm
// schnell startet. Termine kommen immer frisch von Google und werden nicht
// zwischengespeichert.
const CACHE = 'easy-calender-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest']))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Nur eigene Dateien. Google (Anmeldung, Kalender) geht immer ans Netz.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  // Zuerst das Netz, damit neue Versionen sofort ankommen; offline der Cache.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match('./index.html')))
  )
})
