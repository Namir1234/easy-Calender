import { describe, expect, it } from 'vitest'
import { OutlookBridge, OutlookLocalProvider } from './outlookLocal'
import {
  mapOutlookItem,
  patternToRrule,
  rruleToPattern,
  toOutlookItem,
  type OutlookItem
} from './outlookLocalMapper'

const item: OutlookItem = {
  id: 'ABC',
  subject: ' Sitzung ',
  body: 'Traktanden\r\n',
  location: 'Zimmer 2',
  allDay: false,
  startUtc: '2026-11-17T08:00:00Z',
  endUtc: '2026-11-17T09:00:00Z',
  startDate: '2026-11-17',
  endDate: '2026-11-17',
  busy: 2,
  meeting: 0,
  occurrence: false,
  pattern: null,
  modified: '2026-11-01T10:00:00Z'
}

describe('mapOutlookItem', () => {
  it('wandelt einen Termin mit Uhrzeit um', () => {
    expect(mapOutlookItem(item, 'Europe/Zurich')).toEqual({
      id: 'ABC',
      title: 'Sitzung',
      description: 'Traktanden',
      location: 'Zimmer 2',
      start: '2026-11-17T08:00:00Z',
      end: '2026-11-17T09:00:00Z',
      allDay: false,
      timeZone: 'Europe/Zurich',
      recurrence: null,
      status: 'confirmed',
      updatedAt: '2026-11-01T10:00:00Z'
    })
  })

  it('erkennt ganztägige Termine, Vorkommen, Absagen und Serien', () => {
    expect(
      mapOutlookItem(
        { ...item, allDay: true, startDate: '2026-12-24', endDate: '2026-12-25' },
        'UTC'
      )
    ).toMatchObject({ start: '2026-12-24', end: '2026-12-25', allDay: true })
    expect(mapOutlookItem({ ...item, occurrence: true }, 'UTC')?.recurrence).toBe('SERIE')
    expect(mapOutlookItem({ ...item, meeting: 5 }, 'UTC')?.status).toBe('cancelled')
    expect(mapOutlookItem({ ...item, busy: 1 }, 'UTC')?.status).toBe('tentative')
    const weekly = {
      type: 1,
      interval: 2,
      dayMask: 2 + 32,
      dayOfMonth: 0,
      month: 0,
      instance: 0,
      noEnd: true,
      occurrences: 0
    }
    expect(mapOutlookItem({ ...item, pattern: weekly }, 'UTC')?.recurrence).toBe(
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR'
    )
  })
})

describe('Serien: RRULE und Outlook-Muster', () => {
  const roundTrip = (rule: string): string | null =>
    patternToRrule({ ...rruleToPattern(rule, '2026-11-17'), noEnd: !/COUNT|UNTIL/.test(rule) })

  it('übersetzt hin und zurück', () => {
    expect(roundTrip('FREQ=DAILY;INTERVAL=3;COUNT=5')).toBe('FREQ=DAILY;INTERVAL=3;COUNT=5')
    expect(roundTrip('FREQ=WEEKLY;BYDAY=TU,TH')).toBe('FREQ=WEEKLY;BYDAY=TU,TH')
    expect(roundTrip('FREQ=MONTHLY;BYMONTHDAY=8')).toBe('FREQ=MONTHLY;BYMONTHDAY=8')
    expect(roundTrip('FREQ=MONTHLY;BYDAY=-1FR')).toBe('FREQ=MONTHLY;BYDAY=-1FR')
    expect(roundTrip('FREQ=YEARLY;UNTIL=20301231T000000Z')).toBe(
      'FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=17;UNTIL=20301231'
    )
  })

  it('rechnet jährliche Serien in Monate um, wie Outlook sie zählt', () => {
    expect(rruleToPattern('FREQ=YEARLY;INTERVAL=2', '2026-11-17')).toMatchObject({
      type: 5,
      interval: 24,
      month: 11,
      dayOfMonth: 17
    })
  })
})

describe('toOutlookItem', () => {
  const base = {
    title: 'Zahnarzt',
    start: '2026-11-17T08:00:00.000Z',
    end: '2026-11-17T08:30:00.000Z',
    allDay: false,
    timeZone: 'Europe/Zurich',
    recurrence: null,
    status: 'confirmed' as const
  }

  it('unterscheidet «keine Serie», «Serie setzen» und «Serie in Ruhe lassen»', () => {
    expect(toOutlookItem(base)).toMatchObject({
      subject: 'Zahnarzt',
      body: '',
      startUtc: '2026-11-17T08:00:00.000Z',
      recurrence: 'none',
      pattern: null
    })
    expect(toOutlookItem({ ...base, recurrence: 'FREQ=DAILY' })).toMatchObject({
      recurrence: 'set',
      pattern: { type: 0, interval: 1 }
    })
    expect(toOutlookItem({ ...base, recurrence: 'SERIE' }).recurrence).toBe('keep')
  })

  it('schreibt die Notiz nur mit ASCII, Titel und Ort bleiben unverändert', () => {
    const sent = toOutlookItem({
      ...base,
      title: 'Zürich',
      location: 'Café',
      description: 'Grüsse aus Zürich, «café» für 5 €'
    })
    expect(sent).toMatchObject({
      subject: 'Zürich',
      location: 'Café',
      body: 'Gruesse aus Zuerich, "cafe" fuer 5 EUR'
    })
  })
})

describe('OutlookBridge und OutlookLocalProvider', () => {
  it('trennt Konto und Ordner in der Kalender-ID und reicht Aufträge durch', async () => {
    const requests: Array<Record<string, unknown>> = []
    const bridge = new OutlookBridge(async (json) => {
      const request = JSON.parse(json)
      requests.push(request)
      if (request.op === 'calendars') {
        return JSON.stringify({
          ok: true,
          data: {
            stores: [
              {
                storeId: 'S1',
                name: 'ich@example.com',
                calendars: [{ id: 'F1', name: 'Kalender' }]
              }
            ]
          }
        })
      }
      return `Hinweis von PowerShell\n${JSON.stringify({ ok: true, data: { events: [item] } })}`
    })

    const [store] = await bridge.listStores()
    expect(store).toMatchObject({ name: 'ich@example.com' })
    expect(store.calendars[0].remoteId).toBe('S1|F1')

    const provider = new OutlookLocalProvider(bridge)
    const events = await provider.listEvents('S1|F1', { startDay: 20774, endDay: 20781 })
    expect(events).toHaveLength(1)
    expect(requests[1]).toMatchObject({ op: 'list', storeId: 'S1', folderId: 'F1', expand: true })
  })

  it('gibt Fehler aus Outlook verständlich weiter und läuft danach weiter', async () => {
    let fail = true
    const bridge = new OutlookBridge(async () =>
      JSON.stringify(
        fail ? { ok: false, error: 'Ordner fehlt' } : { ok: true, data: { stores: [] } }
      )
    )
    await expect(bridge.listStores()).rejects.toThrow('Outlook meldet: Ordner fehlt')
    fail = false
    await expect(bridge.listStores()).resolves.toEqual([])
  })
})
