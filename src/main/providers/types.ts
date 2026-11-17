import type { NormalizedEvent } from '../../shared/types'
import type { DayRange } from '../dateRange'

/** Ein Termin, wie ihn ein Anbieter liefert: normalisiert, mit der ID beim Anbieter. */
export interface ProviderEvent extends NormalizedEvent {
  id: string
  /** Letzte Änderung beim Anbieter (ISO 8601). Entscheidet bei Konflikten im Sync. */
  updatedAt?: string
  /** Bei einem einzelnen Vorkommen: die ID der ganzen Serie */
  seriesId?: string
}

/** Gemeinsame Schnittstelle für alle Kalender-Anbieter. */
export interface CalendarProvider {
  /** Termine für die Anzeige. Serien sind in einzelne Vorkommen aufgelöst. */
  listEvents(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]>
  /**
   * Termine für den Abgleich: Einzeltermine im Zeitraum und Serien als
   * Ganzes (mit RRULE). Einzelne Vorkommen und Ausnahmen fehlen.
   */
  listForSync(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]>
  /** Liefert `null`, wenn es den Termin nicht mehr gibt. */
  getEvent(calendarRemoteId: string, eventId: string): Promise<ProviderEvent | null>
  createEvent(calendarRemoteId: string, event: NormalizedEvent): Promise<ProviderEvent>
  updateEvent(
    calendarRemoteId: string,
    eventId: string,
    event: NormalizedEvent
  ): Promise<ProviderEvent>
  deleteEvent(calendarRemoteId: string, eventId: string): Promise<void>
}

/** Markiert in der Anzeige ein einzelnes Vorkommen einer Serie. */
export const SERIES_INSTANCE = 'SERIE'

/** Die RRULE eines Termins, falls er selbst eine Serie ist. */
export function seriesRule(event: NormalizedEvent): string | null {
  return event.recurrence && event.recurrence !== SERIES_INSTANCE ? event.recurrence : null
}
