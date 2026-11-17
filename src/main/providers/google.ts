import { calendar, type calendar_v3 } from '@googleapis/calendar'
import type { OAuth2Client } from 'google-auth-library'
import type { NormalizedEvent } from '../../shared/types'
import { toDateString, type DayRange } from '../dateRange'
import type { RemoteCalendar } from '../db/store'
import { mapGoogleEvent, normalizeColor, toGoogleBody, type GoogleReminder } from './googleMapper'
import type { CalendarProvider, ProviderEvent } from './types'

const DEFAULT_COLOR = '#2563a8'
/** Schutz vor Endlosschleifen beim Blättern durch die Ergebnisseiten */
const MAX_PAGES = 20

/** Mitternacht in der lokalen Zeitzone als Zeitpunkt für die Google-Abfrage. */
function localMidnight(dayNumber: number): string {
  const [year, month, day] = toDateString(dayNumber).split('-').map(Number)
  return new Date(year, month - 1, day).toISOString()
}

function isGone(error: unknown): boolean {
  const status =
    (error as { code?: number; status?: number })?.code ?? (error as { status?: number })?.status
  return status === 404 || status === 410
}

/** Liest und schreibt Kalender und Termine eines Google-Kontos (Calendar API v3). */
export class GoogleProvider implements CalendarProvider {
  private readonly api: calendar_v3.Calendar
  /** Die Standard-Erinnerungen je Kalender, wie Google sie beim Auflisten mitliefert */
  private readonly defaultReminders = new Map<string, GoogleReminder[]>()

  constructor(auth: OAuth2Client) {
    this.api = calendar({ version: 'v3', auth })
  }

  async listCalendars(): Promise<RemoteCalendar[]> {
    const calendars: RemoteCalendar[] = []
    let pageToken: string | undefined

    for (let page = 0; page < MAX_PAGES; page++) {
      const { data } = await this.api.calendarList.list({ pageToken, maxResults: 250 })
      for (const item of data.items ?? []) {
        if (!item.id || item.deleted) continue
        calendars.push({
          remoteId: item.id,
          name: item.summaryOverride ?? item.summary ?? item.id,
          color: normalizeColor(item.backgroundColor, DEFAULT_COLOR)
        })
      }
      pageToken = data.nextPageToken ?? undefined
      if (!pageToken) break
    }

    return calendars
  }

  /** @param expand Serien in einzelne Vorkommen auflösen (für die Anzeige) */
  private async list(
    calendarRemoteId: string,
    range: DayRange,
    expand: boolean
  ): Promise<ProviderEvent[]> {
    const events: ProviderEvent[] = []
    let pageToken: string | undefined

    for (let page = 0; page < MAX_PAGES; page++) {
      const { data } = await this.api.events.list({
        calendarId: calendarRemoteId,
        timeMin: localMidnight(range.startDay),
        timeMax: localMidnight(range.endDay),
        singleEvents: expand,
        orderBy: expand ? 'startTime' : undefined,
        maxResults: 2500,
        pageToken
      })
      const timeZone = data.timeZone ?? 'UTC'
      const defaults = data.defaultReminders ?? []
      this.defaultReminders.set(calendarRemoteId, defaults)
      for (const item of data.items ?? []) {
        // Ohne Auflösung liefert Google Serien als Ganzes und dazu ihre
        // Ausnahmen. Die Ausnahmen werden nicht einzeln abgeglichen.
        if (!expand && item.recurringEventId) continue
        const event = mapGoogleEvent(item, timeZone, defaults)
        if (event && event.status !== 'cancelled') events.push(event)
      }
      pageToken = data.nextPageToken ?? undefined
      if (!pageToken) break
    }

    return events
  }

  listEvents(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]> {
    return this.list(calendarRemoteId, range, true)
  }

  listForSync(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]> {
    return this.list(calendarRemoteId, range, false)
  }

  async getEvent(calendarRemoteId: string, eventId: string): Promise<ProviderEvent | null> {
    try {
      const { data } = await this.api.events.get({ calendarId: calendarRemoteId, eventId })
      const event = mapGoogleEvent(
        data,
        data.start?.timeZone ?? 'UTC',
        this.defaultReminders.get(calendarRemoteId)
      )
      return event && event.status !== 'cancelled' ? event : null
    } catch (error) {
      if (isGone(error)) return null
      throw error
    }
  }

  async createEvent(calendarRemoteId: string, event: NormalizedEvent): Promise<ProviderEvent> {
    const { data } = await this.api.events.insert({
      calendarId: calendarRemoteId,
      requestBody: toGoogleBody(event)
    })
    return this.written(calendarRemoteId, data, event)
  }

  async updateEvent(
    calendarRemoteId: string,
    eventId: string,
    event: NormalizedEvent
  ): Promise<ProviderEvent> {
    const { data } = await this.api.events.patch({
      calendarId: calendarRemoteId,
      eventId,
      requestBody: toGoogleBody(event)
    })
    return this.written(calendarRemoteId, data, event)
  }

  async deleteEvent(calendarRemoteId: string, eventId: string): Promise<void> {
    try {
      await this.api.events.delete({ calendarId: calendarRemoteId, eventId })
    } catch (error) {
      // Schon gelöscht ist auch gelöscht.
      if (!isGone(error)) throw error
    }
  }

  private written(
    calendarRemoteId: string,
    data: calendar_v3.Schema$Event,
    sent: NormalizedEvent
  ): ProviderEvent {
    const event = mapGoogleEvent(data, sent.timeZone, this.defaultReminders.get(calendarRemoteId))
    if (!event) throw new Error('Google hat den gespeicherten Termin nicht zurückgegeben')
    return event
  }
}
