import type { SyncPair } from '../../shared/types'

/**
 * Prüft, ob zwei Kalender ein neues Paar bilden dürfen. Liefert den Grund,
 * falls nicht, sonst `null`.
 *
 * Ein Kalender darf in mehreren Paaren stehen (Google ↔ Outlook und
 * Google ↔ iCloud), dann wandern Termine über ihn weiter. Ein Ring aber
 * (dazu noch Outlook ↔ iCloud) würde jeden Termin auf zwei Wegen ans selbe
 * Ziel bringen. Darum dürfen zwei Kalender, die schon über andere Paare
 * verbunden sind, kein eigenes Paar mehr bilden.
 */
export function pairProblem(pairs: SyncPair[], aId: string, bId: string): string | null {
  if (aId === bId) return 'Ein Kalender lässt sich nicht mit sich selbst abgleichen'
  const neighbours = new Map<string, string[]>()
  const connect = (from: string, to: string): void => {
    neighbours.set(from, [...(neighbours.get(from) ?? []), to])
  }
  for (const pair of pairs) {
    if (
      (pair.calendarAId === aId && pair.calendarBId === bId) ||
      (pair.calendarAId === bId && pair.calendarBId === aId)
    ) {
      return 'Diese zwei Kalender werden schon abgeglichen'
    }
    connect(pair.calendarAId, pair.calendarBId)
    connect(pair.calendarBId, pair.calendarAId)
  }
  const seen = new Set([aId])
  const queue = [aId]
  while (queue.length > 0) {
    for (const next of neighbours.get(queue.shift()!) ?? []) {
      if (next === bId) {
        return 'Diese zwei Kalender werden schon über einen anderen Kalender abgeglichen'
      }
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return null
}
