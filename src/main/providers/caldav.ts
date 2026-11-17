import { find, findAll, parseXml, textOf, type XmlNode } from './xml'

/** Die Teile von `fetch`, die der Client braucht. Für Tests austauschbar. */
export type HttpFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; redirect: 'manual' }
) => Promise<{
  status: number
  headers: { get(name: string): string | null }
  text(): Promise<string>
}>

export interface CalDavCredentials {
  username: string
  password: string
}

/** Ein Kalender auf dem Server. */
export interface CalDavCalendar {
  url: string
  name: string
  /** `#rrggbb`, falls der Server eine Farbe kennt */
  color?: string
}

/** Ein Kalendereintrag (eine `.ics`-Datei) auf dem Server. */
export interface CalDavObject {
  url: string
  etag?: string
  data: string
}

const MAX_REDIRECTS = 5

/** Fehler mit dem HTTP-Status, damit Aufrufer zwischen «fehlt» und «kaputt» unterscheiden. */
export class CalDavError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

const NS =
  'xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"'

function propfindBody(props: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><d:propfind ${NS}><d:prop>${props}</d:prop></d:propfind>`
}

/** Zeitpunkt in der Form, die CalDAV für Zeiträume verlangt: `20261117T000000Z`. */
export function caldavTime(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

function normalizeColor(value: string | undefined): string | undefined {
  // Apple liefert `#rrggbbaa`, andere Server `#rrggbb`.
  const match = /^#([0-9a-f]{6})/i.exec(value?.trim() ?? '')
  return match ? `#${match[1].toLowerCase()}` : undefined
}

/**
 * Ein schlanker CalDAV-Client (RFC 4791) für genau das, was die App braucht:
 * Kalender finden, Einträge in einem Zeitraum lesen, einzelne Einträge
 * lesen, schreiben und löschen. Angemeldet wird mit Benutzername und
 * Passwort (HTTP Basic), bei iCloud mit einem app-spezifischen Passwort.
 */
export class CalDavClient {
  private readonly auth: string

