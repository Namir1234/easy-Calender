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
- date ist der Tag im Format YYYY-MM-DD aus dem Kalenderblatt. Nennt die Nachricht keinen Tag und keine Uhrzeit, action "ask" und frage, wann.
- start und end als HH:mm (24 Stunden). Ohne Ende: leer lassen. Ohne Uhrzeit: allDay true, start und end leer.
- endDate nur bei mehrtägigen Terminen (letzter Tag), sonst leer.
- calendar ist der Schlüssel des passenden Kalenders. Nennt die Nachricht keinen, nimm ${calendars[0]?.key ?? 'k1'}.
- title kurz, ohne Datum, Uhrzeit und Wörter wie «ganztägig». location und notes nur, wenn genannt, sonst leer.
- Sprich den Benutzer mit «du» an.`
}

/** Wörter, die sagen, wann etwas ist. Ohne sie hat das Modell den Tag geraten. */
const WHEN =
  /\d|heute|morgen|übermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|woche|wochenende|monat|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|mittag|abend|nacht|früh|vormittag|nachmittag|feiertag|weihnacht|silvester|ostern|uhr/i

/** Sagt der Verlauf überhaupt, wann der Termin ist? */
export function mentionsWhen(texts: string[]): boolean {
  return texts.some((text) => WHEN.test(text))
}

/**
 * Vergleicht den Vorschlag mit dem, was der Benutzer geschrieben hat.
 * Kleine Modelle erfinden manchmal Tag, Uhrzeit oder Titel. Gibt eine
 * Rückfrage zurück, wenn etwas nicht passt, sonst `null`.
 */
export function mismatch(input: EventInput, texts: string[]): string | null {
  // Tag und Uhrzeit aus der letzten Nachricht, die welche nennt: Nach einer
  // Rückfrage kann ein neuer Wunsch die alte Angabe ersetzen.
  const said = ([...texts].reverse().find((text) => WHEN.test(text)) ?? '').toLowerCase()

  // Titel: Mindestens ein Wort muss aus dem Gespräch stammen.
  const heard = words(texts.join(' '))
  const titleWords = words(input.title).filter((word) => word.length >= 4)
  const fromUser = titleWords.some((word) =>
    heard.some((h) => h.length >= 4 && (sharePrefix(word, h) || word.includes(h)))
  )
  if (!fromUser) return 'Was soll ich eintragen?'

  // Wochentag: Nennt die Nachricht welche, muss der Tag einer davon sein.
  const start = input.allDay
    ? (() => {
        const [y, m, d] = input.start.split('-').map(Number)
        return new Date(y, m - 1, d)
      })()
    : new Date(input.start)
  const named = WEEKDAYS.filter((day) => said.includes(day.toLowerCase()))
  if (named.length > 0 && !named.includes(WEEKDAYS[start.getDay()])) {
    return `Welcher Tag ist gemeint: ${named.join(' oder ')}? Schreib es bitte mit Datum.`
  }

  // Uhrzeit: «17 Uhr», «17:30», «um 9» muss Beginn oder Ende sein.
  if (!input.allDay) {
    const end = new Date(input.end)
    const hours = [...said.matchAll(/(?:^|\D)([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\s*uhr/g)].map(
      (match) => Number(match[1])
    )
    const clock = [...said.matchAll(/(?:^|\D)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/g)].map((match) =>
      Number(match[1])
    )
    const mentioned = [...hours, ...clock]
    const fits = (hour: number): boolean =>
      hour === start.getHours() ||
      hour === end.getHours() ||
      hour + 12 === start.getHours() ||
      hour + 12 === end.getHours()
    if (mentioned.length > 0 && !mentioned.some(fits)) {
      return `Um wie viel Uhr ist «${input.title}»?`
    }
  }
  return null
}

/** Anbieter-Domains, die nichts über den Zweck eines Kontos sagen. */
const GENERIC_DOMAINS = new Set([
  'gmail',
  'googlemail',
  'outlook',
  'hotmail',
  'live',
  'icloud',
  'yahoo',
  'gmx',
  'bluewin'
])

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-zäöüéèàß0-9]+/)
    // Ab drei Buchstaben, damit Kürzel wie «BMS» zählen.
    .filter((word) => word.length >= 3)

function sharePrefix(a: string, b: string): boolean {
  const length = Math.min(a.length, b.length)
  if (length < 4) return false
  let same = 0
  while (same < length && a[same] === b[same]) same++
  return same >= Math.min(5, length)
}

/**
 * Sucht den Kalender, den die Nachricht nennt: über seinen Namen («im
 * Schulkalender» → «Schule BMS») oder sein Konto («bei Noser» →
 * …@noseryoung.ch). Kleine Modelle wählen hier oft falsch, darum
 * entscheidet die App. Ohne klaren Treffer: keiner.
 */
export function calendarNamedIn(
  texts: string[],
  calendars: AssistantCalendar[]
): AssistantCalendar | undefined {
  const said = texts.flatMap(words)
  const score = (calendar: AssistantCalendar): number => {
    const domain = calendar.account.split('@')[1]?.split('.')[0]?.toLowerCase() ?? ''
    const marks = [
      ...words(calendar.name).filter((word) => !NOT_A_MARK.has(word) && !GENERIC_DOMAINS.has(word)),
      ...(domain && !GENERIC_DOMAINS.has(domain) ? [domain] : [])
    ]
    return marks.filter((mark) =>
      said.some(
        (word) =>
          word === mark || sharePrefix(word, mark) || (word.length >= 4 && mark.includes(word))
      )
    ).length
  }
  const ranked = calendars
    .map((calendar) => ({ calendar, score: score(calendar) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
  if (ranked.length === 0) return undefined
  const best = ranked.filter((entry) => entry.score === ranked[0].score).map((e) => e.calendar)
  if (best.length === 1) return best[0]
  // Gleich gute Treffer im selben Konto («bei Noser»): dessen Hauptkalender.
  // Aus verschiedenen Konten: nicht raten.
  return best.every((calendar) => calendar.account === best[0].account)
    ? mainCalendar(best)
    : undefined
}

/** Wörter in Kalendernamen, die nichts über den Zweck sagen. */
const NOT_A_MARK = new Set(['kalender', 'calendar', 'com'])
/** Kalender, in die man selten selbst etwas einträgt. */
const SPECIAL = /geburtstag|birthday|feiertag|holiday|ferien/i

/**
 * Der Kalender, in den ohne Angabe eingetragen wird: der Hauptkalender
 * eines Kontos (bei Google heisst er wie die Adresse, bei Outlook
 * «Kalender»), nie Geburtstage oder Feiertage, wenn es anders geht.
 */
export function mainCalendar(calendars: AssistantCalendar[]): AssistantCalendar | undefined {
  const rank = (calendar: AssistantCalendar): number => {
    const name = calendar.name.toLowerCase()
    if (name === calendar.account.toLowerCase()) return 0
    if (name === 'kalender' || name === 'calendar') return 1
    if (SPECIAL.test(name)) return 3
    return 2
  }
  return [...calendars].sort((a, b) => rank(a) - rank(b))[0]
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

  // «Ganztägig Ausflug» → «Ausflug»: Das Ganztägige steht schon im Termin.
  const title = text(answer.title).replace(/^ganztägig(e[rsn]?)?\s+/i, '')
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
  // Kleine Modelle wiederholen gern den Titel als Notiz.
  if (notes && notes.toLowerCase() !== title.toLowerCase()) input.description = notes

  return {
    kind: 'proposal',
    calendarId: calendar.id,
    calendarName: `${calendar.name} (${calendar.account})`,
    input
  }
}
