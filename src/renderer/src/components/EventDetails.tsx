import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Calendar, CalendarEvent, Category } from '../../../shared/types'
import { describeReminder, parseLocal, SHOW_AS_LABELS } from '../dates'
import { describeRule } from '../recurrence'

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
  categories: Category[]
  anchor: AnchorRect
  onEdit(): void
  onEditSeries(): void
  onDuplicate(): void
  onDelete(): void
  onDeleteSeries(): void
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
function EventDetails({
  event,
  calendar,
  categories,
  anchor,
  onEdit,
  onEditSeries,
  onDuplicate,
  onDelete,
  onDeleteSeries,
  onClose
}: Props): React.JSX.Element {
  const popoverRef = useRef<HTMLDivElement>(null)
  const instance = event.recurrence === 'SERIE'
  const series = Boolean(event.recurrence)
  // Die ganze Serie lässt sich nur bearbeiten, wenn der Anbieter sie nennt.
  const canHandleSeries = instance && Boolean(event.seriesId)

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

  const categoryColor = new Map(
    categories.map((category) => [category.name.toLowerCase(), category.color])
  )
  const seriesText =
    event.recurrence && !instance
      ? describeRule(event.recurrence, parseLocal(event.start))
      : 'Termin einer Serie'

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
        {series && (
          <>
            <dt>Serie</dt>
            <dd>{seriesText}</dd>
          </>
        )}
        {event.showAs && (
          <>
            <dt>Anzeigen als</dt>
            <dd>
              {SHOW_AS_LABELS[event.showAs]}
              {event.private ? ', privat' : ''}
            </dd>
          </>
        )}
        {event.reminderMinutes !== undefined && (
          <>
            <dt>Erinnerung</dt>
            <dd>{describeReminder(event.reminderMinutes)}</dd>
          </>
        )}
        {event.categories && event.categories.length > 0 && (
          <>
            <dt>Kategorien</dt>
            <dd className="category-list">
              {event.categories.map((name) => (
                <span key={name} className="category-chip">
                  <span
                    className="calendar-swatch"
                    style={{ background: categoryColor.get(name.toLowerCase()) ?? 'transparent' }}
                    aria-hidden="true"
                  />
                  {name}
                </span>
              ))}
            </dd>
          </>
        )}
        {event.description && (
          <>
            <dt>Notiz</dt>
            <dd className="event-note">{event.description}</dd>
          </>
        )}
      </dl>

      <div className="details-actions">
        <button type="button" className="button" onClick={onEdit}>
          {instance ? 'Diesen bearbeiten' : 'Bearbeiten'}
        </button>
        <button type="button" className="button" onClick={onDuplicate}>
          Duplizieren
        </button>
        <button type="button" className="button" onClick={onDelete}>
          {instance ? 'Diesen löschen' : 'Löschen'}
        </button>
      </div>
      {canHandleSeries && (
        <div className="details-actions details-series">
          <button type="button" className="button" onClick={onEditSeries}>
            Serie bearbeiten
          </button>
          <button type="button" className="button" onClick={onDeleteSeries}>
            Serie löschen
          </button>
        </div>
      )}
    </div>
  )
}

export default EventDetails
