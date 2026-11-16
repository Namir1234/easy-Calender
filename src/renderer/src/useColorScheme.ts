import { useEffect, useSyncExternalStore } from 'react'

export type ColorScheme = 'light' | 'dark'

const query = window.matchMedia('(prefers-color-scheme: dark)')

function subscribe(onChange: () => void): () => void {
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSnapshot(): ColorScheme {
  return query.matches ? 'dark' : 'light'
}

/**
 * Folgt dem Hell-/Dunkelmodus von Windows und setzt `data-color-scheme`
 * auf dem Dokument. Darauf hören sowohl unser CSS als auch FullCalendar.
 */
export function useColorScheme(): ColorScheme {
  const scheme = useSyncExternalStore(subscribe, getSnapshot)
  useEffect(() => {
    document.documentElement.dataset.colorScheme = scheme
  }, [scheme])
  return scheme
}
