import type { CalendarEvent } from '../../../src/shared/types'
import type { WebCalendar } from '../google/api'
import Sheet from './Sheet'

interface Props {
  event: CalendarEvent
  calendar?: WebCalendar
  onEdit(): void
  onDelete(): void
  onClose(): void
}

const DAY = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })
const TIME = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' })

function parseLocal(value: string): Date {
  if (value.includes('T')) return new Date(value)
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** «Mittwoch, 18. November» und «14:00 bis 15:00 Uhr» oder «ganztägig» */
function describeWhen(event: Pick<CalendarEvent, 'start' | 'end' | 'allDay'>): [string, string] {
  const start = parseLocal(event.start)
  const end = parseLocal(event.end)
  if (event.allDay) {
    end.setDate(end.getDate() - 1)
    return end > start
      ? [`${DAY.format(start)} bis ${DAY.format(end)}`, 'ganztägig']
      : [DAY.format(start), 'ganztägig']
  }
  if (start.toDateString() === end.toDateString()) {
    return [DAY.format(start), `${TIME.format(start)} bis ${TIME.format(end)} Uhr`]
  }
  return [
    `${DAY.format(start)}, ${TIME.format(start)} Uhr`,
    `bis ${DAY.format(end)}, ${TIME.format(end)} Uhr`
  ]
}

/** Details eines Termins als Blatt von unten. */
function EventSheet({ event, calendar, onEdit, onDelete, onClose }: Props): React.JSX.Element {
  const [day, time] = describeWhen(event)
  return (
    <Sheet label={event.title} onClose={onClose}>
      <h2 className="sheet-title">{event.title}</h2>
      <p className="event-when">
        <span>{day}</span>
        <span>{time}</span>
      </p>
      <dl className="sheet-facts">
        {calendar && (
          <>
            <dt>Kalender</dt>
            <dd>
              <span className="calendar-swatch" style={{ background: calendar.color }} />
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
        {event.recurrence && (
          <>
            <dt>Serie</dt>
            <dd>Teil einer Serie</dd>
          </>
        )}
        {event.description && (
          <>
            <dt>Notiz</dt>
            <dd className="sheet-notes">{event.description}</dd>
          </>
        )}
      </dl>
      <div className="sheet-actions">
        {calendar?.writable ? (
          <>
            <button type="button" className="button button-strong" onClick={onEdit}>
              Bearbeiten
            </button>
            <button type="button" className="button" onClick={onDelete}>
              Löschen
            </button>
          </>
        ) : (
          <p className="form-note">Diesen Kalender kannst du nur lesen.</p>
        )}
        <button type="button" className="button" onClick={onClose}>
          Schliessen
        </button>
      </div>
    </Sheet>
  )
}

export default EventSheet
