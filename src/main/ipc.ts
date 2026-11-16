import { ipcMain } from 'electron'
import type { Account, Calendar, CalendarEvent, DbStatus, EventsResult } from '../shared/types'
import type { AccountService } from './accounts'
import { parseDateRange } from './dateRange'
import type { StoreContext } from './db'

export interface AppContext extends StoreContext {
  accounts: AccountService
}

function requireId(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) {
    throw new Error(`Ungültige ${what}`)
  }
  return value
}

/**
 * Registriert die API für den Renderer. Die Datenquelle wird im Hintergrund
 * verbunden, darum warten alle Handler zuerst auf `ready`.
 * Alles, was vom Renderer kommt, wird hier geprüft.
 */
export function registerIpc(ready: Promise<AppContext>): void {
  ipcMain.handle('app:status', async (): Promise<DbStatus> => (await ready).status)

  ipcMain.handle('accounts:list', async (): Promise<Account[]> => {
    const { store } = await ready
    return store.listAccounts()
  })

  ipcMain.handle('accounts:connectGoogle', async (): Promise<Account> => {
    const { accounts } = await ready
    return accounts.connectGoogle()
  })

  ipcMain.handle('accounts:remove', async (_event, accountId: unknown): Promise<void> => {
    const id = requireId(accountId, 'Konto-ID')
    const { accounts } = await ready
    await accounts.remove(id)
  })

  ipcMain.handle('calendars:list', async (): Promise<Calendar[]> => {
    const { store } = await ready
    return store.listCalendars()
  })

  ipcMain.handle(
    'calendars:setVisible',
    async (_event, calendarId: unknown, visible: unknown): Promise<void> => {
      const id = requireId(calendarId, 'Kalender-ID')
      if (typeof visible !== 'boolean') throw new Error('visible muss true oder false sein')
      const { store } = await ready
      await store.setCalendarVisible(id, visible)
    }
  )

  ipcMain.handle('events:list', async (_event, input: unknown): Promise<EventsResult> => {
    const range = parseDateRange(input)
    const { store, accounts } = await ready
    const [accountList, calendars] = await Promise.all([
      store.listAccounts(),
      store.listCalendars()
    ])
    const accountById = new Map(accountList.map((account) => [account.id, account]))

    // Fällt ein Kalender aus (kein Netz, Anmeldung abgelaufen), werden die
    // anderen trotzdem angezeigt. Ausgeblendete Kalender werden nicht abgefragt.
    const events: CalendarEvent[] = []
    const problems: string[] = []
    await Promise.all(
      calendars
        .filter((calendar) => calendar.visible)
        .map(async (calendar) => {
          try {
            const account = accountById.get(calendar.accountId)
            if (!account) return
            const loaded = await accounts.providerFor(account).listEvents(calendar.remoteId, range)
            for (const event of loaded) events.push({ ...event, calendarId: calendar.id })
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            problems.push(`${calendar.name}: ${reason}`)
          }
        })
    )
    return { events, problems }
  })
}
