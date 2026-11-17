import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account, Calendar, SyncPair, SyncStatus } from '../../../shared/types'

interface Props {
  accounts: Account[]
  calendars: Calendar[]
  /** Ein Abgleich ist durchgelaufen: Die Termine sollen neu geladen werden. */
  onSynced(): void
  onError(message: string): void
}

const POLL_MS = 20_000
const TIME_FORMAT = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' })

/** Kalenderpaare für den Abgleich Google ↔ Outlook und der Stand des Abgleichs. */
function SyncPanel({ accounts, calendars, onSynced, onError }: Props): React.JSX.Element {
  const [pairs, setPairs] = useState<SyncPair[]>([])
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [googleId, setGoogleId] = useState('')
  const [outlookId, setOutlookId] = useState('')
  const [busy, setBusy] = useState(false)
  const lastRun = useRef<string | null>(null)

  const ofProvider = (provider: Account['provider']): Calendar[] => {
    const ids = new Set(
      accounts.filter((account) => account.provider === provider).map((account) => account.id)
    )
    return calendars.filter((calendar) => ids.has(calendar.accountId))
  }
  const googleCalendars = ofProvider('google')
  const outlookCalendars = ofProvider('microsoft')
  /** Name mit Konto, weil Kalender in mehreren Konten gleich heissen können. */
  const nameOf = (id: string): string => {
    const calendar = calendars.find((entry) => entry.id === id)
    if (!calendar) return 'Unbekannter Kalender'
    const account = accounts.find((entry) => entry.id === calendar.accountId)
    return account ? `${calendar.name} (${account.email})` : calendar.name
  }

  const applyStatus = useCallback(
    (next: SyncStatus) => {
      setStatus(next)
      // Nur wenn seit dem letzten Blick ein Abgleich fertig wurde, neu laden.
      if (next.lastRun && lastRun.current && next.lastRun !== lastRun.current) onSynced()
      lastRun.current = next.lastRun
    },
    [onSynced]
  )

  // Die Paare hängen an den Kalendern: Verschwindet ein Konto, verschwinden sie mit.
  const calendarKey = calendars.map((calendar) => calendar.id).join(',')
  useEffect(() => {
    let cancelled = false
    window.api
      .listSyncPairs()
      .then((loaded) => {
        if (!cancelled) setPairs(loaded)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [calendarKey])

  useEffect(() => {
    let cancelled = false
    const poll = (): void => {
      window.api
        .getSyncStatus()
        .then((next) => {
          if (!cancelled) applyStatus(next)
        })
        .catch(() => undefined)
    }
    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [applyStatus])

  const run = (work: () => Promise<unknown>): void => {
    setBusy(true)
    work()
      .catch((error) => onError(error instanceof Error ? error.message : String(error)))
      .finally(() => setBusy(false))
  }

  const addPair = (): void =>
    run(async () => {
      const google = googleId || googleCalendars[0]?.id
      const outlook = outlookId || outlookCalendars[0]?.id
      if (!google || !outlook) return
      await window.api.addSyncPair(google, outlook)
      setPairs(await window.api.listSyncPairs())
      applyStatus(await window.api.syncNow())
    })

  const removePair = (pair: SyncPair): void => {
    const sure = window.confirm(
      `Abgleich «${nameOf(pair.googleCalendarId)} ↔ ${nameOf(pair.msCalendarId)}» beenden?\n\nDie Termine bleiben in beiden Kalendern stehen. Sie werden nur nicht mehr abgeglichen.`
    )
    if (!sure) return
    run(async () => {
      await window.api.removeSyncPair(pair.id)
      setPairs(await window.api.listSyncPairs())
    })
  }

  const syncNow = (): void => run(async () => applyStatus(await window.api.syncNow()))

  const canPair = googleCalendars.length > 0 && outlookCalendars.length > 0

  return (
    <section className="sync" aria-label="Synchronisation">
      <h2 className="section-title">Synchronisation</h2>

      {!canPair && pairs.length === 0 && (
        <p className="section-hint">
          Verbinde ein Google-Konto und Outlook. Danach lassen sich zwei Kalender abgleichen.
        </p>
      )}

      {pairs.length > 0 && (
        <ul className="pair-list">
          {pairs.map((pair) => (
            <li key={pair.id}>
              <span className="pair-name">
                {nameOf(pair.googleCalendarId)} ↔ {nameOf(pair.msCalendarId)}
              </span>
              <button
                type="button"
                className="link-button"
                onClick={() => removePair(pair)}
                disabled={busy}
              >
                Abgleich beenden
              </button>
            </li>
          ))}
        </ul>
      )}

      {canPair && (
        <div className="pair-form">
          <label className="field">
            <span>Google-Kalender</span>
            <select value={googleId} onChange={(event) => setGoogleId(event.target.value)}>
              {googleCalendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {nameOf(calendar.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Outlook-Kalender</span>
            <select value={outlookId} onChange={(event) => setOutlookId(event.target.value)}>
              {outlookCalendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {nameOf(calendar.id)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="button" onClick={addPair} disabled={busy}>
            Diese zwei abgleichen
          </button>
        </div>
      )}

      {pairs.length > 0 && (
        <>
          <p className="sync-status" aria-live="polite">
            {busy || status?.running
              ? 'Abgleich läuft …'
              : status?.lastRun
                ? `${status.summary ?? ''} Zuletzt um ${TIME_FORMAT.format(new Date(status.lastRun))} Uhr.`
                : 'Noch nicht abgeglichen.'}
          </p>
          {status && status.problems.length > 0 && (
            <ul className="sync-problems">
              {status.problems.slice(0, 3).map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
              {status.problems.length > 3 && (
                <li>und {status.problems.length - 3} weitere Meldungen</li>
              )}
            </ul>
          )}
          <button type="button" className="link-button" onClick={syncNow} disabled={busy}>
            Jetzt synchronisieren
          </button>
        </>
      )}
    </section>
  )
}

export default SyncPanel
