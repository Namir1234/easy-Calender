import { useCallback, useSyncExternalStore } from 'react'

/** Die wählbaren Designs. Die Farben dazu stehen in `assets/tokens.css`. */
export const DESIGNS = [
  { id: 'dose', name: 'Dose', hint: 'warmes Papier, ein Grün' },
  { id: 'classic', name: 'Klassisch', hint: 'grau mit einem Rot, wie bis 0.14' },
  { id: 'coral', name: 'Coral', hint: 'Briefpapier, ein Korallenrot' },
  { id: 'terrazzo', name: 'Terrazzo', hint: 'eckig, harte Kanten, Terrakotta' }
] as const

/** Hell, dunkel, oder wie das System (Windows, iOS, Android). */
export const MODES = [
  { id: 'system', name: 'Wie das System' },
  { id: 'light', name: 'Hell' },
  { id: 'dark', name: 'Dunkel' }
] as const

export type DesignId = (typeof DESIGNS)[number]['id']
export type ModeId = (typeof MODES)[number]['id']

export const DEFAULT_DESIGN: DesignId = 'dose'
export const DEFAULT_MODE: ModeId = 'system'
const DESIGN_KEY = 'easy-calender.design'
const MODE_KEY = 'easy-calender.mode'

export function isDesignId(value: unknown): value is DesignId {
  return DESIGNS.some((design) => design.id === value)
}

export function isModeId(value: unknown): value is ModeId {
  return MODES.some((mode) => mode.id === value)
}

type Reader = Pick<Storage, 'getItem'> | undefined

function read<T>(
  storage: Reader,
  key: string,
  valid: (value: unknown) => value is T,
  fallback: T
): T {
  try {
    const stored = storage?.getItem(key)
    return valid(stored) ? stored : fallback
  } catch {
    return fallback
  }
}

/** Gespeichertes Design, oder das Standard-Design, wenn nichts (Gültiges) gespeichert ist. */
export function loadDesign(storage: Reader): DesignId {
  return read(storage, DESIGN_KEY, isDesignId, DEFAULT_DESIGN)
}

/** Gespeicherte Wahl für hell oder dunkel, sonst «wie das System». */
export function loadMode(storage: Reader): ModeId {
  return read(storage, MODE_KEY, isModeId, DEFAULT_MODE)
}

/** Ob die App hell oder dunkel ist, aus der Wahl und der Einstellung des Systems. */
export function resolveScheme(mode: ModeId, systemDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return systemDark ? 'dark' : 'light'
  return mode
}

function storage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function save(key: string, value: string): void {
  try {
    storage()?.setItem(key, value)
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum nächsten Start.
  }
}

const listeners = new Set<() => void>()
let currentDesign: DesignId = DEFAULT_DESIGN
let currentMode: ModeId = DEFAULT_MODE

const systemQuery = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: dark)')

/** Hell oder dunkel, wie es jetzt gerade gilt. */
export function currentScheme(): 'light' | 'dark' {
  return resolveScheme(currentMode, systemQuery().matches)
}

/**
 * Setzt Design und Hell/Dunkel auf dem Dokument. Vor dem ersten Rendern
 * aufrufen, damit nichts flackert.
 */
export function applyStoredDesign(): void {
  currentDesign = loadDesign(storage())
  currentMode = loadMode(storage())
  document.documentElement.dataset.theme = currentDesign
  document.documentElement.dataset.colorScheme = currentScheme()
}

/** Meldet Änderungen an Design oder Hell/Dunkel (auch die des Systems). */
export function subscribeDesign(listener: () => void): () => void {
  const query = systemQuery()
  listeners.add(listener)
  query.addEventListener('change', listener)
  return () => {
    listeners.delete(listener)
    query.removeEventListener('change', listener)
  }
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

/** Das aktuelle Design und eine Funktion, um es zu wechseln. Gilt nur auf diesem Gerät. */
export function useDesign(): [DesignId, (design: DesignId) => void] {
  const design = useSyncExternalStore(subscribeDesign, () => currentDesign)
  const change = useCallback((next: DesignId) => {
    currentDesign = next
    document.documentElement.dataset.theme = next
    save(DESIGN_KEY, next)
    notify()
  }, [])
  return [design, change]
}

/** Die Wahl hell, dunkel oder wie das System, und eine Funktion, um sie zu ändern. */
export function useMode(): [ModeId, (mode: ModeId) => void] {
  const mode = useSyncExternalStore(subscribeDesign, () => currentMode)
  const change = useCallback((next: ModeId) => {
    currentMode = next
    save(MODE_KEY, next)
    notify()
  }, [])
  return [mode, change]
}
