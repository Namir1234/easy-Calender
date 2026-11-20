import { ipcMain } from 'electron'
import type {
  Account,
  AssistantReply,
  AssistantStatus,
  Calendar,
  CalendarEvent,
  DbStatus,
  EventsResult,
  ProviderId,
  Settings,
  SyncPair,
  SyncStatus
} from '../shared/types'
import type { AccountService } from './accounts'
import { AssistantService, parseTurns } from './assistant/service'
import { parseDateRange } from './dateRange'
import type { StoreContext } from './db'
import { parseEventInput } from './eventInput'
import type { CalendarProvider } from './providers/types'
import { parseCalendarOptions, parseSettings } from './settings'
import type { SyncService } from './sync/service'

export interface AppContext extends StoreContext {
  accounts: AccountService
  sync: SyncService
}

export interface SettingsAccess {
  get(): Settings
  set(settings: Settings): Settings
}

function requireId(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1100) {
    throw new Error(`Ungültige ${what}`)
  }
  return value
}

/**
 * Registriert die API für den Renderer. Die Datenquelle wird im Hintergrund
 * verbunden, darum warten alle Handler zuerst auf `ready`.
 * Alles, was vom Renderer kommt, wird hier geprüft.
 */
export function registerIpc(ready: Promise<AppContext>, settings: SettingsAccess): void {
  /** Sucht zu einem Kalender der App den Anbieter und die ID beim Anbieter. */
  async function target(
    calendarId: unknown,
    expected?: ProviderId
  ): Promise<{ calendar: Calendar; provider: CalendarProvider }> {
    const id = requireId(calendarId, 'Kalender-ID')
    const { store, accounts } = await ready
    const calendar = (await store.listCalendars()).find((entry) => entry.id === id)
    const account =
      calendar && (await store.listAccounts()).find((entry) => entry.id === calendar.accountId)
    if (!calendar || !account) throw new Error('Kalender nicht gefunden')
    if (expected && account.provider !== expected) {
      throw new Error(
        expected === 'google'
          ? 'Hier wird ein Google-Kalender erwartet'
          : 'Hier wird ein Outlook-Kalender erwartet'
      )
    }
    return { calendar, provider: accounts.providerFor(account) }
  }

  /** Ergänzt einen Kalender um das, was auf diesem Gerät für ihn eingestellt ist. */
  const withOptions = (calendar: Calendar): Calendar => {
    const options = settings.get().calendars[calendar.id] ?? {}
    return {
      ...calendar,
      color: options.color ?? calendar.color,
      hidden: Boolean(options.hidden),
      allDayOnly: Boolean(options.allDayOnly),
      background: Boolean(options.background)
    }
  }

  // Der Assistent trägt nur in Kalender ein, die in der App sichtbar sind.
  const assistant = new AssistantService({
    listAccounts: async () => (await ready).store.listAccounts(),
    listCalendars: async () =>
      (await (await ready).store.listCalendars())
        .map(withOptions)
        .filter((calendar) => calendar.visible && !calendar.hidden)
  })

  ipcMain.handle('assistant:status', (): Promise<AssistantStatus> => assistant.status())

  ipcMain.handle('assistant:ask', (_event, turns: unknown): Promise<AssistantReply> =>
    assistant.ask(parseTurns(turns))
  )

  ipcMain.handle('app:status', async (): Promise<DbStatus> => (await ready).status)

  ipcMain.handle('accounts:list', async (): Promise<Account[]> => {
    const { store } = await ready
    return store.listAccounts()
  })

  ipcMain.handle('accounts:connectGoogle', async (): Promise<Account> => {
    const { accounts } = await ready
    return accounts.connectGoogle()
  })

  ipcMain.handle('accounts:connectMicrosoft', async (): Promise<Account> => {
    const { accounts } = await ready
    return accounts.connectMicrosoft()
  })

  ipcMain.handle('accounts:reopenLogin', async (): Promise<void> => {
    await (await ready).accounts.reopenLogin()
  })

  ipcMain.handle('accounts:copyLoginLink', async (): Promise<void> => {
    const { accounts } = await ready
    accounts.copyLoginLink()
  })

  ipcMain.handle('accounts:cancelLogin', async (): Promise<void> => {
    const { accounts } = await ready
    accounts.cancelLogin()
  })

  ipcMain.handle('accounts:remove', async (_event, accountId: unknown): Promise<void> => {
    const id = requireId(accountId, 'Konto-ID')
    const { accounts } = await ready
    await accounts.remove(id)
  })

  ipcMain.handle('calendars:list', async (): Promise<Calendar[]> => {
    const { store } = await ready
    return (await store.listCalendars()).map(withOptions)
  })

  ipcMain.handle(
    'calendars:setOptions',
    async (_event, calendarId: unknown, input: unknown): Promise<void> => {
      const { calendar } = await target(calendarId)
      const options = parseCalendarOptions(input)
      const current = settings.get()
      const calendars = { ...current.calendars }
      if (Object.keys(options).length > 0) calendars[calendar.id] = options
      else delete calendars[calendar.id]
      settings.set({ ...current, calendars })
    }
  )

  ipcMain.handle(
    'calendars:create',
    async (_event, accountId: unknown, name: unknown): Promise<void> => {
      const id = requireId(accountId, 'Konto-ID')
      if (typeof name !== 'string' || !name.trim() || name.length > 60) {
        throw new Error('Der Name muss 1 bis 60 Zeichen lang sein')
      }
      const { accounts } = await ready
      await accounts.createCalendar(id, name.trim())
    }
  )

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
        .map(withOptions)
        .filter((calendar) => calendar.visible && !calendar.hidden)
        .map(async (calendar) => {
          try {
            const account = accountById.get(calendar.accountId)
            if (!account) return
            const loaded = await accounts.providerFor(account).listEvents(calendar.remoteId, range)
            for (const event of loaded) {
              if (calendar.allDayOnly && !event.allDay) continue
              events.push({ ...event, calendarId: calendar.id })
            }
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            problems.push(`${calendar.name}: ${reason}`)
          }
        })
    )
    return { events, problems }
  })

  ipcMain.handle(
    'events:create',
    async (_event, calendarId: unknown, input: unknown): Promise<CalendarEvent> => {
      const event = parseEventInput(input)
      const { calendar, provider } = await target(calendarId)
      const created = await provider.createEvent(calendar.remoteId, event)
      ;(await ready).sync.runSoon()
      return { ...created, calendarId: calendar.id }
    }
  )

  ipcMain.handle(
    'events:update',
    async (
      _event,
      calendarId: unknown,
      eventId: unknown,
      input: unknown
    ): Promise<CalendarEvent> => {
      const id = requireId(eventId, 'Termin-ID')
      const event = parseEventInput(input)
      const { calendar, provider } = await target(calendarId)
      const updated = await provider.updateEvent(calendar.remoteId, id, event)
      ;(await ready).sync.runSoon()
      return { ...updated, calendarId: calendar.id }
    }
  )

  ipcMain.handle(
    'events:delete',
    async (_event, calendarId: unknown, eventId: unknown): Promise<void> => {
      const id = requireId(eventId, 'Termin-ID')
      const { calendar, provider } = await target(calendarId)
      await provider.deleteEvent(calendar.remoteId, id)
      ;(await ready).sync.runSoon()
    }
  )

  ipcMain.handle('sync:listPairs', async (): Promise<SyncPair[]> => {
    return (await ready).store.listSyncPairs()
  })

  ipcMain.handle(
    'sync:addPair',
    async (_event, googleCalendarId: unknown, msCalendarId: unknown): Promise<SyncPair> => {
      const google = await target(googleCalendarId, 'google')
      const outlook = await target(msCalendarId, 'microsoft')
      const { store, sync } = await ready
      const pair = await store.addSyncPair(google.calendar.id, outlook.calendar.id)
      sync.runSoon()
      return pair
    }
  )

  ipcMain.handle('sync:removePair', async (_event, pairId: unknown): Promise<void> => {
    const id = requireId(pairId, 'Paar-ID')
    await (await ready).store.removeSyncPair(id)
  })

  ipcMain.handle('sync:now', async (): Promise<SyncStatus> => (await ready).sync.run())

  ipcMain.handle('sync:status', async (): Promise<SyncStatus> => (await ready).sync.getStatus())

  ipcMain.handle('settings:get', (): Settings => settings.get())

  ipcMain.handle('settings:set', (_event, input: unknown): Settings => {
    // Die Einstellungen der Kalender haben ihren eigenen Weg und bleiben hier unberührt.
    return settings.set({ ...parseSettings(input), calendars: settings.get().calendars })
  })
}
