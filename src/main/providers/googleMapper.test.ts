import { describe, expect, it } from 'vitest'
import { mapGoogleEvent, normalizeColor, toGoogleBody } from './googleMapper'

describe('mapGoogleEvent', () => {
  it('wandelt einen Termin mit Uhrzeit um', () => {
    const event = mapGoogleEvent(
      {
        id: 'abc',
        status: 'confirmed',
        summary: ' Zahnarzt ',
        description: 'Kontrolle',
        location: 'Zürich',
        start: { dateTime: '2026-11-17T09:00:00+01:00', timeZone: 'Europe/Zurich' },
        end: { dateTime: '2026-11-17T09:30:00+01:00', timeZone: 'Europe/Zurich' }
      },
      'UTC'
    )
    expect(event).toEqual({
      id: 'abc',
      title: 'Zahnarzt',
      description: 'Kontrolle',
      location: 'Zürich',
      start: '2026-11-17T09:00:00+01:00',
      end: '2026-11-17T09:30:00+01:00',
      allDay: false,
      timeZone: 'Europe/Zurich',
      recurrence: null,
      status: 'confirmed',
      updatedAt: undefined,
      seriesId: undefined,
      showAs: 'busy',
      private: false,
      reminderMinutes: null,
      categories: []
    })
  })

  it('liest Anzeigen als, Privat, Erinnerung und Kategorien', () => {
    const base = { id: 'x', start: { date: '2026-11-17' }, end: { date: '2026-11-18' } }
    expect(
      mapGoogleEvent(
        {
          ...base,
          transparency: 'transparent',
          visibility: 'private',
          reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] },
          extendedProperties: { private: { easyCategories: '["Rote Kategorie"]' } }
        },
        'UTC'
      )
    ).toMatchObject({
      showAs: 'free',
      private: true,
      reminderMinutes: 10,
      categories: ['Rote Kategorie']
    })
  })

  it('nimmt die Standard-Erinnerung des Kalenders und merkt sich «abwesend»', () => {
    const base = { id: 'x', start: { date: '2026-11-17' }, end: { date: '2026-11-18' } }
    const event = mapGoogleEvent(
      {
        ...base,
        reminders: { useDefault: true },
        extendedProperties: { private: { easyShowAs: 'oof' } }
      },
      'UTC',
      [{ method: 'popup', minutes: 30 }]
    )
    expect(event).toMatchObject({ reminderMinutes: 30, showAs: 'oof' })
    // Hat jemand den Termin in Google auf «frei» gestellt, gilt das.
    const changed = mapGoogleEvent(
      {
        ...base,
        transparency: 'transparent',
        extendedProperties: { private: { easyShowAs: 'oof' } }
      },
      'UTC'
    )
    expect(changed?.showAs).toBe('free')
  })

  it('erkennt ganztägige Termine und behält das exklusive Ende', () => {
    const event = mapGoogleEvent(
      { id: 'ferien', start: { date: '2026-12-24' }, end: { date: '2026-12-27' } },
      'Europe/Zurich'
    )
    expect(event).toMatchObject({
      start: '2026-12-24',
      end: '2026-12-27',
      allDay: true,
      timeZone: 'Europe/Zurich'
    })
  })

  it('nimmt die Zeitzone des Kalenders, wenn der Termin keine hat', () => {
    const event = mapGoogleEvent(
      {
        id: 'x',
        start: { dateTime: '2026-11-17T09:00:00Z' },
        end: { dateTime: '2026-11-17T10:00:00Z' }
      },
      'Europe/Zurich'
    )
    expect(event?.timeZone).toBe('Europe/Zurich')
  })

  it('setzt einen Platzhalter für Termine ohne Titel', () => {
    const event = mapGoogleEvent(
      { id: 'x', summary: '  ', start: { date: '2026-11-17' }, end: { date: '2026-11-18' } },
      'UTC'
    )
    expect(event?.title).toBe('(Ohne Titel)')
  })

  it('liest die RRULE einer Serie und markiert einzelne Vorkommen', () => {
    const base = { start: { date: '2026-11-17' }, end: { date: '2026-11-18' } }
    const series = mapGoogleEvent(
      { ...base, id: 'serie', recurrence: ['EXDATE:20261124', 'RRULE:FREQ=WEEKLY;BYDAY=TU'] },
      'UTC'
    )
    const instance = mapGoogleEvent(
      { ...base, id: 'serie_20261117', recurringEventId: 'serie' },
      'UTC'
    )
    expect(series?.recurrence).toBe('FREQ=WEEKLY;BYDAY=TU')
    expect(instance?.recurrence).toBe('SERIE')
  })

  it('übernimmt den Status und behandelt Unbekanntes als bestätigt', () => {
    const base = { id: 'x', start: { date: '2026-11-17' }, end: { date: '2026-11-18' } }
    expect(mapGoogleEvent({ ...base, status: 'cancelled' }, 'UTC')?.status).toBe('cancelled')
    expect(mapGoogleEvent({ ...base, status: 'tentative' }, 'UTC')?.status).toBe('tentative')
    expect(mapGoogleEvent({ ...base, status: 'seltsam' }, 'UTC')?.status).toBe('confirmed')
  })

  it('verwirft Termine ohne ID oder ohne Zeit', () => {
    expect(
      mapGoogleEvent({ start: { date: '2026-11-17' }, end: { date: '2026-11-18' } }, 'UTC')
    ).toBeNull()
    expect(mapGoogleEvent({ id: 'x' }, 'UTC')).toBeNull()
    expect(mapGoogleEvent({ id: 'x', start: {}, end: {} }, 'UTC')).toBeNull()
  })
})

