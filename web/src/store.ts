import type { KeyValueStore } from './google/auth'

/** Einstellungen eines Kalenders auf diesem Handy. */
export interface LocalOptions {
  /** In der Ansicht zeigen. Ohne Angabe gilt, was Google sagt. */
  visible?: boolean
  /** Eigene Farbe `#rrggbb` */
  color?: string
}

const KEY = 'easy-calender.calendars'
const VIEW_KEY = 'easy-calender.view'

export type ViewName = 'listWeek' | 'timeGridDay' | 'dayGridMonth'
const VIEWS: ViewName[] = ['listWeek', 'timeGridDay', 'dayGridMonth']

export function loadOptions(store: KeyValueStore): Record<string, LocalOptions> {
  try {
    const raw = JSON.parse(store.getItem(KEY) ?? '{}') as unknown
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
    const result: Record<string, LocalOptions> = {}
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue
      const entry = value as Record<string, unknown>
      const options: LocalOptions = {}
      if (typeof entry.visible === 'boolean') options.visible = entry.visible
      if (typeof entry.color === 'string' && /^#[0-9a-f]{6}$/i.test(entry.color)) {
        options.color = entry.color.toLowerCase()
      }
      result[id] = options
    }
    return result
  } catch {
    return {}
  }
}

export function saveOptions(store: KeyValueStore, options: Record<string, LocalOptions>): void {
  store.setItem(KEY, JSON.stringify(options))
}

export function loadView(store: KeyValueStore): ViewName {
  const view = store.getItem(VIEW_KEY)
  return VIEWS.includes(view as ViewName) ? (view as ViewName) : 'listWeek'
}

export function saveView(store: KeyValueStore, view: ViewName): void {
  store.setItem(VIEW_KEY, view)
}
