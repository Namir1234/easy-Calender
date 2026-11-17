import { useState } from 'react'
import type { Account, Calendar, CalendarOptions, ProviderId } from '../../../shared/types'

interface Props {
  accounts: Account[]
  calendars: Calendar[]
  loading: boolean
  onToggle(calendarId: string, visible: boolean): void
  onOptions(calendar: Calendar, options: CalendarOptions): void
  /** Legt in einem Outlook-Konto einen neuen Kalender an. */
  onCreate(account: Account, name: string): Promise<void>
  onRemove(account: Account): void
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  google: 'Google',
  microsoft: 'Outlook',
  demo: 'Demo'
}

/** Was für einen Kalender gerade eingestellt ist, als vollständiger Satz. */
function optionsOf(calendar: Calendar, overrideColor: boolean): CalendarOptions {
  return {
    hidden: calendar.hidden,
    allDayOnly: calendar.allDayOnly,
    color: overrideColor ? calendar.color : undefined
  }
}

function CalendarList({
  accounts,
  calendars,
  loading,
  onToggle,
  onOptions,
  onCreate,
  onRemove
}: Props): React.JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null)
  const [creatingIn, setCreatingIn] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) {
    return <p className="sidebar-hint">Kalender werden geladen …</p>
  }
  if (accounts.length === 0) {
    return <p className="sidebar-hint">Noch keine Konten verbunden.</p>
  }

  const hidden = calendars.filter((calendar) => calendar.hidden)
  const accountOf = (calendar: Calendar): string =>
    accounts.find((account) => account.id === calendar.accountId)?.email ?? ''

  const create = (account: Account): void => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    onCreate(account, name)
      .then(() => {
        setCreatingIn(null)
        setNewName('')
      })
      .catch(() => undefined)
      .finally(() => setBusy(false))
  }

  return (
    <nav className="calendar-list" aria-label="Kalender">
      {accounts.map((account) => (
        <section key={account.id} className="account">
          <h2 className="account-title">
            <span className="account-email" title={account.email}>
              {account.email}
            </span>
            <span className="account-provider">{PROVIDER_LABELS[account.provider]}</span>
          </h2>
          <ul>
            {calendars
              .filter((calendar) => calendar.accountId === account.id && !calendar.hidden)
              .map((calendar) => (
                <li key={calendar.id}>
                  <div className="calendar-row">
                    {/* Die Farbe des Kalenders steckt im Häkchen selbst. */}
                    <label className="calendar-item">
                      <input
                        type="checkbox"
                        checked={calendar.visible}
                        onChange={(event) => onToggle(calendar.id, event.target.checked)}
                        style={{ accentColor: calendar.color }}
                      />
                      <span className="calendar-name" title={calendar.name}>
                        {calendar.name}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="calendar-more"
                      aria-expanded={openId === calendar.id}
                      aria-label={`Einstellungen für ${calendar.name}`}
                      title="Farbe und Anzeige"
                      onClick={() => setOpenId(openId === calendar.id ? null : calendar.id)}
                    >
                      ···
                    </button>
                  </div>

                  {openId === calendar.id && (
                    <div className="calendar-options">
                      <label className="option-color">
                        <span>Farbe</span>
                        <input
                          type="color"
                          value={calendar.color}
                          onChange={(event) =>
                            onOptions(calendar, {
                              ...optionsOf(calendar, true),
                              color: event.target.value
                            })
                          }
                        />
                      </label>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={Boolean(calendar.allDayOnly)}
                          onChange={(event) =>
                            onOptions(calendar, {
                              ...optionsOf(calendar, true),
                              allDayOnly: event.target.checked
                            })
                          }
                        />
                        <span>Nur ganztägige Termine zeigen</span>
                      </label>
                      <button
                        type="button"
                        className="link-button"
                        title="Der Kalender bleibt beim Anbieter bestehen"
                        onClick={() => {
                          setOpenId(null)
                          onOptions(calendar, { ...optionsOf(calendar, true), hidden: true })
                        }}
                      >
                        Aus der App entfernen
                      </button>
                    </div>
                  )}
                </li>
              ))}
          </ul>

          {account.provider === 'microsoft' &&
            (creatingIn === account.id ? (
              <form
                className="new-calendar"
                onSubmit={(event) => {
                  event.preventDefault()
                  create(account)
                }}
              >
                <label className="field">
                  <span>Name des neuen Kalenders</span>
                  <input
                    type="text"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    maxLength={60}
                    autoFocus
                  />
                </label>
                <div className="form-actions">
                  <button type="button" className="button" onClick={() => setCreatingIn(null)}>
                    Abbrechen
                  </button>
                  <button type="submit" className="button" disabled={busy || !newName.trim()}>
                    {busy ? 'Legt an …' : 'Anlegen'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setNewName('')
                  setCreatingIn(account.id)
                }}
              >
                Neuer Kalender
              </button>
            ))}

          {account.provider !== 'demo' && (
            <button type="button" className="link-button" onClick={() => onRemove(account)}>
              Konto entfernen
            </button>
          )}
        </section>
      ))}

      {hidden.length > 0 && (
        <details className="hidden-calendars">
          <summary>Entfernte Kalender ({hidden.length})</summary>
          <ul>
            {hidden.map((calendar) => (
              <li key={calendar.id}>
                <span className="calendar-name" title={`${calendar.name} (${accountOf(calendar)})`}>
                  {calendar.name}
                </span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    onOptions(calendar, { ...optionsOf(calendar, true), hidden: false })
                  }
                >
                  Wieder zeigen
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </nav>
  )
}

export default CalendarList
