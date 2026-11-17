import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Account,
  Calendar,
  CalendarEvent,
  CalendarOptions,
  DbStatus,
  EventInput,
  Settings
} from '../../shared/types'
import CalendarList from './components/CalendarList'
import { toLocalDate, VIEWS } from './calendarViews'
import CalendarView, { type CalendarHandle, type VisibleRange } from './components/CalendarView'
import EventDetails, { type AnchorRect } from './components/EventDetails'
import AssistantPanel from './components/AssistantPanel'
import EventForm, { type FormTarget } from './components/EventForm'
import MiniMonth from './components/MiniMonth'
import SearchResults from './components/SearchResults'
import SettingsPanel from './components/SettingsPanel'
import StatusBadge from './components/StatusBadge'
import SyncPanel from './components/SyncPanel'
import { addDays, parseLocal } from './dates'
import { useColorScheme } from './useColorScheme'

/** Electron stellt Fehlern aus dem Main-Prozess einen technischen Vorspann voran. */
function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

type Provider = 'google' | 'microsoft'

/** Gesucht wird ein halbes Jahr zurück und ein Jahr voraus. */
const SEARCH_DAYS_BACK = 182
const SEARCH_DAYS_AHEAD = 365

/** Ein Popover ohne Termin im Kalender erscheint in der Fenstermitte. */
function centerAnchor(): AnchorRect {
  const x = window.innerWidth / 2 - 160
  const y = window.innerHeight / 3
  return { top: y, bottom: y, left: x, right: x }
}

/** Ob der Fokus in einem Eingabefeld steht. Dort gehören die Tasten dem Feld. */
function typing(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"]'))
}

