import { describe, expect, it } from 'vitest'
import type { NormalizedEvent } from '../../shared/types'
import { toDayNumber } from '../dateRange'
import { syncPair, type EventLink, type SyncSide } from '../sync/engine'
import { pairProblem } from '../sync/pairs'
import { CalDavClient, type HttpFetch } from './caldav'
import { ICloudProvider } from './icloud'
import type { CalendarProvider, ProviderEvent } from './types'
import { parseXml, textOf } from './xml'

const HOME = 'https://p01-caldav.icloud.com/123/calendars/'
const CALENDAR = `${HOME}home/`

interface Request {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

/**
 * Ein nachgebauter iCloud-Server: beantwortet die Suche nach den Kalendern
 * und hält die `.ics`-Dateien eines Kalenders im Speicher.
 */
function fakeICloud(): { http: HttpFetch; files: Map<string, string>; requests: Request[] } {
  const files = new Map<string, string>()
  const requests: Request[] = []
  let version = 0

  type Response = Awaited<ReturnType<HttpFetch>>
  const respond = (status: number, body = '', headers: Record<string, string> = {}): Response => ({
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => body
  })
  const multistatus = (inner: string): string =>
    `<?xml version="1.0"?><multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">${inner}</multistatus>`

  const http: HttpFetch = async (url, init) => {
    requests.push({ method: init.method, url, headers: init.headers, body: init.body })
    if (
      init.headers.Authorization !==
      `Basic ${Buffer.from('ich@icloud.com:abcd-efgh-ijkl-mnop').toString('base64')}`
    ) {
      return respond(401)
    }
    if (url === 'https://caldav.icloud.com/' && init.method === 'PROPFIND') {
      // iCloud leitet auf den Server des Kontos weiter.
      return respond(301, '', { location: 'https://p01-caldav.icloud.com/' })
    }
    if (url === 'https://p01-caldav.icloud.com/' && init.method === 'PROPFIND') {
      return respond(
        207,
        multistatus(
          '<response><href>/</href><propstat><prop><current-user-principal><href>/123/principal/</href></current-user-principal></prop></propstat></response>'
        )
      )
    }
    if (url.endsWith('/123/principal/')) {
      return respond(
        207,
        multistatus(
          `<response><href>/123/principal/</href><propstat><prop><C:calendar-home-set><href>${HOME}</href></C:calendar-home-set></prop></propstat></response>`
        )
      )
    }
    if (url === HOME && init.method === 'PROPFIND') {
      return respond(
        207,
        multistatus(
          '<response><href>/123/calendars/</href><propstat><prop><resourcetype><collection/></resourcetype></prop></propstat></response>' +
            '<response><href>/123/calendars/home/</href><propstat><prop><resourcetype><collection/><C:calendar/></resourcetype><displayname>Privat</displayname><calendar-color xmlns="http://apple.com/ns/ical/">#34AADCFF</calendar-color><C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set></prop></propstat></response>' +
            '<response><href>/123/calendars/tasks/</href><propstat><prop><resourcetype><collection/><C:calendar/></resourcetype><displayname>Erinnerungen</displayname><C:supported-calendar-component-set><C:comp name="VTODO"/></C:supported-calendar-component-set></prop></propstat></response>'
        )
      )
    }
    if (url === CALENDAR && init.method === 'REPORT') {
      const entries = [...files.entries()]
        .map(
          ([href, data]) =>
            `<response><href>${new URL(href).pathname}</href><propstat><prop><getetag>"${version}"</getetag><C:calendar-data><![CDATA[${data}]]></C:calendar-data></prop></propstat></response>`
        )
        .join('')
      return respond(207, multistatus(entries))
    }
    if (init.method === 'GET') {
      const data = files.get(url)
      return data ? respond(200, data, { etag: `"${version}"` }) : respond(404)
    }
    if (init.method === 'PUT') {
      if (init.headers['If-None-Match'] === '*' && files.has(url)) return respond(412)
      if (init.headers['If-Match'] && init.headers['If-Match'] !== `"${version}"`)
        return respond(412)
      files.set(url, init.body ?? '')
      version++
      return respond(201)
    }
    if (init.method === 'DELETE') {
      files.delete(url)
      return respond(204)
    }
    return respond(405)
  }
  return { http, files, requests }
}

const login = { username: 'ich@icloud.com', password: 'abcd-efgh-ijkl-mnop' }
const NOVEMBER = { startDay: toDayNumber('2026-11-01'), endDay: toDayNumber('2026-12-01') }

const event: NormalizedEvent = {
  title: 'Zahnarzt',
  description: 'Kontrolle',
  start: '2026-11-18T14:00:00+01:00',
  end: '2026-11-18T15:00:00+01:00',
  allDay: false,
  timeZone: 'Europe/Zurich',
  recurrence: null,
  status: 'confirmed'
}

describe('XML', () => {
  it('liest Namensräume, CDATA und Entitäten', () => {
    const root = parseXml(
      '<?xml version="1.0"?><d:a xmlns:d="DAV:"><d:b>1 &amp; 2</d:b><c><![CDATA[<x>]]></c><e/></d:a>'
    )
    expect(textOf(root, 'b')).toBe('1 & 2')
    expect(textOf(root, 'c')).toBe('<x>')
    expect(textOf(root, 'e')).toBe('')
  })
})

describe('CalDAV und iCloud', () => {
  it('findet die Kalender über die Weiterleitung, ohne Erinnerungslisten', async () => {
    const server = fakeICloud()
    const provider = new ICloudProvider(
      new CalDavClient('https://caldav.icloud.com/', login, server.http)
    )
    expect(await provider.listCalendars()).toEqual([
      { remoteId: CALENDAR, name: 'Privat', color: '#34aadc' }
    ])
    // Auch nach der Weiterleitung wird mit Anmeldung gefragt.
    expect(server.requests.every((request) => request.headers.Authorization)).toBe(true)
  })

  it('schickt die Anmeldung nicht an fremde Server', async () => {
    const requests: string[] = []
    const http: HttpFetch = async (url) => {
      requests.push(url)
      return {
        status: 301,
        headers: { get: (name) => (name === 'location' ? 'https://example.com/fang/' : null) },
        text: async () => ''
      }
    }
    const client = new CalDavClient('https://caldav.icloud.com/', login, http)
    await expect(client.listCalendars()).rejects.toThrow('fremde Adresse (example.com)')
    expect(requests).toEqual(['https://caldav.icloud.com/'])
  })

  it('meldet ein falsches Passwort verständlich', async () => {
    const server = fakeICloud()
    const client = new CalDavClient(
      'https://caldav.icloud.com/',
      { ...login, password: 'falsch-falsch' },
      server.http
    )
    await expect(client.listCalendars()).rejects.toThrow('app-spezifisches Passwort')
  })

  it('erstellt, liest, ändert und löscht Termine', async () => {
    const server = fakeICloud()
    const provider = new ICloudProvider(
      new CalDavClient('https://caldav.icloud.com/', login, server.http)
    )
    const created = await provider.createEvent(CALENDAR, event)
    expect(created.id.startsWith(CALENDAR)).toBe(true)
    expect(created.start).toBe('2026-11-18T13:00:00.000Z')
    expect(server.requests.at(-2)?.headers['If-None-Match']).toBe('*')

    expect(await provider.listForSync(CALENDAR, NOVEMBER)).toHaveLength(1)
    const updated = await provider.updateEvent(CALENDAR, created.id, {
      ...event,
      title: 'Zahnarzt Dr. Muster'
    })
    expect(updated.title).toBe('Zahnarzt Dr. Muster')
    expect(
      server.requests.find((request) => request.method === 'PUT' && request.headers['If-Match'])
    ).toBeTruthy()

    await provider.deleteEvent(CALENDAR, created.id)
    expect(await provider.getEvent(CALENDAR, created.id)).toBeNull()
    expect(server.files.size).toBe(0)
  })

  it('ändert und löscht einzelne Vorkommen einer Serie', async () => {
    const server = fakeICloud()
    const provider = new ICloudProvider(
      new CalDavClient('https://caldav.icloud.com/', login, server.http)
    )
    await provider.createEvent(CALENDAR, { ...event, recurrence: 'FREQ=WEEKLY;COUNT=3' })
    const shown = await provider.listEvents(CALENDAR, NOVEMBER)
    // Das dritte Vorkommen (2.12.) liegt ausserhalb des Novembers.
    expect(shown.map((entry) => entry.start)).toEqual([
      '2026-11-18T13:00:00.000Z',
      '2026-11-25T13:00:00.000Z'
    ])

    await provider.updateEvent(CALENDAR, shown[1].id, {
      ...event,
      title: 'Verschoben',
      start: '2026-11-26T09:00:00+01:00',
      end: '2026-11-26T10:00:00+01:00',
      recurrence: 'SERIE'
    })
    await provider.deleteEvent(CALENDAR, shown[0].id)
    const after = await provider.listEvents(CALENDAR, NOVEMBER)
    expect(after.map((entry) => [entry.title, entry.start])).toEqual([
      ['Verschoben', '2026-11-26T08:00:00.000Z']
    ])
    // Für den Abgleich bleibt die Serie als Ganzes.
    const [series] = await provider.listForSync(CALENDAR, NOVEMBER)
    expect(series.recurrence).toBe('FREQ=WEEKLY;COUNT=3')
  })
})

/** Ein Anbieter im Speicher, wie die Demo-Kalender. */
function memoryProvider(): CalendarProvider & { events: Map<string, NormalizedEvent> } {
  const events = new Map<string, NormalizedEvent>()
  let next = 1
  const out = (id: string): ProviderEvent => ({ ...events.get(id)!, id })
  return {
    events,
    listEvents: async () => [...events.keys()].map(out),
    listForSync: async () => [...events.keys()].map(out),
    getEvent: async (_c, id) => (events.has(id) ? out(id) : null),
    createEvent: async (_c, value) => {
      const id = `m${next++}`
      events.set(id, value)
      return out(id)
    },
    updateEvent: async (_c, id, value) => {
      events.set(id, value)
      return out(id)
    },
    deleteEvent: async (_c, id) => {
      events.delete(id)
    }
  }
}

function sideOf(label: string, provider: CalendarProvider, calendar: string): SyncSide {
  return {
    label,
    list: () => provider.listForSync(calendar, NOVEMBER),
    get: (id) => provider.getEvent(calendar, id),
    create: (value) => provider.createEvent(calendar, value),
    update: (id, value) => provider.updateEvent(calendar, id, value),
    remove: (id) => provider.deleteEvent(calendar, id)
  }
}

describe('Abgleich mit iCloud', () => {
  it('überträgt in beide Richtungen und löst keinen zweiten Abgleich aus', async () => {
    const server = fakeICloud()
    const icloud = new ICloudProvider(
      new CalDavClient('https://caldav.icloud.com/', login, server.http)
    )
    const google = memoryProvider()
    google.events.set('g1', { ...event, title: 'Aus Google' })
    await icloud.createEvent(CALENDAR, {
      ...event,
      title: 'Aus iCloud',
      start: '2026-11-19T09:00:00+01:00',
      end: '2026-11-19T10:00:00+01:00'
    })

    let links: EventLink[] = []
    const store = {
      list: async () => links,
      save: async (link: EventLink) => {
        links = [...links.filter((entry) => entry.aId !== link.aId), link]
      },
      remove: async (link: EventLink) => {
        links = links.filter((entry) => entry !== link)
      }
    }
    const a = sideOf('Google', google, 'g')
    const b = sideOf('iCloud', icloud, CALENDAR)

    const first = await syncPair(a, b, store)
    expect(first).toMatchObject({ created: 2, problems: [] })
    expect(server.files.size).toBe(2)
    expect([...google.events.values()].map((entry) => entry.title).sort()).toEqual([
      'Aus Google',
      'Aus iCloud'
    ])

    const second = await syncPair(a, b, store)
    expect(second).toMatchObject({ created: 0, updated: 0, deleted: 0, problems: [] })
  })
})

describe('Paare', () => {
  const pairs = [
    { id: 'p1', calendarAId: 'google', calendarBId: 'outlook' },
    { id: 'p2', calendarAId: 'google', calendarBId: 'icloud' }
  ]

  it('erlaubt einen Kalender in mehreren Paaren', () => {
    expect(pairProblem(pairs.slice(0, 1), 'google', 'icloud')).toBeNull()
  })

  it('lehnt doppelte Paare, Ringe und Paare mit sich selbst ab', () => {
    expect(pairProblem(pairs, 'icloud', 'google')).toMatch('schon abgeglichen')
    expect(pairProblem(pairs, 'outlook', 'icloud')).toMatch('anderen Kalender')
    expect(pairProblem(pairs, 'outlook', 'outlook')).toMatch('sich selbst')
  })
})
