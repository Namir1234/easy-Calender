import { useCallback, useEffect, useState } from 'react'
import type { Account, Calendar, CalendarEvent, DbStatus } from '../../shared/types'
import CalendarList from './components/CalendarList'
import CalendarView from './components/CalendarView'
import EventDetails, { type AnchorRect } from './components/EventDetails'
import StatusBadge from './components/StatusBadge'
import { useColorScheme } from './useColorScheme'

/** Electron stellt Fehlern aus dem Main-Prozess einen technischen Vorspann voran. */
function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

function App(): React.JSX.Element {
  const colorScheme = useColorScheme()
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ event: CalendarEvent; anchor: AnchorRect } | null>(
    null
  )

  const loadAccounts = useCallback(async () => {
    const [loadedAccounts, loadedCalendars] = await Promise.all([
      window.api.listAccounts(),
      window.api.listCalendars()
    ])
    setAccounts(loadedAccounts)
    setCalendars(loadedCalendars)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([window.api.getStatus(), window.api.listAccounts(), window.api.listCalendars()])
      .then(([loadedStatus, loadedAccounts, loadedCalendars]) => {
        if (cancelled) return
        setStatus(loadedStatus)
        setAccounts(loadedAccounts)
        setCalendars(loadedCalendars)
      })
      .catch((loadError) => {
        if (!cancelled) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setVisible = useCallback((calendarId: string, visible: boolean) => {
    const apply = (value: boolean): void =>
      setCalendars((current) =>
        current.map((calendar) =>
          calendar.id === calendarId ? { ...calendar, visible: value } : calendar
        )
      )
    // Sofort anzeigen, bei einem Fehler zurücknehmen.
    apply(visible)
    setError(null)
    window.api.setCalendarVisible(calendarId, visible).catch((saveError) => {
      apply(!visible)
      setError(errorMessage(saveError))
    })
  }, [])

  const connectGoogle = useCallback(() => {
    setConnecting(true)
    setError(null)
    window.api
      .connectGoogle()
      .then(loadAccounts)
      .catch((connectError) => setError(errorMessage(connectError)))
      .finally(() => setConnecting(false))
  }, [loadAccounts])

  const removeAccount = useCallback(
    (account: Account) => {
      const sure = window.confirm(
        `${account.email} entfernen?\n\nDie Termine bleiben bei Google erhalten. Die App zeigt sie nur nicht mehr an.`
      )
      if (!sure) return
      setError(null)
      window.api
        .removeAccount(account.id)
        .then(loadAccounts)
        .catch((removeError) => setError(errorMessage(removeError)))
    },
    [loadAccounts]
  )

  const selectEvent = useCallback((event: CalendarEvent, anchor: AnchorRect) => {
    setSelected({ event, anchor })
  }, [])
  const closeDetails = useCallback(() => setSelected(null), [])
  const showError = useCallback((message: string) => setError(errorMessage(message)), [])

  const selectedCalendar = selected
    ? calendars.find((calendar) => calendar.id === selected.event.calendarId)
    : undefined

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="wordmark">easy-Calender</h1>

        <CalendarList
          accounts={accounts}
          calendars={calendars}
          loading={loading}
          onToggle={setVisible}
          onRemove={removeAccount}
        />

        <div className="sidebar-actions">
          <button type="button" className="button" onClick={connectGoogle} disabled={connecting}>
            {connecting ? 'Warte auf Anmeldung im Browser …' : 'Google-Konto verbinden'}
          </button>
        </div>

        <StatusBadge status={status} />
      </aside>

      <main className="content">
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              Schliessen
            </button>
          </div>
        )}
        <CalendarView
          calendars={calendars}
          colorScheme={colorScheme}
          onSelect={selectEvent}
          onError={showError}
        />
      </main>

      {selected && (
        <EventDetails
          key={selected.event.id}
          event={selected.event}
          calendar={selectedCalendar}
          anchor={selected.anchor}
          onClose={closeDetails}
        />
      )}
    </div>
  )
}

export default App
