import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Die Monatsansicht als langes Band von Wochen, das man stufenlos scrollt:
 * mit Mausrad, Touchpad oder Finger, ohne Einrasten. FullCalendar zeigt
 * dafür ein Raster über viele Wochen (eigene Ansicht `monthStrip`). Kommt
 * man in die Nähe des Endes, wird das Raster unbemerkt neu um die sichtbare
 * Woche gelegt. Der Titel zeigt den Monat, der gerade im Blick ist.
 */

/** Name der Ansicht für FullCalendar. */
export const MONTH_STRIP = 'monthStrip'

/** So viele Wochen stehen vor und nach dem gewählten Datum im Raster. */
const WEEKS_BEFORE = 20
const WEEKS_AFTER = 30
/**
 * Näher als so viele Wochen am Rand wird das Raster neu gelegt, sobald man
 * kurz nicht scrollt. Neu legen mitten im Scrollen würde kurz rucken.
 */
const EDGE_WEEKS = 8
/** Noch näher am Rand wird es sofort neu gelegt, auch mitten im Scrollen. */
const CRITICAL_WEEKS = 2
/** So lange ohne Scrollen gilt als Pause. */
const IDLE_MS = 180
/**
 * So lange wird eine gesetzte Position festgehalten. FullCalendar stellt nach
 * einem Wechsel der Ansicht kurz danach seine alte Scrollposition wieder her.
 */
const HOLD_MS = 300
/** So lange dauert ein weiches Scrollen mit «‹ ›» etwa. */
const SMOOTH_MS = 800
/** Der Monat in dieser Höhe des sichtbaren Bereichs (von oben) gibt den Titel. */
const TITLE_PROBE = 0.35

/** Etwa ein Bild später. Ein Timer statt `requestAnimationFrame`, der in Fenstern im Hintergrund ruht. */
const nextFrame = (callback: () => void): ReturnType<typeof setTimeout> => setTimeout(callback, 16)

const pad = (value: number): string => String(value).padStart(2, '0')

/** Lokales Datum als `YYYY-MM-DD`, wie FullCalendar es in `data-date` schreibt. */
export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `YYYY-MM-DD` als lokales Datum um Mitternacht. */
export function parseDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

/** Montag der Woche, in der `date` liegt, um Mitternacht. */
export function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

/** Zeitraum des Rasters rund um `current`, immer ganze Wochen ab Montag. */
export function stripRange(current: Date): { start: Date; end: Date } {
  const start = mondayOf(current)
  start.setDate(start.getDate() - WEEKS_BEFORE * 7)
  const end = new Date(start)
  end.setDate(end.getDate() + (WEEKS_BEFORE + WEEKS_AFTER) * 7)
  return { start, end }
}

/**
 * Zusätzliche Ansicht für FullCalendar. Muss eine Konstante sein: Ein neues
 * Objekt bei jedem Rendern lässt FullCalendar endlos neu rechnen.
 * `dateIncrement` hält «‹ ›» bedienbar, die Klicks übernimmt `useMonthStrip`.
 */
export const STRIP_VIEWS = {
  [MONTH_STRIP]: {
    type: 'dayGrid',
    visibleRange: stripRange,
    // Klassen fürs CSS: Die Zeilenhöhe muss schon stimmen, wenn FullCalendar
    // das Raster einsetzt, sonst stimmt die Scrollposition nicht.
    viewClass: 'month-strip',
    dayRowClass: 'month-strip-row',
    dateIncrement: { weeks: 4 }
  }
}

/** Erster Tag des Monats, `offset` Monate nach dem Monat von `month` (`YYYY-MM`). */
export function firstOfMonth(month: string, offset = 0): Date {
  const [year, index] = month.split('-').map(Number)
  return new Date(year, index - 1 + offset, 1)
}

/** «November 2026» */
export function monthTitle(month: string): string {
  return new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' }).format(
    firstOfMonth(month)
  )
}

export interface RowBox {
  top: number
  bottom: number
  /** Tage der Woche als `YYYY-MM-DD`, Montag zuerst. */
  days: string[]
}

