import type { WebCalendar } from '../google/api'
import type { LocalOptions } from '../store'
import Sheet from './Sheet'

interface Props {
  email: string
  calendars: WebCalendar[]
  onOptions(calendarId: string, options: LocalOptions): void
  onSignOut(): void
  onClose(): void
}

/** Welche Kalender sichtbar sind und in welcher Farbe, nur auf diesem Handy. */
function CalendarSheet({
  email,
  calendars,
  onOptions,
  onSignOut,
  onClose
}: Props): React.JSX.Element {
  return (
    <Sheet label="Kalender" onClose={onClose}>
      <h2 className="sheet-title">Kalender</h2>
      <p className="form-note">{email}</p>
      <ul className="sheet-calendars">
        {calendars.map((calendar) => (
          <li key={calendar.id}>
            <label className="sheet-calendar">
              <input
                type="checkbox"
                checked={calendar.visible}
                onChange={(event) => onOptions(calendar.id, { visible: event.target.checked })}
                style={{ accentColor: calendar.color }}
              />
              <span className="sheet-calendar-name">{calendar.name}</span>
            </label>
            <label className="sheet-color">
              <span className="visually-hidden">Farbe von {calendar.name}</span>
              <input
                type="color"
                value={calendar.color}
                onChange={(event) => onOptions(calendar.id, { color: event.target.value })}
              />
            </label>
          </li>
        ))}
      </ul>
      <p className="form-note">
        Outlook-Termine siehst du hier, wenn easy-Calender auf dem PC sie mit Google abgleicht.
      </p>
      <div className="sheet-actions">
        <button type="button" className="button" onClick={onClose}>
          Fertig
        </button>
        <button type="button" className="link-button" onClick={onSignOut}>
          Abmelden
        </button>
      </div>
    </Sheet>
  )
}

export default CalendarSheet
