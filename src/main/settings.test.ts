import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  parseCalendarOptions,
  parseCategories,
  parseSettings,
  parseView
} from './settings'

describe('parseSettings', () => {
  it('liefert die Vorgaben für Unsinn', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings({ autostart: 'ja', calendars: 'x', reminders: 1 })).toEqual(
      DEFAULT_SETTINGS
    )
  })

  it('übernimmt gültige Werte und wirft Unbekanntes weg', () => {
    const settings = parseSettings({
      autostart: true,
      closeToTray: false,
      boese: 1,
      calendars: {
        a: { hidden: true, color: '#AABBCC', allDayOnly: true, fremd: 'x' },
        b: { color: 'rot' },
        c: {}
      }
    })
    expect(settings).toMatchObject({
      autostart: true,
      closeToTray: false,
      calendars: { a: { hidden: true, color: '#aabbcc', allDayOnly: true } }
    })
    expect(settings).not.toHaveProperty('boese')
  })
})

describe('parseView', () => {
  it('übernimmt gültige Werte', () => {
    expect(
      parseView({
        firstDay: 0,
        workDays: [5, 1, 1, 9],
        workStart: '07:30',
        workEnd: '16:00',
        slotMinutes: 15,
        weekNumbers: false
      })
    ).toEqual({
      firstDay: 0,
      workDays: [1, 5],
      workStart: '07:30',
      workEnd: '16:00',
      slotMinutes: 15,
      weekNumbers: false
    })
  })

  it('setzt Ungültiges auf die Vorgabe zurück', () => {
    const view = parseView({
      firstDay: 8,
      workDays: [],
      workStart: '17:00',
      workEnd: '08:00',
      slotMinutes: 7
    })
    expect(view).toEqual(DEFAULT_SETTINGS.view)
  })
})

describe('parseCategories', () => {
  it('behält gültige Kategorien ohne Doppelte', () => {
    expect(
      parseCategories([
        { name: ' Schule ', color: '#AA0000' },
        { name: 'schule', color: '#00aa00' },
        { name: 'A;B', color: '#00aa00' },
        { name: 'Ohne Farbe' },
        'Unsinn'
      ])
    ).toEqual([{ name: 'Schule', color: '#aa0000' }])
  })

  it('liefert ohne Liste die Kategorien von Outlook', () => {
    expect(parseCategories(undefined)).toHaveLength(6)
    expect(parseCategories([])).toEqual([])
  })
})

describe('parseCalendarOptions', () => {
  it('behält nur, was eingeschaltet oder gültig ist', () => {
    expect(parseCalendarOptions({ hidden: false, allDayOnly: 'ja', color: '#12345' })).toEqual({})
    expect(parseCalendarOptions({ color: '#123456' })).toEqual({ color: '#123456' })
  })
})
