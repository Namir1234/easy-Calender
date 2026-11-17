import type { CalendarEvent } from '../shared/types'

/** Wie oft nachgesehen wird, ob eine Erinnerung fällig ist. */
const TICK_MS = 30_000
/** Wie oft die Termine neu geladen werden. */
const REFRESH_MS = 5 * 60_000
/** Was länger als so lange fällig ist (z. B. weil der PC schlief), wird nicht mehr gemeldet. */
const LATE_MS = 15 * 60_000

/** Der Beginn eines Termins als Zeitpunkt. Ganztägige beginnen um Mitternacht in lokaler Zeit. */
export function startTime(event: CalendarEvent): number {
  if (!event.allDay) return Date.parse(event.start)
  const [year, month, day] = event.start.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

/** Ein Schlüssel pro Vorkommen und Erinnerungszeit. Ändert sich die Zeit, wird neu erinnert. */
export function reminderKey(event: CalendarEvent): string {
  return `${event.calendarId}|${event.id}|${event.start}|${event.reminderMinutes}`
}

/**
 * Die Termine, deren Erinnerung jetzt fällig ist: Der Zeitpunkt ist erreicht,
 * liegt nicht zu weit zurück, und es wurde noch nicht erinnert.
 */
export function dueReminders(
  events: CalendarEvent[],
  now: number,
  fired: ReadonlySet<string>
): CalendarEvent[] {
  return events.filter((event) => {
    if (typeof event.reminderMinutes !== 'number' || event.status === 'cancelled') return false
    const at = startTime(event) - event.reminderMinutes * 60_000
    return at <= now && now - at <= LATE_MS && !fired.has(reminderKey(event))
  })
}

/** Text der Mitteilung: wann der Termin beginnt, aus Sicht von jetzt. */
export function reminderText(event: CalendarEvent, now: number): string {
  const start = startTime(event)
  const time = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' }).format(
    start
  )
  const where = event.location ? ` · ${event.location}` : ''
  if (event.allDay) {
    const day = new Intl.DateTimeFormat('de-CH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(start)
    return `Ganztägig, ${day}${where}`
  }
  const minutes = Math.round((start - now) / 60_000)
  if (minutes <= 0) return `Jetzt, ${time} Uhr${where}`
  if (minutes < 60) return `In ${minutes} Min., ${time} Uhr${where}`
  return `${time} Uhr${where}`
}

export interface ReminderOptions {
  /** Termine der nächsten Tage, an die die App erinnern soll */
  load(): Promise<CalendarEvent[]>
  notify(event: CalendarEvent, text: string): void
  enabled(): boolean
  now?: () => number
}

/**
 * Erinnert an Termine mit einer Windows-Mitteilung. Die Termine werden alle
 * fünf Minuten geladen, fällige Erinnerungen alle 30 Sekunden geprüft.
 */
export class ReminderService {
  private events: CalendarEvent[] = []
  private readonly fired = new Set<string>()
  private timers: NodeJS.Timeout[] = []
  private loading: Promise<void> | null = null

  constructor(private readonly options: ReminderOptions) {}

  start(): void {
    if (this.timers.length > 0) return
    void this.refresh()
    this.timers = [
      setInterval(() => this.check(), TICK_MS),
      setInterval(() => void this.refresh(), REFRESH_MS)
    ]
  }

  stop(): void {
    for (const timer of this.timers) clearInterval(timer)
    this.timers = []
  }

  /** Lädt die Termine neu, z. B. nach einer Änderung in der App. */
  refresh(): Promise<void> {
    this.loading ??= this.options
      .load()
      .then((events) => {
        this.events = events
        this.check()
      })
      .catch(() => {
        // Ein Fehler beim Laden zeigt sich in der Oberfläche. Hier wird es später nochmals versucht.
      })
      .finally(() => {
        this.loading = null
      })
    return this.loading
  }

  check(): void {
    if (!this.options.enabled()) return
    const now = this.options.now?.() ?? Date.now()
    for (const event of dueReminders(this.events, now, this.fired)) {
      this.fired.add(reminderKey(event))
      this.options.notify(event, reminderText(event, now))
    }
  }
}
