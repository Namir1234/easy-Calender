// Ansichten und Hilfen für den grossen Kalender.
import type { Calendar, CalendarEvent, Category } from '../../shared/types'

/** Die Ansichten, wie sie in Outlook heissen */
export type ViewName =
  'timeGridDay' | 'timeGridWorkWeek' | 'timeGridWeek' | 'dayGridMonth' | 'listMonth'

export const VIEWS: Array<{ name: ViewName; label: string }> = [
  { name: 'timeGridDay', label: 'Tag' },
  { name: 'timeGridWorkWeek', label: 'Arbeitswoche' },
  { name: 'timeGridWeek', label: 'Woche' },
  { name: 'dayGridMonth', label: 'Monat' },
  { name: 'listMonth', label: 'Liste' }
]

/** Lokales Datum als `YYYY-MM-DD`, ohne Umweg über UTC. */
export function toLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Die Farbe eines Termins: die seiner ersten Kategorie, sonst die des Kalenders (wie Outlook). */
export function eventColor(
  event: CalendarEvent,
  calendar: Calendar,
  categories: Category[]
): string {
  const byName = new Map(categories.map((category) => [category.name.toLowerCase(), category]))
  for (const name of event.categories ?? []) {
    const category = byName.get(name.toLowerCase())
    if (category) return category.color
  }
  return calendar.color
}
