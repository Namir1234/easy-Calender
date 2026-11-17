import { describe, expect, it } from 'vitest'
import { parseCalendarOptions, parseSettings } from './settings'

describe('parseSettings', () => {
  it('liefert die Vorgaben für Unsinn', () => {
    expect(parseSettings(null)).toEqual({ autostart: false, closeToTray: true, calendars: {} })
    expect(parseSettings({ autostart: 'ja', calendars: 'x' })).toEqual({
      autostart: false,
      closeToTray: true,
      calendars: {}
    })
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
    expect(settings).toEqual({
      autostart: true,
      closeToTray: false,
      calendars: { a: { hidden: true, color: '#aabbcc', allDayOnly: true } }
    })
  })
})

describe('parseCalendarOptions', () => {
  it('behält nur, was eingeschaltet oder gültig ist', () => {
    expect(parseCalendarOptions({ hidden: false, allDayOnly: 'ja', color: '#12345' })).toEqual({})
    expect(parseCalendarOptions({ color: '#123456' })).toEqual({ color: '#123456' })
  })
})
