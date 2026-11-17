import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { CalendarOptions, Settings } from '../shared/types'

export const DEFAULT_SETTINGS: Settings = { autostart: false, closeToTray: true, calendars: {} }

const COLOR = /^#[0-9a-f]{6}$/i
const MAX_CALENDARS = 500

/** Prüft die Einstellungen eines Kalenders. Unbekanntes und Ungültiges fällt weg. */
export function parseCalendarOptions(input: unknown): CalendarOptions {
  const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const options: CalendarOptions = {}
  if (raw.hidden === true) options.hidden = true
  if (raw.allDayOnly === true) options.allDayOnly = true
  if (typeof raw.color === 'string' && COLOR.test(raw.color)) {
    options.color = raw.color.toLowerCase()
  }
  return options
}

/** Prüft Einstellungen aus der Datei oder von der Oberfläche. Unbekanntes fällt weg. */
export function parseSettings(input: unknown): Settings {
  const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
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
    calendars
  }
}

/** Liest die Einstellungen. Eine fehlende oder kaputte Datei ergibt die Vorgaben. */
export function loadSettings(filePath: string): Settings {
  try {
    if (existsSync(filePath)) return parseSettings(JSON.parse(readFileSync(filePath, 'utf8')))
  } catch {
    // Die Vorgaben sind ein sicherer Ersatz.
  }
  return { ...DEFAULT_SETTINGS, calendars: {} }
}

export function saveSettings(filePath: string, settings: Settings): void {
  writeFileSync(filePath, JSON.stringify(settings, null, 2))
}
