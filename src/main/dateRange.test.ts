import { describe, expect, it } from 'vitest'
import { MAX_RANGE_DAYS, parseDateRange, toDateString, toDayNumber } from './dateRange'

describe('toDayNumber und toDateString', () => {
  it('wandeln hin und zurück', () => {
    expect(toDayNumber('1970-01-01')).toBe(0)
    expect(toDateString(toDayNumber('2026-11-16'))).toBe('2026-11-16')
    expect(toDateString(toDayNumber('2028-02-29'))).toBe('2028-02-29')
  })

  it('ignorieren einen Zeitanteil', () => {
    expect(toDayNumber('2026-11-16T23:59:00')).toBe(toDayNumber('2026-11-16'))
  })

  it('lehnen ungültige Daten ab', () => {
    expect(() => toDayNumber('morgen')).toThrow()
    expect(() => toDayNumber('2026-02-30')).toThrow()
    expect(() => toDayNumber('2026-13-01')).toThrow()
  })
})

describe('parseDateRange', () => {
  it('nimmt einen gültigen Zeitraum an', () => {
    const range = parseDateRange({ start: '2026-11-16', end: '2026-11-23' })
    expect(range.endDay - range.startDay).toBe(7)
  })

  it('lehnt alles ab, was kein Zeitraum ist', () => {
    expect(() => parseDateRange(null)).toThrow()
    expect(() => parseDateRange('2026-11-16')).toThrow()
    expect(() => parseDateRange({ start: '2026-11-16' })).toThrow()
    expect(() => parseDateRange({ start: 1, end: 2 })).toThrow()
  })

  it('lehnt ein Ende vor oder am Start ab', () => {
    expect(() => parseDateRange({ start: '2026-11-16', end: '2026-11-16' })).toThrow()
    expect(() => parseDateRange({ start: '2026-11-16', end: '2026-11-01' })).toThrow()
  })

  it('begrenzt die Länge', () => {
    const start = toDayNumber('2026-01-01')
    const ok = { start: '2026-01-01', end: toDateString(start + MAX_RANGE_DAYS) }
    const tooLong = { start: '2026-01-01', end: toDateString(start + MAX_RANGE_DAYS + 1) }
    expect(() => parseDateRange(ok)).not.toThrow()
    expect(() => parseDateRange(tooLong)).toThrow()
  })
})
