// Typen, die Main-Prozess, Preload und Renderer gemeinsam verwenden.

export type ProviderId = 'google' | 'microsoft' | 'demo'

export interface Account {
  id: string
  provider: ProviderId
  email: string
}

export interface Calendar {
  id: string
  accountId: string
  /** ID des Kalenders beim Anbieter */
  remoteId: string
  name: string
  color: string
  syncEnabled: boolean
  /** Ob der Kalender in der kombinierten Ansicht angezeigt wird */
  visible: boolean
}

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled'

/**
 * Das normalisierte Event-Modell. Beide Anbieter werden darauf abgebildet,
 * gesynct wird nur diese Teilmenge an Feldern.
 */
export interface NormalizedEvent {
  title: string
  description?: string
  location?: string
  /**
   * Ganztägig: `YYYY-MM-DD`. Sonst ein Zeitpunkt nach ISO 8601, mit
   * Zeitverschiebung (`2026-11-17T09:00:00+01:00`) oder ohne (dann lokale Zeit).
   */
  start: string
  /** Wie `start`. Bei ganztägigen Terminen exklusiv (der Tag danach). */
  end: string
  allDay: boolean
  timeZone: string
  /** Wiederholung als RRULE, `null` bei Einzelterminen */
  recurrence: string | null
  status: EventStatus
}

export interface CalendarEvent extends NormalizedEvent {
  id: string
  calendarId: string
}

export interface DateRange {
  /** ISO-Datum oder -Zeitpunkt, inklusiv */
  start: string
  /** ISO-Datum oder -Zeitpunkt, exklusiv */
  end: string
}

export interface DbStatus {
  /** `supabase`: Daten liegen in Supabase. `memory`: nur Demo-Daten im Arbeitsspeicher. */
  mode: 'supabase' | 'memory'
  /** `false`, wenn Supabase konfiguriert ist, aber nicht erreicht werden konnte */
  ok: boolean
  message: string
}

/** Termine für einen Zeitraum, dazu Meldungen zu Kalendern, die nicht geladen werden konnten. */
export interface EventsResult {
  events: CalendarEvent[]
  problems: string[]
}

/** Die schmale API, die der Renderer über `window.api` bekommt. */
export interface AppApi {
  getStatus(): Promise<DbStatus>
  listAccounts(): Promise<Account[]>
  /** Öffnet die Google-Anmeldung im Browser und wartet, bis sie abgeschlossen ist. */
  connectGoogle(): Promise<Account>
  removeAccount(accountId: string): Promise<void>
  listCalendars(): Promise<Calendar[]>
  setCalendarVisible(calendarId: string, visible: boolean): Promise<void>
  listEvents(range: DateRange): Promise<EventsResult>
}
