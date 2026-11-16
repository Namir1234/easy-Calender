import type { Account, Calendar, ProviderId } from '../../shared/types'

/** Ein Demo-Konto mit seinen Kalendern, noch ohne Datenbank-IDs. */
export interface SeedAccount {
  provider: ProviderId
  email: string
  calendars: Array<{ remoteId: string; name: string; color: string }>
}

/**
 * Zugriff auf die gespeicherten Konten und Kalender.
 * Es gibt zwei Umsetzungen: Supabase (Normalfall) und Arbeitsspeicher
 * (solange Supabase nicht eingerichtet ist, und für Tests).
 */
export interface Store {
  readonly mode: 'supabase' | 'memory'
  listAccounts(): Promise<Account[]>
  listCalendars(): Promise<Calendar[]>
  setCalendarVisible(calendarId: string, visible: boolean): Promise<void>
  /** Legt die Demo-Konten an, falls noch gar kein Konto existiert. */
  seedIfEmpty(seed: SeedAccount[]): Promise<void>
}
