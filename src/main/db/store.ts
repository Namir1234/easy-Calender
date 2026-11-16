import type { Account, Calendar, ProviderId, SyncPair } from '../../shared/types'
import type { EventLink } from '../sync/engine'

/** Ein Kalender, wie ihn ein Anbieter meldet, noch ohne Datenbank-ID. */
export interface RemoteCalendar {
  remoteId: string
  name: string
  color: string
}

/** Ein Konto mit seinen Kalendern, noch ohne Datenbank-IDs. */
export interface SeedAccount {
  provider: ProviderId
  email: string
  calendars: RemoteCalendar[]
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
  /**
   * Legt ein Konto an oder aktualisiert es und gleicht seine Kalender ab:
   * neue kommen dazu, bestehende behalten ihre Einstellungen, verschwundene
   * werden entfernt.
   */
  saveAccount(account: SeedAccount): Promise<Account>
  /** Entfernt ein Konto mit seinen Kalendern und gibt es zurück. */
  removeAccount(accountId: string): Promise<Account>
  /** Entfernt alle Demo-Konten. */
  removeDemoAccounts(): Promise<void>

  listSyncPairs(): Promise<SyncPair[]>
  addSyncPair(googleCalendarId: string, msCalendarId: string): Promise<SyncPair>
  /** Entfernt ein Paar samt seinen Verknüpfungen. Die Termine selbst bleiben. */
  removeSyncPair(pairId: string): Promise<void>
  /** Die Verknüpfungen eines Paars. Seite A ist Google, Seite B ist Outlook. */
  listLinks(pairId: string): Promise<EventLink[]>
  saveLink(pairId: string, link: EventLink): Promise<void>
  removeLink(linkId: string): Promise<void>
}
