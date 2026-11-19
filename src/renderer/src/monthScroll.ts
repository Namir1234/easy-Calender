import { useEffect, useRef, type RefObject } from 'react'

/** Ein Monat vor (`1`) oder zurück (`-1`). */
export type Step = 1 | -1

/** So viel Scrollen (in Pixel) blättert einen Monat weiter. */
const WHEEL_THRESHOLD = 60
/** So lange nach dem Blättern zählt kein Scrollen. */
const WHEEL_MIN_LOCK_MS = 250
/** Nach dieser Pause beginnt eine neue Scrollbewegung. */
const WHEEL_QUIET_MS = 150
/** Ab dieser Grösse ist ein Ereignis eine Raste am Mausrad, kein Nachlaufen am Touchpad. */
const WHEEL_NOTCH = 50
/** Ein Wisch muss mindestens so weit gehen ... */
const SWIPE_DISTANCE = 50
/** ... und darf höchstens so lange dauern. Länger ist Antippen und Halten. */
const SWIPE_MAX_MS = 500

export interface WheelInput {
  deltaY: number
  /** 0 = Pixel, 1 = Zeilen, 2 = Seiten, wie bei `WheelEvent`. */
  deltaMode: number
  timeStamp: number
}

/**
 * Macht aus Scroll-Ereignissen ganze Monatsschritte.
 *
 * Ein Mausrad liefert pro Raste ein grosses Ereignis, ein Touchpad viele
 * kleine, die nach dem Loslassen noch eine Weile nachlaufen. Darum gilt:
 * Nach einem Schritt ist kurz Ruhe. Danach blättert erst eine neue Bewegung
 * (nach einer Pause) oder die nächste Raste am Mausrad weiter. So springt
 * ein Wisch auf dem Touchpad nur einen Monat, das Mausrad aber jede Raste.
 */
export function createWheelPager(pageHeight = 800): (input: WheelInput) => Step | 0 {
  let sum = 0
  let last = -Infinity
  let steppedAt: number | null = null

  return ({ deltaY, deltaMode, timeStamp }) => {
    // Zeilen grosszügig umrechnen, damit eine Raste (meist 3 Zeilen) reicht.
    const delta = deltaMode === 1 ? deltaY * 40 : deltaMode === 2 ? deltaY * pageHeight : deltaY
    const quiet = timeStamp - last >= WHEEL_QUIET_MS
    last = timeStamp

    if (steppedAt !== null) {
      const notch = Math.abs(delta) >= WHEEL_NOTCH
      if (timeStamp - steppedAt < WHEEL_MIN_LOCK_MS || !(quiet || notch)) return 0
      steppedAt = null
      sum = 0
    } else if (quiet) {
      sum = 0
    }

    sum += delta
    if (Math.abs(sum) < WHEEL_THRESHOLD) return 0
    const step: Step = sum > 0 ? 1 : -1
    sum = 0
    steppedAt = timeStamp
    return step
  }
}

/**
 * Wisch auf dem Handy: nach oben oder links ist der nächste Monat,
 * nach unten oder rechts der vorige. Wie beim Scrollen: Was unten
 * nachkommt, ist später.
 */
export function swipeStep(dx: number, dy: number, ms: number): Step | 0 {
  if (ms > SWIPE_MAX_MS) return 0
  const vertical = Math.abs(dy) >= Math.abs(dx)
  const distance = vertical ? dy : dx
  if (Math.abs(distance) < SWIPE_DISTANCE) return 0
  return distance < 0 ? 1 : -1
}

/**
 * Kann zwischen `target` und `root` etwas selbst scrollen? Dann gehört das
 * Scrollen dorthin (zum Beispiel die Liste «+3 weitere»), nicht zum Blättern.
 * Ohne `deltaY` zählt jede Richtung.
 */
function scrollsInside(target: EventTarget | null, root: HTMLElement, deltaY?: number): boolean {
  for (
    let el = target instanceof Element ? target : null;
    el && el !== root;
    el = el.parentElement
  ) {
    if (el.scrollHeight <= el.clientHeight + 1) continue
    const overflow = getComputedStyle(el).overflowY
    if (overflow !== 'auto' && overflow !== 'scroll') continue
    if (deltaY === undefined) return true
    if (deltaY < 0 && el.scrollTop > 0) return true
    if (deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true
  }
  return false
}

/**
 * Blättert in der Monatsansicht mit Mausrad, Touchpad und Wischen durch die
 * Monate. `active` ist nur in der Monatsansicht wahr: In Woche und Tag
 * scrollt das Rad weiter durch die Stunden.
 */
export function useMonthScroll(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onStep: (step: Step) => void
): void {
  const onStepRef = useRef(onStep)
  useEffect(() => {
    onStepRef.current = onStep
  }, [onStep])

  useEffect(() => {
    const root = ref.current
    if (!root || !active) return

    const pager = createWheelPager(root.clientHeight || 800)

    const handleWheel = (event: WheelEvent): void => {
      // Ctrl + Rad und Zwei-Finger-Zoom sind Zoomen, nicht Blättern.
      if (event.ctrlKey) return
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      if (scrollsInside(event.target, root, event.deltaY)) return
      event.preventDefault()
      const step = pager(event)
      if (step) onStepRef.current(step)
    }

    let touch: { x: number; y: number; time: number } | null = null

    const handleTouchStart = (event: TouchEvent): void => {
      const point = event.touches[0]
      touch =
        event.touches.length === 1 && !scrollsInside(event.target, root)
          ? { x: point.clientX, y: point.clientY, time: event.timeStamp }
          : null
    }

    const handleTouchEnd = (event: TouchEvent): void => {
      const start = touch
      touch = null
      const point = event.changedTouches[0]
      if (!start || !point || event.touches.length > 0) return
      const step = swipeStep(
        point.clientX - start.x,
        point.clientY - start.y,
        event.timeStamp - start.time
      )
      if (step) onStepRef.current(step)
    }

    const handleTouchCancel = (): void => {
      touch = null
    }

    root.addEventListener('wheel', handleWheel, { passive: false })
    root.addEventListener('touchstart', handleTouchStart, { passive: true })
    root.addEventListener('touchend', handleTouchEnd, { passive: true })
    root.addEventListener('touchcancel', handleTouchCancel, { passive: true })
    return () => {
      root.removeEventListener('wheel', handleWheel)
      root.removeEventListener('touchstart', handleTouchStart)
      root.removeEventListener('touchend', handleTouchEnd)
      root.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [ref, active])
}
