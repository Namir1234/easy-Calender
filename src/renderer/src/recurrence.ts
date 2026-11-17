// Wiederholungen wie im Dialog «Terminserie» von Outlook: als Felder für das
// Formular, als RRULE für den Main-Prozess und als Satz für die Anzeige.

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

/** Wochentage in der Schreibweise der RRULE, Index wie `Date.getDay()` */
export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
const WEEKDAY_NAMES = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag'
]
const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember'
]
const ORDINALS = ['ersten', 'zweiten', 'dritten', 'vierten']

export interface Repeat {
  frequency: Frequency
  /** Alle wie viele Tage, Wochen, Monate oder Jahre */
  interval: number
  /** Wochentage (0 Sonntag … 6 Samstag), nur bei wöchentlich */
  weekdays: number[]
  /** Monatlich und jährlich: am gleichen Datum oder am n-ten Wochentag («am zweiten Dienstag») */
  monthlyBy: 'date' | 'weekday'
  end: 'never' | 'count' | 'until'
  count: number
  /** Letzter Tag als `YYYY-MM-DD` */
  until: string
}

/** Die Vorgabe für eine neue Serie, passend zum Beginn des Termins. */
export function defaultRepeat(frequency: Frequency, start: Date): Repeat {
  return {
    frequency,
    interval: 1,
    weekdays: [start.getDay()],
    monthlyBy: 'date',
    end: 'never',
    count: 10,
    until: ''
  }
}

/**
 * Der wievielte Wochentag des Monats ein Datum ist. Den fünften gibt es
 * nicht in jedem Monat, darum heisst er wie in Outlook «der letzte» (-1).
 */
export function weekdayPosition(date: Date): number {
  const nth = Math.ceil(date.getDate() / 7)
  return nth === 5 ? -1 : nth
}

/** Baut die RRULE. Tag und Monat ergeben sich aus dem Beginn des Termins. */
export function toRrule(repeat: Repeat, start: Date): string {
  const parts = [`FREQ=${repeat.frequency}`]
  if (repeat.interval > 1) parts.push(`INTERVAL=${repeat.interval}`)
  if (repeat.frequency === 'WEEKLY') {
    const days = repeat.weekdays.length > 0 ? repeat.weekdays : [start.getDay()]
    parts.push(
      `BYDAY=${[...days]
        .sort()
        .map((day) => WEEKDAY_CODES[day])
        .join(',')}`
    )
  }
  if (repeat.frequency === 'MONTHLY' || repeat.frequency === 'YEARLY') {
    if (repeat.frequency === 'YEARLY') parts.push(`BYMONTH=${start.getMonth() + 1}`)
    if (repeat.monthlyBy === 'weekday') {
      parts.push(`BYDAY=${weekdayPosition(start)}${WEEKDAY_CODES[start.getDay()]}`)
    } else {
      parts.push(`BYMONTHDAY=${start.getDate()}`)
    }
  }
  if (repeat.end === 'count' && repeat.count > 0) parts.push(`COUNT=${repeat.count}`)
  if (repeat.end === 'until' && /^\d{4}-\d{2}-\d{2}$/.test(repeat.until)) {
    parts.push(`UNTIL=${repeat.until.replaceAll('-', '')}T235959Z`)
  }
  return parts.join(';')
}

function ruleParts(rule: string): Map<string, string> {
  return new Map(
    rule
      .split(';')
      .map((part) => part.split('=') as [string, string])
      .filter(([key, value]) => key && value !== undefined)
      .map(([key, value]) => [key.toUpperCase(), value.toUpperCase()])
  )
}

/** Liest eine RRULE in die Felder des Formulars. `null`, wenn das Formular sie nicht abbilden kann. */
export function fromRrule(rule: string, start: Date): Repeat | null {
  const parts = ruleParts(rule)
  const frequency = parts.get('FREQ') as Frequency | undefined
  if (!frequency || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(frequency)) return null
  const repeat = defaultRepeat(frequency, start)
  repeat.interval = Number(parts.get('INTERVAL') ?? 1) || 1
  const byDay = parts.get('BYDAY')
  if (frequency === 'WEEKLY' && byDay) {
    repeat.weekdays = byDay
      .split(',')
      .map((code) => WEEKDAY_CODES.indexOf(code as (typeof WEEKDAY_CODES)[number]))
      .filter((day) => day >= 0)
  }
  if ((frequency === 'MONTHLY' || frequency === 'YEARLY') && byDay) repeat.monthlyBy = 'weekday'
  const count = Number(parts.get('COUNT'))
  const until = parts.get('UNTIL')
  if (count > 0) {
    repeat.end = 'count'
    repeat.count = count
  } else if (until && /^\d{8}/.test(until)) {
    repeat.end = 'until'
    repeat.until = `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`
  }
  return repeat
}

function every(interval: number, one: string, many: string): string {
  return interval > 1 ? `Alle ${interval} ${many}` : `Jede${one}`
}

/** Beschreibt eine RRULE in einem Satz, z. B. «Jede Woche am Dienstag und Donnerstag, 10 Mal». */
export function describeRule(rule: string, start: Date): string {
  const parts = ruleParts(rule)
  const repeat = fromRrule(rule, start)
  if (!repeat) return 'wiederholt sich'
  let text: string
  switch (repeat.frequency) {
    case 'DAILY':
      text = repeat.interval > 1 ? `Alle ${repeat.interval} Tage` : 'Jeden Tag'
      break
    case 'WEEKLY': {
      const days = [...repeat.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      const names = days.map((day) => WEEKDAY_NAMES[day])
      const list =
        names.length > 1 ? `${names.slice(0, -1).join(', ')} und ${names.at(-1)}` : names[0]
      text = `${every(repeat.interval, ' Woche', 'Wochen')} am ${list}`
      break
    }
    case 'MONTHLY':
    case 'YEARLY': {
      const yearly = repeat.frequency === 'YEARLY'
      const month = yearly
        ? ` im ${MONTH_NAMES[Number(parts.get('BYMONTH') ?? start.getMonth() + 1) - 1]}`
        : ''
      const head = yearly
        ? every(repeat.interval, 's Jahr', 'Jahre')
        : every(repeat.interval, 'n Monat', 'Monate')
      const byDay = parts.get('BYDAY')
      if (byDay) {
        const match = /^(-?\d)?([A-Z]{2})$/.exec(byDay)
        const position = Number(match?.[1] ?? weekdayPosition(start))
        const day = WEEKDAY_CODES.indexOf((match?.[2] ?? 'MO') as (typeof WEEKDAY_CODES)[number])
        const nth = position < 0 ? 'letzten' : (ORDINALS[position - 1] ?? `${position}.`)
        text = `${head} am ${nth} ${WEEKDAY_NAMES[day]}${month}`
      } else {
        const day = Number(parts.get('BYMONTHDAY') ?? start.getDate())
        text = `${head} am ${day}.${month}`
      }
      break
    }
  }
  if (repeat.end === 'count') text += `, ${repeat.count} Mal`
  if (repeat.end === 'until') {
    const [year, month, day] = repeat.until.split('-').map(Number)
    text += `, bis ${day}.${month}.${year}`
  }
  return text
}
