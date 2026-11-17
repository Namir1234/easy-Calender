import type { Account, Calendar, SyncPair } from '../../shared/types'
import type { EventLink } from '../sync/engine'
import type { SeedAccount, Store } from './store'

/** Hält Konten und Kalender nur im Arbeitsspeicher. Nichts wird gespeichert. */
export class MemoryStore implements Store {
  readonly mode = 'memory' as const
  private accounts: Account[] = []
  private calendars: Calendar[] = []
  private pairs: SyncPair[] = []
  private links: Array<EventLink & { pairId: string }> = []
  private nextId = 1

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
    for (const entry of seed) await this.saveAccount(entry)
  }

  async saveAccount(entry: SeedAccount): Promise<Account> {
    let account = this.accounts.find(
      (existing) => existing.provider === entry.provider && existing.email === entry.email
    )
    if (!account) {
      account = { id: `mem-account-${this.nextId++}`, provider: entry.provider, email: entry.email }
      this.accounts.push(account)
    }
    const accountId = account.id

    const remoteIds = new Set(entry.calendars.map((calendar) => calendar.remoteId))
    this.calendars = this.calendars.filter(
      (calendar) => calendar.accountId !== accountId || remoteIds.has(calendar.remoteId)
    )
    for (const remote of entry.calendars) {
      const existing = this.calendars.find(
        (calendar) => calendar.accountId === accountId && calendar.remoteId === remote.remoteId
      )
      if (existing) {
        existing.name = remote.name
        existing.color = remote.color
      } else {
        this.calendars.push({
          id: `mem-calendar-${this.nextId++}`,
          accountId,
          remoteId: remote.remoteId,
          name: remote.name,
          color: remote.color,
          syncEnabled: false,
          visible: true
        })
      }
    }
    return { ...account }
  }

  async removeAccount(accountId: string): Promise<Account> {
    const account = this.accounts.find((entry) => entry.id === accountId)
    if (!account) throw new Error(`Konto ${accountId} nicht gefunden`)
    this.accounts = this.accounts.filter((entry) => entry.id !== accountId)
    this.calendars = this.calendars.filter((calendar) => calendar.accountId !== accountId)
    // Wie in der Datenbank: Paare verschwinden mit ihren Kalendern.
    const calendarIds = new Set(this.calendars.map((calendar) => calendar.id))
    for (const pair of [...this.pairs]) {
      if (!calendarIds.has(pair.calendarAId) || !calendarIds.has(pair.calendarBId)) {
        await this.removeSyncPair(pair.id)
      }
    }
    return { ...account }
  }

  async removeDemoAccounts(): Promise<void> {
    const demoIds = this.accounts
      .filter((entry) => entry.provider === 'demo')
      .map((entry) => entry.id)
    for (const id of demoIds) await this.removeAccount(id)
  }

  async listSyncPairs(): Promise<SyncPair[]> {
    return this.pairs.map((pair) => ({ ...pair }))
  }

  async addSyncPair(calendarAId: string, calendarBId: string): Promise<SyncPair> {
    const existing = this.pairs.find(
      (pair) => pair.calendarAId === calendarAId && pair.calendarBId === calendarBId
    )
    if (existing) return { ...existing }
    const pair = { id: `mem-pair-${this.nextId++}`, calendarAId, calendarBId }
    this.pairs.push(pair)
    return { ...pair }
  }

  async removeSyncPair(pairId: string): Promise<void> {
    this.pairs = this.pairs.filter((pair) => pair.id !== pairId)
    this.links = this.links.filter((link) => link.pairId !== pairId)
  }

  async listLinks(pairId: string): Promise<EventLink[]> {
    return this.links
      .filter((link) => link.pairId === pairId)
      .map((link) => ({
        id: link.id,
        aId: link.aId,
        bId: link.bId,
        aHash: link.aHash,
        bHash: link.bHash
      }))
  }

  async saveLink(pairId: string, link: EventLink): Promise<void> {
    if (link.id) {
      this.links = this.links.map((entry) => (entry.id === link.id ? { ...link, pairId } : entry))
    } else {
      this.links.push({ ...link, id: `mem-link-${this.nextId++}`, pairId })
    }
  }

  async removeLink(linkId: string): Promise<void> {
    this.links = this.links.filter((link) => link.id !== linkId)
  }
}
