import { createHash } from 'crypto'
import type { NormalizedEvent } from '../../shared/types'
import { seriesRule } from '../providers/types'

/** Beginn oder Ende so, dass derselbe Moment immer gleich aussieht. */
function timeKey(value: string, allDay: boolean): string {
  if (allDay) return value.slice(0, 10)
  const time = Date.parse(value)
  return Number.isNaN(time) ? value : String(time)
}

/**
 * Bringt eine RRULE in eine feste Form: Teile sortiert, `WKST` weg, `UNTIL`
 * nur als Datum. So gelten zwei gleichwertige Schreibweisen als gleich.
 */
export function canonicalRule(rule: string | null): string {
  if (!rule) return ''
  return rule
    .toUpperCase()
    .split(';')
    .filter((part) => part && !part.startsWith('WKST=') && part !== 'INTERVAL=1')
    .map((part) => (part.startsWith('UNTIL=') ? part.slice(0, 'UNTIL='.length + 8) : part))
    .sort()
    .join(';')
}

function digest(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32)
}

/** Fingerabdruck aller Felder, die abgeglichen werden. */
export function contentHash(event: NormalizedEvent): string {
  return digest([
    event.title.trim(),
    (event.description ?? '').trim(),
    (event.location ?? '').trim(),
    event.allDay,
    timeKey(event.start, event.allDay),
    timeKey(event.end, event.allDay),
    canonicalRule(seriesRule(event))
  ])
}

/**
 * Gröberer Fingerabdruck für den ersten Abgleich: Titel und Zeit. Damit
 * werden Termine erkannt, die schon in beiden Kalendern stehen, auch wenn
 * die Anbieter die Notiz leicht anders speichern.
 */
export function identityHash(event: NormalizedEvent): string {
  return digest([
    event.title.trim().toLowerCase(),
    event.allDay,
    timeKey(event.start, event.allDay),
    timeKey(event.end, event.allDay),
    Boolean(seriesRule(event))
  ])
}
