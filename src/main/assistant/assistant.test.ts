import { describe, expect, it } from 'vitest'
import { systemPrompt, toReply, type AssistantCalendar } from './interpret'
import { OllamaClient, pickModel } from './ollama'
import { AssistantService, parseTurns } from './service'

const calendars: AssistantCalendar[] = [
  { key: 'k1', id: 'cal-privat', name: 'Privat', account: 'ich@gmail.com' },
  { key: 'k2', id: 'cal-schule', name: 'Kalender', account: 'ich@schule.ch' }
]

const answer = {
  action: 'create',
  question: '',
  title: 'Zahnarzt',
  date: '2026-11-19',
  endDate: '',
  start: '14:00',
  end: '14:30',
  allDay: false,
  calendar: 'k2',
  location: 'Zürich',
  notes: ''
}

describe('systemPrompt', () => {
  it('enthält ein Kalenderblatt mit heute und morgen und die Kalender', () => {
    const prompt = systemPrompt(new Date(2026, 10, 17, 9, 5), calendars)
    expect(prompt).toContain('Dienstag 17.11. = 2026-11-17 (heute)')
    expect(prompt).toContain('Mittwoch 18.11. = 2026-11-18 (morgen)')
    expect(prompt).toContain('09:05 Uhr')
    expect(prompt).toContain('k2: «Kalender» (Konto ich@schule.ch)')
  })
})

describe('toReply', () => {
  it('macht aus einer Antwort mit Uhrzeit einen Vorschlag in lokaler Zeit', () => {
    const reply = toReply(answer, calendars, 'Europe/Zurich')
    expect(reply).toMatchObject({
      kind: 'proposal',
      calendarId: 'cal-schule',
      calendarName: 'Kalender (ich@schule.ch)',
      input: { title: 'Zahnarzt', allDay: false, location: 'Zürich', recurrence: null }
    })
    if (reply.kind !== 'proposal') throw new Error('kein Vorschlag')
    expect(new Date(reply.input.start)).toEqual(new Date(2026, 10, 19, 14, 0))
    expect(new Date(reply.input.end)).toEqual(new Date(2026, 10, 19, 14, 30))
    expect(reply.input).not.toHaveProperty('description')
  })

  it('nimmt ohne Ende eine Stunde und geht über Mitternacht', () => {
    const noEnd = toReply({ ...answer, end: '' }, calendars, 'UTC')
    const late = toReply({ ...answer, start: '22:00', end: '01:00' }, calendars, 'UTC')
    if (noEnd.kind !== 'proposal' || late.kind !== 'proposal') throw new Error('kein Vorschlag')
    expect(new Date(noEnd.input.end)).toEqual(new Date(2026, 10, 19, 15, 0))
    expect(new Date(late.input.end)).toEqual(new Date(2026, 10, 20, 1, 0))
  })

  it('macht ganztägige und mehrtägige Termine mit exklusivem Ende', () => {
    const oneDay = toReply({ ...answer, start: '', end: '', allDay: true }, calendars, 'UTC')
    const trip = toReply(
      { ...answer, start: '', end: '', allDay: true, endDate: '2026-11-21' },
      calendars,
      'UTC'
    )
    expect(oneDay).toMatchObject({
      input: { allDay: true, start: '2026-11-19', end: '2026-11-20' }
    })
    expect(trip).toMatchObject({ input: { start: '2026-11-19', end: '2026-11-22' } })
  })

  it('fragt nach, statt Unsinn einzutragen', () => {
    expect(
      toReply({ ...answer, action: 'ask', question: 'Um welche Zeit?' }, calendars, 'UTC')
    ).toEqual({
      kind: 'question',
      text: 'Um welche Zeit?'
    })
    expect(toReply({ ...answer, title: ' ' }, calendars, 'UTC').kind).toBe('question')
    expect(toReply({ ...answer, date: '2026-02-30' }, calendars, 'UTC').kind).toBe('question')
    expect(toReply({ ...answer, date: 'morgen' }, calendars, 'UTC').kind).toBe('question')
    expect(toReply(null, calendars, 'UTC').kind).toBe('question')
  })

  it('nimmt bei unbekanntem Kalender den ersten', () => {
    expect(toReply({ ...answer, calendar: 'k9' }, calendars, 'UTC')).toMatchObject({
      calendarId: 'cal-privat'
    })
  })
})

describe('pickModel', () => {
  it('nimmt das vorgeschlagene Modell, sonst das erste, sonst eine Anleitung', () => {
    expect(pickModel(['llama3.2:3b', 'qwen2.5:3b'])).toBe('qwen2.5:3b')
    expect(pickModel(['llama3.2:3b'])).toBe('llama3.2:3b')
    expect(() => pickModel([])).toThrow('ollama pull qwen2.5:3b')
  })
})

describe('parseTurns', () => {
  it('prüft den Verlauf', () => {
    expect(parseTurns([{ role: 'user', text: 'Hallo' }])).toEqual([{ role: 'user', text: 'Hallo' }])
    expect(() => parseTurns([])).toThrow()
    expect(() => parseTurns([{ role: 'system', text: 'x' }])).toThrow()
    expect(() =>
      parseTurns([
        { role: 'user', text: 'a' },
        { role: 'assistant', text: 'b' }
      ])
    ).toThrow()
  })
})

describe('AssistantService', () => {
  const service = (fetchFn: typeof fetch): AssistantService =>
    new AssistantService({
      client: new OllamaClient(fetchFn, 'http://ollama.test'),
      listAccounts: async () => [{ id: 'a1', provider: 'google', email: 'ich@gmail.com' }],
      listCalendars: async () => [
        {
          id: 'cal-privat',
          accountId: 'a1',
          remoteId: 'r',
          name: 'Privat',
          color: '#123456',
          syncEnabled: false,
          visible: true
        }
      ],
      now: () => new Date(2026, 10, 17, 9, 0)
    })

  it('schickt Verlauf, Schema und Modell an Ollama und gibt den Vorschlag zurück', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> | null }> = []
    const fake = (async (url: string, init?: RequestInit) => {
      requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
      const body = url.endsWith('/api/tags')
        ? { models: [{ name: 'qwen2.5:3b' }] }
        : { message: { content: JSON.stringify({ ...answer, calendar: 'k1' }) } }
      return new Response(JSON.stringify(body), { status: 200 })
    }) as typeof fetch

    const reply = await service(fake).ask([{ role: 'user', text: 'Do 14 Uhr Zahnarzt' }])

    expect(reply).toMatchObject({ kind: 'proposal', calendarId: 'cal-privat' })
    const chat = requests.find((request) => request.url.endsWith('/api/chat'))!.body!
    expect(chat).toMatchObject({ model: 'qwen2.5:3b', stream: false })
    expect((chat.messages as Array<{ role: string }>).map((m) => m.role)).toEqual([
      'system',
      'user'
    ])
    expect(chat.format).toMatchObject({ type: 'object' })
  })

  it('meldet verständlich, wenn Ollama nicht läuft', async () => {
    const down = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    const reply = await service(down).ask([{ role: 'user', text: 'x' }])
    expect(reply).toEqual({ kind: 'problem', text: expect.stringContaining('Ollama läuft nicht') })
    expect(await service(down).status()).toMatchObject({ ready: false })
  })
})
