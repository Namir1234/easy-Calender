// Kleine Datumshelfer, die mehrere Teile der Oberfläche brauchen.

/**
 * Liest einen Zeitpunkt für die Anzeige in der lokalen Zeit. Ein reines
 * Datum (`YYYY-MM-DD`) würde `new Date` als UTC lesen, darum wird es hier
 * von Hand zerlegt.
 */
export function parseLocal(value: string): Date {
  if (value.includes('T')) return new Date(value)
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Ein Tag mehr oder weniger, in lokaler Zeit */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Erinnerungen zur Auswahl, wie in Outlook */
export const REMINDER_OPTIONS: Array<[number | null, string]> = [
  [null, 'Keine'],
  [0, 'Zu Beginn'],
  [5, '5 Minuten vorher'],
  [10, '10 Minuten vorher'],
  [15, '15 Minuten vorher'],
  [30, '30 Minuten vorher'],
  [60, '1 Stunde vorher'],
  [120, '2 Stunden vorher'],
  [180, '3 Stunden vorher'],
  [720, '12 Stunden vorher'],
  [1080, '18 Stunden vorher'],
  [1440, '1 Tag vorher'],
  [2880, '2 Tage vorher'],
  [10080, '1 Woche vorher']
]

/** Eine Erinnerung als Text, auch für Werte, die nicht in der Auswahl stehen. */
export function describeReminder(minutes: number | null | undefined): string {
  if (minutes === undefined) return 'Standard'
  const known = REMINDER_OPTIONS.find(([value]) => value === minutes)
  if (known) return known[1]
  if (minutes === null) return 'Keine'
  if (minutes % 1440 === 0) return `${minutes / 1440} Tage vorher`
  if (minutes % 60 === 0) return `${minutes / 60} Stunden vorher`
  return `${minutes} Minuten vorher`
}

export const SHOW_AS_LABELS = {
  free: 'Frei',
  tentative: 'Mit Vorbehalt',
  busy: 'Gebucht',
  oof: 'Abwesend',
  workingElsewhere: 'Woanders tätig'
} as const

/** Kalenderwoche nach ISO 8601, wie in der Schweiz üblich */
export function isoWeek(date: Date): number {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const weekday = day.getUTCDay() || 7
  day.setUTCDate(day.getUTCDate() + 4 - weekday)
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1))
  return Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}