/**
 * Welcher Monat ist im Blick? Der Monat der Woche, die auf der Höhe `probe`
 * liegt. Von dieser Woche zählt der Donnerstag: Eine Woche gehört zu dem
 * Monat, in dem die meisten ihrer Tage liegen.
 */
export function monthAt(rows: RowBox[], probe: number): string | null {
  if (rows.length === 0) return null
  const row = rows.find((box) => box.bottom > probe) ?? rows[rows.length - 1]
  const thursday = row.days[3] ?? row.days[0]
  return thursday ? thursday.slice(0, 7) : null
}

/** Die Wochenzeilen des Rasters, von FullCalendar mit `role="row"` ausgezeichnet. */
function rowElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[role="row"]')).filter((row) =>
    row.querySelector(':scope > [data-date]')
  )
}

function rowBoxes(root: HTMLElement): RowBox[] {
  return rowElements(root).map((row) => {
    const { top, bottom } = row.getBoundingClientRect()
    const days = Array.from(row.querySelectorAll<HTMLElement>(':scope > [data-date]')).map(
      (cell) => cell.dataset.date ?? ''
    )
    return { top, bottom, days }
  })
}

/** Der Scrollbereich, den FullCalendar um die Wochenzeilen legt. */
function findScroller(root: HTMLElement): HTMLElement | null {
  const cell = root.querySelector('[role="row"] > [data-date]')
  for (let el = cell?.parentElement ?? null; el && el !== root; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1) continue
    const overflow = getComputedStyle(el).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return el
  }
  return null
}

/** Zeile, in der der Tag `day` steht. */
function rowOf(root: HTMLElement, day: string): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>(`[role="row"] > [data-date="${day}"]`)?.parentElement ?? null
  )
}

interface Controller {
  gotoDate(date: Date): void
  getDate(): Date | undefined
}

/** Wohin nach dem nächsten Neuzeichnen gescrollt wird. */
interface Pending {
  /** Diese Woche kommt an den oberen Rand ... */
  day: string
  /** ... mit diesem Abstand (Pixel) zur Oberkante des Scrollbereichs. */
  offset: number
}

export interface MonthStrip {
  /** Monat im Blick, z. B. «November 2026». Leer, solange nichts gezeichnet ist. */
  title: string
  /** Derselbe Monat als `YYYY-MM`, oder `null`. */
  month: string | null
  /** Weich zum Anfang des nächsten (`1`) oder vorigen (`-1`) Monats scrollen. */
  step(direction: 1 | -1): void
  /** Zum Monat mit dem heutigen Tag. */
  today(): void
  /**
   * Vor dem Wechsel in eine andere Ansicht aufrufen: Diese zeigt dann den Monat
   * im Blick, genauer heute, wenn heute darin liegt, sonst seinen Ersten.
   */
  leave(): void
  /** Nach jedem `datesSet` aufrufen: legt die Scrollposition nach dem Neuzeichnen fest. */
  rendered(viewType: string): void
}

/**
 * Steuert das Scrollen im Monatsband. `active` ist nur in der Monatsansicht
 * wahr. `rootRef` umschliesst den FullCalendar.
 */
