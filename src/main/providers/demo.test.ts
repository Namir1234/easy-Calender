import { describe, expect, it } from 'vitest'
import { parseDateRange } from '../dateRange'
import { DemoProvider } from './demo'

const provider = new DemoProvider()

// Montag, 16. November 2026 bis und mit Sonntag, 22. November 2026
const WEEK = parseDateRange({ start: '2026-11-16', end: '2026-11-23' })

describe('DemoProvider', () => {
  it('liefert für denselben Zeitraum immer dieselben Termine', async () => {
    const first = await provider.listEvents('demo-sport', WEEK)
    const second = await provider.listEvents('demo-sport', WEEK)
    expect(second).toEqual(first)
  })

  it('legt wöchentliche Termine auf die richtigen Wochentage', async () => {
    const events = await provider.listEvents('demo-sport', WEEK)
    const trainings = events.filter((event) => event.title === 'Fussballtraining')
    expect(trainings.map((event) => event.start)).toEqual([
      '2026-11-17T18:30:00', // Dienstag
      '2026-11-19T18:30:00' // Donnerstag
    ])
    expect(trainings[0].end).toBe('2026-11-17T20:00:00')
    expect(trainings[0].allDay).toBe(false)
  })

  it('legt Termine alle zwei Wochen nur in jede zweite Woche', async () => {
    const fourWeeks = parseDateRange({ start: '2026-11-02', end: '2026-11-30' })
    const events = await provider.listEvents('demo-firma', fourWeeks)
    const reviews = events.filter((event) => event.title === 'Sprint Review')
    expect(reviews).toHaveLength(2)
    const [first, second] = reviews.map((event) => new Date(`${event.start}Z`).getTime())
    expect((second - first) / 86_400_000).toBe(14)
  })

  it('gibt ganztägigen Terminen ein exklusives Ende am Folgetag', async () => {
    const events = await provider.listEvents('demo-schule', WEEK)
    const deadline = events.find((event) => event.title === 'Abgabe Projektarbeit')
    expect(deadline).toMatchObject({ start: '2026-11-20', end: '2026-11-21', allDay: true })
  })

  it('bleibt innerhalb des Zeitraums und vergibt eindeutige IDs', async () => {
    const month = parseDateRange({ start: '2026-11-01', end: '2026-12-01' })
    const all = (
      await Promise.all(
        ['demo-privat', 'demo-sport', 'demo-schule', 'demo-firma'].map((id) =>
          provider.listEvents(id, month)
        )
      )
    ).flat()

    expect(all.length).toBeGreaterThan(20)
    expect(new Set(all.map((event) => event.id)).size).toBe(all.length)
    for (const event of all) {
      expect(event.start >= '2026-11-01').toBe(true)
      expect(event.start < '2026-12-01').toBe(true)
      expect(event.end > event.start).toBe(true)
    }
  })

  it('liefert für unbekannte Kalender nichts', async () => {
    expect(await provider.listEvents('gibt-es-nicht', WEEK)).toEqual([])
  })
})
