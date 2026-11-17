import { describe, expect, it } from 'vitest'
import { parseEventInput } from './eventInput'

const timed = {
  title: ' Zahnarzt ',
  start: '2026-11-17T09:00:00+01:00',
  end: '2026-11-17T09:30:00+01:00',
  allDay: false,
  timeZone: 'Europe/Zurich',
  recurrence: null
}

describe('parseEventInput', () => {
  it('übernimmt einen Termin mit Uhrzeit als eindeutigen Zeitpunkt', () => {
    expect(parseEventInput(timed)).toEqual({
      title: 'Zahnarzt',
      description: undefined,
      location: undefined,
      start: '2026-11-17T08:00:00.000Z',
      end: '2026-11-17T08:30:00.000Z',
      allDay: false,
      timeZone: 'Europe/Zurich',
      recurrence: null,
      status: 'confirmed'
    })
  })

  it('übernimmt ganztägige Termine als Datum', () => {
    const event = parseEventInput({
      ...timed,
      allDay: true,
      start: '2026-12-24',
      end: '2026-12-27'
    })
    expect(event).toMatchObject({ start: '2026-12-24', end: '2026-12-27', allDay: true })
  })

  it('setzt einen Platzhalter für einen leeren Titel', () => {
    expect(parseEventInput({ ...timed, title: '  ' }).title).toBe('(Ohne Titel)')
  })

  it('lehnt ein Ende vor dem Beginn ab', () => {
    expect(() => parseEventInput({ ...timed, end: timed.start })).toThrow('Ende')
    expect(() =>
      parseEventInput({ ...timed, allDay: true, start: '2026-12-24', end: '2026-12-24' })
    ).toThrow('Ende')
  })

  it('lehnt Unsinn ab', () => {
    expect(() => parseEventInput(null)).toThrow()
    expect(() => parseEventInput({ ...timed, start: 'morgen' })).toThrow()
    expect(() => parseEventInput({ ...timed, allDay: 'ja' })).toThrow()
    expect(() => parseEventInput({ ...timed, timeZone: 'Mond/Krater' })).toThrow('Zeitzone')
    expect(() => parseEventInput({ ...timed, title: 'x'.repeat(501) })).toThrow('zu lang')
    expect(() =>
      parseEventInput({ ...timed, allDay: true, start: '2026-13-40', end: '2026-13-41' })
    ).toThrow()
  })

  it('erlaubt einfache Wiederholungen und lehnt andere ab', () => {
    expect(parseEventInput({ ...timed, recurrence: 'FREQ=WEEKLY;BYDAY=TU' }).recurrence).toBe(
      'FREQ=WEEKLY;BYDAY=TU'
    )
    expect(() => parseEventInput({ ...timed, recurrence: 'FREQ=SECONDLY' })).toThrow()
    expect(() => parseEventInput({ ...timed, recurrence: 'DROP TABLE' })).toThrow()
  })
})

describe('parseEventInput: Zusatzfelder', () => {
  it('übernimmt gültige Zusatzfelder', () => {
    expect(
      parseEventInput({
        ...timed,
        showAs: 'tentative',
        private: true,
        reminderMinutes: 15,
        categories: [' Schule ', 'Schule', 'Sport']
      })
    ).toMatchObject({
      status: 'tentative',
      showAs: 'tentative',
      private: true,
      reminderMinutes: 15,
      categories: ['Schule', 'Sport']
    })
  })

  it('lässt fehlende Zusatzfelder weg und erlaubt «keine Erinnerung»', () => {
    const event = parseEventInput({ ...timed, reminderMinutes: null })
    expect(event.reminderMinutes).toBeNull()
    expect(event).not.toHaveProperty('showAs')
    expect(event).not.toHaveProperty('categories')
  })

  it('lehnt Ungültiges ab', () => {
    expect(() => parseEventInput({ ...timed, showAs: 'weg' })).toThrow()
    expect(() => parseEventInput({ ...timed, private: 'ja' })).toThrow()
    expect(() => parseEventInput({ ...timed, reminderMinutes: -5 })).toThrow()
    expect(() => parseEventInput({ ...timed, reminderMinutes: 1.5 })).toThrow()
    expect(() => parseEventInput({ ...timed, reminderMinutes: 50_000 })).toThrow()
    expect(() => parseEventInput({ ...timed, categories: 'Schule' })).toThrow()
    expect(() => parseEventInput({ ...timed, categories: ['A,B'] })).toThrow()
  })
})