function App(): React.JSX.Element {
  const colorScheme = useColorScheme()
  const calendarRef = useRef<CalendarHandle>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const gotoRef = useRef<HTMLFormElement>(null)
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
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [visible, setVisibleRange] = useState<VisibleRange | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<{ query: string; results: CalendarEvent[] | null } | null>(
    null
  )
  const [gotoOpen, setGotoOpen] = useState(false)
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
  const print = useCallback(() => window.print(), [])

  const startCreate = useCallback((start: Date, end: Date, allDay: boolean) => {
    setSelected(null)
    setForm({ kind: 'create', start, end, allDay })
  }, [])

  /** Öffnet einen Vorschlag des Assistenten im normalen Formular. */
  const editProposal = useCallback((calendarId: string, input: EventInput) => {
    setSelected(null)
    setForm({
      kind: 'create',
      start: parseLocal(input.start),
      end: parseLocal(input.end),
      allDay: input.allDay,
      draft: {
        title: input.title,
        calendarId,
        location: input.location,
        description: input.description
      }
    })
  }, [])

  const createNow = useCallback((): void => {
    // Vorgabe: die nächste volle Stunde, eine Stunde lang.
    const start = new Date()
    start.setHours(start.getHours() + 1, 0, 0, 0)
    startCreate(start, new Date(start.getTime() + 3_600_000), false)
  }, [startCreate])

  /** Springt im Kalender zu einem Tag und schliesst eine allfällige Suche. */
  const gotoDate = useCallback((date: Date) => {
    setSearch(null)
    // Erst nach dem Wechsel von der Suche zurück gibt es den Kalender wieder.
    requestAnimationFrame(() => calendarRef.current?.gotoDate(date))
  }, [])

  // Klick auf eine Erinnerung: zum Termin springen und ihn zeigen.
  useEffect(
    () =>
      window.api.onReminderOpened((event) => {
        gotoDate(parseLocal(event.start))
        setSelected({ event, anchor: centerAnchor() })
      }),
    [gotoDate]
  )

  const runSearch = (event: React.FormEvent): void => {
    event.preventDefault()
    const text = query.trim()
    if (!text) return
    setSelected(null)
    setSearch({ query: text, results: null })
    const today = new Date()
    const ranges = [
      { start: toLocalDate(addDays(today, -SEARCH_DAYS_BACK)), end: toLocalDate(today) },
      { start: toLocalDate(today), end: toLocalDate(addDays(today, SEARCH_DAYS_AHEAD)) }
    ]
    Promise.all(ranges.map((range) => window.api.searchEvents(text, range)))
      .then((parts) => {
        const seen = new Set<string>()
        const results = parts
          .flatMap((part) => part.events)
          .filter((entry) => {
            const key = `${entry.calendarId}|${entry.id}|${entry.start}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          .sort((a, b) => parseLocal(a.start).getTime() - parseLocal(b.start).getTime())
        const problems = [...new Set(parts.flatMap((part) => part.problems))]
        if (problems.length > 0) {
          setError(`Nicht alle Kalender wurden durchsucht. ${problems.join(' · ')}`)
        }
        setSearch((current) => (current?.query === text ? { query: text, results } : current))
      })
      .catch((searchError) => {
        setError(errorMessage(searchError))
        setSearch(null)
      })
  }

  const openSearchResult = (event: CalendarEvent): void => {
    gotoDate(parseLocal(event.start))
    setSelected({ event, anchor: centerAnchor() })
  }

  const editSelected = (): void => {
    if (!selected) return
    setForm({ kind: 'edit', event: selected.event })
    setSelected(null)
  }

  /** Lädt die ganze Serie zu einem Vorkommen und öffnet sie im Formular. */
  const editSeries = (): void => {
    if (!selected?.event.seriesId) return
    const { event } = selected
    setSelected(null)
    window.api
      .getEvent(event.calendarId, event.seriesId!)
      .then((master) => {
        if (!master) throw new Error('Die Serie gibt es nicht mehr.')
        setForm({ kind: 'edit', event: master })
      })
      .catch((loadError) => setError(errorMessage(loadError)))
  }

  /** Öffnet einen neuen Termin mit allem vom gewählten, wie «Kopieren» in Outlook. */
  const duplicateSelected = (): void => {
    if (!selected) return
    const { event } = selected
    setSelected(null)
    setForm({
      kind: 'create',
      start: parseLocal(event.start),
      end: parseLocal(event.end),
      allDay: event.allDay,
      draft: {
        title: event.title,
        calendarId: event.calendarId,
        location: event.location,
        description: event.description,
        showAs: event.showAs,
        private: event.private,
        reminderMinutes: event.reminderMinutes,
        categories: event.categories
      }
    })
  }

  const deleteSelected = useCallback((): void => {
    if (!selected) return
    const { event } = selected
    const sure = window.confirm(
      `«${event.title}» löschen?${event.recurrence === 'SERIE' ? '\n\nGelöscht wird nur dieser eine Termin der Serie.' : ''}`
    )
    if (!sure) return
    setSelected(null)
    setError(null)
    window.api
      .deleteEvent(event.calendarId, event.id)
      .then(reloadEvents)
      .catch((deleteError) => setError(errorMessage(deleteError)))
  }, [selected, reloadEvents])

  const deleteSeries = (): void => {
    if (!selected?.event.seriesId) return
    const { event } = selected
    const sure = window.confirm(
      `Die ganze Serie «${event.title}» löschen?\n\nAlle Termine der Serie verschwinden, auch die vergangenen.`
    )
    if (!sure) return
    setSelected(null)
    setError(null)
    window.api
      .deleteEvent(event.calendarId, event.seriesId!)
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

  // Das «Gehe zu Datum»-Popover öffnen.
  useEffect(() => {
    const popover = gotoRef.current
    if (gotoOpen && popover && !popover.matches(':popover-open')) {
      popover.showPopover()
      popover.querySelector('input')?.focus()
    }
  }, [gotoOpen])

  // Tastenkürzel wie in Outlook.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      const ctrl = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (ctrl && event.altKey && /^[1-5]$/.test(event.key)) {
        event.preventDefault()
        setSearch(null)
        const view = VIEWS[Number(event.key) - 1].name
        requestAnimationFrame(() => calendarRef.current?.changeView(view))
      } else if (ctrl && !event.altKey && key === 'n') {
        event.preventDefault()
        createNow()
      } else if (ctrl && (key === 'e' || key === 'f')) {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (ctrl && key === 'g') {
        event.preventDefault()
        setGotoOpen(true)
      } else if (ctrl && key === 'p') {
        event.preventDefault()
        window.print()
      } else if (!ctrl && !typing(event.target) && !form) {
        if (event.key === 'Delete' && selected) deleteSelected()
        else if (event.altKey && event.key === 'ArrowLeft') calendarRef.current?.prev()
        else if (event.altKey && event.key === 'ArrowRight') calendarRef.current?.next()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [createNow, deleteSelected, form, selected])

  const selectedCalendar = selected
    ? calendars.find((calendar) => calendar.id === selected.event.calendarId)
    : undefined
  const onlyDemo = accounts.length > 0 && accounts.every((account) => account.provider === 'demo')
  const categories = settings?.categories ?? []

  return (
    <div className={assistantOpen ? 'app with-assistant' : 'app'}>
      <aside className="sidebar">
        <h1 className="wordmark">easy-Calender</h1>

        <div className="sidebar-actions">
          <button
            type="button"
            className="button button-strong"
            onClick={createNow}
            disabled={!calendars.some((calendar) => !calendar.hidden)}
            title="Ctrl+N"
          >
            Neuer Termin
          </button>
          <button
            type="button"
            className="button"
            aria-pressed={assistantOpen}
            onClick={() => setAssistantOpen((open) => !open)}
          >
            Assistent
          </button>
          <form className="search-form" role="search" onSubmit={runSearch}>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                if (!event.target.value) setSearch(null)
              }}
              placeholder="Termine suchen"
              aria-label="Termine suchen (Ctrl+E)"
              maxLength={200}
            />
          </form>
        </div>

        <div className="sidebar-scroll">
          {visible && settings && (
            <MiniMonth
              current={visible.current}
              rangeStart={visible.start}
              rangeEnd={visible.end}
              firstDay={settings.view.firstDay}
              weekNumbers={settings.view.weekNumbers}
              onPick={gotoDate}
            />
          )}

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

          {settings && <SettingsPanel settings={settings} onChange={saveSettings} />}
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
        {search ? (
          <SearchResults
            query={search.query}
            results={search.results}
            calendars={calendars}
            onOpen={openSearchResult}
            onClose={() => setSearch(null)}
          />
        ) : (
          settings && (
            <CalendarView
              ref={calendarRef}
              calendars={calendars}
              categories={categories}
              view={settings.view}
              colorScheme={colorScheme}
              reloadKey={reloadKey}
              onSelect={selectEvent}
              onCreate={startCreate}
              onChanged={reloadEvents}
              onRangeChange={setVisibleRange}
              onPrint={print}
              onError={showError}
            />
          )
        )}
      </main>

      {assistantOpen && (
        <AssistantPanel
          onCreated={reloadEvents}
          onEdit={editProposal}
          onClose={() => setAssistantOpen(false)}
        />
      )}

      {selected && (
        <EventDetails
          key={`${selected.event.calendarId}|${selected.event.id}`}
          event={selected.event}
          calendar={selectedCalendar}
          categories={categories}
          anchor={selected.anchor}
          onEdit={editSelected}
          onEditSeries={editSeries}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onDeleteSeries={deleteSeries}
          onClose={closeDetails}
        />
      )}

      {form && (
        <EventForm
          key={form.kind === 'edit' ? form.event.id : form.start.getTime()}
          target={form}
          calendars={calendars.filter((calendar) => !calendar.hidden)}
          categories={categories}
          onSaved={() => {
            setForm(null)
            reloadEvents()
          }}
          onClose={closeForm}
        />
      )}

      {gotoOpen && (
        <form
          ref={gotoRef}
          popover="auto"
          className="goto-form"
          aria-label="Gehe zu Datum"
          onToggle={(event) => {
            if ((event.nativeEvent as ToggleEvent).newState === 'closed') setGotoOpen(false)
          }}
          onSubmit={(event) => {
            event.preventDefault()
            const value = new FormData(event.currentTarget).get('date')
            if (typeof value === 'string' && value) gotoDate(parseLocal(value))
            setGotoOpen(false)
          }}
        >
          <label className="field">
            <span>Gehe zu Datum</span>
            <input
              type="date"
              name="date"
              defaultValue={toLocalDate(visible?.current ?? new Date())}
              required
            />
          </label>
          <button type="submit" className="button button-strong">
            Anzeigen
          </button>
        </form>
      )}
    </div>
  )
}

export default App
