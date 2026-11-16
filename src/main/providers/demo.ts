import type { NormalizedEvent } from '../../shared/types'
import { toDateString, toDayNumber, type DayRange } from '../dateRange'
import type { CalendarProvider, ProviderEvent } from './types'

const TIME_ZONE = 'Europe/Zurich'

interface DayInfo {
  /** 0 = Sonntag … 6 = Samstag */
  weekday: number
  dayOfMonth: number
  /** Fortlaufende Wochennummer, für Termine alle zwei Wochen */
  weekIndex: number
}

interface Template {
  key: string
  title: string
  location?: string
  description?: string
  /** `[von, bis]` als `HH:mm`. Fehlt die Angabe, ist der Termin ganztägig. */
  time?: [string, string]
  recurrence: string
  matches(day: DayInfo): boolean
}

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function weekly(weekdays: number[]): Pick<Template, 'recurrence' | 'matches'> {
  return {
    recurrence: `FREQ=WEEKLY;BYDAY=${weekdays.map((weekday) => WEEKDAY_CODES[weekday]).join(',')}`,
    matches: (day) => weekdays.includes(day.weekday)
  }
}

function everySecondWeek(weekday: number): Pick<Template, 'recurrence' | 'matches'> {
  return {
    recurrence: `FREQ=WEEKLY;INTERVAL=2;BYDAY=${WEEKDAY_CODES[weekday]}`,
    matches: (day) => day.weekday === weekday && day.weekIndex % 2 === 0
  }
}

function monthly(dayOfMonth: number): Pick<Template, 'recurrence' | 'matches'> {
  return {
    recurrence: `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`,
    matches: (day) => day.dayOfMonth === dayOfMonth
  }
}

const TEMPLATES: Record<string, Template[]> = {
  'demo-privat': [
    { key: 'znacht', title: 'Znacht mit der Familie', time: ['18:30', '20:00'], ...weekly([0]) },
    {
      key: 'coiffeur',
      title: 'Coiffeur',
      location: 'Zürich',
      time: ['17:15', '18:00'],
      ...monthly(8)
    },
    { key: 'miete', title: 'Miete überweisen', ...monthly(25) }
  ],
  'demo-sport': [
    {
      key: 'training',
      title: 'Fussballtraining',
      location: 'Sportplatz',
      time: ['18:30', '20:00'],
      ...weekly([2, 4])
    },
    {
      key: 'match',
      title: 'Match',
      location: 'Sportplatz',
      time: ['14:00', '16:00'],
      ...everySecondWeek(6)
    }
  ],
  'demo-schule': [
    {
      key: 'modul',
      title: 'Modul Applikationsentwicklung',
      time: ['08:00', '11:30'],
      ...weekly([1])
    },
    { key: 'mathe', title: 'Mathematik', time: ['13:00', '16:15'], ...weekly([3]) },
    {
      key: 'abgabe',
      title: 'Abgabe Projektarbeit',
      description: 'Dokumentation und Code einreichen',
      ...monthly(20)
    }
  ],
  'demo-firma': [
    { key: 'daily', title: 'Daily Standup', time: ['09:00', '09:15'], ...weekly([2, 3, 4, 5]) },
    {
      key: 'review',
      title: 'Sprint Review',
      location: 'Sitzungszimmer 2',
      time: ['14:00', '15:00'],
      ...everySecondWeek(5)
    }
  ]
}

function describeDay(dayNumber: number): DayInfo {
  const date = new Date(dayNumber * 86_400_000)
  return {
    weekday: date.getUTCDay(),
    dayOfMonth: date.getUTCDate(),
    // Der 1.1.1970 war ein Donnerstag. Mit +3 beginnt jede Woche am Montag.
    weekIndex: Math.floor((dayNumber + 3) / 7)
  }
}

/**
 * Liefert erfundene Termine für die Demo-Kalender. Die Termine werden aus
 * festen Vorlagen berechnet: gleicher Zeitraum, gleiche Termine. Eigene
 * Termine lassen sich zum Ausprobieren anlegen, sie leben aber nur bis zum
 * Beenden der App.
 */
export class DemoProvider implements CalendarProvider {
  private readonly own = new Map<string, { calendar: string; event: ProviderEvent }>()
  private nextId = 1

  async listEvents(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]> {
    const templates = TEMPLATES[calendarRemoteId] ?? []
    const events: ProviderEvent[] = []

    for (let dayNumber = range.startDay; dayNumber < range.endDay; dayNumber++) {
      const day = describeDay(dayNumber)
      const date = toDateString(dayNumber)

      for (const template of templates) {
        if (!template.matches(day)) continue
        const allDay = !template.time
        events.push({
          id: `${calendarRemoteId}:${template.key}:${date}`,
          title: template.title,
          description: template.description,
          location: template.location,
          start: template.time ? `${date}T${template.time[0]}:00` : date,
          end: template.time ? `${date}T${template.time[1]}:00` : toDateString(dayNumber + 1),
          allDay,
          timeZone: TIME_ZONE,
          recurrence: template.recurrence,
          status: 'confirmed'
        })
      }
    }

    for (const { calendar, event } of this.own.values()) {
      if (calendar !== calendarRemoteId) continue
      const startDay = toDayNumber(event.allDay ? event.start : localDate(event.start))
      const endDay = toDayNumber(event.allDay ? event.end : localDate(event.end))
      if (startDay < range.endDay && endDay >= range.startDay) events.push({ ...event })
    }

    return events
  }

  listForSync(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]> {
    return this.listEvents(calendarRemoteId, range)
  }

  async getEvent(_calendarRemoteId: string, eventId: string): Promise<ProviderEvent | null> {
    const entry = this.own.get(eventId)
    return entry ? { ...entry.event } : null
  }

  async createEvent(calendarRemoteId: string, event: NormalizedEvent): Promise<ProviderEvent> {
    const created = { ...event, recurrence: null, id: `demo-eigen-${this.nextId++}` }
    this.own.set(created.id, { calendar: calendarRemoteId, event: created })
    return { ...created }
  }

  async updateEvent(
    calendarRemoteId: string,
    eventId: string,
    event: NormalizedEvent
  ): Promise<ProviderEvent> {
    this.requireOwn(eventId)
    const updated = { ...event, recurrence: null, id: eventId }
    this.own.set(eventId, { calendar: calendarRemoteId, event: updated })
    return { ...updated }
  }

  async deleteEvent(_calendarRemoteId: string, eventId: string): Promise<void> {
    this.requireOwn(eventId)
    this.own.delete(eventId)
  }

  private requireOwn(eventId: string): void {
    if (!this.own.has(eventId)) {
      throw new Error('Die Beispieltermine lassen sich nicht ändern. Verbinde ein eigenes Konto.')
    }
  }
}

/** Das lokale Datum eines Zeitpunkts als `YYYY-MM-DD`. */
function localDate(instant: string): string {
  const date = new Date(instant)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${String(date.getDate()).padStart(2, '0')}`
}
