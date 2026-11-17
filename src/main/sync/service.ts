import { PROVIDER_LABELS, type Account, type Calendar, type SyncStatus } from '../../shared/types'
import type { DayRange } from '../dateRange'
import type { Store } from '../db/store'
import type { CalendarProvider } from '../providers/types'
import { syncPair, type SyncResult, type SyncSide } from './engine'

/** Abgeglichen wird von vor einem Monat bis in einem Jahr. */
const DAYS_BACK = 30
const DAYS_AHEAD = 365
const INTERVAL_MS = 5 * 60_000
/** Nach einer Änderung in der App wird kurz gewartet, falls gleich noch eine folgt. */
const SOON_MS = 3_000

export interface SyncServiceOptions {
  store: Store
  providerFor(account: Account): CalendarProvider
  /** Heutige Tagesnummer. Für Tests austauschbar. */
  today?: () => number
  onChange?: (status: SyncStatus) => void
}

function side(
  label: string,
  provider: CalendarProvider,
  calendar: Calendar,
  range: DayRange
): SyncSide {
  const id = calendar.remoteId
  return {
    label,
    list: () => provider.listForSync(id, range),
    get: (eventId) => provider.getEvent(id, eventId),
    create: (event) => provider.createEvent(id, event),
    update: (eventId, event) => provider.updateEvent(id, eventId, event),
    remove: (eventId) => provider.deleteEvent(id, eventId)
  }
}

function summarize(total: SyncResult, pairs: number): string {
  if (pairs === 0) return 'Es sind keine Kalender zum Abgleichen verbunden.'
  const parts = [
    total.created && `${total.created} neu`,
    total.updated && `${total.updated} geändert`,
    total.deleted && `${total.deleted} gelöscht`,
    total.linked && `${total.linked} verknüpft`
  ].filter(Boolean)
  return parts.length > 0 ? `Abgeglichen: ${parts.join(', ')}.` : 'Alles auf dem gleichen Stand.'
}

/**
 * Gleicht alle Kalenderpaare ab: auf Wunsch, alle fünf Minuten und kurz
 * nach einer Änderung in der App. Es läuft immer nur ein Abgleich.
 */
export class SyncService {
  private status: SyncStatus = { running: false, lastRun: null, summary: null, problems: [] }
  private current: Promise<SyncStatus> | null = null
  private interval: NodeJS.Timeout | null = null
  private soon: NodeJS.Timeout | null = null

  constructor(private readonly options: SyncServiceOptions) {}

  getStatus(): SyncStatus {
    return { ...this.status, problems: [...this.status.problems] }
  }

  /** Startet den regelmässigen Abgleich. */
  start(): void {
    this.interval ??= setInterval(() => void this.run(), INTERVAL_MS)
    this.runSoon()
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval)
    if (this.soon) clearTimeout(this.soon)
    this.interval = this.soon = null
  }

  /** Plant einen Abgleich in wenigen Sekunden. */
  runSoon(): void {
    if (this.soon) clearTimeout(this.soon)
    this.soon = setTimeout(() => void this.run(), SOON_MS)
  }

  /** Gleicht jetzt ab. Läuft schon ein Abgleich, wird auf diesen gewartet. */
  run(): Promise<SyncStatus> {
    this.current ??= this.runOnce().finally(() => (this.current = null))
    return this.current
  }

  private setStatus(status: SyncStatus): void {
    this.status = status
    this.options.onChange?.(this.getStatus())
  }

  private async runOnce(): Promise<SyncStatus> {
    this.setStatus({ ...this.status, running: true })
    const total: SyncResult = { created: 0, updated: 0, deleted: 0, linked: 0, problems: [] }
    let pairCount = 0

    try {
      const { store, providerFor } = this.options
      const pairs = await store.listSyncPairs()
      pairCount = pairs.length
      if (pairCount > 0) {
        const today = this.options.today?.() ?? Math.floor(Date.now() / 86_400_000)
        const range = { startDay: today - DAYS_BACK, endDay: today + DAYS_AHEAD }
        const [accounts, calendars] = await Promise.all([
          store.listAccounts(),
          store.listCalendars()
        ])
        const calendarById = new Map(calendars.map((calendar) => [calendar.id, calendar]))
        const accountById = new Map(accounts.map((account) => [account.id, account]))

        for (const pair of pairs) {
          const calendarA = calendarById.get(pair.calendarAId)
          const calendarB = calendarById.get(pair.calendarBId)
          const name = `${calendarA?.name ?? '?'} ↔ ${calendarB?.name ?? '?'}`
          try {
            const accountA = calendarA && accountById.get(calendarA.accountId)
            const accountB = calendarB && accountById.get(calendarB.accountId)
            if (!calendarA || !calendarB || !accountA || !accountB) {
              throw new Error('Ein Kalender dieses Paars fehlt')
            }
            // In Meldungen heisst eine Seite nach ihrem Anbieter. Haben beide
            // Seiten denselben, kommt der Name des Kalenders dazu.
            const same = accountA.provider === accountB.provider
            const label = (account: Account, calendar: Calendar): string =>
              same
                ? `${PROVIDER_LABELS[account.provider]} «${calendar.name}»`
                : PROVIDER_LABELS[account.provider]
            const result = await syncPair(
              side(label(accountA, calendarA), providerFor(accountA), calendarA, range),
              side(label(accountB, calendarB), providerFor(accountB), calendarB, range),
              {
                list: () => store.listLinks(pair.id),
                save: (link) => store.saveLink(pair.id, link),
                remove: async (link) => {
                  if (link.id) await store.removeLink(link.id)
                }
              }
            )
            total.created += result.created
            total.updated += result.updated
            total.deleted += result.deleted
            total.linked += result.linked
            total.problems.push(...result.problems.map((problem) => `${name}: ${problem}`))
          } catch (error) {
            total.problems.push(
              `${name}: ${error instanceof Error ? error.message : String(error)}`
            )
          }
        }
      }
    } catch (error) {
      total.problems.push(error instanceof Error ? error.message : String(error))
    }

    this.setStatus({
      running: false,
      lastRun: new Date().toISOString(),
      summary: summarize(total, pairCount),
      problems: total.problems.slice(0, 20)
    })
    return this.getStatus()
  }
}
