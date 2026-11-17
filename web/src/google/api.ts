import type {
  Calendar,
  CalendarEvent,
  EventInput,
  NormalizedEvent
} from '../../../src/shared/types'
import {
  mapGoogleEvent,
  normalizeColor,
  toGoogleBody
} from '../../../src/main/providers/googleMapper'
import type { GoogleEvent } from '../../../src/main/providers/googleMapper'

const BASE = 'https://www.googleapis.com/calendar/v3'
const FALLBACK_COLOR = '#2563a8'

/** Das Token ist abgelaufen oder wurde zurückgezogen: neu anmelden. */
export class SignInNeeded extends Error {
  constructor() {
    super('Deine Anmeldung bei Google ist abgelaufen. Melde dich nochmals an.')
  }
}

interface GoogleCalendarEntry {
  id?: string
  summary?: string
  summaryOverride?: string
  backgroundColor?: string
  primary?: boolean
  accessRole?: string
  selected?: boolean
}

/** Ein Kalender der Web-App: mit Angabe, ob man darin schreiben darf. */
export interface WebCalendar extends Calendar {
  primary: boolean
  writable: boolean
}

type Fetch = typeof fetch

/** Was die Oberfläche braucht. Google oder, zum Ausprobieren, Beispieldaten. */
export interface CalendarBackend {
  listCalendars(): Promise<WebCalendar[]>
  listEvents(calendarId: string, start: string, end: string): Promise<CalendarEvent[]>
  createEvent(calendarId: string, input: EventInput): Promise<void>
  updateEvent(calendarId: string, eventId: string, input: EventInput): Promise<void>
  deleteEvent(calendarId: string, eventId: string): Promise<void>
}

/** Lokaler Tag `YYYY-MM-DD` als Beginn dieses Tages in Ortszeit, als RFC 3339. */
export function dayStart(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date).toISOString()
}

/** Wandelt einen Eintrag der Google-Kalenderliste um. */
export function mapCalendar(entry: GoogleCalendarEntry, accountId: string): WebCalendar | null {
  if (!entry.id) return null
  return {
    id: entry.id,
    accountId,
    remoteId: entry.id,
    name: entry.summaryOverride || entry.summary || entry.id,
    color: normalizeColor(entry.backgroundColor, FALLBACK_COLOR),
    syncEnabled: false,
    visible: entry.selected !== false,
    primary: entry.primary === true,
    writable: entry.accessRole === 'owner' || entry.accessRole === 'writer'
  }
}

/** Aus dem Formular ein Termin fürs Mapping (Status gibt es dort nicht). */
function toNormalized(input: EventInput): NormalizedEvent {
  return { ...input, status: 'confirmed' }
}

/**
 * Spricht direkt mit der Google Calendar API, mit dem Token aus der
 * Anmeldung. Dieselbe Umwandlung wie in der Desktop-App.
 */
export class GoogleCalendarApi implements CalendarBackend {
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  constructor(
    private readonly token: () => string,
    private readonly accountId: string,
    private readonly fetchFn: Fetch = (...args) => fetch(...args)
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response
    try {
      response = await this.fetchFn(`${BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token()}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {})
        }
      })
    } catch {
      throw new Error('Keine Verbindung zu Google. Bist du online?')
    }
    if (response.status === 401) throw new SignInNeeded()
    if (response.status === 204) return undefined as T
    const data = (await response.json().catch(() => ({}))) as T & {
      error?: { message?: string }
    }
    if (!response.ok) {
      throw new Error(`Google meldet: ${data.error?.message ?? response.statusText}`)
    }
    return data
  }

  async listCalendars(): Promise<WebCalendar[]> {
    const data = await this.request<{ items?: GoogleCalendarEntry[] }>(
      '/users/me/calendarList?minAccessRole=reader&maxResults=250'
    )
    const calendars = (data.items ?? []).flatMap((entry) => {
      const calendar = mapCalendar(entry, this.accountId)
      return calendar ? [calendar] : []
    })
    // Der Hauptkalender zuerst, danach nach Namen.
    return calendars.sort(
      (a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name, 'de')
    )
  }

  /** Termine von `start` bis vor `end` (lokale Tage), Serien aufgelöst. */
  async listEvents(calendarId: string, start: string, end: string): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = []
    let pageToken: string | undefined
    do {
      const query = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin: dayStart(start),
        timeMax: dayStart(end),
        maxResults: '2500'
      })
      if (pageToken) query.set('pageToken', pageToken)
      const data = await this.request<{ items?: GoogleEvent[]; nextPageToken?: string }>(
        `/calendars/${encodeURIComponent(calendarId)}/events?${query}`
      )
      for (const item of data.items ?? []) {
        const mapped = mapGoogleEvent(item, this.timeZone)
        if (mapped && mapped.status !== 'cancelled') events.push({ ...mapped, calendarId })
      }
      pageToken = data.nextPageToken
    } while (pageToken)
    return events
  }

  async createEvent(calendarId: string, input: EventInput): Promise<void> {
    await this.request(`/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      body: JSON.stringify(toGoogleBody(toNormalized(input)))
    })
  }

  async updateEvent(calendarId: string, eventId: string, input: EventInput): Promise<void> {
    await this.request(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'PATCH', body: JSON.stringify(toGoogleBody(toNormalized(input))) }
    )
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.request(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' }
    )
  }
}
