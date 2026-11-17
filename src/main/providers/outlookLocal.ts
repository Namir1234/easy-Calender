import { spawn } from 'child_process'
import type { NormalizedEvent } from '../../shared/types'
import { toDateString, type DayRange } from '../dateRange'
import type { RemoteCalendar } from '../db/store'
import { mapOutlookItem, toOutlookItem, type OutlookItem } from './outlookLocalMapper'
import type { CalendarProvider, ProviderEvent } from './types'

const TIMEOUT_MS = 90_000
const DEFAULT_COLOR = '#0f6cbd'
/** Trennt in der Kalender-ID den Speicher (das Konto) vom Ordner. Kommt in Outlook-IDs nicht vor. */
const SEPARATOR = '|'

/** Ein Konto im lokalen Outlook mit seinen Kalendern. */
export interface OutlookStore {
  name: string
  calendars: RemoteCalendar[]
}

/** Führt einen Auftrag aus und liefert die Antwort als Text (JSON). */
export type OutlookRunner = (requestJson: string) => Promise<string>

function localMidnight(dayNumber: number): string {
  const [year, month, day] = toDateString(dayNumber).split('-').map(Number)
  return new Date(year, month - 1, day).toISOString()
}

/**
 * Startet das Brückenskript in Windows PowerShell. Der Auftrag geht über die
 * Standardeingabe hinein, damit nichts davon in einer Befehlszeile steht.
 */
export function powershellRunner(scriptPath: string): OutlookRunner {
  return (requestJson) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { windowsHide: true }
      )
      let output = ''
      let errors = ''
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error('Outlook hat nicht rechtzeitig geantwortet'))
      }, TIMEOUT_MS)
      child.stdout.setEncoding('utf8').on('data', (chunk) => (output += chunk))
      child.stderr.setEncoding('utf8').on('data', (chunk) => (errors += chunk))
      child.on('error', (error) => {
        clearTimeout(timer)
        reject(new Error(`PowerShell liess sich nicht starten: ${error.message}`))
      })
      child.on('close', () => {
        clearTimeout(timer)
        if (output.trim()) resolve(output)
        else reject(new Error(`Keine Antwort von Outlook. ${errors.trim().split('\n')[0] ?? ''}`))
      })
      // Nur ASCII senden: Umlaute gehen als \uXXXX hinein, unabhängig von der Codepage.
      child.stdin.end(
        requestJson.replace(
          /[^\x20-\x7e]/g,
          (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
        )
      )
    })
}

/**
 * Zugriff auf das lokal installierte Outlook (classic). Aufträge laufen
 * nacheinander, weil Outlook gleichzeitige Zugriffe schlecht verträgt.
 */
export class OutlookBridge {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly run: OutlookRunner) {}

  call<T>(request: Record<string, unknown>): Promise<T> {
    const next = this.queue.then(async () => {
      const raw = await this.run(JSON.stringify(request))
      let answer: { ok: boolean; data?: T; error?: string }
      try {
        // Vor dem JSON kann PowerShell Hinweise ausgeben. Die Antwort ist die letzte Zeile.
        answer = JSON.parse(raw.trim().split(/\r?\n/).pop() ?? '')
      } catch {
        throw new Error('Outlook hat eine unlesbare Antwort gegeben')
      }
      if (!answer.ok) throw new Error(`Outlook meldet: ${answer.error ?? 'unbekannter Fehler'}`)
      return answer.data as T
    })
    this.queue = next.catch(() => undefined)
    return next
  }

  /** Legt im Konto des angegebenen Kalenders einen neuen, leeren Kalender an. */
  async createCalendar(siblingRemoteId: string, name: string): Promise<void> {
    const [storeId] = siblingRemoteId.split(SEPARATOR)
    await this.call({ op: 'createCalendar', storeId, name })
  }

  /** Alle Konten des lokalen Outlook, die einen Kalender haben. */
  async listStores(): Promise<OutlookStore[]> {
    const data = await this.call<{
      stores: Array<{
        storeId: string
        name: string
        calendars: Array<{ id: string; name: string }>
      }>
    }>({ op: 'calendars' })
    return data.stores.map((store) => ({
      name: store.name,
      calendars: store.calendars.map((calendar) => ({
        remoteId: `${store.storeId}${SEPARATOR}${calendar.id}`,
        name: calendar.name,
        color: DEFAULT_COLOR
      }))
    }))
  }
}

/** Liest und schreibt Termine über das lokal installierte Outlook (classic). */
export class OutlookLocalProvider implements CalendarProvider {
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  constructor(private readonly bridge: OutlookBridge) {}

  private ids(calendarRemoteId: string): { storeId: string; folderId: string } {
    const [storeId, folderId] = calendarRemoteId.split(SEPARATOR)
    if (!storeId || !folderId) throw new Error('Ungültiger Outlook-Kalender')
    return { storeId, folderId }
  }

  private map(items: OutlookItem[]): ProviderEvent[] {
    return items.flatMap((item) => {
      const event = mapOutlookItem(item, this.timeZone)
      return event && event.status !== 'cancelled' ? [event] : []
    })
  }

  private async list(
    calendarRemoteId: string,
    range: DayRange,
    expand: boolean
  ): Promise<ProviderEvent[]> {
    const data = await this.bridge.call<{ events: OutlookItem[] }>({
      op: 'list',
      ...this.ids(calendarRemoteId),
      start: localMidnight(range.startDay),
      end: localMidnight(range.endDay),
      expand
    })
    return this.map(data.events)
  }

  listEvents(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]> {
    return this.list(calendarRemoteId, range, true)
  }

  listForSync(calendarRemoteId: string, range: DayRange): Promise<ProviderEvent[]> {
    return this.list(calendarRemoteId, range, false)
  }

  async getEvent(calendarRemoteId: string, eventId: string): Promise<ProviderEvent | null> {
    const data = await this.bridge.call<{ event: OutlookItem | null }>({
      op: 'get',
      storeId: this.ids(calendarRemoteId).storeId,
      id: eventId
    })
    return data.event ? (this.map([data.event])[0] ?? null) : null
  }

  async createEvent(calendarRemoteId: string, event: NormalizedEvent): Promise<ProviderEvent> {
    const data = await this.bridge.call<{ event: OutlookItem }>({
      op: 'create',
      ...this.ids(calendarRemoteId),
      event: toOutlookItem(event)
    })
    return this.written(data.event)
  }

  async updateEvent(
    calendarRemoteId: string,
    eventId: string,
    event: NormalizedEvent
  ): Promise<ProviderEvent> {
    const data = await this.bridge.call<{ event: OutlookItem }>({
      op: 'update',
      storeId: this.ids(calendarRemoteId).storeId,
      id: eventId,
      event: toOutlookItem(event)
    })
    return this.written(data.event)
  }

  async deleteEvent(calendarRemoteId: string, eventId: string): Promise<void> {
    await this.bridge.call({
      op: 'delete',
      storeId: this.ids(calendarRemoteId).storeId,
      id: eventId
    })
  }

  private written(item: OutlookItem): ProviderEvent {
    const event = mapOutlookItem(item, this.timeZone)
    if (!event) throw new Error('Outlook hat den gespeicherten Termin nicht zurückgegeben')
    return event
  }
}
