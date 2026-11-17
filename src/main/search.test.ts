import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../shared/types'
import { matchesSearch } from './search'

const event: CalendarEvent = {
  id: 'e',
  calendarId: 'c',
  title: 'Sprint Review',
  location: 'Sitzungszimmer 2',
  description: 'Demo für das Team',
  start: '2026-11-20T13:00:00Z',
  end: '2026-11-20T14:00:00Z',
  allDay: false,
  timeZone: 'Europe/Zurich',
  recurrence: null,
  status: 'confirmed',
  categories: ['Blaue Kategorie']
}

describe('matchesSearch', () => {
  it('findet Wörter in Titel, Ort, Notiz und Kategorie, unabhängig von Gross/klein', () => {
    expect(matchesSearch(event, 'review')).toBe(true)
    expect(matchesSearch(event, 'SITZUNGSZIMMER')).toBe(true)
    expect(matchesSearch(event, 'für')).toBe(true)
    expect(matchesSearch(event, 'blaue')).toBe(true)
  })

  it('verlangt alle Wörter', () => {
    expect(matchesSearch(event, 'review team')).toBe(true)
    expect(matchesSearch(event, 'review zahnarzt')).toBe(false)
  })

  it('findet mit leerem Suchbegriff nichts', () => {
    expect(matchesSearch(event, '   ')).toBe(false)
  })
})
