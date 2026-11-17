import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { CalendarOptions, Category, Settings, ViewSettings } from '../shared/types'

/** Die Kategorien, die Outlook in einem neuen Konto mitbringt. */
export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Rote Kategorie', color: '#d13438' },
  { name: 'Orange Kategorie', color: '#ca5010' },
  { name: 'Gelbe Kategorie', color: '#c19c00' },
  { name: 'Grüne Kategorie', color: '#498205' },
  { name: 'Blaue Kategorie', color: '#0078d4' },
  { name: 'Lila Kategorie', color: '#8764b8' }
]

export const DEFAULT_VIEW: ViewSettings = {
  firstDay: 1,
  workDays: [1, 2, 3, 4, 5],
  workStart: '08:00',
  workEnd: '17:00',
  slotMinutes: 30,
  weekNumbers: true
}

export const DEFAULT_SETTINGS: Settings = {
  autostart: false,
  closeToTray: true,
  calendars: {},
  reminders: true,
  view: DEFAULT_VIEW,
  categories: DEFAULT_CATEGORIES
}

const COLOR = /^#[0-9a-f]{6}$/i
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const SLOTS = [5, 6, 10, 15, 30, 60]
const MAX_CALENDARS = 500
const MAX_CATEGORIES = 50

type Raw = Record<string, unknown>
const asObject = (input: unknown): Raw =>
  typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Raw) : {}

/** Prüft die Einstellungen eines Kalenders. Unbekanntes und Ungültiges fällt weg. */
export function parseCalendarOptions(input: unknown): CalendarOptions {
  const raw = asObject(input)
  const options: CalendarOptions = {}
  if (raw.hidden === true) options.hidden = true
  if (raw.allDayOnly === true) options.allDayOnly = true
  if (typeof raw.color === 'string' && COLOR.test(raw.color)) {
    options.color = raw.color.toLowerCase()
  }
  return options
}

/** Prüft die Ansicht. Jeder ungültige Wert fällt auf die Vorgabe zurück. */
export function parseView(input: unknown): ViewSettings {
  const raw = asObject(input)
  const day = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
  const workDays = Array.isArray(raw.workDays)
    ? [...new Set(raw.workDays.filter(day))].sort((a, b) => a - b)
    : DEFAULT_VIEW.workDays
  let workStart = typeof raw.workStart === 'string' && TIME.test(raw.workStart) ? raw.workStart : ''
  let workEnd = typeof raw.workEnd === 'string' && TIME.test(raw.workEnd) ? raw.workEnd : ''
  if (!workStart || !workEnd || workEnd <= workStart) {
    workStart = DEFAULT_VIEW.workStart
    workEnd = DEFAULT_VIEW.workEnd
  }
  return {
    firstDay: day(raw.firstDay) ? raw.firstDay : DEFAULT_VIEW.firstDay,
    workDays: workDays.length > 0 ? workDays : DEFAULT_VIEW.workDays,
    workStart,
    workEnd,
    slotMinutes: SLOTS.includes(raw.slotMinutes as number)
      ? (raw.slotMinutes as number)
      : DEFAULT_VIEW.slotMinutes,
    weekNumbers: typeof raw.weekNumbers === 'boolean' ? raw.weekNumbers : DEFAULT_VIEW.weekNumbers
  }
}

/** Prüft die Kategorien. Doppelte Namen und ungültige Einträge fallen weg. */
export function parseCategories(input: unknown): Category[] {
  if (!Array.isArray(input)) return DEFAULT_CATEGORIES.map((category) => ({ ...category }))
  const seen = new Set<string>()
  const categories: Category[] = []
  for (const entry of input.slice(0, MAX_CATEGORIES)) {
    const { name, color } = asObject(entry)
    if (typeof name !== 'string' || typeof color !== 'string' || !COLOR.test(color)) continue
    const trimmed = name.trim()
    // Komma und Semikolon trennen in Outlook die Kategorien.
    if (!trimmed || trimmed.length > 60 || /[,;]/.test(trimmed)) continue
    if (seen.has(trimmed.toLowerCase())) continue
    seen.add(trimmed.toLowerCase())
    categories.push({ name: trimmed, color: color.toLowerCase() })
  }
  return categories
}

/** Prüft Einstellungen aus der Datei oder von der Oberfläche. Unbekanntes fällt weg. */
export function parseSettings(input: unknown): Settings {
  const raw = asObject(input)
  const calendars: Settings['calendars'] = {}
  if (typeof raw.calendars === 'object' && raw.calendars !== null) {
    for (const [id, value] of Object.entries(raw.calendars).slice(0, MAX_CALENDARS)) {
      const options = parseCalendarOptions(value)
      // Leere Einträge werden nicht aufbewahrt.
      if (id.length <= 100 && Object.keys(options).length > 0) calendars[id] = options
    }
  }
  return {
    autostart: typeof raw.autostart === 'boolean' ? raw.autostart : DEFAULT_SETTINGS.autostart,
    closeToTray:
      typeof raw.closeToTray === 'boolean' ? raw.closeToTray : DEFAULT_SETTINGS.closeToTray,
    calendars,
    reminders: typeof raw.reminders === 'boolean' ? raw.reminders : DEFAULT_SETTINGS.reminders,
    view: parseView(raw.view),
    categories: parseCategories(raw.categories)
  }
}

/** Liest die Einstellungen. Eine fehlende oder kaputte Datei ergibt die Vorgaben. */
export function loadSettings(filePath: string): Settings {
  try {
    if (existsSync(filePath)) return parseSettings(JSON.parse(readFileSync(filePath, 'utf8')))
  } catch {
    // Die Vorgaben sind ein sicherer Ersatz.
  }
  return parseSettings({})
}

export function saveSettings(filePath: string, settings: Settings): void {
  writeFileSync(filePath, JSON.stringify(settings, null, 2))
}