describe('toGoogleBody', () => {
  const base = {
    title: 'Zahnarzt',
    start: '2026-11-17T08:00:00.000Z',
    end: '2026-11-17T08:30:00.000Z',
    allDay: false,
    timeZone: 'Europe/Zurich',
    recurrence: null,
    status: 'confirmed' as const
  }

  it('schickt Zeit mit Zeitzone und leert leere Felder', () => {
    expect(toGoogleBody(base)).toEqual({
      summary: 'Zahnarzt',
      description: '',
      location: '',
      start: { dateTime: '2026-11-17T08:00:00.000Z', date: null, timeZone: 'Europe/Zurich' },
      end: { dateTime: '2026-11-17T08:30:00.000Z', date: null, timeZone: 'Europe/Zurich' },
      recurrence: []
    })
  })

  it('schickt ganztägige Termine als Datum und Serien als RRULE', () => {
    const body = toGoogleBody({
      ...base,
      allDay: true,
      start: '2026-12-24',
      end: '2026-12-25',
      recurrence: 'FREQ=YEARLY'
    })
    expect(body.start).toEqual({ date: '2026-12-24', dateTime: null, timeZone: null })
    expect(body.recurrence).toEqual(['RRULE:FREQ=YEARLY'])
  })

  it('schreibt Zusatzfelder nur, wenn sie mitkommen', () => {
    expect(
      toGoogleBody({
        ...base,
        showAs: 'oof',
        private: true,
        reminderMinutes: null,
        categories: ['A']
      })
    ).toMatchObject({
      transparency: 'opaque',
      visibility: 'private',
      reminders: { useDefault: false, overrides: [] },
      extendedProperties: { private: { easyShowAs: 'oof', easyCategories: '["A"]' } }
    })
  })

  it('lässt bei einem einzelnen Vorkommen die Serie in Ruhe', () => {
    expect(toGoogleBody({ ...base, recurrence: 'SERIE' })).not.toHaveProperty('recurrence')
  })
})

describe('normalizeColor', () => {
  it('übernimmt gültige Farben in Kleinbuchstaben', () => {
    expect(normalizeColor('#9FE1E7', '#000000')).toBe('#9fe1e7')
  })

  it('nimmt sonst die Ersatzfarbe', () => {
    expect(normalizeColor(null, '#2563a8')).toBe('#2563a8')
    expect(normalizeColor('red', '#2563a8')).toBe('#2563a8')
    expect(normalizeColor('#fff', '#2563a8')).toBe('#2563a8')
  })
})
