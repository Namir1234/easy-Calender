import type { SupabaseClient } from '@supabase/supabase-js'
import type { Account, Calendar, ProviderId, SyncPair } from '../../shared/types'
import type { EventLink } from '../sync/engine'
import type { SeedAccount, Store } from './store'

interface AccountRow {
  id: string
  provider: ProviderId
  email: string
}

interface CalendarRow {
  id: string
  account_id: string
  remote_id: string
  name: string
  color: string | null
  sync_enabled: boolean
  visible: boolean
}

interface PairRow {
  id: string
  google_calendar_id: string
  ms_calendar_id: string
}

/**
 * Die Spalten `google_etag` und `ms_changekey` halten fest, wie der Termin
 * auf der jeweiligen Seite beim letzten Abgleich aussah (als Fingerabdruck).
 */
interface LinkRow {
  id: string
  google_event_id: string
  ms_event_id: string
  google_etag: string | null
  ms_changekey: string | null
}

const toPair = (row: PairRow): SyncPair => ({
  id: row.id,
  googleCalendarId: row.google_calendar_id,
  msCalendarId: row.ms_calendar_id
})

const DEFAULT_COLOR = '#2563a8'

/**
 * Speichert Konten und Kalender in Supabase. Die Zeilen gehören dem
 * angemeldeten Supabase-Benutzer, die Zugriffsregeln (RLS) stehen in
 * `supabase/migrations`.
 */
export class SupabaseStore implements Store {
  readonly mode = 'supabase' as const

  constructor(private readonly client: SupabaseClient) {}

  async listAccounts(): Promise<Account[]> {
    const { data, error } = await this.client
      .from('accounts')
      .select('id, provider, email')
      .order('created_at')
    if (error) throw new Error(`Konten konnten nicht geladen werden: ${error.message}`)
    return (data as AccountRow[]).map((row) => ({
      id: row.id,
      provider: row.provider,
      email: row.email
    }))
  }

