import { useState } from 'react'
import { isoWeek } from '../dates'

interface Props {
  /** Das Datum, das der Kalender gerade zeigt */
  current: Date
  /** Der sichtbare Zeitraum des Kalenders, `end` exklusiv */
  rangeStart: Date
  rangeEnd: Date
  firstDay: number
  weekNumbers: boolean
  onPick(date: Date): void
}

const MONTH = new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' })
const LONG = new Intl.DateTimeFormat('de-CH', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})
const SHORT_DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

const sameDay = (a: Date, b: Date): boolean => a.toDateString() === b.toDateString()

/** Sechs Wochen ab der Woche, in der der Monat beginnt */
function monthGrid(month: Date, firstDay: number): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() - firstDay + 7) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - offset)
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(start)
      date.setDate(start.getDate() + week * 7 + day)
      return date
    })
  )
}

/**
 * Der kleine Monatskalender oben in der Seitenleiste, wie der
 * Datumsnavigator in Outlook. Ein Klick auf einen Tag springt dorthin.
 */
function MiniMonth({
  current,
  rangeStart,
  rangeEnd,
  firstDay,
  weekNumbers,
  onPick
}: Props): React.JSX.Element {
  const [month, setMonth] = useState(() => new Date(current.getFullYear(), current.getMonth(), 1))

  // Blättert der Kalender in einen anderen Monat, zieht der kleine Monat mit.
  const currentMonth = `${current.getFullYear()}-${current.getMonth()}`
  const [followed, setFollowed] = useState(currentMonth)
  if (followed !== currentMonth) {
    setFollowed(currentMonth)
    setMonth(new Date(current.getFullYear(), current.getMonth(), 1))
  }

  const today = new Date()
  const shift = (months: number): void =>
    setMonth((value) => new Date(value.getFullYear(), value.getMonth() + months, 1))
  const weekdays = Array.from({ length: 7 }, (_, index) => SHORT_DAYS[(firstDay + index) % 7])

  return (
    <section className="mini-month" aria-label="Datumsnavigator">
      <div className="mini-month-head">
        <button
          type="button"
          className="mini-nav"
          onClick={() => shift(-1)}
          aria-label="Vorheriger Monat"
        >
          ‹
        </button>
        <span className="mini-month-title">{MONTH.format(month)}</span>
        <button
          type="button"
          className="mini-nav"
          onClick={() => shift(1)}
          aria-label="Nächster Monat"
        >
          ›
        </button>
      </div>
      <table className={weekNumbers ? 'mini-grid with-weeks' : 'mini-grid'}>
        <thead>
          <tr>
            {weekNumbers && (
              <th scope="col" className="mini-week">
                <abbr title="Kalenderwoche">KW</abbr>
              </th>
            )}
            {weekdays.map((name) => (
              <th key={name} scope="col">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month, firstDay).map((week) => (
            <tr key={week[0].toDateString()}>
              {weekNumbers && <td className="mini-week">{isoWeek(week[0])}</td>}
              {week.map((date) => {
                const classes = ['mini-day']
                if (date.getMonth() !== month.getMonth()) classes.push('is-other')
                if (date >= rangeStart && date < rangeEnd) classes.push('is-visible')
                if (sameDay(date, today)) classes.push('is-today')
                return (
                  <td key={date.toDateString()}>
                    <button
                      type="button"
                      className={classes.join(' ')}
                      onClick={() => onPick(date)}
                      aria-label={LONG.format(date)}
                      aria-current={sameDay(date, today) ? 'date' : undefined}
                    >
                      {date.getDate()}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default MiniMonth
