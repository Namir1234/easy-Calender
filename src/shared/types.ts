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
  /** Aus der App entfernt: erscheint weder in der Liste noch im Kalender */
  hidden?: boolean
  /** Von diesem Kalender werden nur ganztägige Termine gezeigt */
  allDayOnly?: boolean
}

/** Einstellungen eines Kalenders, die nur auf diesem Gerät gelten. */
export interface CalendarOptions {
  hidden?: boolean
  allDayOnly?: boolean
  /** Eigene Farbe (`#rrggbb`). Ohne Angabe gilt die Farbe des Anbieters. */
  color?: string
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

/** Was die Oberfläche beim Erstellen oder Ändern eines Termins schickt. */
export interface EventInput {
  title: string
  description?: string
  location?: string
  /** Ganztägig: `YYYY-MM-DD`. Sonst ein Zeitpunkt nach ISO 8601 mit Zeitverschiebung. */
  start: string
  /** Wie `start`. Bei ganztägigen Terminen exklusiv. */
  end: string
  allDay: boolean
  timeZone: string
  /**
   * RRULE einer neuen Serie, `null` für Einzeltermine. Beim Ändern eines
   * einzelnen Vorkommens bleibt der Wert, wie er geliefert wurde.
   */
  recurrence: string | null
}

/** Ein Google-Kalender und ein Outlook-Kalender, die abgeglichen werden. */
export interface SyncPair {
  id: string
  googleCalendarId: string
  msCalendarId: string
}

export interface SyncStatus {
  running: boolean
  /** Zeitpunkt des letzten Abgleichs (ISO 8601), `null` vor dem ersten */
  lastRun: string | null
  /** Was der letzte Abgleich getan hat, in einem Satz */
  summary: string | null
  problems: string[]
}

export interface Settings {
  /** Die App startet mit Windows, im Hintergrund */
  autostart: boolean
  /** Fenster schliessen beendet die App nicht, sie läuft im Infobereich weiter */
  closeToTray: boolean
  /** Einstellungen pro Kalender, nach der ID des Kalenders in der App */
  calendars: Record<string, CalendarOptions>
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
  /** Wie `connectGoogle`, für ein Microsoft-Konto (Outlook). */
  connectMicrosoft(): Promise<Account>
  /** Öffnet die Seite der laufenden Anmeldung nochmals im Browser. */
  reopenLogin(): Promise<void>
  /** Kopiert die Adresse der laufenden Anmeldung in die Zwischenablage. */
  copyLoginLink(): Promise<void>
  cancelLogin(): Promise<void>
  removeAccount(accountId: string): Promise<void>
  listCalendars(): Promise<Calendar[]>
  setCalendarVisible(calendarId: string, visible: boolean): Promise<void>
  /** Ersetzt die Einstellungen eines Kalenders (Farbe, entfernt, nur ganztägig). */
  setCalendarOptions(calendarId: string, options: CalendarOptions): Promise<void>
  /** Legt in einem Outlook-Konto einen neuen, leeren Kalender an. */
  createCalendar(accountId: string, name: string): Promise<void>
  listEvents(range: DateRange): Promise<EventsResult>
  createEvent(calendarId: string, input: EventInput): Promise<CalendarEvent>
  updateEvent(calendarId: string, eventId: string, input: EventInput): Promise<CalendarEvent>
  deleteEvent(calendarId: string, eventId: string): Promise<void>
  listSyncPairs(): Promise<SyncPair[]>
  addSyncPair(googleCalendarId: string, msCalendarId: string): Promise<SyncPair>
  removeSyncPair(pairId: string): Promise<void>
  /** Gleicht alle Kalenderpaare jetzt ab und wartet auf das Ergebnis. */
  syncNow(): Promise<SyncStatus>
  getSyncStatus(): Promise<SyncStatus>
  getSettings(): Promise<Settings>
  setSettings(settings: Settings): Promise<Settings>
}
