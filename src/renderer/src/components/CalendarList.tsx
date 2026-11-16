import type { Account, Calendar, ProviderId } from '../../../shared/types'

interface Props {
  accounts: Account[]
  calendars: Calendar[]
  loading: boolean
  onToggle(calendarId: string, visible: boolean): void
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  demo: 'Demo'
}

function CalendarList({ accounts, calendars, loading, onToggle }: Props): React.JSX.Element {
  if (loading) {
    return <p className="sidebar-hint">Kalender werden geladen …</p>
  }
  if (accounts.length === 0) {
    return <p className="sidebar-hint">Noch keine Konten verbunden.</p>
  }

  return (
    <nav className="calendar-list" aria-label="Kalender">
      {accounts.map((account) => (
        <section key={account.id}>
          <h2 className="account-title">
            <span className="account-email" title={account.email}>
              {account.email}
            </span>
            <span className="account-provider">{PROVIDER_LABELS[account.provider]}</span>
          </h2>
          <ul>
            {calendars
              .filter((calendar) => calendar.accountId === account.id)
              .map((calendar) => (
                <li key={calendar.id}>
                  {/* Die Farbe des Kalenders steckt im Häkchen selbst. */}
                  <label className="calendar-item">
                    <input
                      type="checkbox"
                      checked={calendar.visible}
                      onChange={(event) => onToggle(calendar.id, event.target.checked)}
                      style={{ accentColor: calendar.color }}
                    />
                    <span className="calendar-name">{calendar.name}</span>
                  </label>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </nav>
  )
}

export default CalendarList
