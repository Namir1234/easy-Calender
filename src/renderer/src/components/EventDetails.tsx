import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Calendar, CalendarEvent } from '../../../shared/types'

/** Die Position des angeklickten Termins im Fenster. */
export interface AnchorRect {
  top: number
  bottom: number
  left: number
  right: number
}

interface Props {
  event: CalendarEvent
  calendar: Calendar | undefined
  anchor: AnchorRect
  onClose(): void
}

const GAP = 8
const EDGE = 12

const DATE_FORMAT = new Intl.DateTimeFormat('de-CH', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})
const TIME_FORMAT = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' })

/** Liest `YYYY-MM-DD` oder `YYYY-MM-DDTHH:mm:ss` als lokale Zeit. */
function parseLocal(value: string): Date {
  const [datePart, timePart = '00:00:00'] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

/** Datum und Uhrzeit als zwei Zeilen, damit nichts mitten in der Zeit umbricht. */
function formatWhen(event: CalendarEvent): string[] {
  const start = parseLocal(event.start)
  const end = parseLocal(event.end)

  if (event.allDay) {
    // Das Ende ist exklusiv: ein eintägiger Termin endet «am Tag danach».
    const lastDay = new Date(end)
    lastDay.setDate(lastDay.getDate() - 1)
    if (lastDay.getTime() <= start.getTime()) return [DATE_FORMAT.format(start), 'ganztägig']
    return [`${DATE_FORMAT.format(start)} bis`, DATE_FORMAT.format(lastDay)]
  }

  if (start.toDateString() === end.toDateString()) {
    return [
      DATE_FORMAT.format(start),
      `${TIME_FORMAT.format(start)} bis ${TIME_FORMAT.format(end)} Uhr`
    ]
  }
  return [
    `${DATE_FORMAT.format(start)}, ${TIME_FORMAT.format(start)} Uhr bis`,
    `${DATE_FORMAT.format(end)}, ${TIME_FORMAT.format(end)} Uhr`
  ]
}

/**
 * Zeigt die Details eines Termins als Popover direkt neben dem Termin.
 * Ein Klick daneben oder Escape schliesst es, das übernimmt der Browser.
 */
function EventDetails({ event, calendar, anchor, onClose }: Props): React.JSX.Element {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Öffnen und neben dem Termin platzieren: rechts davon, sonst links,
  // und immer ganz innerhalb des Fensters.
  useLayoutEffect(() => {
    const popover = popoverRef.current
    if (!popover) return
    if (!popover.matches(':popover-open')) popover.showPopover()

    const { width, height } = popover.getBoundingClientRect()
    let left = anchor.right + GAP
    if (left + width > window.innerWidth - EDGE) left = anchor.left - GAP - width
    left = Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE))
    const top = Math.max(EDGE, Math.min(anchor.top, window.innerHeight - height - EDGE))

    popover.style.left = `${left}px`
    popover.style.top = `${top}px`
  }, [anchor])

  useEffect(() => {
    const popover = popoverRef.current
    if (!popover) return
    const handleToggle = (toggle: Event): void => {
      if ((toggle as ToggleEvent).newState === 'closed') onClose()
    }
    popover.addEventListener('toggle', handleToggle)
    return () => popover.removeEventListener('toggle', handleToggle)
  }, [onClose])

  return (
    <div
      ref={popoverRef}
      popover="auto"
      className="event-details"
      role="dialog"
      aria-label={event.title}
    >
      <h2>{event.title}</h2>
      <p className="event-when">
        {formatWhen(event).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>

      <dl>
        {calendar && (
          <>
            <dt>Kalender</dt>
            <dd>
              <span
                className="calendar-swatch"
                style={{ background: calendar.color }}
                aria-hidden="true"
              />
              {calendar.name}
            </dd>
          </>
        )}
        {event.location && (
          <>
            <dt>Ort</dt>
            <dd>{event.location}</dd>
          </>
        )}
        {event.description && (
          <>
            <dt>Notiz</dt>
            <dd>{event.description}</dd>
          </>
        )}
        {event.recurrence && (
          <>
            <dt>Serie</dt>
            <dd>wiederholt sich</dd>
          </>
        )}
      </dl>
    </div>
  )
}

export default EventDetails
