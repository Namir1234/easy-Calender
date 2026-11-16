import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'

export interface LoopbackSession {
  /** Die Adresse, an die der Anbieter nach der Anmeldung zurückleitet */
  redirectUri: string
  /** Wird mit dem Autorisierungscode erfüllt, sobald der Browser zurückkommt */
  code: Promise<string>
  close(): void
}

const PAGE = (title: string, text: string): string =>
  `<!doctype html><html lang="de"><meta charset="utf-8"><title>${title}</title>` +
  `<body style="font-family:Segoe UI,system-ui,sans-serif;margin:15vh auto;max-width:28rem;padding:0 1rem">` +
  `<h1 style="font-size:1.25rem">${title}</h1><p>${text}</p></body></html>`

/**
 * Startet einen kleinen Webserver, der nur auf diesem Rechner erreichbar ist
 * (127.0.0.1, zufälliger Port). Der Browser landet nach der Anmeldung dort
 * und liefert den Autorisierungscode ab. `state` schützt davor, dass eine
 * fremde Seite einen eigenen Code unterschiebt.
 */
export async function startLoopback(
  expectedState: string,
  timeoutMs: number
): Promise<LoopbackSession> {
  let server: Server
  let timer: NodeJS.Timeout

  const code = new Promise<string>((resolve, reject) => {
    server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/') {
        response.writeHead(404).end()
        return
      }

      const send = (status: number, title: string, text: string): void => {
        response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end(PAGE(title, text))
      }

      if (url.searchParams.get('state') !== expectedState) {
        send(400, 'Anmeldung abgelehnt', 'Diese Anfrage gehört nicht zur laufenden Anmeldung.')
        return
      }

      const error = url.searchParams.get('error')
      const received = url.searchParams.get('code')
      if (error || !received) {
        send(400, 'Anmeldung abgebrochen', 'Du kannst dieses Fenster schliessen.')
        reject(
          new Error(
            error === 'access_denied'
              ? 'Die Anmeldung wurde abgebrochen'
              : `Anmeldung fehlgeschlagen: ${error ?? 'kein Code erhalten'}`
          )
        )
        return
      }

      send(
        200,
        'Anmeldung erfolgreich',
        'Du kannst dieses Fenster schliessen und zu easy-Calender zurückkehren.'
      )
      resolve(received)
    })

    timer = setTimeout(
      () => reject(new Error('Die Anmeldung wurde nicht rechtzeitig abgeschlossen')),
      timeoutMs
    )
  })

  const close = (): void => {
    clearTimeout(timer)
    server.close()
    server.closeAllConnections()
  }
  // Egal wie die Anmeldung ausgeht: Server und Timer werden aufgeräumt.
  code.then(close, close)

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server!.address() as AddressInfo

  return { redirectUri: `http://127.0.0.1:${port}`, code, close }
}
