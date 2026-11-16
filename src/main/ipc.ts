import { ipcMain } from 'electron'
import type { Account, Calendar, CalendarEvent, DbStatus } from '../shared/types'
import { parseDateRange } from './dateRange'
import type { StoreContext } from './db'
import type { CalendarProvider } from './providers/types'

/**
 * Registriert die API für den Renderer. Die Datenquelle wird im Hintergrund
 * verbunden, darum warten alle Handler zuerst auf `ready`.
 * Alles, was vom Renderer kommt, wird hier geprüft.
 */
export function registerIpc(ready: Promise<StoreContext>, provider: CalendarProvider): void {
  ipcMain.handle('app:status', async (): Promise<DbStatus> => (await ready).status)

  ipcMain.handle('accounts:list', async (): Promise<Account[]> => {
    const { store } = await ready
    return store.listAccounts()
  })

  ipcMain.handle('calendars:list', async (): Promise<Calendar[]> => {
    const { store } = await ready
    return store.listCalendars()
  })

  ipcMain.handle(
    'calendars:setVisible',
    async (_event, calendarId: unknown, visible: unknown): Promise<void> => {
      if (typeof calendarId !== 'string' || calendarId.length === 0 || calendarId.length > 100) {
        throw new Error('Ungültige Kalender-ID')
      }
      if (typeof visible !== 'boolean') throw new Error('visible muss true oder false sein')
      const { store } = await ready
      await store.setCalendarVisible(calendarId, visible)
    }
  )

  ipcMain.handle('events:list', async (_event, input: unknown): Promise<CalendarEvent[]> => {
    const range = parseDateRange(input)
    const { store } = await ready
    const calendars = await store.listCalendars()
    const perCalendar = await Promise.all(
      calendars.map(async (calendar) => {
        const events = await provider.listEvents(calendar.remoteId, range)
        return events.map((event) => ({ ...event, calendarId: calendar.id }))
      })
    )
    return perCalendar.flat()
  })
}
