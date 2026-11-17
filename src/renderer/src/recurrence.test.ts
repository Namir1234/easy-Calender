import { describe, expect, it } from 'vitest'
import { defaultRepeat, describeRule, fromRrule, toRrule, weekdayPosition } from './recurrence'

// Dienstag, 17. November 2026 (der dritte Dienstag im Monat)
const start = new Date(2026, 10, 17, 9, 0)

describe('toRrule', () => {
  it('baut einfache Serien', () => {
    expect(toRrule(defaultRepeat('DAILY', start), start)).toBe('FREQ=DAILY')
    expect(toRrule(defaultRepeat('WEEKLY', start), start)).toBe('FREQ=WEEKLY;BYDAY=TU')
    expect(toRrule(defaultRepeat('MONTHLY', start), start)).toBe('FREQ=MONTHLY;BYMONTHDAY=17')
    expect(toRrule(defaultRepeat('YEARLY', start), start)).toBe(
      'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=17'
    )
  })

  it('baut Intervall, Wochentage, n-ten Wochentag und Ende ein', () => {
    expect(
      toRrule(
        {
          ...defaultRepeat('WEEKLY', start),
          interval: 2,
          weekdays: [4, 2],
          end: 'count',
          count: 5
        },
        start
      )
    ).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=5')
    expect(
      toRrule(
        {
          ...defaultRepeat('MONTHLY', start),
          monthlyBy: 'weekday',
          end: 'until',
          until: '2027-06-30'
        },
        start
      )
    ).toBe('FREQ=MONTHLY;BYDAY=3TU;UNTIL=20270630T235959Z')
  })
})

describe('weekdayPosition', () => {
  it('zählt den Wochentag im Monat und erkennt den letzten', () => {
    expect(weekdayPosition(new Date(2026, 10, 3))).toBe(1)
    expect(weekdayPosition(start)).toBe(3)
    expect(weekdayPosition(new Date(2026, 10, 24))).toBe(4)
    // Der 30.11.2026 ist der fünfte Montag.
    expect(weekdayPosition(new Date(2026, 10, 30))).toBe(-1)
  })
})

describe('fromRrule', () => {
  it('liest, was es selbst geschrieben hat', () => {
    for (const rule of [
      'FREQ=DAILY;INTERVAL=3',
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=5',
      'FREQ=MONTHLY;BYDAY=3TU;UNTIL=20270630T235959Z',
      'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=17'
    ]) {
      expect(toRrule(fromRrule(rule, start)!, start)).toBe(rule)
    }
  })

  it('lehnt Unbekanntes ab', () => {
    expect(fromRrule('FREQ=HOURLY', start)).toBeNull()
  })
})

describe('describeRule', () => {
  it('beschreibt Serien in einem Satz', () => {
    expect(describeRule('FREQ=DAILY', start)).toBe('Jeden Tag')
    expect(describeRule('FREQ=WEEKLY;BYDAY=TH,MO', start)).toBe(
      'Jede Woche am Montag und Donnerstag'
    )
    expect(describeRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;COUNT=5', start)).toBe(
      'Alle 2 Wochen am Dienstag, 5 Mal'
    )
    expect(describeRule('FREQ=MONTHLY;BYDAY=-1FR', start)).toBe('Jeden Monat am letzten Freitag')
    expect(describeRule('FREQ=MONTHLY;BYMONTHDAY=25;UNTIL=20271231', start)).toBe(
      'Jeden Monat am 25., bis 31.12.2027'
    )
    expect(describeRule('FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=8', start)).toBe(
      'Jedes Jahr am 8. im März'
    )
  })
})
