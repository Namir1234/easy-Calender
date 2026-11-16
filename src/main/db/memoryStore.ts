import type { Account, Calendar } from '../../shared/types'
import type { SeedAccount, Store } from './store'

/** Hält Konten und Kalender nur im Arbeitsspeicher. Nichts wird gespeichert. */
export class MemoryStore implements Store {
  readonly mode = 'memory' as const
  private accounts: Account[] = []
  private calendars: Calendar[] = []

  async listAccounts(): Promise<Account[]> {
    return this.accounts.map((account) => ({ ...account }))
  }

  async listCalendars(): Promise<Calendar[]> {
    return this.calendars.map((calendar) => ({ ...calendar }))
  }

  async setCalendarVisible(calendarId: string, visible: boolean): Promise<void> {
    const calendar = this.calendars.find((entry) => entry.id === calendarId)
    if (!calendar) throw new Error(`Kalender ${calendarId} nicht gefunden`)
    calendar.visible = visible
  }

  async seedIfEmpty(seed: SeedAccount[]): Promise<void> {
    if (this.accounts.length > 0) return
    seed.forEach((entry, accountIndex) => {
      const accountId = `mem-account-${accountIndex + 1}`
      this.accounts.push({ id: accountId, provider: entry.provider, email: entry.email })
      entry.calendars.forEach((calendar, calendarIndex) => {
        this.calendars.push({
          id: `mem-calendar-${accountIndex + 1}-${calendarIndex + 1}`,
          accountId,
          remoteId: calendar.remoteId,
          name: calendar.name,
          color: calendar.color,
          syncEnabled: false,
          visible: true
        })
      })
    })
  }
}
