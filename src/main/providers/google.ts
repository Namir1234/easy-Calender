import { calendar, type calendar_v3 } from '@googleapis/calendar'
import type { OAuth2Client } from 'google-auth-library'
import { toDateString, type DayRange } from '../dateRange'
import type { SeedAccount } from '../db/store'
import { mapGoogleEvent, normalizeColor } from './googleMapper'
import type { CalendarProvider, ProviderEvent } from './types'

const DEFAULT_COLOR = '#2563a8'
/** Schutz vor Endlosschleifen beim Blättern durch die Ergebnisseiten */
const MAX_PAGES = 20

/** Mitternacht in der lokalen Zeitzone als Zeitpunkt für die Google-Abfrage. */
function localMidnight(dayNumber: number): string {
  const [year, month, day] = toDateString(dayNumber).split('-').map(Number)
  return new Date(year, month - 1, day).toISOString()
}

/** Liest Kalender und Termine eines Google-Kontos (Calendar API v3). */
export class GoogleProvider implements CalendarProvider {
  private readonly api: calendar_v3.Calendar

  constructor(auth: OAuth2Client) {
    this.api = calendar({ version: 'v3', auth })
  }

  async listCalendars(): Promise<SeedAccount['calendars']> {
    const calendars: SeedAccount['calendars'] = []
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

  async listEvents(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]> {
    const events: ProviderEvent[] = []
    let pageToken: string | undefined

    for (let page = 0; page < MAX_PAGES; page++) {
      const { data } = await this.api.events.list({
        calendarId: calendarRemoteId,
        timeMin: localMidnight(range.startDay),
        timeMax: localMidnight(range.endDay),
        // Serien werden von Google in einzelne Vorkommen aufgelöst.
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500,
        pageToken
      })
      const timeZone = data.timeZone ?? 'UTC'
      for (const item of data.items ?? []) {
        const event = mapGoogleEvent(item, timeZone)
        if (event && event.status !== 'cancelled') events.push(event)
      }
      pageToken = data.nextPageToken ?? undefined
      if (!pageToken) break
    }

    return events
  }
}
