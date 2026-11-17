import { SHOW_AS_VALUES } from '../../shared/types'
import type { EventExtras, EventStatus, NormalizedEvent, ShowAs } from '../../shared/types'
import { SERIES_INSTANCE, seriesRule, type ProviderEvent } from './types'

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
  updated?: string | null
  /** `transparent` heisst «frei» */
  transparency?: string | null
  /** `private` oder `confidential` heisst privat */
  visibility?: string | null
  reminders?: {
    useDefault?: boolean
    overrides?: GoogleReminder[]
  } | null
  extendedProperties?: {
    private?: Record<string, string>
    shared?: Record<string, string>
  } | null
}

type ExtrasBody = Pick<
  GoogleEvent,
  'transparency' | 'visibility' | 'reminders' | 'extendedProperties'
>

/** Eine Standard-Erinnerung eines Google-Kalenders */
export interface GoogleReminder {
  method?: string | null
  minutes?: number | null
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
 * Google kennt nur «frei» und «beschäftigt». Was die App genauer wissen
 * will («abwesend»), merkt sie sich in einer privaten Eigenschaft des Termins.
 */
const SHOW_AS_KEY = 'easyShowAs'
const CATEGORIES_KEY = 'easyCategories'

function readShowAs(event: GoogleEvent, status: EventStatus): ShowAs {
  const stored = event.extendedProperties?.private?.[SHOW_AS_KEY] as ShowAs | undefined
  const free = event.transparency === 'transparent'
  // Die gemerkte Angabe gilt nur, solange sie zu Googles eigener passt.
  if (stored && SHOW_AS_VALUES.includes(stored) && (stored === 'free') === free) return stored
  if (free) return 'free'
  return status === 'tentative' ? 'tentative' : 'busy'
}

function readCategories(event: GoogleEvent): string[] {
  const stored = event.extendedProperties?.private?.[CATEGORIES_KEY]
  if (!stored) return []
  try {
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === 'string') : []
  } catch {
    return []
  }
}

/** Die früheste Erinnerung als Popup. Ohne eigene gilt die Vorgabe des Kalenders. */
function readReminder(event: GoogleEvent, defaults: GoogleReminder[]): number | null {
  const list = event.reminders?.useDefault === false ? (event.reminders.overrides ?? []) : defaults
  const minutes = list
    .filter((reminder) => reminder.method !== 'email' && typeof reminder.minutes === 'number')
    .map((reminder) => reminder.minutes as number)
  return minutes.length > 0 ? Math.max(...minutes) : null
}

/**
 * Wandelt einen Google-Termin ins normalisierte Modell um.
 * Liefert `null` für Termine ohne ID oder ohne Zeitangabe, die sich nicht
 * anzeigen lassen. Abgesagte Termine werden mit Status `cancelled` geliefert.
 *
 * @param defaultReminders die Standard-Erinnerungen des Kalenders
 */
export function mapGoogleEvent(
  event: GoogleEvent,
  fallbackTimeZone: string,
  defaultReminders: GoogleReminder[] = []
): ProviderEvent | null {
  if (!event.id || !event.start || !event.end) return null

  const allDay = Boolean(event.start.date)
  const start = allDay ? event.start.date : event.start.dateTime
  const end = allDay ? event.end.date : event.end.dateTime
  if (!start || !end) return null

  const rule = event.recurrence?.find((line) => line.startsWith('RRULE:'))
  const status = STATUSES[event.status ?? ''] ?? 'confirmed'

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
    recurrence: rule
      ? rule.slice('RRULE:'.length)
      : event.recurringEventId
        ? SERIES_INSTANCE
        : null,
    status,
    updatedAt: event.updated ?? undefined,
    seriesId: event.recurringEventId ?? undefined,
    showAs: readShowAs(event, status),
    private: event.visibility === 'private' || event.visibility === 'confidential',
    reminderMinutes: readReminder(event, defaultReminders),
    categories: readCategories(event)
  }
}

/** Die Zusatzfelder in der Form, die Google erwartet. Fehlende Felder bleiben weg. */
function extrasBody(extras: EventExtras): ExtrasBody {
  const body: ExtrasBody = {}
  const stored: Record<string, string> = {}
  if (extras.showAs !== undefined) {
    body.transparency = extras.showAs === 'free' ? 'transparent' : 'opaque'
    stored[SHOW_AS_KEY] = extras.showAs
  }
  if (extras.private !== undefined) body.visibility = extras.private ? 'private' : 'default'
  if (extras.reminderMinutes !== undefined) {
    body.reminders = {
      useDefault: false,
      overrides:
        extras.reminderMinutes === null
          ? []
          : [{ method: 'popup', minutes: extras.reminderMinutes }]
    }
  }
  if (extras.categories !== undefined) stored[CATEGORIES_KEY] = JSON.stringify(extras.categories)
  // Google führt die Eigenschaften beim Ändern zusammen, andere bleiben erhalten.
  if (Object.keys(stored).length > 0) body.extendedProperties = { private: stored }
  return body
}

/**
 * Baut den Termin so, wie Google ihn beim Erstellen und Ändern erwartet.
 * Leere Felder gehen als leerer Text hinaus, damit ein Ändern sie auch leert.
 */
export function toGoogleBody(event: NormalizedEvent): GoogleEvent & {
  start: GoogleEventTime
  end: GoogleEventTime
} {
  const rule = seriesRule(event)
  const time = (value: string): GoogleEventTime =>
    event.allDay
      ? { date: value.slice(0, 10), dateTime: null, timeZone: null }
      : { dateTime: value, date: null, timeZone: event.timeZone }
  return {
    summary: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    start: time(event.start),
    end: time(event.end),
    // Ein einzelnes Vorkommen behält seine Serie: Das Feld bleibt dann weg.
    ...(rule
      ? { recurrence: [`RRULE:${rule}`] }
      : event.recurrence === null
        ? { recurrence: [] }
        : {}),
    ...extrasBody(event)
  }
}

/** Google liefert Farben als `#rrggbb`. Alles andere wird verworfen. */
export function normalizeColor(color: string | null | undefined, fallback: string): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback
}
