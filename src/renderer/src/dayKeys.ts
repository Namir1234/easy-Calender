import { useCallback, useEffect, useRef, useState } from 'react'

/** Was die Pfeiltasten brauchen: Ansicht, Zeitraum und Springen zu einem Tag. */
export interface DayKeysTarget {
  /** Aktuelle Ansicht, zum Beispiel `timeGridWeek`. */
  viewType: string
  /**
   * Der eigentliche Zeitraum der Ansicht als lokale Tage `YYYY-MM-DD`, `end`
   * exklusiv. Im Monat ist das der Monat selbst, ohne die grauen Tage davor
   * und danach: Wer dorthin blättert, landet im nächsten Monat.
   */
  range: { start: string; end: string } | null
  /** Springt zur Ansicht, die diesen Tag enthält. */
  gotoDate(day: Date): void
}

const pad = (value: number): string => String(value).padStart(2, '0')

/** Lokales Datum als `YYYY-MM-DD`, ohne Umweg über UTC. */
export const toDayKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** `YYYY-MM-DD` als lokale Mitternacht. */
export const fromDayKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Verschiebt einen Tag um `days` Tage. Rechnet in Kalendertagen, nicht in Stunden. */
export const addDays = (key: string, days: number): string => {
  const date = fromDayKey(key)
  date.setDate(date.getDate() + days)
  return toDayKey(date)
}

/**
 * Wie viele Tage eine Taste weiterspringt, oder 0, wenn sie nicht zum
 * Blättern gehört. Links und rechts sind ein Tag, in der Liste eine Woche:
 * Dort fehlen Tage ohne Termine, ein Tagesschritt wäre oft unsichtbar.
 * Hoch und runter nur im Monat eine Woche, sonst scrollen sie weiter durch
 * Stunden oder Liste.
 */
export function dayKeyStep(key: string, viewType: string): number {
  const side = viewType.startsWith('list') ? 7 : 1
  switch (key) {
    case 'ArrowLeft':
      return -side
    case 'ArrowRight':
      return side
    case 'ArrowUp':
      return viewType === 'dayGridMonth' ? -7 : 0
    case 'ArrowDown':
      return viewType === 'dayGridMonth' ? 7 : 0
    default:
      return 0
  }
}

/** Von welchem Tag aus geblättert wird: dem markierten, sonst heute, sonst dem ersten sichtbaren. */
export function startDay(
  focused: string | null,
  range: { start: string; end: string },
  today: string
): string {
  if (focused && inRange(focused, range)) return focused
  if (inRange(today, range)) return today
  return range.start
}

const inRange = (day: string, range: { start: string; end: string }): boolean =>
  day >= range.start && day < range.end

/**
 * Gehört die Taste jemand anderem? In Eingabefeldern bewegen die Pfeile den
 * Cursor, und solange ein Formular oder Popover offen ist, bleibt der
 * Kalender stehen.
 */
function belongsElsewhere(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return true
  }
  const target = event.target
  if (target instanceof HTMLElement) {
    if (target.isContentEditable) return true
    if (target.closest('input, textarea, select, [role="slider"], [role="listbox"]')) return true
  }
  return document.querySelector(':popover-open, dialog[open]') !== null
}

/** Was FullCalendar den Klassen-Funktionen für Tage mitgibt. */
interface DayInfo {
  date: Date
  view: { type: string }
}

/** Klassen für FullCalendar, die den gewählten Tag markieren. */
export interface DayKeysMarks {
  /** Gewählter Tag (`YYYY-MM-DD`), `null`, solange niemand die Pfeile benutzt hat. */
  focusedDay: string | null
  /** Für Monatsfelder, Tagesspalten und Listentage (`dayCellClass`, `dayLaneClass`, `listDayClass`). */
  dayClass(info: DayInfo): string | undefined
  /** Für die Kopfzeile der Woche (`dayHeaderClass`). Im Monat steht dort nur der Wochentag. */
  headerClass(info: DayInfo): string | undefined
}

export const FOCUSED_DAY_CLASS = 'is-focused-day'

/**
 * Mit den Pfeiltasten durch die Tage: links und rechts ein Tag, im Monat
 * hoch und runter eine Woche. Der gewählte Tag wird markiert, in der
 * Tagesansicht ist er einfach der angezeigte Tag. Der Kalender springt immer
 * mit, so zeigt ein Wechsel zur Tagesansicht genau diesen Tag.
 */
export function useDayKeys({ viewType, range, gotoDate }: DayKeysTarget): DayKeysMarks {
  const [focused, setFocused] = useState<string | null>(null)
  const latest = useRef({ viewType, range, gotoDate, focused })
  useEffect(() => {
    latest.current = { viewType, range, gotoDate, focused }
  })

  // Blättert jemand mit Knöpfen oder Mausrad weg, gilt die Markierung nicht mehr.
  const focusedDay = focused && range && inRange(focused, range) ? focused : null

  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      const { viewType, range, gotoDate, focused } = latest.current
      if (!range || belongsElsewhere(event)) return
      const step = dayKeyStep(event.key, viewType)
      if (!step) return
      event.preventDefault()
      const next = addDays(startDay(focused, range, toDayKey(new Date())), step)
      setFocused(next)
      gotoDate(fromDayKey(next))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const dayClass = useCallback(
    ({ date, view }: DayInfo) =>
      focusedDay && view.type !== 'timeGridDay' && toDayKey(date) === focusedDay
        ? FOCUSED_DAY_CLASS
        : undefined,
    [focusedDay]
  )
  const headerClass = useCallback(
    (info: DayInfo) => (info.view.type === 'dayGridMonth' ? undefined : dayClass(info)),
    [dayClass]
  )

  return { focusedDay, dayClass, headerClass }
}
