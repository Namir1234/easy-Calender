import { describe, expect, it } from 'vitest'
import { addDays, dayKeyStep, startDay, toDayKey } from './dayKeys'

describe('dayKeyStep', () => {
  it('links und rechts sind ein Tag', () => {
    for (const view of ['dayGridMonth', 'timeGridWeek', 'timeGridDay']) {
      expect(dayKeyStep('ArrowLeft', view)).toBe(-1)
      expect(dayKeyStep('ArrowRight', view)).toBe(1)
    }
  })

  it('in der Liste springen links und rechts eine Woche', () => {
    expect(dayKeyStep('ArrowLeft', 'listWeek')).toBe(-7)
    expect(dayKeyStep('ArrowRight', 'listWeek')).toBe(7)
  })

  it('hoch und runter springen nur im Monat eine Woche', () => {
    expect(dayKeyStep('ArrowUp', 'dayGridMonth')).toBe(-7)
    expect(dayKeyStep('ArrowDown', 'dayGridMonth')).toBe(7)
    expect(dayKeyStep('ArrowUp', 'timeGridWeek')).toBe(0)
    expect(dayKeyStep('ArrowDown', 'timeGridDay')).toBe(0)
  })

  it('andere Tasten blättern nicht', () => {
    expect(dayKeyStep('Enter', 'timeGridWeek')).toBe(0)
    expect(dayKeyStep('a', 'dayGridMonth')).toBe(0)
  })
})

describe('addDays', () => {
  it('geht über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('rechnet über die Zeitumstellung in ganzen Tagen', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-25', -7)).toBe('2026-10-18')
  })
})

describe('startDay', () => {
  const week = { start: '2026-11-16', end: '2026-11-23' }

  it('nimmt den markierten Tag, wenn er sichtbar ist', () => {
    expect(startDay('2026-11-20', week, '2026-11-19')).toBe('2026-11-20')
  })

  it('nimmt sonst heute, wenn heute sichtbar ist', () => {
    expect(startDay(null, week, '2026-11-19')).toBe('2026-11-19')
    expect(startDay('2026-10-01', week, '2026-11-19')).toBe('2026-11-19')
  })

  it('nimmt sonst den ersten Tag der Ansicht', () => {
    expect(startDay(null, week, '2026-12-24')).toBe('2026-11-16')
  })
})

describe('toDayKey', () => {
  it('nimmt den lokalen Tag, nicht den UTC-Tag', () => {
    expect(toDayKey(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
  })
})
