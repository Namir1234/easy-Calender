import type { NormalizedEvent } from '../../shared/types'
import { toDateString, type DayRange } from '../dateRange'
import type { RemoteCalendar } from '../db/store'
import { mapGraphEvent, toGraphBody, type GraphEvent } from './microsoftMapper'
import type { CalendarProvider, ProviderEvent } from './types'

const GRAPH = 'https://graph.microsoft.com/v1.0'
const DEFAULT_COLOR = '#0f6cbd'
const MAX_PAGES = 30
const FIELDS =
  'id,subject,body,location,start,end,isAllDay,isCancelled,showAs,type,recurrence,lastModifiedDateTime,' +
  'seriesMasterId,sensitivity,isReminderOn,reminderMinutesBeforeStart,categories'

// Zeiten immer in UTC, Notizen als reiner Text, und IDs, die sich nicht
// ändern, wenn ein Termin verschoben wird.
const PREFER = 'outlook.timezone="UTC", outlook.body-content-type="text", IdType="ImmutableId"'

/** Die Farbnamen, die Outlook für Kalender ohne eigene Farbe meldet. */
const PRESET_COLORS: Record<string, string> = {
  lightBlue: '#4a90d9',
  lightGreen: '#3f9b5c',
  lightOrange: '#d9822b',
  lightGray: '#7a828e',
  lightYellow: '#b89b1d',
  lightTeal: '#1f9c9c',
  lightPink: '#c9538e',
  lightBrown: '#9a6b4b',
  lightRed: '#cf4a3c'
}

interface GraphCalendar {
  id?: string
  name?: string
  color?: string
  hexColor?: string
}

interface Page<T> {
  value?: T[]
  '@odata.nextLink'?: string
}

function localMidnight(dayNumber: number): string {
  const [year, month, day] = toDateString(dayNumber).split('-').map(Number)
  return new Date(year, month - 1, day).toISOString()
}

/** Liest und schreibt Kalender und Termine eines Microsoft-Kontos (Graph API). */
export class MicrosoftProvider implements CalendarProvider {
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  /** @param getToken liefert ein gültiges Access-Token */
  constructor(private readonly getToken: () => Promise<string>) {}

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    allowMissing = false
  ): Promise<T | null> {
    const response = await fetch(url.startsWith('https://') ? url : `${GRAPH}${url}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.getToken()}`,
        Prefer: PREFER,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (allowMissing && (response.status === 404 || response.status === 410)) return null
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: { message?: string; code?: string }
      } | null
      if (allowMissing && data?.error?.code === 'ErrorItemNotFound') return null
      throw new Error(
        `Outlook meldet einen Fehler (${response.status}): ${data?.error?.message ?? response.statusText}`
      )
    }
    return response.status === 204 ? null : ((await response.json()) as T)
  }

  private async pages<T>(firstUrl: string): Promise<T[]> {
    const items: T[] = []
    let url: string | undefined = firstUrl
    for (let page = 0; page < MAX_PAGES && url; page++) {
      const data: Page<T> | null = await this.request<Page<T>>('GET', url)
      items.push(...(data?.value ?? []))
      url = data?.['@odata.nextLink']
    }
    return items
  }

  private events(calendarRemoteId: string): string {
    return `/me/calendars/${encodeURIComponent(calendarRemoteId)}/events`
  }

  async listCalendars(): Promise<RemoteCalendar[]> {
    const calendars = await this.pages<GraphCalendar>('/me/calendars?$top=100')
    return calendars
      .filter((calendar) => calendar.id)
      .map((calendar) => ({
        remoteId: calendar.id!,
        name: calendar.name ?? 'Kalender',
        color: /^#[0-9a-f]{6}$/i.test(calendar.hexColor ?? '')
          ? calendar.hexColor!.toLowerCase()
          : (PRESET_COLORS[calendar.color ?? ''] ?? DEFAULT_COLOR)
      }))
  }

  async listEvents(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]> {
    const query = new URLSearchParams({
      startDateTime: localMidnight(range.startDay),
      endDateTime: localMidnight(range.endDay),
      $select: FIELDS,
      $top: '200'
    })
    const items = await this.pages<GraphEvent>(
      `/me/calendars/${encodeURIComponent(calendarRemoteId)}/calendarView?${query}`
    )
    return items.flatMap((item) => {
      const event = mapGraphEvent(item, this.timeZone)
      return event && event.status !== 'cancelled' ? [event] : []
    })
  }

  async listForSync(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]> {
    const from = Date.parse(localMidnight(range.startDay))
    const to = Date.parse(localMidnight(range.endDay))
    const query = new URLSearchParams({ $select: FIELDS, $top: '100' })
    const items = await this.pages<GraphEvent>(`${this.events(calendarRemoteId)}?${query}`)

    return items.flatMap((item) => {
      // Ausnahmen einer Serie werden nicht einzeln abgeglichen.
      if (item.type !== 'singleInstance' && item.type !== 'seriesMaster') return []
      const event = mapGraphEvent(item, this.timeZone)
      if (!event || event.status === 'cancelled') return []

      if (item.type === 'seriesMaster') {
        const range = item.recurrence?.range
        const ended = range?.type === 'endDate' && range.endDate && Date.parse(range.endDate) < from
        return ended ? [] : [event]
      }
      const start = Date.parse(event.start)
      const end = Date.parse(event.end)
      return end > from && start < to ? [event] : []
    })
  }

  async getEvent(calendarRemoteId: string, eventId: string): Promise<ProviderEvent | null> {
    const item = await this.request<GraphEvent>(
      'GET',
      `${this.events(calendarRemoteId)}/${encodeURIComponent(eventId)}?$select=${FIELDS}`,
      undefined,
      true
    )
    const event = item && mapGraphEvent(item, this.timeZone)
    return event && event.status !== 'cancelled' ? event : null
  }

  async createEvent(calendarRemoteId: string, event: NormalizedEvent): Promise<ProviderEvent> {
    const item = await this.request<GraphEvent>(
      'POST',
      this.events(calendarRemoteId),
      toGraphBody(event)
    )
    return this.written(item, event)
  }

  async updateEvent(
    calendarRemoteId: string,
    eventId: string,
    event: NormalizedEvent
  ): Promise<ProviderEvent> {
    const item = await this.request<GraphEvent>(
      'PATCH',
      `${this.events(calendarRemoteId)}/${encodeURIComponent(eventId)}`,
      toGraphBody(event)
    )
    return this.written(item, event)
  }

  async deleteEvent(calendarRemoteId: string, eventId: string): Promise<void> {
    await this.request(
      'DELETE',
      `${this.events(calendarRemoteId)}/${encodeURIComponent(eventId)}`,
      undefined,
      true
    )
  }

  private written(item: GraphEvent | null, sent: NormalizedEvent): ProviderEvent {
    const event = item && mapGraphEvent(item, sent.timeZone)
    if (!event) throw new Error('Outlook hat den gespeicherten Termin nicht zurückgegeben')
    return event
  }
}