  async listCalendars(): Promise<Calendar[]> {
    const { data, error } = await this.client
      .from('calendars')
      .select('id, account_id, remote_id, name, color, sync_enabled, visible')
      .order('name')
    if (error) throw new Error(`Kalender konnten nicht geladen werden: ${error.message}`)
    return (data as CalendarRow[]).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      remoteId: row.remote_id,
      name: row.name,
      color: row.color ?? DEFAULT_COLOR,
      syncEnabled: row.sync_enabled,
      visible: row.visible
    }))
  }

  async setCalendarVisible(calendarId: string, visible: boolean): Promise<void> {
    const { data, error } = await this.client
      .from('calendars')
      .update({ visible })
      .eq('id', calendarId)
      .select('id')
    if (error) throw new Error(`Kalender konnte nicht geändert werden: ${error.message}`)
    if (!data || data.length === 0) throw new Error(`Kalender ${calendarId} nicht gefunden`)
  }

  async seedIfEmpty(seed: SeedAccount[]): Promise<void> {
    const { count, error: countError } = await this.client
      .from('accounts')
      .select('id', { count: 'exact', head: true })
    if (countError) throw new Error(`Konten konnten nicht gezählt werden: ${countError.message}`)
    if ((count ?? 0) > 0) return

    for (const entry of seed) await this.saveAccount(entry)
  }

  async saveAccount(entry: SeedAccount): Promise<Account> {
    const account = await this.findOrCreateAccount(entry)

    const { data: existing, error: listError } = await this.client
      .from('calendars')
      .select('id, remote_id')
      .eq('account_id', account.id)
    if (listError) throw new Error(`Kalender konnten nicht geladen werden: ${listError.message}`)

    // Bestehende Kalender behalten ihre Einstellungen (sichtbar, Sync),
    // weil nur Name und Farbe überschrieben werden.
    if (entry.calendars.length > 0) {
      const { error: upsertError } = await this.client.from('calendars').upsert(
        entry.calendars.map((calendar) => ({
          account_id: account.id,
          remote_id: calendar.remoteId,
          name: calendar.name,
          color: calendar.color
        })),
        { onConflict: 'account_id,remote_id' }
      )
      if (upsertError) {
        throw new Error(`Kalender konnten nicht gespeichert werden: ${upsertError.message}`)
      }
    }

    const remoteIds = new Set(entry.calendars.map((calendar) => calendar.remoteId))
    const goneIds = (existing as Array<{ id: string; remote_id: string }>)
      .filter((row) => !remoteIds.has(row.remote_id))
      .map((row) => row.id)
    if (goneIds.length > 0) {
      const { error: deleteError } = await this.client.from('calendars').delete().in('id', goneIds)
      if (deleteError) {
        throw new Error(`Alte Kalender konnten nicht entfernt werden: ${deleteError.message}`)
      }
    }

    return account
  }

  async removeAccount(accountId: string): Promise<Account> {
    // Die Kalender des Kontos löscht die Datenbank mit (on delete cascade).
    const { data, error } = await this.client
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .select('id, provider, email')
    if (error) throw new Error(`Konto konnte nicht entfernt werden: ${error.message}`)
    const [row] = data as AccountRow[]
    if (!row) throw new Error(`Konto ${accountId} nicht gefunden`)
    return { id: row.id, provider: row.provider, email: row.email }
  }

  async removeDemoAccounts(): Promise<void> {
    const { error } = await this.client.from('accounts').delete().eq('provider', 'demo')
    if (error) throw new Error(`Demo-Konten konnten nicht entfernt werden: ${error.message}`)
  }

  async listSyncPairs(): Promise<SyncPair[]> {
    const { data, error } = await this.client
      .from('sync_pairs')
      .select('id, google_calendar_id, ms_calendar_id')
      .order('created_at')
    if (error) throw new Error(`Kalenderpaare konnten nicht geladen werden: ${error.message}`)
    return (data as PairRow[]).map(toPair)
  }

  async addSyncPair(googleCalendarId: string, msCalendarId: string): Promise<SyncPair> {
    const { data, error } = await this.client
      .from('sync_pairs')
      .upsert(
        { google_calendar_id: googleCalendarId, ms_calendar_id: msCalendarId },
        { onConflict: 'google_calendar_id,ms_calendar_id' }
      )
      .select('id, google_calendar_id, ms_calendar_id')
      .single()
    if (error) throw new Error(`Kalenderpaar konnte nicht gespeichert werden: ${error.message}`)
    return toPair(data as PairRow)
  }

  async removeSyncPair(pairId: string): Promise<void> {
    // Die Verknüpfungen des Paars löscht die Datenbank mit (on delete cascade).
    const { error } = await this.client.from('sync_pairs').delete().eq('id', pairId)
    if (error) throw new Error(`Kalenderpaar konnte nicht entfernt werden: ${error.message}`)
  }

  async listLinks(pairId: string): Promise<EventLink[]> {
    const links: EventLink[] = []
    // Supabase liefert höchstens 1000 Zeilen pro Abfrage, darum seitenweise.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.client
        .from('event_links')
        .select('id, google_event_id, ms_event_id, google_etag, ms_changekey')
        .eq('pair_id', pairId)
        .order('id')
        .range(from, from + 999)
      if (error) throw new Error(`Verknüpfungen konnten nicht geladen werden: ${error.message}`)
      for (const row of data as LinkRow[]) {
        links.push({
          id: row.id,
          aId: row.google_event_id,
          bId: row.ms_event_id,
          aHash: row.google_etag ?? '',
          bHash: row.ms_changekey ?? ''
        })
      }
      if (data.length < 1000) break
    }
    return links
  }

  async saveLink(pairId: string, link: EventLink): Promise<void> {
    const row = {
      pair_id: pairId,
      google_event_id: link.aId,
      ms_event_id: link.bId,
      google_etag: link.aHash,
      ms_changekey: link.bHash,
      updated_at: new Date().toISOString()
    }
    const { error } = link.id
      ? await this.client.from('event_links').update(row).eq('id', link.id)
      : await this.client.from('event_links').insert(row)
    if (error) throw new Error(`Verknüpfung konnte nicht gespeichert werden: ${error.message}`)
  }

  async removeLink(linkId: string): Promise<void> {
    const { error } = await this.client.from('event_links').delete().eq('id', linkId)
    if (error) throw new Error(`Verknüpfung konnte nicht entfernt werden: ${error.message}`)
  }

  private async findOrCreateAccount(entry: SeedAccount): Promise<Account> {
    const { data: found, error: findError } = await this.client
      .from('accounts')
      .select('id, provider, email')
      .eq('provider', entry.provider)
      .eq('email', entry.email)
      .limit(1)
    if (findError) throw new Error(`Konto konnte nicht gesucht werden: ${findError.message}`)
    const [existing] = found as AccountRow[]
    if (existing) return { id: existing.id, provider: existing.provider, email: existing.email }

    const { data: created, error: createError } = await this.client
      .from('accounts')
      .insert({
        provider: entry.provider,
        email: entry.email,
        // Verweis auf das lokal gespeicherte Token, nie das Token selbst
        token_ref: entry.provider === 'demo' ? null : `${entry.provider}:${entry.email}`
      })
      .select('id, provider, email')
      .single()
    if (createError) throw new Error(`Konto konnte nicht angelegt werden: ${createError.message}`)
    const row = created as AccountRow
    return { id: row.id, provider: row.provider, email: row.email }
  }
}
