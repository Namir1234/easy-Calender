import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { Settings } from '../shared/types'

export const DEFAULT_SETTINGS: Settings = { autostart: false, closeToTray: true }

/** Prüft Einstellungen aus der Datei oder von der Oberfläche. Unbekanntes fällt weg. */
export function parseSettings(input: unknown): Settings {
  const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  return {
    autostart: typeof raw.autostart === 'boolean' ? raw.autostart : DEFAULT_SETTINGS.autostart,
    closeToTray:
      typeof raw.closeToTray === 'boolean' ? raw.closeToTray : DEFAULT_SETTINGS.closeToTray
  }
}

/** Liest die Einstellungen. Eine fehlende oder kaputte Datei ergibt die Vorgaben. */
export function loadSettings(filePath: string): Settings {
  try {
    if (existsSync(filePath)) return parseSettings(JSON.parse(readFileSync(filePath, 'utf8')))
  } catch {
    // Die Vorgaben sind ein sicherer Ersatz.
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(filePath: string, settings: Settings): void {
  writeFileSync(filePath, JSON.stringify(settings, null, 2))
}
