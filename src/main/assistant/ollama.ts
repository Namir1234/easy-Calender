/** Ollama läuft lokal und ist nur von diesem Rechner aus erreichbar. */
export const OLLAMA_URL = 'http://127.0.0.1:11434'

/** Das Modell, das die App vorschlägt: klein, schnell, kann Deutsch. */
export const DEFAULT_MODEL = 'qwen2.5:3b'

const TIMEOUT_MS = 120_000

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type Fetch = typeof fetch

/** Eine Meldung, die direkt in der Oberfläche stehen kann. */
export class OllamaError extends Error {}

/** Das Modell hat kein gültiges JSON geliefert (meist hängen geblieben). */
export class UnreadableAnswer extends OllamaError {}

/** Spricht mit dem lokal installierten Ollama. */
export class OllamaClient {
  constructor(
    private readonly fetchFn: Fetch = fetch,
    private readonly baseUrl = OLLAMA_URL
  ) {}

  private async request<T>(path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
    } catch (error) {
      if ((error as Error)?.name === 'TimeoutError') {
        throw new OllamaError('Ollama hat nicht rechtzeitig geantwortet.')
      }
      throw new OllamaError(
        'Ollama läuft nicht. Installiere es von ollama.com oder starte es über das Startmenü.'
      )
    }
    const data = (await response.json().catch(() => ({}))) as T & { error?: string }
    if (!response.ok) {
      throw new OllamaError(`Ollama meldet: ${data.error ?? response.statusText}`)
    }
    return data
  }

  /** Die Namen der heruntergeladenen Modelle. */
  async listModels(): Promise<string[]> {
    const data = await this.request<{ models?: Array<{ name?: string }> }>('/api/tags')
    return (data.models ?? []).flatMap((model) => (model.name ? [model.name] : []))
  }

  /** Fragt das Modell und verlangt eine Antwort nach dem JSON-Schema. */
  async chat(model: string, messages: ChatMessage[], schema: object): Promise<unknown> {
    const data = await this.request<{ message?: { content?: string } }>('/api/chat', {
      model,
      messages,
      format: schema,
      stream: false,
      // Kein Würfeln: Gleiche Eingabe, gleiche Antwort.
      // Höchstens so viele Tokens: Kleine Modelle bleiben sonst manchmal
      // in einer Schleife hängen, bis die Zeit abläuft.
      options: { temperature: 0, num_predict: 300 }
    })
    try {
      return JSON.parse(data.message?.content ?? '')
    } catch {
      throw new UnreadableAnswer('Das habe ich nicht verstanden. Schreib es bitte etwas anders.')
    }
  }
}

/**
 * Wählt das Modell: das vorgeschlagene, wenn es da ist, sonst das erste
 * heruntergeladene. Ohne Modell gibt es eine Anleitung statt einer Antwort.
 */
export function pickModel(installed: string[], preferred = DEFAULT_MODEL): string {
  const match = installed.find((name) => name === preferred || name === `${preferred}:latest`)
  if (match) return match
  if (installed.length > 0) return installed[0]
  throw new OllamaError(
    `In Ollama ist noch kein Modell geladen. Öffne ein Terminal und gib ein: ollama pull ${preferred}`
  )
}
