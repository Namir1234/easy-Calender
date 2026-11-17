import { describe, expect, it } from 'vitest'
import type { NormalizedEvent } from '../../shared/types'
import { contentHash } from '../sync/hash'
import {
  buildCalendar,
  buildTimezone,
  displayEvents,
  occurrenceEvent,
  removeOccurrence,
  seriesEvent,
  splitEventId,
  updateOccurrence,
  updateSeries,
  zonedToInstant
} from './icalMapper'

const ZURICH = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Zurich',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'DTSTART:19810329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'DTSTART:19961027T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE'
]

const ics = (...lines: string[]): string =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Apple Inc.//iCloud//EN',
    ...lines,
    'END:VCALENDAR'
  ].join('\r\n')

const URL = 'https://p01-caldav.icloud.com/123/calendars/home/abc.ics'
const NOW = new Date('2026-11-17T10:00:00Z')

const single = ics(
  ...ZURICH,
  'BEGIN:VEVENT',
  'UID:abc',
  'DTSTAMP:20261101T080000Z',
  'LAST-MODIFIED:20261102T080000Z',
  'SUMMARY:Zahnarzt',
  'DESCRIPTION:Zeile 1\\nZeile 2\\, mit Komma',
  'LOCATION:Zürich',
  'DTSTART;TZID=Europe/Zurich:20261118T140000',
  'DTEND;TZID=Europe/Zurich:20261118T150000',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  'TRIGGER:-PT15M',
  'END:VALARM',
  'END:VEVENT'
)

const series = ics(
  ...ZURICH,
  'BEGIN:VEVENT',
  'UID:serie',
  'DTSTAMP:20261101T080000Z',
  'SUMMARY:Training',
  'DTSTART;TZID=Europe/Zurich:20261102T180000',
  'DTEND;TZID=Europe/Zurich:20261102T193000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO',
  'EXDATE;TZID=Europe/Zurich:20261109T180000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:serie',
  'DTSTAMP:20261101T080000Z',
  'RECURRENCE-ID;TZID=Europe/Zurich:20261116T180000',
  'SUMMARY:Training (später)',
  'DTSTART;TZID=Europe/Zurich:20261116T190000',
  'DTEND;TZID=Europe/Zurich:20261116T203000',
  'END:VEVENT'
)

const NOVEMBER = { start: new Date('2026-11-01T00:00:00Z'), end: new Date('2026-12-01T00:00:00Z') }

const base: NormalizedEvent = {
  title: 'Kino',
  description: 'Mit Lea\nund Tom',
  location: 'Pathé',
  start: '2026-11-20T20:00:00+01:00',
  end: '2026-11-20T22:00:00+01:00',
  allDay: false,
  timeZone: 'Europe/Zurich',
  recurrence: null,
  status: 'confirmed'
}

describe('Lesen', () => {
  it('liest einen Einzeltermin mit Zone, Notiz und Ort', () => {
    const event = seriesEvent(URL, single, 'UTC')
    expect(event).toMatchObject({
      id: URL,
      title: 'Zahnarzt',
      description: 'Zeile 1\nZeile 2, mit Komma',
      location: 'Zürich',
      start: '2026-11-18T13:00:00.000Z',
      end: '2026-11-18T14:00:00.000Z',
      allDay: false,
      timeZone: 'Europe/Zurich',
      recurrence: null,
      updatedAt: '2026-11-02T08:00:00.000Z'
    })
  })

  it('liest ganztägige Termine, auch ohne Ende', () => {
    const data = ics(
      'BEGIN:VEVENT',
      'UID:x',
      'SUMMARY:Ferien',
      'DTSTART;VALUE=DATE:20261224',
      'END:VEVENT'
    )
    expect(seriesEvent(URL, data, 'Europe/Zurich')).toMatchObject({
      allDay: true,
      start: '2026-12-24',
      end: '2026-12-25',
      timeZone: 'Europe/Zurich'
    })
  })

  it('rechnet eine Zone ohne VTIMEZONE mit Intl um', () => {
    const data = ics(
      'BEGIN:VEVENT',
      'UID:x',
      'SUMMARY:Sommer',
      'DTSTART;TZID=Europe/Zurich:20260710T090000',
      'DTEND;TZID=Europe/Zurich:20260710T100000',
      'END:VEVENT'
    )
    expect(seriesEvent(URL, data, 'UTC')?.start).toBe('2026-07-10T07:00:00.000Z')
  })

  it('liefert eine Serie für den Abgleich als Ganzes', () => {
    const event = seriesEvent(URL, series, 'UTC')
    expect(event?.recurrence).toBe('FREQ=WEEKLY;BYDAY=MO')
    expect(event?.start).toBe('2026-11-02T17:00:00.000Z')
  })

  it('löst eine Serie für die Anzeige auf, mit Ausnahme und EXDATE', () => {
    const events = displayEvents(URL, series, NOVEMBER, 'UTC')
    expect(events.map((event) => [event.title, event.start])).toEqual([
      ['Training', '2026-11-02T17:00:00.000Z'],
      ['Training (später)', '2026-11-16T18:00:00.000Z'],
      ['Training', '2026-11-23T17:00:00.000Z'],
      ['Training', '2026-11-30T17:00:00.000Z']
    ])
    expect(events.every((event) => event.recurrence === 'SERIE')).toBe(true)
    expect(splitEventId(events[1].id)).toEqual({ url: URL, key: '2026-11-16T17:00:00.000Z' })
  })

  it('findet ein einzelnes Vorkommen über seine ID', () => {
    expect(occurrenceEvent(URL, series, '2026-11-23T17:00:00.000Z', 'UTC')?.start).toBe(
      '2026-11-23T17:00:00.000Z'
    )
    expect(occurrenceEvent(URL, series, '2026-11-09T17:00:00.000Z', 'UTC')).toBeNull()
  })
})

