import { SHOW_AS_VALUES } from '../shared/types'
import type { EventExtras, NormalizedEvent, ShowAs } from '../shared/types'
import { SERIES_INSTANCE } from './providers/types'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const RRULE = /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$/

function text(value: unknown, what: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new Error(`${what} muss Text sein`)
  if (value.length > max) throw new Error(`${what} ist zu lang (höchstens ${max} Zeichen)`)
  return value
}

/**
 * Prüft einen Termin, der von der Oberfläche kommt, und wandelt ihn ins
 * normalisierte Modell um. Alles Unerwartete wird abgelehnt.
 */
export function parseEventInput(input: unknown): NormalizedEvent {
  if (typeof input !== 'object' || input === null) throw new Error('Termin fehlt')
  const raw = input as Record<string, unknown>

  const title = text(raw.title, 'Der Titel', 500)?.trim() || '(Ohne Titel)'
  if (typeof raw.allDay !== 'boolean') throw new Error('allDay muss true oder false sein')
  if (typeof raw.start !== 'string' || typeof raw.end !== 'string') {
    throw new Error('Beginn und Ende fehlen')
  }

  let start = raw.start
  let end = raw.end
  if (raw.allDay) {
    if (!DATE.test(start) || !DATE.test(end)) throw new Error('Ungültiges Datum')
    if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
      throw new Error('Ungültiges Datum')
    }
    if (end <= start) throw new Error('Das Ende muss nach dem Beginn liegen')
  } else {
    const startTime = Date.parse(start)
    const endTime = Date.parse(end)
    if (!start.includes('T') || !end.includes('T') || Number.isNaN(startTime + endTime)) {
      throw new Error('Ungültiger Zeitpunkt')
    }
    if (endTime <= startTime) throw new Error('Das Ende muss nach dem Beginn liegen')
    // Immer als eindeutiger Zeitpunkt weitergeben, nie als «lokale Zeit».
    start = new Date(startTime).toISOString()
    end = new Date(endTime).toISOString()
  }

  const timeZone = text(raw.timeZone, 'Die Zeitzone', 64) ?? 'UTC'
  try {
    new Intl.DateTimeFormat('de-CH', { timeZone })
  } catch {
    throw new Error(`Unbekannte Zeitzone: ${timeZone}`)
  }

  const recurrence = text(raw.recurrence, 'Die Wiederholung', 200) ?? null
  // Ein einzelnes Vorkommen einer Serie trägt nur die Markierung, keine Regel.
  if (recurrence && recurrence !== SERIES_INSTANCE && !RRULE.test(recurrence)) {
    throw new Error('Ungültige Wiederholung')
  }

  return {
    title,
    description: text(raw.description, 'Die Notiz', 8000),
    location: text(raw.location, 'Der Ort', 500),
    start,
    end,
    allDay: raw.allDay,
    timeZone,
    recurrence,
    status: raw.showAs === 'tentative' ? 'tentative' : 'confirmed',
    ...parseExtras(raw)
  }
}

/** Google und Outlook erlauben Erinnerungen bis vier Wochen vorher. */
export const MAX_REMINDER_MINUTES = 40_320
const MAX_CATEGORIES = 25

/**
 * Prüft die Zusatzfelder eines Termins. Was fehlt, bleibt weg, damit es
 * beim Anbieter unverändert bleibt.
 */
export function parseExtras(raw: Record<string, unknown>): EventExtras {
  const extras: EventExtras = {}
  if (raw.showAs !== undefined) {
    if (!SHOW_AS_VALUES.includes(raw.showAs as ShowAs)) throw new Error('Ungültiges «Anzeigen als»')
    extras.showAs = raw.showAs as ShowAs
  }
  if (raw.private !== undefined) {
    if (typeof raw.private !== 'boolean') throw new Error('private muss true oder false sein')
    extras.private = raw.private
  }
  if (raw.reminderMinutes !== undefined) {
    const minutes = raw.reminderMinutes
    if (
      minutes !== null &&
      (typeof minutes !== 'number' ||
        !Number.isInteger(minutes) ||
        minutes < 0 ||
        minutes > MAX_REMINDER_MINUTES)
    ) {
      throw new Error('Ungültige Erinnerung')
    }
    extras.reminderMinutes = minutes
  }
  if (raw.categories !== undefined) {
    if (!Array.isArray(raw.categories) || raw.categories.length > MAX_CATEGORIES) {
      throw new Error('Ungültige Kategorien')
    }
    const names = raw.categories.map((name) => {
      // Komma und Semikolon trennen in Outlook die Kategorien.
      if (typeof name !== 'string' || !name.trim() || name.length > 60 || /[,;]/.test(name)) {
        throw new Error('Ungültiger Name einer Kategorie')
      }
      return name.trim()
    })
    extras.categories = [...new Set(names)]
  }
  return extras
}