export function useMonthStrip(
  rootRef: RefObject<HTMLElement | null>,
  active: boolean,
  controller: Controller
): MonthStrip {
  const [month, setMonth] = useState<string | null>(null)
  const monthRef = useRef<string | null>(null)
  const pending = useRef<Pending | null>(null)
  /** Bis dann läuft ein weiches Scrollen, das nicht unterbrochen werden soll. */
  const smoothUntil = useRef(0)
  /** Schon an den Anfang des Monats gescrollt, seit die Ansicht offen ist? */
  const positioned = useRef(false)
  /** Zuletzt gesetzte Position, die festgehalten wird, bis man selbst scrollt. */
  const held = useRef<{ top: number; until: number } | null>(null)
  /** Monat, zu dem «‹ ›» gerade weich scrollen (`YYYY-MM`). */
  const target = useRef<string | null>(null)
  /** `update` für `hold` und `applyPending`, die vor ihr stehen müssen. */
  const updateRef = useRef<(idle: boolean) => void>(() => {})
  const controllerRef = useRef(controller)
  useEffect(() => {
    controllerRef.current = controller
  }, [controller])

  /** Position `top` kurz festhalten, solange man nicht selbst scrollt. */
  const hold = useCallback(
    (top: number): void => {
      held.current = { top, until: performance.now() + HOLD_MS }
      const check = (): void => {
        const scroller = rootRef.current && findScroller(rootRef.current)
        const target = held.current
        if (!scroller || !target || performance.now() > target.until) {
          held.current = null
          updateRef.current(false)
          return
        }
        if (Math.abs(scroller.scrollTop - target.top) > 1) scroller.scrollTop = target.top
        nextFrame(check)
      }
      nextFrame(check)
    },
    [rootRef]
  )

  /**
   * Gemerkte Position anwenden, sobald die Woche im Raster steht. Gleich
   * versuchen (vor dem Malen, sonst flackern kurz falsche Wochen), sonst ein
   * paar Bilder lang warten: FullCalendar zeichnet lange Raster etwas später.
   */
  const applyPending = useCallback((): void => {
    let tries = 0
    const apply = (): void => {
      const root = rootRef.current
      const goal = pending.current
      const scroller = root && findScroller(root)
      const row = goal && root && rowOf(root, goal.day)
      if (!root || !scroller || !goal || !row) {
        if (goal && tries++ < 120) nextFrame(apply)
        else pending.current = null
        return
      }
      const top =
        row.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop -
        goal.offset
      pending.current = null
      scroller.scrollTop = top
      updateRef.current(false)
      hold(top)
    }
    apply()
  }, [rootRef, hold])

  /**
   * Das Raster neu um `date` legen und danach die Woche `goal.day` an
   * dieselbe Stelle setzen. Ist `date` schon das gewählte Datum, ändert sich
   * das Raster nicht, und die Position wird gleich gesetzt.
   */
  const relayout = useCallback(
    (goal: Pending, date: Date): void => {
      held.current = null
      pending.current = goal
      const current = controllerRef.current.getDate()
      if (current && isoDay(current) === isoDay(date)) applyPending()
      else controllerRef.current.gotoDate(date)
    },
    [applyPending]
  )

  /**
   * Titel nachführen und, wenn nötig, das Raster neu um die sichtbare Woche
   * legen. `idle`: Es wird gerade nicht gescrollt.
   */
  const update = useCallback(
    (idle: boolean): void => {
      const root = rootRef.current
      const scroller = root && findScroller(root)
      if (!root || !scroller || pending.current) return
      const view = scroller.getBoundingClientRect()
      const rows = rowBoxes(root)
      const current = monthAt(rows, view.top + view.height * TITLE_PROBE)
      if (current && current !== monthRef.current) {
        monthRef.current = current
        setMonth(current)
      }

      const rowHeight = rows[0] ? rows[0].bottom - rows[0].top : 0
      if (rowHeight <= 0) return
      const edge = Math.min(
        scroller.scrollTop,
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
      )
      const critical = edge < CRITICAL_WEEKS * rowHeight
      const near = edge < EDGE_WEEKS * rowHeight
      const smoothing = performance.now() < smoothUntil.current
      if (!critical && !(near && idle && !smoothing)) return
      const top = rows.find((box) => box.bottom > view.top)
      if (!top) return
      relayout({ day: top.days[0], offset: top.top - view.top }, parseDay(top.days[0]))
    },
    [rootRef, relayout]
  )
  useEffect(() => {
    updateRef.current = update
  }, [update])

  /** Zur Woche mit `date` scrollen. Liegt sie nahe am Rand, erst das Raster neu legen. */
  const reveal = useCallback(
    (date: Date): void => {
      const root = rootRef.current
      const day = isoDay(mondayOf(date))
      const scroller = root && findScroller(root)
      const row = root && rowOf(root, day)
      if (root && scroller && row) {
        const top =
          row.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop
        const room = EDGE_WEEKS * row.getBoundingClientRect().height
        const max = scroller.scrollHeight - scroller.clientHeight
        if (top >= room && max - top >= room) {
          held.current = null
          smoothUntil.current = performance.now() + SMOOTH_MS
          scroller.scrollTo({ top, behavior: 'smooth' })
          return
        }
      }
      relayout({ day, offset: 0 }, date)
    },
    [rootRef, relayout]
  )

  const rendered = useCallback(
    (viewType: string): void => {
      if (viewType !== MONTH_STRIP) return
      // Beim Öffnen: Anfang des gewählten Monats oben.
      if (!positioned.current) {
        positioned.current = true
        const date = controllerRef.current.getDate() ?? new Date()
        pending.current ??= {
          day: isoDay(mondayOf(new Date(date.getFullYear(), date.getMonth(), 1))),
          offset: 0
        }
      }
      applyPending()
    },
    [applyPending]
  )

  // Beim Verlassen der Monatsansicht zurücksetzen.
  useEffect(() => {
    if (active) return
    positioned.current = false
    pending.current = null
    held.current = null
    target.current = null
    monthRef.current = null
  }, [active])

  // Scrollen beobachten. `scroll` steigt nicht auf, darum in der Capture-Phase.
  useEffect(() => {
    const root = rootRef.current
    if (!root || !active) return
    let frame: ReturnType<typeof setTimeout> | 0 = 0
    let idle: ReturnType<typeof setTimeout> | 0 = 0
    const handleScroll = (): void => {
      if (idle) clearTimeout(idle)
      idle = setTimeout(() => {
        idle = 0
        update(true)
      }, IDLE_MS)
      if (frame) return
      frame = nextFrame(() => {
        frame = 0
        update(false)
      })
    }
    // Scrollt man selbst, gilt die eigene Bewegung, nicht die festgehaltene Position.
    const release = (): void => {
      held.current = null
      target.current = null
      smoothUntil.current = 0
    }
    const inputs = ['wheel', 'touchstart', 'keydown'] as const
    for (const type of inputs) root.addEventListener(type, release, { passive: true })
    root.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      for (const type of inputs) root.removeEventListener(type, release)
      root.removeEventListener('scroll', handleScroll, { capture: true })
      if (frame) clearTimeout(frame)
      if (idle) clearTimeout(idle)
    }
  }, [rootRef, active, update])

  // Mehrmals schnell «›»: vom Ziel des letzten Klicks weiterzählen, nicht vom
  // Monat, der während des weichen Scrollens gerade vorbeizieht.
  const step = useCallback(
    (direction: 1 | -1): void => {
      const moving = performance.now() < smoothUntil.current
      const base = (moving && target.current) || monthRef.current || isoDay(new Date()).slice(0, 7)
      const next = firstOfMonth(base, direction)
      target.current = isoDay(next).slice(0, 7)
      reveal(next)
    },
    [reveal]
  )

  const today = useCallback((): void => {
    const now = new Date()
    target.current = isoDay(now).slice(0, 7)
    reveal(new Date(now.getFullYear(), now.getMonth(), 1))
  }, [reveal])

  const leave = useCallback((): void => {
    const current = monthRef.current
    if (!active || !current) return
    const now = new Date()
    controllerRef.current.gotoDate(isoDay(now).startsWith(current) ? now : firstOfMonth(current))
  }, [active])

  // Ausserhalb der Monatsansicht gibt es keinen Monat im Blick.
  const shown = active ? month : null
  return { title: shown ? monthTitle(shown) : '', month: shown, step, today, leave, rendered }
}

/**
 * CSS, das die Tage ausserhalb des Monats im Blick leicht abtönt. So sieht
 * man beim Scrollen, wo ein Monat aufhört. `scope` grenzt auf die Ansicht ein.
 */
export function monthShading(scope: string, month: string | null): string {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return ''
  return `${scope} [role="row"] > [data-date]:not([data-date^="${month}"]) { background: var(--fc-forma-faint); }`
}
