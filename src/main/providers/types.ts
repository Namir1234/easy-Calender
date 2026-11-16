import type { NormalizedEvent } from '../../shared/types'
import type { DayRange } from '../dateRange'

/** Ein Termin, wie ihn ein Anbieter liefert: normalisiert, mit der ID beim Anbieter. */
export interface ProviderEvent extends NormalizedEvent {
  id: string
}

/**
 * Gemeinsame Schnittstelle für alle Kalender-Anbieter.
 * In Etappe 1 gibt es nur das Lesen. Delta-Abfragen sowie Erstellen,
 * Ändern und Löschen kommen in den Etappen 2 bis 5 dazu.
 */
export interface CalendarProvider {
  listEvents(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]>
}
