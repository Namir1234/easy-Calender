import { useCallback, useSyncExternalStore } from 'react'

/** Die wählbaren Designs. Die Farben dazu stehen in `assets/tokens.css`. */
export const DESIGNS = [
  { id: 'dose', name: 'Dose', hint: 'warmes Papier, ein Grün' },
  { id: 'classic', name: 'Klassisch', hint: 'grau mit einem Rot, wie bis 0.14' },
  { id: 'coral', name: 'Coral', hint: 'Briefpapier, ein Korallenrot' },
  { id: 'terrazzo', name: 'Terrazzo', hint: 'eckig, harte Kanten, Terrakotta' }
] as const

export type DesignId = (typeof DESIGNS)[number]['id']

export const DEFAULT_DESIGN: DesignId = 'dose'
const STORAGE_KEY = 'easy-calender.design'

export function isDesignId(value: unknown): value is DesignId {
  return DESIGNS.some((design) => design.id === value)
}

/** Gespeichertes Design, oder das Standard-Design, wenn nichts (Gültiges) gespeichert ist. */
export function loadDesign(storage: Pick<Storage, 'getItem'> | undefined): DesignId {
  try {
    const stored = storage?.getItem(STORAGE_KEY)
    return isDesignId(stored) ? stored : DEFAULT_DESIGN
  } catch {
    return DEFAULT_DESIGN
  }
}

function storage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const listeners = new Set<() => void>()
let current: DesignId = DEFAULT_DESIGN

/** Setzt das Design auf dem Dokument. Vor dem ersten Rendern aufrufen, damit nichts flackert. */
export function applyStoredDesign(): void {
  current = loadDesign(storage())
  document.documentElement.dataset.theme = current
}

function setDesign(design: DesignId): void {
  current = design
  document.documentElement.dataset.theme = design
  try {
    storage()?.setItem(STORAGE_KEY, design)
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum nächsten Start.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Das aktuelle Design und eine Funktion, um es zu wechseln. Gilt nur auf diesem Gerät. */
export function useDesign(): [DesignId, (design: DesignId) => void] {
  const design = useSyncExternalStore(subscribe, () => current)
  const change = useCallback((next: DesignId) => setDesign(next), [])
  return [design, change]
}
