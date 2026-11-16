/** Die Wiederholung eines Termins, wie Microsoft Graph sie beschreibt. */
export interface GraphRecurrence {
  pattern: {
    type:
      | 'daily'
      | 'weekly'
      | 'absoluteMonthly'
      | 'relativeMonthly'
      | 'absoluteYearly'
      | 'relativeYearly'
    interval: number
    daysOfWeek?: string[]
    dayOfMonth?: number
    month?: number
    index?: string
    firstDayOfWeek?: string
  }
  range: {
    type: 'noEnd' | 'endDate' | 'numbered'
    startDate: string
    endDate?: string
    numberOfOccurrences?: number
  }
}

const DAYS: Array<[string, string]> = [
  ['SU', 'sunday'],
  ['MO', 'monday'],
  ['TU', 'tuesday'],
  ['WE', 'wednesday'],
  ['TH', 'thursday'],
  ['FR', 'friday'],
  ['SA', 'saturday']
]
const DAY_NAME = new Map(DAYS)
const DAY_CODE = new Map(DAYS.map(([code, name]) => [name, code]))
const INDEXES: Array<[string, string]> = [
  ['1', 'first'],
  ['2', 'second'],
  ['3', 'third'],
  ['4', 'fourth'],
  ['-1', 'last']
]
const INDEX_NAME = new Map(INDEXES)
const INDEX_CODE = new Map(INDEXES.map(([code, name]) => [name, code]))

const unsupported = (rule: string): Error =>
  new Error(`Diese Wiederholung kann Outlook nicht abbilden: ${rule}`)

/**
 * Wandelt eine RRULE in die Form von Microsoft Graph um. Unterstützt sind
 * tägliche, wöchentliche, monatliche und jährliche Serien mit Intervall,
 * Wochentagen und Ende (Anzahl oder Datum). Alles andere wird abgelehnt,
 * damit keine Serie stillschweigend falsch übertragen wird.
 *
 * @param startDate Datum des ersten Termins (`YYYY-MM-DD`)
 */
export function rruleToGraph(rule: string, startDate: string): GraphRecurrence {
  const parts = new Map<string, string>()
  for (const part of rule.toUpperCase().split(';')) {
    const [key, value] = part.split('=')
    if (key && value) parts.set(key, value)
  }
  for (const key of parts.keys()) {
    const known = [
      'FREQ',
      'INTERVAL',
      'BYDAY',
      'BYMONTHDAY',
      'BYMONTH',
      'BYSETPOS',
      'COUNT',
      'UNTIL',
      'WKST'
    ]
    if (!known.includes(key)) throw unsupported(rule)
  }

  const [year, month, day] = startDate.split('-').map(Number)
  const startWeekday = DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()][1]
  const interval = Number(parts.get('INTERVAL') ?? '1')
  if (!Number.isInteger(interval) || interval < 1) throw unsupported(rule)

  // BYDAY kann eine Position tragen («2TU» = zweiter Dienstag).
  let position = parts.get('BYSETPOS')
  const days = (parts.get('BYDAY') ?? '')
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const match = /^([+-]?\d)?([A-Z]{2})$/.exec(entry)
      const name = match && DAY_NAME.get(match[2])
      if (!match || !name) throw unsupported(rule)
      if (match[1]) position = String(Number(match[1]))
      return name
    })

  let pattern: GraphRecurrence['pattern']
  switch (parts.get('FREQ')) {
    case 'DAILY':
      if (days.length > 0) throw unsupported(rule)
      pattern = { type: 'daily', interval }
      break
    case 'WEEKLY':
      pattern = {
        type: 'weekly',
        interval,
        daysOfWeek: days.length > 0 ? days : [startWeekday],
        firstDayOfWeek: DAY_NAME.get(parts.get('WKST') ?? 'MO') ?? 'monday'
      }
      break
    case 'MONTHLY':
    case 'YEARLY': {
      const yearly = parts.get('FREQ') === 'YEARLY'
      const months = yearly ? { month: Number(parts.get('BYMONTH') ?? month) } : {}
      if (days.length > 0) {
        const index = INDEX_NAME.get(position ?? '')
        if (!index) throw unsupported(rule)
        pattern = {
          type: yearly ? 'relativeYearly' : 'relativeMonthly',
          interval,
          daysOfWeek: days,
          index,
          ...months
        }
      } else {
        const dayOfMonth = Number(parts.get('BYMONTHDAY') ?? day)
        if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1) throw unsupported(rule)
        pattern = {
          type: yearly ? 'absoluteYearly' : 'absoluteMonthly',
          interval,
          dayOfMonth,
          ...months
        }
      }
      break
    }
    default:
      throw unsupported(rule)
  }

  const count = parts.get('COUNT')
  const until = parts.get('UNTIL')
  const range: GraphRecurrence['range'] = count
    ? { type: 'numbered', startDate, numberOfOccurrences: Number(count) }
    : until
      ? {
          type: 'endDate',
          startDate,
          endDate: `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`
        }
      : { type: 'noEnd', startDate }

  return { pattern, range }
}

/** Die Gegenrichtung zu `rruleToGraph`. Liefert `null` für unbekannte Muster. */
export function graphToRrule(recurrence: GraphRecurrence | null | undefined): string | null {
  if (!recurrence?.pattern || !recurrence.range) return null
  const { pattern, range } = recurrence
  const days = (pattern.daysOfWeek ?? []).map((name) => DAY_CODE.get(name.toLowerCase()))
  if (days.some((code) => !code)) return null
  const parts: string[] = []

  switch (pattern.type) {
    case 'daily':
      parts.push('FREQ=DAILY')
      break
    case 'weekly':
      parts.push('FREQ=WEEKLY')
      if (days.length > 0) parts.push(`BYDAY=${days.join(',')}`)
      break
    case 'absoluteMonthly':
    case 'absoluteYearly':
      parts.push(pattern.type === 'absoluteYearly' ? 'FREQ=YEARLY' : 'FREQ=MONTHLY')
      if (pattern.type === 'absoluteYearly' && pattern.month) parts.push(`BYMONTH=${pattern.month}`)
      if (pattern.dayOfMonth) parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`)
      break
    case 'relativeMonthly':
    case 'relativeYearly': {
      const index = INDEX_CODE.get((pattern.index ?? 'first').toLowerCase())
      if (!index || days.length === 0) return null
      parts.push(pattern.type === 'relativeYearly' ? 'FREQ=YEARLY' : 'FREQ=MONTHLY')
      if (pattern.type === 'relativeYearly' && pattern.month) parts.push(`BYMONTH=${pattern.month}`)
      parts.push(`BYDAY=${days.map((code) => `${index}${code}`).join(',')}`)
      break
    }
    default:
      return null
  }

  if (pattern.interval > 1) parts.splice(1, 0, `INTERVAL=${pattern.interval}`)
  if (range.type === 'numbered' && range.numberOfOccurrences) {
    parts.push(`COUNT=${range.numberOfOccurrences}`)
  } else if (range.type === 'endDate' && range.endDate) {
    parts.push(`UNTIL=${range.endDate.replaceAll('-', '')}`)
  }
  return parts.join(';')
}
