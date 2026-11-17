import { describe, expect, it } from 'vitest'
import { mapGraphEvent, toGraphBody, wallTime } from './microsoftMapper'
import { graphToRrule, rruleToGraph } from './microsoftRecurrence'

describe('mapGraphEvent', () => {
  it('wandelt einen Termin mit Uhrzeit um (Graph liefert UTC)', () => {
    const event = mapGraphEvent(
      {
        id: 'abc',
        subject: ' Sitzung ',
        body: { contentType: 'text', content: 'Traktanden\r\n' },
        location: { displayName: 'Zimmer 2' },
        start: { dateTime: '2026-11-17T08:00:00.0000000', timeZone: 'UTC' },
        end: { dateTime: '2026-11-17T09:00:00.0000000', timeZone: 'UTC' },
        isAllDay: false,
        type: 'singleInstance',
        showAs: 'busy',
        lastModifiedDateTime: '2026-11-01T10:00:00Z'
      },
      'Europe/Zurich'
    )
    expect(event).toEqual({
      id: 'abc',
      title: 'Sitzung',
      description: 'Traktanden',
      location: 'Zimmer 2',
      start: '2026-11-17T08:00:00Z',
      end: '2026-11-17T09:00:00Z',
      allDay: false,
      timeZone: 'Europe/Zurich',
      recurrence: null,
      status: 'confirmed',
      updatedAt: '2026-11-01T10:00:00Z',
      seriesId: undefined,
      showAs: 'busy',
      private: false,
      reminderMinutes: null,
      categories: []
    })
  })

  it('liest Anzeigen als, Privat, Erinnerung, Kategorien und die Serie', () => {
    const event = mapGraphEvent(
      {
        id: 'x',
        start: { dateTime: '2026-11-17T08:00:00' },
        end: { dateTime: '2026-11-17T09:00:00' },
        type: 'occurrence',
        seriesMasterId: 'master',
        showAs: 'oof',
        sensitivity: 'private',
        isReminderOn: true,
        reminderMinutesBeforeStart: 30,
        categories: ['Rote Kategorie']
      },
      'UTC'
    )
    expect(event).toMatchObject({
      seriesId: 'master',
      showAs: 'oof',
      private: true,
      reminderMinutes: 30,
      categories: ['Rote Kategorie']
    })
  })

  it('erkennt ganztägige Termine, Serien, Vorkommen und Absagen', () => {
    const base = {
      id: 'x',
      start: { dateTime: '2026-12-24T00:00:00.0000000' },
      end: { dateTime: '2026-12-25T00:00:00.0000000' },
      isAllDay: true
    }
    expect(mapGraphEvent(base, 'UTC')).toMatchObject({
      start: '2026-12-24',
      end: '2026-12-25',
      allDay: true,
      title: '(Ohne Titel)'
    })
    expect(mapGraphEvent({ ...base, type: 'occurrence' }, 'UTC')?.recurrence).toBe('SERIE')
    expect(mapGraphEvent({ ...base, isCancelled: true }, 'UTC')?.status).toBe('cancelled')
    expect(mapGraphEvent({ ...base, showAs: 'tentative' }, 'UTC')?.status).toBe('tentative')
    const series = mapGraphEvent(
      {
        ...base,
        type: 'seriesMaster',
        recurrence: {
          pattern: { type: 'absoluteYearly', interval: 1, dayOfMonth: 24, month: 12 },
          range: { type: 'noEnd', startDate: '2026-12-24' }
        }
      },
      'UTC'
    )
    expect(series?.recurrence).toBe('FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=24')
  })

  it('verwirft Termine ohne ID oder Zeit', () => {
    expect(mapGraphEvent({ id: 'x' }, 'UTC')).toBeNull()
    expect(mapGraphEvent({ start: { dateTime: 'a' }, end: { dateTime: 'b' } }, 'UTC')).toBeNull()
  })
})

