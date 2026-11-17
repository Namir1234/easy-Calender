import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppApi, CalendarEvent, EventInput } from '../../src/shared/types'
import EventForm, { type FormTarget } from '../../src/renderer/src/components/EventForm'
import { useColorScheme } from '../../src/renderer/src/useColorScheme'
import { GOOGLE_CLIENT_ID } from './config'
import {
  clearSession,
  lastEmail,
  loadGoogleLibrary,
  loadSession,
  revoke,
  saveSession,
  signIn,
  type Session
} from './google/auth'
import {
  GoogleCalendarApi,
  SignInNeeded,
  type CalendarBackend,
  type WebCalendar
} from './google/api'
import { DEMO, DemoBackend } from './demo'
import {
  loadOptions,
  loadView,
  saveOptions,
  saveView,
  type LocalOptions,
  type ViewName
} from './store'
import MobileCalendar, { type DayRange } from './components/MobileCalendar'
import EventSheet from './components/EventSheet'
import CalendarSheet from './components/CalendarSheet'
import SignInScreen from './components/SignInScreen'

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

function App(): React.JSX.Element {
  const colorScheme = useColorScheme()
  const [session, setSession] = useState<Session | null>(() =>
    DEMO ? { token: '', email: 'beispiel@demo', expiresAt: Infinity } : loadSession(localStorage)
  )
  const [libraryReady, setLibraryReady] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [googleCalendars, setGoogleCalendars] = useState<WebCalendar[]>([])
  const [options, setOptions] = useState<Record<string, LocalOptions>>(() =>
    loadOptions(localStorage)
  )
  const [view, setView] = useState<ViewName>(() => loadView(localStorage))
  const [range, setRange] = useState<DayRange | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadedKey, setLoadedKey] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState<FormTarget | null>(null)
  const [calendarsOpen, setCalendarsOpen] = useState(false)

  /** Für den Rückweg aus dem Hintergrund: War jemand angemeldet? */
  const signedIn = useRef(Boolean(session))
  useEffect(() => {
    signedIn.current = Boolean(session)
  }, [session])

  useEffect(() => {
    loadGoogleLibrary()
      .then(() => setLibraryReady(true))
      .catch((loadError) => setError(message(loadError)))
  }, [])

  const api = useMemo<CalendarBackend | null>(
    () =>
      DEMO
        ? new DemoBackend()
        : session
          ? // Das Token liest die API bei jeder Anfrage aus dem Speicher: So
            // gilt nach einer neuen Anmeldung sofort das neue.
            new GoogleCalendarApi(() => loadSession(localStorage)?.token ?? '', session.email)
          : null,
    // Ein neues Token allein braucht keine neue API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.email]
  )

  /** Fehler anzeigen. Ist die Anmeldung abgelaufen, zurück zum Anmelden. */
  const fail = useCallback((failure: unknown) => {
    if (failure instanceof SignInNeeded) {
      clearSession(localStorage)
      setSession(null)
    }
    setError(message(failure))
  }, [])

  const login = (): void => {
    if (!GOOGLE_CLIENT_ID) return
    setSigningIn(true)
    setError(null)
    // Direkt im Tipp aufrufen, sonst blockiert Safari das Anmeldefenster.
    signIn(GOOGLE_CLIENT_ID, lastEmail(localStorage))
      .then((next) => {
        saveSession(localStorage, next)
        setSession(next)
      })
      .catch((loginError) => setError(message(loginError)))
      .finally(() => setSigningIn(false))
  }

  const logout = (): void => {
    if (
      !window.confirm(
        'Abmelden? Die Termine bleiben bei Google, die App zeigt sie nur nicht mehr an.'
      )
    )
      return
    if (session) revoke(session.token)
    clearSession(localStorage, true)
    setSession(null)
    setGoogleCalendars([])
    setEvents([])
    setCalendarsOpen(false)
  }

  // Kalenderliste nach der Anmeldung laden.
  useEffect(() => {
    if (!api) return
    let cancelled = false
    api
      .listCalendars()
      .then((loaded) => {
        if (!cancelled) setGoogleCalendars(loaded)
      })
      .catch((loadError) => {
        if (!cancelled) fail(loadError)
      })
    return () => {
      cancelled = true
    }
  }, [api, fail])

  // Google-Kalender mit den Einstellungen auf diesem Handy.
  const calendars = useMemo(
    () =>
      googleCalendars.map((calendar) => ({
        ...calendar,
        visible: options[calendar.id]?.visible ?? calendar.visible,
        color: options[calendar.id]?.color ?? calendar.color
      })),
    [googleCalendars, options]
  )
  const visibleIds = calendars
    .filter((calendar) => calendar.visible)
    .map((calendar) => calendar.id)
    .join('\n')
  /** Was gerade geladen werden soll. Weicht der fertig geladene Stand ab, lädt es noch. */
  const loadKey = `${range?.start}|${range?.end}|${visibleIds}|${reloadKey}`

  // Termine des sichtbaren Zeitraums aus allen sichtbaren Kalendern.
  useEffect(() => {
    // Ohne sichtbaren Kalender bleibt die alte Liste stehen; die Ansicht
    // zeigt ohnehin nur Termine sichtbarer Kalender.
    if (!api || !range || !visibleIds) return
    let cancelled = false
    const key = loadKey
    const ids = visibleIds.split('\n')
    Promise.allSettled(ids.map((id) => api.listEvents(id, range.start, range.end)))
      .then((results) => {
        if (cancelled) return
        const loaded = results.flatMap((result) =>
          result.status === 'fulfilled' ? result.value : []
        )
        setEvents(loaded)
        const failed = results.find((result) => result.status === 'rejected')
        if (failed) fail((failed as PromiseRejectedResult).reason)
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(key)
      })
    return () => {
      cancelled = true
    }
  }, [api, range, visibleIds, loadKey, fail])
  const loadingEvents = Boolean(api && range && visibleIds) && loadedKey !== loadKey

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  // Kommt die App aus dem Hintergrund zurück, frisch laden.
  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return
      const current = loadSession(localStorage)
      if (!DEMO && !current && signedIn.current) {
        setSession(null)
        setError('Deine Anmeldung bei Google ist abgelaufen. Melde dich nochmals an.')
      } else {
        reload()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  // Das Formular der Desktop-App ruft window.api auf. Hier geht das an Google.
  useEffect(() => {
    if (!api) return
    const watch = (saveError: unknown): never => {
      if (saveError instanceof SignInNeeded) fail(saveError)
      throw saveError
    }
    // Nur diese zwei Aufrufe braucht das Formular; den Rückgabewert liest es nicht.
    window.api = {
      createEvent: (calendarId: string, input: EventInput) =>
        api.createEvent(calendarId, input).catch(watch),
      updateEvent: (calendarId: string, eventId: string, input: EventInput) =>
        api.updateEvent(calendarId, eventId, input).catch(watch)
    } as unknown as AppApi
  }, [api, fail])

  const setCalendarOptions = (calendarId: string, change: LocalOptions): void => {
    setOptions((current) => {
      const next = { ...current, [calendarId]: { ...current[calendarId], ...change } }
      saveOptions(localStorage, next)
      return next
    })
  }

  const changeView = (next: ViewName): void => {
    setView(next)
    saveView(localStorage, next)
  }

  const writable = calendars.filter((calendar) => calendar.writable && calendar.visible)

  const createNow = (): void => {
    const start = new Date()
    start.setHours(start.getHours() + 1, 0, 0, 0)
    setForm({ kind: 'create', start, end: new Date(start.getTime() + 3_600_000), allDay: false })
  }

  const deleteSelected = (): void => {
    if (!selected || !api) return
    const event = selected
    const sure = window.confirm(
      `«${event.title}» löschen?${event.recurrence ? '\n\nGelöscht wird nur dieser eine Termin der Serie.' : ''}`
    )
    if (!sure) return
    setSelected(null)
    api.deleteEvent(event.calendarId, event.id).then(reload).catch(fail)
  }

  if (!session) {
    return (
      <SignInScreen
        clientIdMissing={!GOOGLE_CLIENT_ID}
        ready={libraryReady}
        busy={signingIn}
        again={Boolean(lastEmail(localStorage))}
        error={error}
        onSignIn={login}
      />
    )
  }

  const selectedCalendar = selected
    ? calendars.find((calendar) => calendar.id === selected.calendarId)
    : undefined

  return (
    <div className="mobile">
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            OK
          </button>
        </div>
      )}

      <MobileCalendar
        calendars={calendars}
        events={events}
        view={view}
        colorScheme={colorScheme}
        loading={loadingEvents}
        onView={changeView}
        onRange={setRange}
        onSelect={setSelected}
        onCreate={(start, end, allDay) => setForm({ kind: 'create', start, end, allDay })}
        onReload={reload}
        onCalendars={() => setCalendarsOpen(true)}
      />

      <button
        type="button"
        className="fab"
        onClick={createNow}
        disabled={writable.length === 0}
        aria-label="Neuer Termin"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {selected && (
        <EventSheet
          event={selected}
          calendar={selectedCalendar}
          onEdit={() => {
            setForm({ kind: 'edit', event: selected })
            setSelected(null)
          }}
          onDelete={deleteSelected}
          onClose={() => setSelected(null)}
        />
      )}

      {calendarsOpen && (
        <CalendarSheet
          email={session.email}
          calendars={calendars}
          onOptions={setCalendarOptions}
          onSignOut={logout}
          onClose={() => setCalendarsOpen(false)}
        />
      )}

      {form && (
        <EventForm
          key={form.kind === 'edit' ? form.event.id : form.start.getTime()}
          target={form}
          calendars={writable}
          onSaved={() => {
            setForm(null)
            reload()
          }}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  )
}

export default App
