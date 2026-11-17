import type {
  Account,
  AssistantReply,
  AssistantStatus,
  AssistantTurn,
  Calendar
} from '../../shared/types'
import {
  answerSchema,
  calendarNamedIn,
  mainCalendar,
  mentionsWhen,
  mismatch,
  systemPrompt,
  toReply,
  type AssistantCalendar
} from './interpret'
import { OllamaClient, OllamaError, UnreadableAnswer, pickModel, type ChatMessage } from './ollama'

const MAX_TURNS = 10
const ASK_WHEN = 'Wann ist das? Sag mir Tag und Uhrzeit.'
const MAX_TEXT = 2000

/** Prüft den Gesprächsverlauf, der von der Oberfläche kommt. */
export function parseTurns(input: unknown): AssistantTurn[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('Nachricht fehlt')
  const turns = input.slice(-MAX_TURNS).map((entry): AssistantTurn => {
    const raw =
      typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}
    if (raw.role !== 'user' && raw.role !== 'assistant') throw new Error('Ungültige Nachricht')
    if (typeof raw.text !== 'string' || !raw.text.trim()) throw new Error('Leere Nachricht')
    return { role: raw.role, text: raw.text.slice(0, MAX_TEXT) }
  })
  if (turns[turns.length - 1].role !== 'user')
    throw new Error('Die letzte Nachricht muss von dir sein')
  return turns
}

export interface AssistantServiceOptions {
  client?: OllamaClient
  listAccounts(): Promise<Account[]>
  /** Kalender, in die eingetragen werden darf (sichtbar und nicht entfernt) */
  listCalendars(): Promise<Calendar[]>
  now?: () => Date
}

/**
 * Versteht Sätze wie «morgen 14 Uhr Zahnarzt» mit einem lokalen Modell
 * und macht daraus einen Terminvorschlag. Eingetragen wird erst, wenn
 * der Vorschlag in der Oberfläche bestätigt ist.
 */
export class AssistantService {
  private readonly client: OllamaClient
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  constructor(private readonly options: AssistantServiceOptions) {
    this.client = options.client ?? new OllamaClient()
  }

  async status(): Promise<AssistantStatus> {
    try {
      const model = pickModel(await this.client.listModels())
      return { ready: true, model }
    } catch (error) {
      return { ready: false, problem: error instanceof Error ? error.message : String(error) }
    }
  }

  async ask(turns: AssistantTurn[]): Promise<AssistantReply> {
    const [accounts, calendars] = await Promise.all([
      this.options.listAccounts(),
      this.options.listCalendars()
    ])
    const known: AssistantCalendar[] = calendars.map((calendar, index) => ({
      key: `k${index + 1}`,
      id: calendar.id,
      name: calendar.name,
      account: accounts.find((account) => account.id === calendar.accountId)?.email ?? ''
    }))
    if (known.length === 0) {
      return { kind: 'question', text: 'Es ist kein Kalender sichtbar, in den ich eintragen kann.' }
    }

    try {
      const model = pickModel(await this.client.listModels())
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt(this.options.now?.() ?? new Date(), known) },
        ...turns.map((turn) => ({ role: turn.role, content: turn.text }))
      ]
      const raw = await this.client.chat(model, messages, answerSchema(known))
      const reply = toReply(raw, known, this.timeZone)
      const said = turns.filter((turn) => turn.role === 'user').map((turn) => turn.text)
      if (reply.kind === 'question') {
        // Kleine Modelle plappern bei Rückfragen gern die Anweisung nach.
        // Fehlt das Wann, stellt die App die Frage selbst; zu Langes kürzt sie.
        if (!mentionsWhen(said)) return { kind: 'question', text: ASK_WHEN }
        if (reply.text.length > 160 || /allDay|action|YYYY|HH:mm/.test(reply.text)) {
          return { kind: 'question', text: 'Kannst du mir noch etwas mehr dazu sagen?' }
        }
        return reply
      }
      if (reply.kind !== 'proposal') return reply

      // Kein Wort zum Wann: Das Modell hat den Tag geraten.
      if (!mentionsWhen(said)) {
        return { kind: 'question', text: `Wann ist «${reply.input.title}»?` }
      }
      // Stimmt der Vorschlag nicht mit der Nachricht überein, lieber nachfragen.
      const doubt = mismatch(reply.input, said)
      if (doubt) return { kind: 'question', text: doubt }
      // Den Kalender wählt die App: genannt oder sonst der Hauptkalender.
      const calendar = calendarNamedIn(said, known) ?? mainCalendar(known) ?? known[0]
      return {
        ...reply,
        calendarId: calendar.id,
        // Der Google-Hauptkalender heisst wie das Konto: nicht doppelt nennen.
        calendarName:
          calendar.name === calendar.account
            ? calendar.name
            : `${calendar.name} (${calendar.account})`
      }
    } catch (error) {
      if (error instanceof UnreadableAnswer) {
        // Meist fehlt die Angabe, wann: Dann ist das die bessere Rückfrage,
        // und das Gespräch kann weitergehen.
        const said = turns.filter((turn) => turn.role === 'user').map((turn) => turn.text)
        return {
          kind: 'question',
          text: mentionsWhen(said) ? error.message : ASK_WHEN
        }
      }
      if (error instanceof OllamaError) return { kind: 'problem', text: error.message }
      throw error
    }
  }
}
