import type { Calendar, CalendarEvent } from '../../../shared/types'
import { parseLocal } from '../dates'

interface Props {
  query: string
  results: CalendarEvent[] | null
  calendars: Calendar[]
  onOpen(event: CalendarEvent): void
  onClose(): void
}

const DAY = new Intl.DateTimeFormat('de-CH', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})
const TIME = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' })

/**
 * Die Treffer einer Suche als Liste, wie in Outlook anstelle des Kalenders.
 * Ein Klick springt zum Termin.
 */
function SearchResults({ query, results, calendars, onOpen, onClose }: Props): React.JSX.Element {
  const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]))
  return (
    <section className="search-results" aria-label="Suchergebnisse">
      <div className="search-head">
        <h2>
          {results === null
            ? `Suche nach «${query}» …`
            : `${results.length} ${results.length === 1 ? 'Treffer' : 'Treffer'} für «${query}»`}
        </h2>
        <button type="button" className="button button-inline" onClick={onClose}>
          Zurück zum Kalender
        </button>
      </div>
      {results !== null && results.length === 0 && (
        <p className="search-empty">
          Nichts gefunden. Gesucht wird in Titel, Ort, Notiz und Kategorien, ein halbes Jahr zurück
          und ein Jahr voraus.
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="search-list">
          {results.map((event) => {
            const calendar = byId.get(event.calendarId)
            const start = parseLocal(event.start)
            return (
              <li key={`${event.calendarId}|${event.id}`}>
                <button type="button" className="search-item" onClick={() => onOpen(event)}>
                  <span
                    className="calendar-swatch"
                    style={{ background: calendar?.color }}
                    aria-hidden="true"
                  />
                  <span className="search-when">
                    {DAY.format(start)}
                    {event.allDay ? ', ganztägig' : `, ${TIME.format(start)} Uhr`}
                  </span>
                  <span className="search-title">{event.title}</span>
                  <span className="search-meta">
                    {[event.location, calendar?.name].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default SearchResults
