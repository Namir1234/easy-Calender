const DAY_MS = 86_400_000
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/

/** Ein Zeitraum in ganzen Tagen, gezählt ab dem 1.1.1970. `endDay` ist exklusiv. */
export interface DayRange {
  startDay: number
  endDay: number
}

/** Mehr als ein gutes Jahr wird nie auf einmal angezeigt. */
export const MAX_RANGE_DAYS = 400

/** Wandelt `YYYY-MM-DD` (ein allfälliger Zeitanteil wird ignoriert) in eine Tagesnummer um. */
export function toDayNumber(value: string): number {
  const match = DATE_PREFIX.exec(value)
  if (!match) throw new Error(`Ungültiges Datum: ${value}`)
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const time = Date.UTC(year, month - 1, day)
  const check = new Date(time)
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Ungültiges Datum: ${value}`)
  }
  return time / DAY_MS
}

/** Wandelt eine Tagesnummer zurück in `YYYY-MM-DD`. */
export function toDateString(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10)
}

/** Prüft einen Zeitraum, der vom Renderer kommt, und wandelt ihn um. */
export function parseDateRange(input: unknown): DayRange {
  if (typeof input !== 'object' || input === null) throw new Error('Zeitraum fehlt')
  const { start, end } = input as Record<string, unknown>
  if (typeof start !== 'string' || typeof end !== 'string') {
    throw new Error('Zeitraum braucht start und end')
  }
  const startDay = toDayNumber(start)
  const endDay = toDayNumber(end)
  if (endDay <= startDay) throw new Error('Das Ende muss nach dem Start liegen')
  if (endDay - startDay > MAX_RANGE_DAYS) {
    throw new Error(`Der Zeitraum darf höchstens ${MAX_RANGE_DAYS} Tage umfassen`)
  }
  return { startDay, endDay }
}
