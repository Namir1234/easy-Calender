import { SHOW_AS_VALUES } from '../../shared/types'
import type { EventExtras, NormalizedEvent, ShowAs } from '../../shared/types'
import { graphToRrule, rruleToGraph, type GraphRecurrence } from './microsoftRecurrence'
import { SERIES_INSTANCE, seriesRule, type ProviderEvent } from './types'

interface GraphTime {
  dateTime?: string | null
  timeZone?: string | null
}

/** Die Felder eines Outlook-Termins, die die App liest. */
export interface GraphEvent {
  id?: string | null
  subject?: string | null
  body?: { contentType?: string | null; content?: string | null } | null
  location?: { displayName?: string | null } | null
  start?: GraphTime | null
  end?: GraphTime | null
  isAllDay?: boolean | null
  isCancelled?: boolean | null
  showAs?: string | null
  /** `singleInstance`, `occurrence`, `exception` oder `seriesMaster` */
  type?: string | null
  recurrence?: GraphRecurrence | null
  lastModifiedDateTime?: string | null
  seriesMasterId?: string | null
  /** `normal`, `personal`, `private` oder `confidential` */
  sensitivity?: string | null
  isReminderOn?: boolean | null
  reminderMinutesBeforeStart?: number | null
  categories?: string[] | null
}

/**
 * Wandelt einen Outlook-Termin ins normalisierte Modell um. Die App fragt
 * Graph immer in UTC ab, darum sind die Zeiten hier UTC ohne Zeitzonenangabe.
 * Liefert `null` für Termine ohne ID oder Zeit und für nicht abbildbare Serien.
 */
export function mapGraphEvent(event: GraphEvent, timeZone: string): ProviderEvent | null {
  const start = event.start?.dateTime
  const end = event.end?.dateTime
  if (!event.id || !start || !end) return null

  const allDay = Boolean(event.isAllDay)
  let recurrence: string | null = null
  if (event.type === 'seriesMaster') {
    recurrence = graphToRrule(event.recurrence)
    if (!recurrence) return null
  } else if (event.type === 'occurrence' || event.type === 'exception') {
    recurrence = SERIES_INSTANCE
  }

  return {
    id: event.id,
    title: event.subject?.trim() || '(Ohne Titel)',
    description: event.body?.content?.trim() || undefined,
    location: event.location?.displayName?.trim() || undefined,
    start: allDay ? start.slice(0, 10) : `${start.slice(0, 19)}Z`,
    end: allDay ? end.slice(0, 10) : `${end.slice(0, 19)}Z`,
    allDay,
    timeZone,
    recurrence,
    status: event.isCancelled
      ? 'cancelled'
      : event.showAs === 'tentative'
        ? 'tentative'
        : 'confirmed',
    updatedAt: event.lastModifiedDateTime ?? undefined,
    seriesId: event.seriesMasterId ?? undefined,
    showAs: SHOW_AS_VALUES.includes(event.showAs as ShowAs) ? (event.showAs as ShowAs) : 'busy',
    private: event.sensitivity === 'private' || event.sensitivity === 'confidential',
    reminderMinutes: event.isReminderOn ? (event.reminderMinutesBeforeStart ?? 15) : null,
    categories: event.categories ?? []
  }
}

/** Die Zusatzfelder in der Form, die Graph erwartet. Fehlende Felder bleiben weg. */
function extrasBody(extras: EventExtras): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (extras.showAs !== undefined) body.showAs = extras.showAs
  if (extras.private !== undefined) body.sensitivity = extras.private ? 'private' : 'normal'
  if (extras.reminderMinutes !== undefined) {
    body.isReminderOn = extras.reminderMinutes !== null
    if (extras.reminderMinutes !== null) body.reminderMinutesBeforeStart = extras.reminderMinutes
  }
  if (extras.categories !== undefined) body.categories = extras.categories
  return body
}

/** Die Uhrzeit eines Zeitpunkts in einer Zeitzone, als `YYYY-MM-DDTHH:mm:ss`. */
export function wallTime(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(instant))
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

/**
 * Baut den Termin so, wie Graph ihn beim Erstellen und Ändern erwartet.
 * Zeiten gehen in der Zeitzone des Termins hinaus, damit eine Serie auch
 * über die Zeitumstellung hinweg zur selben Uhrzeit stattfindet.
 */
export function toGraphBody(event: NormalizedEvent): Record<string, unknown> {
  const rule = seriesRule(event)
  const start = event.allDay
    ? { dateTime: `${event.start.slice(0, 10)}T00:00:00`, timeZone: 'UTC' }
    : { dateTime: wallTime(event.start, event.timeZone), timeZone: event.timeZone }
  const end = event.allDay
    ? { dateTime: `${event.end.slice(0, 10)}T00:00:00`, timeZone: 'UTC' }
    : { dateTime: wallTime(event.end, event.timeZone), timeZone: event.timeZone }

  return {
    subject: event.title,
    body: { contentType: 'text', content: event.description ?? '' },
    location: { displayName: event.location ?? '' },
    isAllDay: event.allDay,
    start,
    end,
    // Ein einzelnes Vorkommen behält seine Serie: Das Feld bleibt dann weg.
    ...(rule
      ? { recurrence: rruleToGraph(rule, start.dateTime.slice(0, 10)) }
      : event.recurrence === null
        ? { recurrence: null }
        : {}),
    ...extrasBody(event)
  }
}
