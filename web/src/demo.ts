import type { CalendarEvent, EventInput } from '../../src/shared/types'
import type { CalendarBackend, WebCalendar } from './google/api'

/** Mit `?demo` in der Adresse läuft die App ohne Google, mit Beispielterminen. */
export const DEMO = new URLSearchParams(window.location.search).has('demo')

const pad = (value: number): string => String(value).padStart(2, '0')
const day = (offset: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const at = (offset: number, hour: number, minute = 0): string => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const calendar = (id: string, name: string, color: string, primary = false): WebCalendar => ({
  id,
  accountId: 'demo',
  remoteId: id,
  name,
  color,
  syncEnabled: false,
  visible: true,
  primary,
  writable: true
})

const base = { timeZone: 'Europe/Zurich', recurrence: null, status: 'confirmed' as const }

/** Beispieldaten, nur im Speicher. Nichts geht ins Netz. */
export class DemoBackend implements CalendarBackend {
  private calendars = [
    calendar('privat', 'Privat', '#2563a8', true),
    calendar('schule', 'Schule BMS', '#1f7a4d'),
    calendar('arbeit', 'Noser Young', '#8a5a00')
  ]
  private events: CalendarEvent[] = [
    {
      ...base,
      id: 'd1',
      calendarId: 'privat',
      title: 'Zahnarzt',
      start: at(1, 14),
      end: at(1, 15),
      allDay: false,
      location: 'Zürich'
    },
    {
      ...base,
      id: 'd2',
      calendarId: 'schule',
      title: 'Mathematik',
      start: at(0, 8),
      end: at(0, 9, 30),
      allDay: false
    },
    {
      ...base,
      id: 'd3',
      calendarId: 'schule',
      title: 'Probeprüfung',
      start: at(2, 15, 20),
      end: at(2, 17),
      allDay: false
    },
    {
      ...base,
      id: 'd4',
      calendarId: 'arbeit',
      title: 'Arbeit',
      start: day(3),
      end: day(4),
      allDay: true
    },
    {
      ...base,
      id: 'd5',
      calendarId: 'privat',
      title: 'Kino mit Lea',
      start: at(4, 20),
      end: at(4, 22),
      allDay: false,
      location: 'Pathé'
    }
  ]
  private next = 100

  async listCalendars(): Promise<WebCalendar[]> {
    return this.calendars
  }

  async listEvents(calendarId: string, start: string, end: string): Promise<CalendarEvent[]> {
    return this.events.filter(
      (event) =>
        event.calendarId === calendarId &&
        event.end.slice(0, 10) >= start &&
        event.start.slice(0, 10) < end
    )
  }

  async createEvent(calendarId: string, input: EventInput): Promise<void> {
    this.events.push({ ...input, status: 'confirmed', id: `d${this.next++}`, calendarId })
  }

  async updateEvent(calendarId: string, eventId: string, input: EventInput): Promise<void> {
    this.events = this.events.map((event) =>
      event.id === eventId && event.calendarId === calendarId ? { ...event, ...input } : event
    )
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    this.events = this.events.filter(
      (event) => !(event.id === eventId && event.calendarId === calendarId)
    )
  }
}
