import type { NormalizedEvent } from '../../shared/types'
import { graphToRrule, rruleToGraph, type GraphRecurrence } from './microsoftRecurrence'
import { SERIES_INSTANCE, seriesRule, type ProviderEvent } from './types'

/** Die Wiederholung, wie das lokale Outlook sie beschreibt (Zahlen des Objektmodells). */
export interface OutlookPattern {
  /** 0 täglich, 1 wöchentlich, 2 monatlich, 3 monatlich am n-ten Wochentag, 5 jährlich, 6 jährlich am n-ten Wochentag */
  type: number
  /** Bei jährlichen Serien in Monaten (12 = jedes Jahr) */
  interval: number
  /** Wochentage als Bits: So 1, Mo 2, Di 4, Mi 8, Do 16, Fr 32, Sa 64 */
  dayMask: number
  dayOfMonth: number
  month: number
  /** 1 bis 4, 5 heisst «letzter» */
  instance: number
  noEnd?: boolean
  occurrences: number
  endDate?: string
  startDate?: string
}

/** Ein Termin, wie ihn `resources/outlook.ps1` liefert. */
export interface OutlookItem {
  id: string
  subject: string
  body: string
  location: string
  allDay: boolean
  startUtc: string
  endUtc: string
  startDate: string
  endDate: string
  /** 1 heisst «mit Vorbehalt» */
  busy: number
  /** 5 und 7 heissen «abgesagt» */
  meeting: number
  occurrence: boolean
  pattern: OutlookPattern | null
  modified: string
}

const TYPES: Array<[number, GraphRecurrence['pattern']['type']]> = [
  [0, 'daily'],
  [1, 'weekly'],
  [2, 'absoluteMonthly'],
  [3, 'relativeMonthly'],
  [5, 'absoluteYearly'],
  [6, 'relativeYearly']
]
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const INDEX_NAMES = ['first', 'second', 'third', 'fourth', 'last']

/** Übersetzt die Wiederholung von Outlook in eine RRULE. `null` für unbekannte Muster. */
export function patternToRrule(pattern: OutlookPattern): string | null {
  const type = TYPES.find(([code]) => code === pattern.type)?.[1]
  if (!type) return null
  const yearly = type.endsWith('Yearly')
  const relative = type.startsWith('relative')
  const usesDays = type === 'weekly' || relative

  return graphToRrule({
    pattern: {
      type,
      interval: yearly ? Math.max(1, Math.round(pattern.interval / 12)) : pattern.interval,
      daysOfWeek: usesDays
        ? DAY_NAMES.filter((_, index) => pattern.dayMask & (1 << index))
        : undefined,
      dayOfMonth: relative ? undefined : pattern.dayOfMonth || undefined,
      month: yearly ? pattern.month : undefined,
      index: relative ? INDEX_NAMES[pattern.instance - 1] : undefined
    },
    range: pattern.noEnd
      ? { type: 'noEnd', startDate: pattern.startDate ?? '' }
      : pattern.occurrences > 0
        ? {
            type: 'numbered',
            startDate: pattern.startDate ?? '',
            numberOfOccurrences: pattern.occurrences
          }
        : { type: 'endDate', startDate: pattern.startDate ?? '', endDate: pattern.endDate }
  })
}

/** Die Gegenrichtung. Wirft für Regeln, die Outlook nicht abbilden kann. */
export function rruleToPattern(rule: string, startDate: string): OutlookPattern {
  const { pattern, range } = rruleToGraph(rule, startDate)
  const yearly = pattern.type.endsWith('Yearly')
  return {
    type: TYPES.find(([, name]) => name === pattern.type)![0],
    interval: yearly ? pattern.interval * 12 : pattern.interval,
    dayMask: (pattern.daysOfWeek ?? []).reduce(
      (mask, name) => mask | (1 << DAY_NAMES.indexOf(name)),
      0
    ),
    dayOfMonth: pattern.dayOfMonth ?? 0,
    month: pattern.month ?? 0,
    instance: pattern.index ? INDEX_NAMES.indexOf(pattern.index) + 1 : 0,
    occurrences: range.type === 'numbered' ? (range.numberOfOccurrences ?? 0) : 0,
    endDate: range.type === 'endDate' ? range.endDate : undefined
  }
}

/** Wandelt einen Termin aus dem lokalen Outlook ins normalisierte Modell um. */
export function mapOutlookItem(item: OutlookItem, timeZone: string): ProviderEvent | null {
  if (!item.id) return null
  let recurrence: string | null = null
  if (item.occurrence) {
    recurrence = SERIES_INSTANCE
  } else if (item.pattern) {
    recurrence = patternToRrule(item.pattern)
    if (!recurrence) return null
  }
  return {
    id: item.id,
    title: item.subject.trim() || '(Ohne Titel)',
    description: item.body.trim() || undefined,
    location: item.location.trim() || undefined,
    start: item.allDay ? item.startDate : item.startUtc,
    end: item.allDay ? item.endDate : item.endUtc,
    allDay: item.allDay,
    timeZone,
    recurrence,
    status:
      item.meeting === 5 || item.meeting === 7
        ? 'cancelled'
        : item.busy === 1
          ? 'tentative'
          : 'confirmed',
    updatedAt: item.modified
  }
}

/** Baut den Auftrag zum Speichern eines Termins im lokalen Outlook. */
export function toOutlookItem(event: NormalizedEvent): Record<string, unknown> {
  const rule = seriesRule(event)
  const localDate = (instant: string): string => {
    const date = new Date(instant)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${String(date.getDate()).padStart(2, '0')}`
  }
  return {
    subject: event.title,
    body: event.description ?? '',
    location: event.location ?? '',
    allDay: event.allDay,
    startUtc: event.allDay ? null : new Date(event.start).toISOString(),
    endUtc: event.allDay ? null : new Date(event.end).toISOString(),
    startDate: event.allDay ? event.start.slice(0, 10) : null,
    endDate: event.allDay ? event.end.slice(0, 10) : null,
    // Ein einzelnes Vorkommen behält seine Serie.
    recurrence: rule ? 'set' : event.recurrence === null ? 'none' : 'keep',
    pattern: rule
      ? rruleToPattern(rule, event.allDay ? event.start.slice(0, 10) : localDate(event.start))
      : null
  }
}
