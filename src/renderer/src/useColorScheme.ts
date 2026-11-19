import { useEffect, useSyncExternalStore } from 'react'
import { currentScheme, subscribeDesign } from './design'

export type ColorScheme = 'light' | 'dark'

/**
 * Hell oder dunkel: so, wie es in den Einstellungen gewählt ist, oder wie
 * das System. Setzt `data-color-scheme` auf dem Dokument. Darauf hören
 * sowohl unser CSS als auch FullCalendar.
 */
export function useColorScheme(): ColorScheme {
  const scheme = useSyncExternalStore(subscribeDesign, currentScheme)
  useEffect(() => {
    document.documentElement.dataset.colorScheme = scheme
  }, [scheme])
  return scheme
}
