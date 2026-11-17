import { useCallback, useEffect, useState } from 'react'
import type {
  Account,
  Calendar,
  CalendarEvent,
  CalendarOptions,
  DbStatus,
  Settings
} from '../../shared/types'
import CalendarList from './components/CalendarList'
import CalendarView from './components/CalendarView'
import EventDetails, { type AnchorRect } from './components/EventDetails'
import EventForm, { type FormTarget } from './components/EventForm'
import StatusBadge from './components/StatusBadge'
import SyncPanel from './components/SyncPanel'
import { useColorScheme } from './useColorScheme'

/** Electron stellt Fehlern aus dem Main-Prozess einen technischen Vorspann voran. */
function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

type Provider = 'google' | 'microsoft'

function App(): React.JSX.Element {
  const colorScheme = useColorScheme()
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<Provider | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ event: CalendarEvent; anchor: AnchorRect } | null>(
    null
  )
  const [form, setForm] = useState<FormTarget | null>(null)
  /** Zählt hoch, wenn die Termine neu geladen werden sollen. */
  const [reloadKey, setReloadKey] = useState(0)

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
    Promise.all([
      window.api.getStatus(),
      window.api.listAccounts(),
      window.api.listCalendars(),
      window.api.getSettings()
    ])
      .then(([loadedStatus, loadedAccounts, loadedCalendars, loadedSettings]) => {
        if (cancelled) return
        setStatus(loadedStatus)
        setAccounts(loadedAccounts)
        setCalendars(loadedCalendars)
        setSettings(loadedSettings)
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

  const connect = useCallback(
    (provider: Provider) => {
      setConnecting(provider)
      setLinkCopied(false)
      setError(null)
      const login =
        provider === 'google' ? window.api.connectGoogle() : window.api.connectMicrosoft()
      login
        .then(loadAccounts)
        .catch((connectError) => setError(errorMessage(connectError)))
        .finally(() => setConnecting(null))
    },
    [loadAccounts]
  )

  const loginAction = useCallback((action: 'reopen' | 'copy' | 'cancel') => {
    const run =
      action === 'reopen'
        ? window.api.reopenLogin()
        : action === 'copy'
          ? window.api.copyLoginLink().then(() => setLinkCopied(true))
          : window.api.cancelLogin()
    run.catch((actionError) => setError(errorMessage(actionError)))
  }, [])

  const removeAccount = useCallback(
    (account: Account) => {
      const sure = window.confirm(
        `${account.email} entfernen?\n\nDie Termine bleiben beim Anbieter erhalten. Die App zeigt sie nur nicht mehr an.`
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

  const reloadEvents = useCallback(() => setReloadKey((current) => current + 1), [])

  const setCalendarOptions = useCallback((calendar: Calendar, options: CalendarOptions) => {
    // Sofort anzeigen, damit die Farbwahl flüssig bleibt.
    setCalendars((current) =>
      current.map((entry) =>
        entry.id === calendar.id
          ? {
              ...entry,
              color: options.color ?? entry.color,
              hidden: Boolean(options.hidden),
              allDayOnly: Boolean(options.allDayOnly)
            }
          : entry
      )
    )
    window.api
      .setCalendarOptions(calendar.id, options)
      .then(() => {
        // Die Farbe ändert die Termine nicht, alles andere schon.
        if (
          Boolean(options.hidden) !== Boolean(calendar.hidden) ||
          Boolean(options.allDayOnly) !== Boolean(calendar.allDayOnly)
        ) {
          setReloadKey((current) => current + 1)
        }
      })
      .catch((saveError) => setError(errorMessage(saveError)))
  }, [])

  const createCalendar = useCallback(
    async (account: Account, name: string) => {
      setError(null)
      try {
        await window.api.createCalendar(account.id, name)
        await loadAccounts()
      } catch (createError) {
        setError(errorMessage(createError))
        throw createError
      }
    },
    [loadAccounts]
  )
  const selectEvent = useCallback((event: CalendarEvent, anchor: AnchorRect) => {
    setSelected({ event, anchor })
  }, [])
  const closeDetails = useCallback(() => setSelected(null), [])
  const closeForm = useCallback(() => setForm(null), [])
  const showError = useCallback((message: string) => setError(errorMessage(message)), [])

  const startCreate = useCallback((start: Date, end: Date, allDay: boolean) => {
    setSelected(null)
    setForm({ kind: 'create', start, end, allDay })
  }, [])

  const createNow = (): void => {
    // Vorgabe: die nächste volle Stunde, eine Stunde lang.
    const start = new Date()
    start.setHours(start.getHours() + 1, 0, 0, 0)
    startCreate(start, new Date(start.getTime() + 3_600_000), false)
  }

  const editSelected = (): void => {
    if (!selected) return
    setForm({ kind: 'edit', event: selected.event })
    setSelected(null)
  }

  const deleteSelected = (): void => {
    if (!selected) return
    const { event } = selected
    const sure = window.confirm(
      `«${event.title}» löschen?${event.recurrence ? '\n\nGelöscht wird nur dieser eine Termin der Serie.' : ''}`
    )
    if (!sure) return
    setSelected(null)
    setError(null)
    window.api
      .deleteEvent(event.calendarId, event.id)
      .then(reloadEvents)
      .catch((deleteError) => setError(errorMessage(deleteError)))
  }

  const saveSettings = (next: Settings): void => {
    setSettings(next)
    window.api
      .setSettings(next)
      .then(setSettings)
      .catch((saveError) => setError(errorMessage(saveError)))
  }

  const selectedCalendar = selected
    ? calendars.find((calendar) => calendar.id === selected.event.calendarId)
    : undefined
  const onlyDemo = accounts.length > 0 && accounts.every((account) => account.provider === 'demo')

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="wordmark">easy-Calender</h1>

        <div className="sidebar-actions">
          <button
            type="button"
            className="button button-strong"
            onClick={createNow}
            disabled={!calendars.some((calendar) => !calendar.hidden)}
          >
            Neuer Termin
          </button>
        </div>

        <div className="sidebar-scroll">
          {onlyDemo && (
            <p className="demo-note">
              Das sind Beispieldaten. Verbinde unten ein Konto, um deine eigenen Kalender zu sehen.
            </p>
          )}

          <CalendarList
            accounts={accounts}
            calendars={calendars}
            loading={loading}
            onToggle={setVisible}
            onOptions={setCalendarOptions}
            onCreate={createCalendar}
            onRemove={removeAccount}
          />

          <div className="sidebar-actions">
            <button
              type="button"
              className="button"
              onClick={() => connect('google')}
              disabled={connecting !== null}
            >
              {connecting === 'google'
                ? 'Warte auf Anmeldung im Browser …'
                : 'Google-Konto verbinden'}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => connect('microsoft')}
              disabled={connecting !== null}
            >
              {connecting === 'microsoft' ? 'Outlook wird verbunden …' : 'Outlook verbinden'}
            </button>
            {connecting === 'google' && (
              <div className="login-help">
                <p>
                  Die Anmeldung läuft in deinem Browser, in einem neuen Tab. Ist dort keine
                  Anmeldeseite aufgegangen?
                </p>
                <button type="button" className="link-button" onClick={() => loginAction('reopen')}>
                  Seite nochmals öffnen
                </button>
                <button type="button" className="link-button" onClick={() => loginAction('copy')}>
                  {linkCopied ? 'Link kopiert' : 'Link kopieren'}
                </button>
                <button type="button" className="link-button" onClick={() => loginAction('cancel')}>
                  Abbrechen
                </button>
              </div>
            )}
          </div>

          <SyncPanel
            accounts={accounts}
            calendars={calendars}
            onSynced={reloadEvents}
            onError={showError}
          />

          {settings && (
            <section className="settings" aria-label="Einstellungen">
              <h2 className="section-title">Einstellungen</h2>
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.autostart}
                  onChange={(event) =>
                    saveSettings({ ...settings, autostart: event.target.checked })
                  }
                />
                <span>Mit Windows starten</span>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.closeToTray}
                  onChange={(event) =>
                    saveSettings({ ...settings, closeToTray: event.target.checked })
                  }
                />
                <span>Beim Schliessen im Hintergrund weiterlaufen</span>
              </label>
            </section>
          )}
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
          reloadKey={reloadKey}
          onSelect={selectEvent}
          onCreate={startCreate}
          onError={showError}
        />
      </main>

      {selected && (
        <EventDetails
          key={selected.event.id}
          event={selected.event}
          calendar={selectedCalendar}
          anchor={selected.anchor}
          onEdit={editSelected}
          onDelete={deleteSelected}
          onClose={closeDetails}
        />
      )}

      {form && (
        <EventForm
          key={form.kind === 'edit' ? form.event.id : form.start.getTime()}
          target={form}
          calendars={calendars.filter((calendar) => !calendar.hidden)}
          onSaved={() => {
            setForm(null)
            reloadEvents()
          }}
          onClose={closeForm}
        />
      )}
    </div>
  )
}

export default App