  constructor(
    private readonly baseUrl: string,
    credentials: CalDavCredentials,
    private readonly http: HttpFetch = (url, init) => fetch(url, init)
  ) {
    this.auth = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`
  }

  /**
   * Die Anmeldung geht nur über HTTPS und nur an Server derselben Domain wie
   * die Startadresse (bei iCloud `*.icloud.com`). Adressen kommen auch aus
   * Antworten des Servers, darum wird jede einzeln geprüft.
   */
  private assertTrusted(url: string): void {
    const target = new URL(url)
    const base = new URL(this.baseUrl).hostname
    const domain = base.split('.').slice(-2).join('.')
    const sameDomain = target.hostname === domain || target.hostname.endsWith(`.${domain}`)
    if (target.protocol !== 'https:' || !sameDomain) {
      throw new CalDavError(
        `Der Kalenderserver verweist auf eine fremde Adresse (${target.host})`,
        0
      )
    }
  }

  /**
   * Schickt eine Anfrage und folgt Weiterleitungen selbst. `fetch` würde die
   * Anmeldung beim Wechsel auf einen anderen Server weglassen, iCloud leitet
   * aber genau so weiter (caldav.icloud.com → pXX-caldav.icloud.com).
   */
  private async request(
    method: string,
    url: string,
    options: { body?: string; headers?: Record<string, string>; accept?: number[] } = {}
  ): Promise<{ status: number; text: string; url: string; etag?: string }> {
    let current = url
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      this.assertTrusted(current)
      const response = await this.http(current, {
        method,
        redirect: 'manual',
        headers: {
          Authorization: this.auth,
          ...(options.body ? { 'Content-Type': 'application/xml; charset=utf-8' } : {}),
          ...options.headers
        },
        body: options.body
      })
      const location = response.headers.get('location')
      if ([301, 302, 307, 308].includes(response.status) && location) {
        current = new URL(location, current).toString()
        continue
      }
      const text = await response.text()
      const ok =
        (response.status >= 200 && response.status < 300) ||
        options.accept?.includes(response.status)
      if (!ok) throw this.failure(response.status, method)
      return {
        status: response.status,
        text,
        url: current,
        etag: response.headers.get('etag') ?? undefined
      }
    }
    throw new CalDavError('Der Kalenderserver leitet zu oft weiter', 310)
  }

  private failure(status: number, method: string): CalDavError {
    if (status === 401) {
      return new CalDavError(
        'Die Anmeldung wurde abgelehnt. Stimmen Apple-ID und app-spezifisches Passwort?',
        status
      )
    }
    if (status === 403) return new CalDavError('Dieser Kalender lässt sich nicht ändern', status)
    if (status === 412) {
      return new CalDavError('Der Termin wurde inzwischen anderswo geändert', status)
    }
    return new CalDavError(`Der Kalenderserver antwortet mit Fehler ${status} (${method})`, status)
  }

  /** Die `response`-Elemente einer Multistatus-Antwort, mit absoluter Adresse. */
  private responses(xml: string, base: string): Array<{ url: string; node: XmlNode }> {
    return findAll(parseXml(xml), 'response').flatMap((node) => {
      const href = textOf(node, 'href')
      return href ? [{ url: new URL(href, base).toString(), node }] : []
    })
  }

  private async propfind(
    url: string,
    depth: 0 | 1,
    props: string
  ): Promise<Array<{ url: string; node: XmlNode }>> {
    const response = await this.request('PROPFIND', url, {
      body: propfindBody(props),
      headers: { Depth: String(depth) }
    })
    return this.responses(response.text, response.url)
  }

  /** Das Element `href` unter der Eigenschaft `prop` der ersten Antwort. */
  private async hrefProperty(url: string, prop: string, xml: string): Promise<string> {
    const [first] = await this.propfind(url, 0, xml)
    const href = first && find(first.node, prop) && textOf(find(first.node, prop)!, 'href')
    if (!href) throw new Error('Der Kalenderserver hat keine Kalender gemeldet')
    return new URL(href, first.url).toString()
  }

  /** Sucht alle Kalender des Kontos, die Termine (VEVENT) aufnehmen. */
  async listCalendars(): Promise<CalDavCalendar[]> {
    const principal = await this.hrefProperty(
      this.baseUrl,
      'current-user-principal',
      '<d:current-user-principal/>'
    )
    const home = await this.hrefProperty(principal, 'calendar-home-set', '<c:calendar-home-set/>')
    const entries = await this.propfind(
      home,
      1,
      '<d:resourcetype/><d:displayname/><a:calendar-color/><c:supported-calendar-component-set/>'
    )
    return entries.flatMap(({ url, node }) => {
      const type = find(node, 'resourcetype')
      if (!type || !find(type, 'calendar')) return []
      // Ohne Angabe nimmt ein Kalender alles auf. Sonst muss VEVENT dabei sein,
      // reine Erinnerungslisten (VTODO) fallen weg.
      const components = findAll(node, 'comp').map((comp) => comp.attrs.name?.toUpperCase())
      if (components.length > 0 && !components.includes('VEVENT')) return []
      return [
        {
          url,
          name: textOf(node, 'displayname') || 'Kalender',
          color: normalizeColor(textOf(node, 'calendar-color'))
        }
      ]
    })
  }

  /** Alle Einträge mit mindestens einem Termin im Zeitraum, Serien als Ganzes. */
  async listObjects(calendarUrl: string, start: Date, end: Date): Promise<CalDavObject[]> {
    const body =
      `<?xml version="1.0" encoding="utf-8"?><c:calendar-query ${NS}>` +
      '<d:prop><d:getetag/><c:calendar-data/></d:prop>' +
      '<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">' +
      `<c:time-range start="${caldavTime(start)}" end="${caldavTime(end)}"/>` +
      '</c:comp-filter></c:comp-filter></c:filter></c:calendar-query>'
    const response = await this.request('REPORT', calendarUrl, { body, headers: { Depth: '1' } })
    return this.responses(response.text, response.url).flatMap(({ url, node }) => {
      const data = find(node, 'calendar-data')?.text
      return data && data.includes('BEGIN:VCALENDAR')
        ? [{ url, etag: textOf(node, 'getetag'), data }]
        : []
    })
  }

  /** Liefert `null`, wenn es den Eintrag nicht gibt. */
  async getObject(url: string): Promise<CalDavObject | null> {
    const response = await this.request('GET', url, { accept: [404, 410] })
    if (response.status === 404 || response.status === 410) return null
    return { url, etag: response.etag, data: response.text }
  }

  /**
   * Schreibt einen Eintrag. Mit `create` nur, wenn es ihn noch nicht gibt,
   * mit `etag` nur, wenn er seither nicht geändert wurde.
   */
  async putObject(
    url: string,
    data: string,
    options: { create?: boolean; etag?: string } = {}
  ): Promise<void> {
    await this.request('PUT', url, {
      body: data,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        ...(options.create ? { 'If-None-Match': '*' } : {}),
        ...(options.etag ? { 'If-Match': options.etag } : {})
      }
    })
  }

  /** Löscht einen Eintrag. Schon gelöscht ist auch gelöscht. */
  async deleteObject(url: string): Promise<void> {
    await this.request('DELETE', url, { accept: [404, 410] })
  }
}