describe('toGraphBody', () => {
  const base = {
    title: 'Zahnarzt',
    start: '2026-11-17T08:00:00.000Z',
    end: '2026-11-17T08:30:00.000Z',
    allDay: false,
    timeZone: 'Europe/Zurich',
    recurrence: null,
    status: 'confirmed' as const
  }

  it('schickt die Uhrzeit in der Zeitzone des Termins', () => {
    expect(
      toGraphBody({
        ...base,
        showAs: 'free',
        private: true,
        reminderMinutes: null,
        categories: ['A']
      })
    ).toMatchObject({
      showAs: 'free',
      sensitivity: 'private',
      isReminderOn: false,
      categories: ['A']
    })
    expect(toGraphBody({ ...base, reminderMinutes: 10 })).toMatchObject({
      isReminderOn: true,
      reminderMinutesBeforeStart: 10
    })
    expect(toGraphBody(base)).toEqual({
      subject: 'Zahnarzt',
      body: { contentType: 'text', content: '' },
      location: { displayName: '' },
      isAllDay: false,
      start: { dateTime: '2026-11-17T09:00:00', timeZone: 'Europe/Zurich' },
      end: { dateTime: '2026-11-17T09:30:00', timeZone: 'Europe/Zurich' },
      recurrence: null
    })
  })

  it('schickt ganztägige Termine ab Mitternacht und Serien als Muster', () => {
    const body = toGraphBody({
      ...base,
      allDay: true,
      start: '2026-11-17',
      end: '2026-11-18',
      recurrence: 'FREQ=WEEKLY;BYDAY=TU,TH;COUNT=10'
    })
    expect(body.start).toEqual({ dateTime: '2026-11-17T00:00:00', timeZone: 'UTC' })
    expect(body.recurrence).toEqual({
      pattern: {
        type: 'weekly',
        interval: 1,
        daysOfWeek: ['tuesday', 'thursday'],
        firstDayOfWeek: 'monday'
      },
      range: { type: 'numbered', startDate: '2026-11-17', numberOfOccurrences: 10 }
    })
  })

  it('lässt bei einem einzelnen Vorkommen die Serie in Ruhe', () => {
    expect(toGraphBody({ ...base, recurrence: 'SERIE' })).not.toHaveProperty('recurrence')
  })
})

describe('wallTime', () => {
  it('rechnet über die Zeitumstellung hinweg richtig', () => {
    expect(wallTime('2026-07-01T07:00:00Z', 'Europe/Zurich')).toBe('2026-07-01T09:00:00')
    expect(wallTime('2026-12-31T23:30:00Z', 'Europe/Zurich')).toBe('2027-01-01T00:30:00')
  })
})

describe('RRULE und Graph-Wiederholung', () => {
  const roundTrip = (rule: string, start = '2026-11-17'): string | null =>
    graphToRrule(rruleToGraph(rule, start))

  it('übersetzt die gängigen Serien hin und zurück', () => {
    expect(roundTrip('FREQ=DAILY')).toBe('FREQ=DAILY')
    expect(roundTrip('FREQ=DAILY;INTERVAL=3;COUNT=5')).toBe('FREQ=DAILY;INTERVAL=3;COUNT=5')
    expect(roundTrip('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR')).toBe(
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR'
    )
    expect(roundTrip('FREQ=MONTHLY;BYMONTHDAY=8')).toBe('FREQ=MONTHLY;BYMONTHDAY=8')
    expect(roundTrip('FREQ=MONTHLY;BYDAY=2TU')).toBe('FREQ=MONTHLY;BYDAY=2TU')
    expect(roundTrip('FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1')).toBe('FREQ=MONTHLY;BYDAY=-1FR')
    expect(roundTrip('FREQ=YEARLY;UNTIL=20301231T225959Z')).toBe(
      'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=17;UNTIL=20301231'
    )
  })

  it('nimmt für wöchentliche Serien ohne Tag den Wochentag des Beginns', () => {
    // Der 17.11.2026 ist ein Dienstag.
    expect(rruleToGraph('FREQ=WEEKLY', '2026-11-17').pattern.daysOfWeek).toEqual(['tuesday'])
  })

  it('lehnt ab, was Outlook nicht kann, statt es falsch zu übertragen', () => {
    expect(() => rruleToGraph('FREQ=HOURLY', '2026-11-17')).toThrow('Outlook')
    expect(() => rruleToGraph('FREQ=MONTHLY;BYDAY=TU', '2026-11-17')).toThrow()
    expect(() => rruleToGraph('FREQ=YEARLY;BYWEEKNO=20', '2026-11-17')).toThrow()
    expect(graphToRrule(null)).toBeNull()
  })
})
