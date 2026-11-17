import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AssistantReply,
  AssistantStatus,
  AssistantTurn,
  EventInput
} from '../../../shared/types'

interface Props {
  /** Ein Termin wurde eingetragen: Die Ansicht soll neu laden. */
  onCreated(): void
  /** Den Vorschlag im normalen Formular weiterbearbeiten. */
  onEdit(calendarId: string, input: EventInput): void
  onClose(): void
}

type Proposal = Extract<AssistantReply, { kind: 'proposal' }>

interface Message {
  id: number
  from: 'user' | 'assistant'
  text: string
  /** Ein Vorschlag, der auf Bestätigung wartet */
  proposal?: Proposal
  /** Hinweis statt Gesprächsbeitrag, z. B. «Ollama läuft nicht» */
  problem?: boolean
}

const DATE = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: 'numeric', month: 'long' })
const TIME = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' })

function parseLocal(value: string): Date {
  if (value.includes('T')) return new Date(value)
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** «Mi., 19. November, 14:00 bis 14:30 Uhr» oder «Fr., 21. November, ganztägig» */
function describeWhen(input: EventInput): string {
  const start = parseLocal(input.start)
  const end = parseLocal(input.end)
  if (input.allDay) {
    end.setDate(end.getDate() - 1)
    return end > start
      ? `${DATE.format(start)} bis ${DATE.format(end)}, ganztägig`
      : `${DATE.format(start)}, ganztägig`
  }
  const sameDay = start.toDateString() === end.toDateString()
  return sameDay
    ? `${DATE.format(start)}, ${TIME.format(start)} bis ${TIME.format(end)} Uhr`
    : `${DATE.format(start)}, ${TIME.format(start)} Uhr bis ${DATE.format(end)}, ${TIME.format(end)} Uhr`
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/**
 * Chat zum Eintragen von Terminen. Ein lokales Modell (Ollama) versteht den
 * Satz und macht einen Vorschlag. Eingetragen wird erst nach «Eintragen».
 */
function AssistantPanel({ onCreated, onEdit, onClose }: Props): React.JSX.Element {
  const [status, setStatus] = useState<AssistantStatus | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  /** Der Verlauf seit dem letzten abgeschlossenen Vorschlag, für Rückfragen */
  const [context, setContext] = useState<AssistantTurn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const nextId = useRef(1)
  const listRef = useRef<HTMLDivElement>(null)

  const loadStatus = useCallback(
    () =>
      window.api
        .assistantStatus()
        .then(setStatus)
        .catch((error) => setStatus({ ready: false, problem: errorText(error) })),
    []
  )

  const checkStatus = useCallback(() => {
    setStatus(null)
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, busy])

  const add = (message: Omit<Message, 'id'>): void =>
    setMessages((current) => [...current, { ...message, id: nextId.current++ }])

  const settle = (id: number, text: string): void =>
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, proposal: undefined, text } : message
      )
    )

  const send = (): void => {
    const text = draft.trim()
    if (!text || busy) return
    const turns: AssistantTurn[] = [...context, { role: 'user', text }]
    add({ from: 'user', text })
    setDraft('')
    setBusy(true)
    window.api
      .askAssistant(turns)
      .then((reply) => {
        if (reply.kind === 'question') {
          add({ from: 'assistant', text: reply.text })
          setContext([...turns, { role: 'assistant', text: reply.text }])
        } else if (reply.kind === 'problem') {
          add({ from: 'assistant', text: reply.text, problem: true })
          checkStatus()
        } else {
          add({ from: 'assistant', text: 'Soll ich das so eintragen?', proposal: reply })
          setContext([])
        }
      })
      .catch((error) => add({ from: 'assistant', text: errorText(error), problem: true }))
      .finally(() => setBusy(false))
  }

  const accept = (message: Message): void => {
    const { proposal } = message
    if (!proposal) return
    setBusy(true)
    window.api
      .createEvent(proposal.calendarId, proposal.input)
      .then(() => {
        settle(message.id, `Eingetragen: «${proposal.input.title}» in ${proposal.calendarName}.`)
        onCreated()
      })
      .catch((error) => add({ from: 'assistant', text: errorText(error), problem: true }))
      .finally(() => setBusy(false))
  }

  return (
    <aside className="assistant" aria-label="Assistent">
      <header className="assistant-head">
        <h2>Assistent</h2>
        <button type="button" className="link-button" onClick={onClose}>
          Schliessen
        </button>
      </header>

      <div className="assistant-messages" ref={listRef} aria-live="polite">
        {status && !status.ready && (
          <div className="assistant-setup">
            <p>{status.problem}</p>
            <ol>
              <li>
                Ollama von <strong>ollama.com</strong> herunterladen und installieren.
              </li>
              <li>
                Im Terminal eingeben: <code>ollama pull qwen2.5:3b</code>
              </li>
            </ol>
            <button type="button" className="button" onClick={checkStatus}>
              Nochmals prüfen
            </button>
          </div>
        )}

        {status?.ready && messages.length === 0 && (
          <p className="assistant-hint">
            Schreib einfach, was du eintragen willst, zum Beispiel «Morgen 14 Uhr Zahnarzt» oder
            «Freitag ganztägig Ausflug im Schulkalender». Ich zeige dir vor dem Eintragen, was ich
            verstanden habe.
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`assistant-message from-${message.from}${message.problem ? ' is-problem' : ''}`}
          >
            <p>{message.text}</p>
            {message.proposal && (
              <div className="assistant-proposal">
                <strong>{message.proposal.input.title}</strong>
                <span>{describeWhen(message.proposal.input)}</span>
                {message.proposal.input.location && <span>{message.proposal.input.location}</span>}
                <span className="assistant-calendar">{message.proposal.calendarName}</span>
                <div className="assistant-actions">
                  <button
                    type="button"
                    className="button button-strong"
                    onClick={() => accept(message)}
                    disabled={busy}
                  >
                    Eintragen
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      settle(message.id, 'Im Formular geöffnet.')
                      onEdit(message.proposal!.calendarId, message.proposal!.input)
                    }}
                  >
                    Ändern
                  </button>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => settle(message.id, 'Verworfen.')}
                  >
                    Verwerfen
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {busy && <p className="assistant-thinking">Denkt nach …</p>}
      </div>

      <form
        className="assistant-input"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter schickt ab, Shift+Enter macht eine neue Zeile.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
          placeholder="Was soll ich eintragen?"
          rows={2}
          maxLength={2000}
          disabled={!status?.ready}
          aria-label="Nachricht an den Assistenten"
        />
        <button
          type="submit"
          className="button button-strong"
          disabled={!status?.ready || busy || !draft.trim()}
        >
          Senden
        </button>
      </form>
    </aside>
  )
}

export default AssistantPanel
