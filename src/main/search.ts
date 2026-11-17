import type { CalendarEvent } from '../shared/types'

/** Ob ein Termin alle Suchwörter in Titel, Ort, Notiz oder Kategorie enthält. Gross/klein egal. */
export function matchesSearch(event: CalendarEvent, query: string): boolean {
  const words = query.toLocaleLowerCase('de-CH').split(/\s+/).filter(Boolean)
  const haystack = [event.title, event.location, event.description, ...(event.categories ?? [])]
    .filter(Boolean)
    .join('\n')
    .toLocaleLowerCase('de-CH')
  return words.length > 0 && words.every((word) => haystack.includes(word))
}
