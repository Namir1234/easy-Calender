import type { SupabaseClient } from '@supabase/supabase-js'
import type { Account, Calendar, ProviderId } from '../../shared/types'
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

    const { data: accounts, error: accountError } = await this.client
      .from('accounts')
      .insert(seed.map((entry) => ({ provider: entry.provider, email: entry.email })))
      .select('id, provider, email')
    if (accountError) {
      throw new Error(`Demo-Konten konnten nicht angelegt werden: ${accountError.message}`)
    }

    const calendarRows = seed.flatMap((entry) => {
      const account = (accounts as AccountRow[]).find(
        (row) => row.provider === entry.provider && row.email === entry.email
      )
      if (!account) return []
      return entry.calendars.map((calendar) => ({
        account_id: account.id,
        remote_id: calendar.remoteId,
        name: calendar.name,
        color: calendar.color
      }))
    })

    const { error: calendarError } = await this.client.from('calendars').insert(calendarRows)
    if (calendarError) {
      throw new Error(`Demo-Kalender konnten nicht angelegt werden: ${calendarError.message}`)
    }
  }
}
