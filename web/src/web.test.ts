import { describe, expect, it } from 'vitest'
import {
  clearSession,
  lastEmail,
  loadSession,
  saveSession,
  type KeyValueStore
} from './google/auth'
import { GoogleCalendarApi, SignInNeeded, dayStart, mapCalendar } from './google/api'
import { loadOptions, loadView, saveOptions } from './store'

/** localStorage-Ersatz für die Tests */
function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key)
  }
}

describe('Anmeldung speichern', () => {
  it('liefert eine gültige Anmeldung zurück, eine abgelaufene nicht', () => {
    const store = memory()
    saveSession(store, { token: 't', email: 'ich@gmail.com', expiresAt: 10_000_000 })
    expect(loadSession(store, 1_000)).toMatchObject({ token: 't', email: 'ich@gmail.com' })
    // Eine Minute vor Ablauf gilt sie schon als abgelaufen.
    expect(loadSession(store, 10_000_000 - 30_000)).toBeNull()
  })

  it('merkt sich die Adresse auch nach dem Abmelden, ausser beim Vergessen', () => {
    const store = memory()
    saveSession(store, { token: 't', email: 'ich@gmail.com', expiresAt: 10_000_000 })
    clearSession(store)
    expect(loadSession(store, 0)).toBeNull()
    expect(lastEmail(store)).toBe('ich@gmail.com')
    clearSession(store, true)
    expect(lastEmail(store)).toBeUndefined()
  })

  it('übersteht kaputte Daten', () => {
    const store = memory()
    store.setItem('easy-calender.session', '{kaputt')
    expect(loadSession(store)).toBeNull()
  })
})

describe('Einstellungen auf dem Handy', () => {
  it('speichert Sichtbarkeit und Farbe und verwirft Ungültiges', () => {
    const store = memory()
    saveOptions(store, { a: { visible: false, color: '#AABBCC' } })
    store.setItem(
      'easy-calender.calendars',
      store
        .getItem('easy-calender.calendars')!
        .replace('}}', '},"b":{"color":"rot","visible":"ja"}}')
    )
    expect(loadOptions(store)).toEqual({ a: { visible: false, color: '#aabbcc' }, b: {} })
  })

  it('nimmt die Liste als Ansicht, wenn nichts Gültiges gespeichert ist', () => {
    const store = memory()
    expect(loadView(store)).toBe('listWeek')
    store.setItem('easy-calender.view', 'timeGridDay')
    expect(loadView(store)).toBe('timeGridDay')
    store.setItem('easy-calender.view', 'quatsch')
    expect(loadView(store)).toBe('listWeek')
  })
})

describe('Google Calendar API im Browser', () => {
  it('wandelt Kalender um und erkennt, ob man schreiben darf', () => {
    expect(
      mapCalendar(
        {
          id: 'x',
          summary: 'Familie',
          backgroundColor: '#FF0000',
          accessRole: 'owner',
          primary: true
        },
        'acc'
      )
    ).toMatchObject({
      id: 'x',
      name: 'Familie',
      color: '#ff0000',
      writable: true,
      primary: true,
      visible: true
    })
    expect(
      mapCalendar({ id: 'f', summary: 'Feiertage', accessRole: 'reader', selected: false }, 'acc')
    ).toMatchObject({ writable: false, visible: false })
    expect(mapCalendar({ summary: 'ohne ID' }, 'acc')).toBeNull()
  })

  it('rechnet den Tag in Ortszeit, nicht in UTC', () => {
    expect(new Date(dayStart('2026-11-18')).getDate()).toBe(18)
    expect(new Date(dayStart('2026-11-18')).getHours()).toBe(0)
  })

  it('lädt Termine seitenweise, mit Token, ohne abgesagte', async () => {
    const urls: string[] = []
    const auth: string[] = []
    const fake = (async (url: string, init?: RequestInit) => {
      urls.push(url)
      auth.push(String((init?.headers as Record<string, string>).Authorization))
      const page = url.includes('pageToken=p2')
        ? {
            items: [
              { id: 'b', summary: 'B', start: { date: '2026-11-19' }, end: { date: '2026-11-20' } }
            ]
          }
        : {
            items: [
              {
                id: 'a',
                summary: 'A',
                start: { dateTime: '2026-11-18T14:00:00+01:00' },
                end: { dateTime: '2026-11-18T15:00:00+01:00' }
              },
              {
                id: 'c',
                status: 'cancelled',
                summary: 'weg',
                start: { date: '2026-11-18' },
                end: { date: '2026-11-19' }
              }
            ],
            nextPageToken: 'p2'
          }
      return new Response(JSON.stringify(page), { status: 200 })
    }) as typeof fetch

    const api = new GoogleCalendarApi(() => 'TOKEN', 'acc', fake)
    const events = await api.listEvents('ich@gmail.com', '2026-11-16', '2026-11-23')

    expect(events.map((event) => event.id)).toEqual(['a', 'b'])
    expect(events[0]).toMatchObject({ calendarId: 'ich@gmail.com', allDay: false })
    expect(urls[0]).toContain('/calendars/ich%40gmail.com/events?')
    expect(urls[0]).toContain('singleEvents=true')
    expect(auth).toEqual(['Bearer TOKEN', 'Bearer TOKEN'])
  })

  it('meldet eine abgelaufene Anmeldung als SignInNeeded', async () => {
    const fake = (async () => new Response('{}', { status: 401 })) as typeof fetch
    const api = new GoogleCalendarApi(() => 'alt', 'acc', fake)
    await expect(api.listCalendars()).rejects.toBeInstanceOf(SignInNeeded)
  })

  it('legt Termine an und ändert sie im Format von Google', async () => {
    const calls: Array<{ url: string; method?: string; body: Record<string, unknown> }> = []
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method, body: JSON.parse(String(init?.body ?? '{}')) })
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const api = new GoogleCalendarApi(() => 'T', 'acc', fake)
    const input = {
      title: 'Ausflug',
      start: '2026-11-20',
      end: '2026-11-21',
      allDay: true,
      timeZone: 'Europe/Zurich',
      recurrence: null
    }
    await api.createEvent('k', input)
    await api.updateEvent('k', 'e1', { ...input, title: 'Ausflug Zoo' })

    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: { summary: 'Ausflug', start: { date: '2026-11-20' }, end: { date: '2026-11-21' } }
    })
    expect(calls[1].method).toBe('PATCH')
    expect(calls[1].url).toMatch(/\/calendars\/k\/events\/e1$/)
  })
})