describe('Schreiben', () => {
  it('baut eine Datei, die gleich zurückgelesen wird', () => {
    const data = buildCalendar(base, 'neu-1', NOW)
    expect(data).toContain('DTSTART;TZID=Europe/Zurich:20261120T200000')
    expect(data).toContain('BEGIN:VTIMEZONE')
    const back = seriesEvent(URL, data, 'UTC')!
    expect(contentHash(back)).toBe(contentHash(base))
  })

  it('schreibt Serien und ganztägige Termine', () => {
    const allDay = { ...base, allDay: true, start: '2026-12-24', end: '2026-12-26' }
    const data = buildCalendar({ ...allDay, recurrence: 'FREQ=YEARLY' }, 'neu-2', NOW)
    expect(data).toContain('DTSTART;VALUE=DATE:20261224')
    expect(data).toContain('RRULE:FREQ=YEARLY')
    expect(seriesEvent(URL, data, 'UTC')).toMatchObject({
      start: '2026-12-24',
      end: '2026-12-26',
      recurrence: 'FREQ=YEARLY'
    })
  })

  it('ändert einen Termin und lässt Erinnerungen stehen', () => {
    const data = updateSeries(single, { ...base, description: undefined }, NOW)
    expect(data).toContain('BEGIN:VALARM')
    expect(data).not.toContain('DESCRIPTION')
    expect(data).toContain('SEQUENCE:1')
    expect(seriesEvent(URL, data, 'UTC')).toMatchObject({
      title: 'Kino',
      start: '2026-11-20T19:00:00.000Z'
    })
  })

  it('macht aus einer Serie einen Einzeltermin', () => {
    const plain = seriesEvent(URL, series, 'UTC')!
    const data = updateSeries(series, { ...plain, recurrence: null }, NOW)
    expect(data).not.toContain('RRULE:FREQ=WEEKLY')
    expect(data).not.toContain('EXDATE')
    expect(data).not.toContain('RECURRENCE-ID')
    expect(displayEvents(URL, data, NOVEMBER, 'UTC')).toHaveLength(1)
  })

  it('ändert ein einzelnes Vorkommen als Ausnahme', () => {
    const key = '2026-11-23T17:00:00.000Z'
    const data = updateOccurrence(
      series,
      key,
      {
        ...base,
        title: 'Training fällt kürzer aus',
        start: '2026-11-23T17:00:00.000Z',
        end: '2026-11-23T17:45:00.000Z',
        recurrence: 'SERIE'
      },
      NOW
    )
    expect(data).toContain('RECURRENCE-ID;TZID=Europe/Zurich:20261123T180000')
    const events = displayEvents(URL, data, NOVEMBER, 'UTC')
    expect(events.find((event) => event.id === `${URL}#${key}`)).toMatchObject({
      title: 'Training fällt kürzer aus',
      end: '2026-11-23T17:45:00.000Z'
    })
    expect(events).toHaveLength(4)
    expect(seriesEvent(URL, data, 'UTC')?.recurrence).toBe('FREQ=WEEKLY;BYDAY=MO')
  })

  it('löscht ein einzelnes Vorkommen, auch eine Ausnahme', () => {
    let data = removeOccurrence(series, '2026-11-23T17:00:00.000Z', NOW)
    data = removeOccurrence(data, '2026-11-16T17:00:00.000Z', NOW)
    const titles = displayEvents(URL, data, NOVEMBER, 'UTC').map((event) => event.start)
    expect(titles).toEqual(['2026-11-02T17:00:00.000Z', '2026-11-30T17:00:00.000Z'])
    expect(data).not.toContain('RECURRENCE-ID')
  })
})

describe('Zeitzonen', () => {
  it('rechnet Uhrzeiten einer Zone in Zeitpunkte um, auch im Sommer', () => {
    expect(zonedToInstant('2026-01-15T09:00:00', 'Europe/Zurich').toISOString()).toBe(
      '2026-01-15T08:00:00.000Z'
    )
    expect(zonedToInstant('2026-07-15T09:00:00', 'Europe/Zurich').toISOString()).toBe(
      '2026-07-15T07:00:00.000Z'
    )
  })

  it('baut die Regeln der Zeitumstellung aus Intl', () => {
    const zone = buildTimezone('Europe/Zurich', 2026)
    expect(zone).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU')
    expect(zone).toContain('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU')
    expect(zone).toContain('DTSTART:19700329T020000')
    expect(zone).toContain('DTSTART:19701025T030000')
    expect(buildTimezone('Asia/Tokyo', 2026)).toContain('TZOFFSETTO:+0900')
  })

  it('hält eine Serie über die Zeitumstellung auf derselben Uhrzeit', () => {
    const data = buildCalendar(
      {
        ...base,
        start: '2026-10-19T18:00:00+02:00',
        end: '2026-10-19T19:00:00+02:00',
        recurrence: 'FREQ=WEEKLY'
      },
      'serie-2',
      NOW
    )
    const starts = displayEvents(URL, data, NOVEMBER, 'UTC').map((event) => event.start)
    // Im November gilt Winterzeit: 18 Uhr in Zürich ist 17 Uhr UTC.
    expect(starts[0]).toBe('2026-11-02T17:00:00.000Z')
  })
})
