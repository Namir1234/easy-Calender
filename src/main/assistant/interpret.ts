import type { AssistantReply, EventInput } from '../../shared/types'

/** Ein Kalender, wie der Assistent ihn kennt: mit kurzem Schlüssel statt langer ID. */
export interface AssistantCalendar {
  /** Kurzer Schlüssel für das Modell, z. B. `k1` */
  key: string
  id: string
  name: string
  account: string
}

/** Was das Modell liefern muss. Felder ohne Inhalt sind leere Texte. */
export interface ModelAnswer {
  action: 'create' | 'ask'
  question: string
  title: string
  /** `YYYY-MM-DD` */
  date: string
  /** Letzter Tag bei mehrtägigen Terminen, sonst leer */
  endDate: string
  /** `HH:mm` oder leer */
  start: string
  /** `HH:mm` oder leer */
  end: string
  allDay: boolean
  calendar: string
  location: string
  notes: string
}

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
/** So viele Tage stehen im Kalenderblatt für das Modell. */
const DAYS_AHEAD = 28

const pad = (value: number): string => String(value).padStart(2, '0')
const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

function addDays(dateField: string, days: number): string {
  const [year, month, day] = dateField.split('-').map(Number)
  return dateKey(new Date(year, month - 1, day + days))
}

/** Prüft, ob ein `YYYY-MM-DD` ein echter Tag ist (kein 31. Februar). */
function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getMonth() === month - 1 && date.getDate() === day
}

/** Das JSON-Schema, an das sich das Modell halten muss. */
export function answerSchema(calendars: AssistantCalendar[]): Record<string, unknown> {
  const text = { type: 'string' }
  return {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'ask'] },
      question: text,
      title: text,
      date: text,
      endDate: text,
      start: text,
      end: text,
      allDay: { type: 'boolean' },
      calendar: { type: 'string', enum: calendars.map((calendar) => calendar.key) },
      location: text,
      notes: text
    },
    required: [
      'action',
      'question',
      'title',
      'date',
      'endDate',
      'start',
      'end',
      'allDay',
      'calendar',
      'location',
      'notes'
    ]
  }
}

/**
 * Die Anweisung an das Modell. Kleine Modelle rechnen schlecht mit Daten,
 * darum steht ein fertiges Kalenderblatt drin: «morgen» und «nächsten
 * Freitag» muss das Modell nur noch nachschlagen.
 */
export function systemPrompt(now: Date, calendars: AssistantCalendar[]): string {
  const days: string[] = []
  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    const label =
      offset === 0 ? ' (heute)' : offset === 1 ? ' (morgen)' : offset === 2 ? ' (übermorgen)' : ''
    days.push(
      `${WEEKDAYS[day.getDay()]} ${day.getDate()}.${day.getMonth() + 1}. = ${dateKey(day)}${label}`
    )
  }
  const list = calendars
    .map((calendar) => `${calendar.key}: «${calendar.name}» (Konto ${calendar.account})`)
    .join('\n')

  return `Du trägst Termine in einen Kalender ein. Antworte nur mit JSON nach dem vorgegebenen Schema.

Jetzt ist ${WEEKDAYS[now.getDay()]}, ${dateKey(now)}, ${pad(now.getHours())}:${pad(now.getMinutes())} Uhr.

Kalenderblatt:
${days.join('\n')}

Kalender:
${list}

Regeln:
- action "create", wenn klar ist, was eingetragen werden soll. Sonst action "ask" und in "question" eine kurze Rückfrage auf Deutsch.
- date ist der Tag im Format YYYY-MM-DD aus dem Kalenderblatt. Ohne Tagesangabe ist es heute.
- start und end als HH:mm (24 Stunden). Ohne Ende: leer lassen. Ohne Uhrzeit: allDay true, start und end leer.
- endDate nur bei mehrtägigen Terminen (letzter Tag), sonst leer.
- calendar ist der Schlüssel des passenden Kalenders. Nennt die Nachricht keinen, nimm ${calendars[0]?.key ?? 'k1'}.
- title kurz, ohne Datum und Uhrzeit. location und notes nur, wenn genannt, sonst leer.`
}

/**
 * Prüft die Antwort des Modells und macht daraus einen Vorschlag für die
 * Oberfläche. Was nicht stimmt, wird zur Rückfrage statt zu einem falschen
 * Termin.
 */
export function toReply(
  raw: unknown,
  calendars: AssistantCalendar[],
  timeZone: string
): AssistantReply {
  const ask = (text: string): AssistantReply => ({ kind: 'question', text })
  if (typeof raw !== 'object' || raw === null)
    return ask('Das habe ich nicht verstanden. Kannst du es anders sagen?')
  const answer = raw as Partial<ModelAnswer>
  const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

  if (answer.action === 'ask') {
    return ask(text(answer.question) || 'Kannst du mir noch etwas mehr dazu sagen?')
  }

  const title = text(answer.title)
  if (!title) return ask('Wie soll der Termin heissen?')
  const date = text(answer.date)
  if (!isRealDate(date)) return ask(`An welchem Tag ist «${title}»?`)
  const calendar = calendars.find((entry) => entry.key === answer.calendar) ?? calendars[0]
  if (!calendar) return ask('Es ist kein Kalender da, in den ich eintragen kann.')

  const start = text(answer.start)
  const end = text(answer.end)
  const lastDay = isRealDate(text(answer.endDate)) ? text(answer.endDate) : date
  const allDay = answer.allDay === true || !TIME.test(start)

  let input: EventInput
  if (allDay) {
    if (lastDay < date) return ask(`Bis wann dauert «${title}»?`)
    input = {
      title,
      start: date,
      end: addDays(lastDay, 1),
      allDay: true,
      timeZone,
      recurrence: null
    }
  } else {
    const [hours, minutes] = start.split(':').map(Number)
    const [startYear, startMonth, startDay] = date.split('-').map(Number)
    const begin = new Date(startYear, startMonth - 1, startDay, hours, minutes)
    let finish: Date
    if (TIME.test(end)) {
      const [endHours, endMinutes] = end.split(':').map(Number)
      const [year, month, day] = lastDay.split('-').map(Number)
      finish = new Date(year, month - 1, day, endHours, endMinutes)
      // «22 bis 1 Uhr» geht über Mitternacht.
      if (finish <= begin && lastDay === date) finish.setDate(finish.getDate() + 1)
    } else {
      finish = new Date(begin.getTime() + 3_600_000)
    }
    if (finish <= begin) return ask(`Wann endet «${title}»?`)
    input = {
      title,
      start: begin.toISOString(),
      end: finish.toISOString(),
      allDay: false,
      timeZone,
      recurrence: null
    }
  }

  const location = text(answer.location)
  const notes = text(answer.notes)
  if (location) input.location = location
  if (notes) input.description = notes

  return {
    kind: 'proposal',
    calendarId: calendar.id,
    calendarName: `${calendar.name} (${calendar.account})`,
    input
  }
}
