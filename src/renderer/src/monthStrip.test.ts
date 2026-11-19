import { describe, expect, it } from 'vitest'
import {
  firstOfMonth,
  isoDay,
  mondayOf,
  monthAt,
  monthShading,
  monthTitle,
  parseDay,
  stripRange,
  type RowBox
} from './monthStrip'

describe('Tage', () => {
  it('schreibt und liest Tage lokal, ohne Umweg über UTC', () => {
    expect(isoDay(new Date(2026, 10, 19, 23, 30))).toBe('2026-11-19')
    expect(isoDay(parseDay('2026-03-29'))).toBe('2026-03-29')
  })

  it('findet den Montag der Woche', () => {
    expect(isoDay(mondayOf(new Date(2026, 10, 19)))).toBe('2026-11-16') // Donnerstag
    expect(isoDay(mondayOf(new Date(2026, 10, 16)))).toBe('2026-11-16') // Montag
    expect(isoDay(mondayOf(new Date(2026, 10, 22)))).toBe('2026-11-16') // Sonntag
  })

  it('rechnet Monate über den Jahreswechsel', () => {
    expect(isoDay(firstOfMonth('2026-12', 1))).toBe('2027-01-01')
    expect(isoDay(firstOfMonth('2026-01', -1))).toBe('2025-12-01')
    expect(monthTitle('2026-11')).toBe('November 2026')
  })
})

describe('stripRange', () => {
  it('legt 50 ganze Wochen ab Montag um das Datum, 20 davor', () => {
    const { start, end } = stripRange(new Date(2026, 10, 19))
    expect(start.getDay()).toBe(1)
    expect(isoDay(start)).toBe('2026-06-29')
    const weeks = Math.round((end.getTime() - start.getTime()) / (7 * 864e5))
    expect(weeks).toBe(50)
  })

  it('bleibt über die Umstellung auf Sommerzeit bei ganzen Tagen', () => {
    const { start, end } = stripRange(new Date(2027, 2, 28))
    expect(start.getHours()).toBe(0)
    expect(end.getHours()).toBe(0)
    expect(end.getDay()).toBe(1)
  })
})

describe('monthAt', () => {
  const week = (monday: string, top: number): RowBox => {
    const start = parseDay(monday)
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start)
      day.setDate(day.getDate() + i)
      return isoDay(day)
    })
    return { top, bottom: top + 100, days }
  }
  const rows = [week('2026-10-26', 0), week('2026-11-02', 100), week('2026-11-30', 200)]

  it('nimmt die Woche auf der Höhe der Probe', () => {
    expect(monthAt(rows, 150)).toBe('2026-11')
  })

  it('zählt eine Woche zum Monat ihres Donnerstags', () => {
    // 26.10.–1.11.: Donnerstag 29.10. → Oktober
    expect(monthAt(rows, 50)).toBe('2026-10')
    // 30.11.–6.12.: Donnerstag 3.12. → Dezember
    expect(monthAt(rows, 250)).toBe('2026-12')
  })

  it('nimmt unter dem Raster die letzte Woche, ohne Raster nichts', () => {
    expect(monthAt(rows, 999)).toBe('2026-12')
    expect(monthAt([], 0)).toBeNull()
  })
})

describe('monthShading', () => {
  it('tönt alle Tage ausser dem Monat im Blick ab', () => {
    expect(monthShading('.v', '2026-11')).toContain(':not([data-date^="2026-11"])')
  })

  it('schreibt nichts ohne gültigen Monat', () => {
    expect(monthShading('.v', null)).toBe('')
    expect(monthShading('.v', '"]{}')).toBe('')
  })
})
