import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PROVIDER_LABELS,
  type Account,
  type Calendar,
  type SyncPair,
  type SyncStatus
} from '../../../shared/types'

interface Props {
  accounts: Account[]
  calendars: Calendar[]
  /** Ein Abgleich ist durchgelaufen: Die Termine sollen neu geladen werden. */
  onSynced(): void
  onError(message: string): void
}

const POLL_MS = 20_000
const TIME_FORMAT = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' })

/** Kalenderpaare für den Abgleich (Google, Outlook, iCloud) und der Stand des Abgleichs. */
function SyncPanel({ accounts, calendars, onSynced, onError }: Props): React.JSX.Element {
  const [pairs, setPairs] = useState<SyncPair[]>([])
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [firstId, setFirstId] = useState('')
  const [secondId, setSecondId] = useState('')
  const [busy, setBusy] = useState(false)
  const lastRun = useRef<string | null>(null)

  // Abgleichen lassen sich alle echten Kalender, die nicht aus der App entfernt sind.
  const realAccounts = new Map(
    accounts
      .filter((account) => account.provider !== 'demo')
      .map((account) => [account.id, account])
  )
  const choices = calendars.filter(
    (calendar) => realAccounts.has(calendar.accountId) && !calendar.hidden
  )
  /** Name mit Anbieter und Konto, weil Kalender in mehreren Konten gleich heissen können. */
  const nameOf = (id: string): string => {
    const calendar = calendars.find((entry) => entry.id === id)
    if (!calendar) return 'Unbekannter Kalender'
    const account = accounts.find((entry) => entry.id === calendar.accountId)
    return account
      ? `${calendar.name} (${PROVIDER_LABELS[account.provider]}, ${account.email})`
      : calendar.name
  }
  const first = choices.some((calendar) => calendar.id === firstId) ? firstId : choices[0]?.id
  const secondChoices = choices.filter((calendar) => calendar.id !== first)
  const second = secondChoices.some((calendar) => calendar.id === secondId)
    ? secondId
    : secondChoices[0]?.id

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
      if (!first || !second) return
      await window.api.addSyncPair(first, second)
      setPairs(await window.api.listSyncPairs())
      applyStatus(await window.api.syncNow())
    })

  const removePair = (pair: SyncPair): void => {
    const sure = window.confirm(
      `Abgleich «${nameOf(pair.calendarAId)} ↔ ${nameOf(pair.calendarBId)}» beenden?\n\nDie Termine bleiben in beiden Kalendern stehen. Sie werden nur nicht mehr abgeglichen.`
    )
    if (!sure) return
    run(async () => {
      await window.api.removeSyncPair(pair.id)
      setPairs(await window.api.listSyncPairs())
    })
  }

  const syncNow = (): void => run(async () => applyStatus(await window.api.syncNow()))

  const canPair = choices.length > 1

  return (
    <section className="sync" aria-label="Synchronisation">
      <h2 className="section-title">Synchronisation</h2>

      {!canPair && pairs.length === 0 && (
        <p className="section-hint">
          Verbinde zwei Konten (Google, Outlook oder iCloud). Danach lassen sich zwei Kalender
          abgleichen.
        </p>
      )}

      {pairs.length > 0 && (
        <ul className="pair-list">
          {pairs.map((pair) => (
            <li key={pair.id}>
              <span className="pair-name">
                {nameOf(pair.calendarAId)} ↔ {nameOf(pair.calendarBId)}
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
            <span>Kalender</span>
            <select value={first} onChange={(event) => setFirstId(event.target.value)}>
              {choices.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {nameOf(calendar.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>abgleichen mit</span>
            <select value={second} onChange={(event) => setSecondId(event.target.value)}>
              {secondChoices.map((calendar) => (
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
