import { useCallback, useEffect, useState } from 'react'
import type { Account, Calendar, CalendarEvent, DbStatus } from '../../shared/types'
import CalendarList from './components/CalendarList'
import CalendarView from './components/CalendarView'
import EventDetails, { type AnchorRect } from './components/EventDetails'
import StatusBadge from './components/StatusBadge'
import { useColorScheme } from './useColorScheme'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function App(): React.JSX.Element {
  const colorScheme = useColorScheme()
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ event: CalendarEvent; anchor: AnchorRect } | null>(
    null
  )

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

  const selectEvent = useCallback((event: CalendarEvent, anchor: AnchorRect) => {
    setSelected({ event, anchor })
  }, [])
  const closeDetails = useCallback(() => setSelected(null), [])

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
        />

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
          onError={setError}
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
