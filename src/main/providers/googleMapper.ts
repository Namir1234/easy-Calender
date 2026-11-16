import type { EventStatus } from '../../shared/types'
import type { ProviderEvent } from './types'

/** Die Felder eines Google-Termins, die die App liest. */
export interface GoogleEvent {
  id?: string | null
  status?: string | null
  summary?: string | null
  description?: string | null
  location?: string | null
  start?: GoogleEventTime | null
  end?: GoogleEventTime | null
  recurrence?: string[] | null
  recurringEventId?: string | null
}

interface GoogleEventTime {
  /** Ganztägig: `YYYY-MM-DD` */
  date?: string | null
  /** Mit Uhrzeit: RFC 3339 mit Zeitverschiebung */
  dateTime?: string | null
  timeZone?: string | null
}

const STATUSES: Record<string, EventStatus> = {
  confirmed: 'confirmed',
  tentative: 'tentative',
  cancelled: 'cancelled'
}

/**
 * Wandelt einen Google-Termin ins normalisierte Modell um.
 * Liefert `null` für Termine ohne ID oder ohne Zeitangabe, die sich nicht
 * anzeigen lassen. Abgesagte Termine werden mit Status `cancelled` geliefert.
 */
export function mapGoogleEvent(event: GoogleEvent, fallbackTimeZone: string): ProviderEvent | null {
  if (!event.id || !event.start || !event.end) return null

  const allDay = Boolean(event.start.date)
  const start = allDay ? event.start.date : event.start.dateTime
  const end = allDay ? event.end.date : event.end.dateTime
  if (!start || !end) return null

  const rule = event.recurrence?.find((line) => line.startsWith('RRULE:'))

  return {
    id: event.id,
    title: event.summary?.trim() || '(Ohne Titel)',
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start,
    end,
    allDay,
    timeZone: event.start.timeZone ?? fallbackTimeZone,
    // Einzelne Vorkommen einer Serie tragen keine Regel, nur den Verweis auf die Serie.
    recurrence: rule ? rule.slice('RRULE:'.length) : event.recurringEventId ? 'SERIE' : null,
    status: STATUSES[event.status ?? ''] ?? 'confirmed'
  }
}

/** Google liefert Farben als `#rrggbb`. Alles andere wird verworfen. */
export function normalizeColor(color: string | null | undefined, fallback: string): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback
}
