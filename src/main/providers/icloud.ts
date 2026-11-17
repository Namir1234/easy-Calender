import { randomUUID } from 'crypto'
import type { NormalizedEvent } from '../../shared/types'
import { toDateString, type DayRange } from '../dateRange'
import type { RemoteCalendar } from '../db/store'
import type { CalDavClient, CalDavObject } from './caldav'
import {
  buildCalendar,
  displayEvents,
  occurrenceEvent,
  removeOccurrence,
  seriesEvent,
  splitEventId,
  updateOccurrence,
  updateSeries
} from './icalMapper'
import type { CalendarProvider, ProviderEvent } from './types'

/** Die Adresse, unter der iCloud seine Kalender anbietet. */
export const ICLOUD_CALDAV_URL = 'https://caldav.icloud.com/'

const DEFAULT_COLOR = '#1d8fe0'

/** Mitternacht in der lokalen Zeitzone. */
function localMidnight(dayNumber: number): Date {
  const [year, month, day] = toDateString(dayNumber).split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Liest und schreibt die Kalender eines iCloud-Kontos über CalDAV.
 *
 * Ein Termin ist eine `.ics`-Datei, seine ID ist ihre Adresse. Ein einzelnes
 * Vorkommen einer Serie hat die ID `<Adresse>#<ursprünglicher Beginn>`.
 * Beim Ändern bleibt in der Datei alles stehen, was die App nicht kennt
 * (Erinnerungen, Teilnehmer, Anhänge).
 */
export class ICloudProvider implements CalendarProvider {
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  constructor(
    private readonly client: CalDavClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  async listCalendars(): Promise<RemoteCalendar[]> {
    const calendars = await this.client.listCalendars()
    return calendars.map((calendar) => ({
      remoteId: calendar.url,
      name: calendar.name,
      color: calendar.color ?? DEFAULT_COLOR
    }))
  }

  private objects(calendarRemoteId: string, range: DayRange): Promise<CalDavObject[]> {
    return this.client.listObjects(
      calendarRemoteId,
      localMidnight(range.startDay),
      localMidnight(range.endDay)
    )
  }

  /** Wendet `map` auf jede Datei an. Eine kaputte Datei soll nicht den ganzen Kalender verhindern. */
  private mapAll(
    objects: CalDavObject[],
    map: (entry: CalDavObject) => ProviderEvent[]
  ): ProviderEvent[] {
    return objects.flatMap((entry) => {
      try {
        return map(entry)
      } catch {
        return []
      }
    })
  }

  async listEvents(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]> {
    const window = { start: localMidnight(range.startDay), end: localMidnight(range.endDay) }
    return this.mapAll(await this.objects(calendarRemoteId, range), (entry) =>
      displayEvents(entry.url, entry.data, window, this.timeZone)
    )
  }

  async listForSync(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]> {
    return this.mapAll(await this.objects(calendarRemoteId, range), (entry) => {
      const event = seriesEvent(entry.url, entry.data, this.timeZone)
      return event && event.status !== 'cancelled' ? [event] : []
    })
  }

  async getEvent(_calendarRemoteId: string, eventId: string): Promise<ProviderEvent | null> {
    const entry = await this.client.getObject(splitEventId(eventId).url)
    return entry ? this.read(eventId, entry.data) : null
  }

  private read(eventId: string, data: string): ProviderEvent | null {
    const { url, key } = splitEventId(eventId)
    const event = key
      ? occurrenceEvent(url, data, key, this.timeZone)
      : seriesEvent(url, data, this.timeZone)
    return event && event.status !== 'cancelled' ? event : null
  }

  /**
   * Liest den Termin nach dem Schreiben nochmals vom Server, damit der
   * Abgleich festhält, was dort wirklich steht.
   */
  private async written(eventId: string, sent: string): Promise<ProviderEvent> {
    const entry = await this.client.getObject(splitEventId(eventId).url).catch(() => null)
    const event = this.read(eventId, entry?.data ?? sent)
    if (!event) throw new Error('iCloud hat den gespeicherten Termin nicht zurückgegeben')
    return event
  }

  async createEvent(calendarRemoteId: string, event: NormalizedEvent): Promise<ProviderEvent> {
    const uid = randomUUID()
    const folder = calendarRemoteId.endsWith('/') ? calendarRemoteId : `${calendarRemoteId}/`
    const url = new URL(`${uid}.ics`, folder).toString()
    const data = buildCalendar(event, uid, this.now())
    await this.client.putObject(url, data, { create: true })
    return this.written(url, data)
  }

  async updateEvent(
    _calendarRemoteId: string,
    eventId: string,
    event: NormalizedEvent
  ): Promise<ProviderEvent> {
    const { url, key } = splitEventId(eventId)
    const entry = await this.client.getObject(url)
    if (!entry) throw new Error('Der Termin wurde in iCloud gelöscht')
    const data = key
      ? updateOccurrence(entry.data, key, event, this.now())
      : updateSeries(entry.data, event, this.now())
    await this.client.putObject(url, data, { etag: entry.etag })
    return this.written(eventId, data)
  }

  async deleteEvent(_calendarRemoteId: string, eventId: string): Promise<void> {
    const { url, key } = splitEventId(eventId)
    if (!key) {
      await this.client.deleteObject(url)
      return
    }
    const entry = await this.client.getObject(url)
    if (!entry) return
    await this.client.putObject(url, removeOccurrence(entry.data, key, this.now()), {
      etag: entry.etag
    })
  }
}
