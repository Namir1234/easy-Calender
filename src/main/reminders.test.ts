import { describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from '../shared/types'
import { dueReminders, reminderKey, ReminderService, reminderText, startTime } from './reminders'

const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1',
  calendarId: 'c1',
  title: 'Zahnarzt',
  start: '2026-11-18T13:00:00.000Z',
  end: '2026-11-18T14:00:00.000Z',
  allDay: false,
  timeZone: 'Europe/Zurich',
  recurrence: null,
  status: 'confirmed',
  reminderMinutes: 15,
  ...overrides
})

const at = (iso: string): number => Date.parse(iso)

describe('dueReminders', () => {
  it('meldet einen Termin, sobald die Erinnerung fällig ist', () => {
    expect(dueReminders([event()], at('2026-11-18T12:44:59Z'), new Set())).toEqual([])
    expect(dueReminders([event()], at('2026-11-18T12:45:00Z'), new Set())).toHaveLength(1)
  })

  it('meldet nichts ohne Erinnerung, bei Absagen und doppelt', () => {
    const now = at('2026-11-18T12:50:00Z')
    expect(dueReminders([event({ reminderMinutes: null })], now, new Set())).toEqual([])
    expect(dueReminders([event({ reminderMinutes: undefined })], now, new Set())).toEqual([])
    expect(dueReminders([event({ status: 'cancelled' })], now, new Set())).toEqual([])
    expect(dueReminders([event()], now, new Set([reminderKey(event())]))).toEqual([])
  })

  it('meldet nichts, was schon lange fällig war', () => {
    expect(dueReminders([event()], at('2026-11-18T13:01:00Z'), new Set())).toEqual([])
  })

  it('rechnet ganztägige Termine ab Mitternacht in lokaler Zeit', () => {
    const allDay = event({
      allDay: true,
      start: '2026-11-18',
      end: '2026-11-19',
      reminderMinutes: 60
    })
    expect(startTime(allDay)).toBe(new Date(2026, 10, 18).getTime())
    const now = new Date(2026, 10, 17, 23, 0).getTime()
    expect(dueReminders([allDay], now, new Set())).toHaveLength(1)
  })
})

describe('reminderText', () => {
  it('nennt die Minuten bis zum Beginn und den Ort', () => {
    const text = reminderText(event({ location: 'Zürich' }), at('2026-11-18T12:45:00Z'))
    expect(text).toMatch(/^In 15 Min\., \d\d:\d\d Uhr · Zürich$/)
  })

  it('sagt «Jetzt», wenn der Termin schon begonnen hat', () => {
    expect(reminderText(event(), at('2026-11-18T13:00:00Z'))).toMatch(/^Jetzt/)
  })
})

describe('ReminderService', () => {
  it('erinnert einmal und nur, wenn es eingeschaltet ist', async () => {
    const notify = vi.fn()
    let enabled = false
    const service = new ReminderService({
      load: async () => [event()],
      notify,
      enabled: () => enabled,
      now: () => at('2026-11-18T12:46:00Z')
    })
    await service.refresh()
    expect(notify).not.toHaveBeenCalled()
    enabled = true
    service.check()
    service.check()
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0].title).toBe('Zahnarzt')
  })
})
