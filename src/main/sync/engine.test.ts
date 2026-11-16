import { describe, expect, it } from 'vitest'
import type { NormalizedEvent } from '../../shared/types'
import type { ProviderEvent } from '../providers/types'
import { syncPair, type EventLink, type LinkStore, type SyncSide } from './engine'

/** Ein Kalender im Arbeitsspeicher, der sich wie ein Anbieter verhält. */
class FakeSide implements SyncSide {
  events = new Map<string, ProviderEvent>()
  /** IDs, die `list` verschweigt, als lägen sie ausserhalb des Zeitraums */
  hidden = new Set<string>()
  writes = 0
  private nextId = 1
  private clock = 1

  constructor(readonly label: string) {}

  private stamp(): string {
    return new Date(Date.UTC(2026, 0, 1, 0, 0, this.clock++)).toISOString()
  }

  add(event: Partial<NormalizedEvent> & { title: string }, updatedAt?: string): ProviderEvent {
    const id = `${this.label}-${this.nextId++}`
    const full: ProviderEvent = {
      start: '2026-11-17T09:00:00Z',
      end: '2026-11-17T10:00:00Z',
      allDay: false,
      timeZone: 'Europe/Zurich',
      recurrence: null,
      status: 'confirmed',
      ...event,
      id,
      updatedAt: updatedAt ?? this.stamp()
    }
    this.events.set(id, full)
    return full
  }

  edit(id: string, change: Partial<NormalizedEvent>, updatedAt?: string): void {
    const event = this.events.get(id)!
    this.events.set(id, { ...event, ...change, updatedAt: updatedAt ?? this.stamp() })
  }

  async list(): Promise<ProviderEvent[]> {
    return [...this.events.values()].filter((event) => !this.hidden.has(event.id))
  }
  async get(id: string): Promise<ProviderEvent | null> {
    return this.events.get(id) ?? null
  }
  async create(event: NormalizedEvent): Promise<ProviderEvent> {
    this.writes++
    return this.add(event)
  }
  async update(id: string, event: NormalizedEvent): Promise<ProviderEvent> {
    this.writes++
    if (!this.events.has(id)) throw new Error('nicht gefunden')
    const updated = { ...event, id, updatedAt: this.stamp() }
    this.events.set(id, updated)
    return updated
  }
  async remove(id: string): Promise<void> {
    this.writes++
    this.events.delete(id)
  }
  titles(): string[] {
    return [...this.events.values()].map((event) => event.title).sort()
  }
}

class FakeLinks implements LinkStore {
  links: EventLink[] = []
  private nextId = 1
  async list(): Promise<EventLink[]> {
    return this.links.map((link) => ({ ...link }))
  }
  async save(link: EventLink): Promise<void> {
    if (link.id) this.links = this.links.map((entry) => (entry.id === link.id ? link : entry))
    else this.links.push({ ...link, id: `link-${this.nextId++}` })
  }
  async remove(link: EventLink): Promise<void> {
    this.links = this.links.filter((entry) => entry.id !== link.id)
  }
}

function setup(): {
  a: FakeSide
  b: FakeSide
  links: FakeLinks
  run: () => ReturnType<typeof syncPair>
} {
  const a = new FakeSide('Google')
  const b = new FakeSide('Outlook')
  const links = new FakeLinks()
  return { a, b, links, run: () => syncPair(a, b, links) }
}

describe('syncPair', () => {
  it('überträgt neue Termine in beide Richtungen', async () => {
    const { a, b, links, run } = setup()
    a.add({ title: 'Zahnarzt' })
    b.add({ title: 'Sitzung', start: '2026-11-18T13:00:00Z', end: '2026-11-18T14:00:00Z' })

    const result = await run()

    expect(result).toMatchObject({ created: 2, updated: 0, deleted: 0, problems: [] })
    expect(a.titles()).toEqual(['Sitzung', 'Zahnarzt'])
    expect(b.titles()).toEqual(['Sitzung', 'Zahnarzt'])
    expect(links.links).toHaveLength(2)
  })

  it('tut beim zweiten Lauf nichts mehr (keine Schleife)', async () => {
    const { a, b, run } = setup()
    a.add({ title: 'Zahnarzt' })
    await run()
    const writes = a.writes + b.writes

    const second = await run()

    expect(second).toMatchObject({ created: 0, updated: 0, deleted: 0, linked: 0 })
    expect(a.writes + b.writes).toBe(writes)
  })

  it('bleibt ruhig, auch wenn ein Anbieter Termine anders zurückgibt, als sie geschrieben wurden', async () => {
    const { a, b, run } = setup()
    // Diese Seite hängt beim Speichern eine Zeile an die Notiz, wie es Outlook tun kann.
    const create = b.create.bind(b)
    b.create = (event) => create({ ...event, description: `${event.description ?? ''}\n` + '-- ' })
    a.add({ title: 'Zahnarzt', description: 'Kontrolle' })

    await run()
    const second = await run()

    expect(second).toMatchObject({ created: 0, updated: 0 })
    expect([...a.events.values()][0].description).toBe('Kontrolle')
  })

  it('verknüpft Termine, die schon in beiden Kalendern stehen, statt sie zu verdoppeln', async () => {
    const { a, b, run } = setup()
    a.add({ title: 'Geburtstag', allDay: true, start: '2026-12-01', end: '2026-12-02' })
    b.add({ title: 'geburtstag ', allDay: true, start: '2026-12-01', end: '2026-12-02' })

    const result = await run()

    expect(result).toMatchObject({ linked: 1, created: 0 })
    expect(a.events.size).toBe(1)
    expect(b.events.size).toBe(1)
  })

  it('überträgt eine Änderung auf die andere Seite', async () => {
    const { a, b, run } = setup()
    const event = a.add({ title: 'Zahnarzt' })
    await run()

    a.edit(event.id, { title: 'Zahnarzt (verschoben)', start: '2026-11-19T09:00:00Z' })
    const result = await run()

    expect(result).toMatchObject({ updated: 1, created: 0 })
    expect([...b.events.values()][0]).toMatchObject({
      title: 'Zahnarzt (verschoben)',
      start: '2026-11-19T09:00:00Z'
    })
    expect((await run()).updated).toBe(0)
  })

  it('lässt bei einem Konflikt die jüngere Änderung gewinnen', async () => {
    const { a, b, run } = setup()
    const event = a.add({ title: 'Zahnarzt' })
    await run()
    const twin = [...b.events.values()][0]

    a.edit(event.id, { title: 'Alt' }, '2026-05-01T10:00:00Z')
    b.edit(twin.id, { title: 'Neu' }, '2026-05-01T11:00:00Z')
    await run()

    expect(a.titles()).toEqual(['Neu'])
    expect(b.titles()).toEqual(['Neu'])
  })

  it('löscht einen Termin auch auf der anderen Seite', async () => {
    const { a, b, links, run } = setup()
    const event = a.add({ title: 'Zahnarzt' })
    await run()

    a.events.delete(event.id)
    const result = await run()

    expect(result.deleted).toBe(1)
    expect(b.events.size).toBe(0)
    expect(links.links).toHaveLength(0)
  })

  it('stellt einen gelöschten Termin wieder her, wenn er drüben geändert wurde', async () => {
    const { a, b, run } = setup()
    const event = a.add({ title: 'Zahnarzt' })
    await run()
    const twin = [...b.events.values()][0]

    a.events.delete(event.id)
    b.edit(twin.id, { title: 'Zahnarzt neu' })
    const result = await run()

    expect(result).toMatchObject({ created: 1, deleted: 0 })
    expect(a.titles()).toEqual(['Zahnarzt neu'])
    expect((await run()).created).toBe(0)
  })

  it('löscht nichts, nur weil ein Termin aus dem Zeitraum gerutscht ist', async () => {
    const { a, b, run } = setup()
    const event = a.add({ title: 'Zahnarzt' })
    await run()

    a.hidden.add(event.id)
    const result = await run()

    expect(result.deleted).toBe(0)
    expect(b.events.size).toBe(1)
  })

  it('räumt die Verknüpfung auf, wenn beide Seiten gelöscht wurden', async () => {
    const { a, b, links, run } = setup()
    a.add({ title: 'Zahnarzt' })
    await run()

    a.events.clear()
    b.events.clear()
    const result = await run()

    expect(result).toMatchObject({ deleted: 0, created: 0 })
    expect(links.links).toHaveLength(0)
  })

  it('stoppt, wenn auf einen Schlag sehr viele Termine gelöscht würden', async () => {
    const { a, b, run } = setup()
    for (let index = 0; index < 20; index++) {
      a.add({
        title: `Termin ${index}`,
        start: `2026-11-${10 + index}T09:00:00Z`,
        end: `2026-11-${10 + index}T10:00:00Z`
      })
    }
    await run()

    a.events.clear()
    const result = await run()

    expect(result.deleted).toBe(0)
    expect(result.problems.join(' ')).toContain('Sicherheitsstopp')
    expect(b.events.size).toBe(20)
  })

  it('meldet einen Fehler bei einem Termin und macht mit den anderen weiter', async () => {
    const { a, b, run } = setup()
    a.add({ title: 'Kaputt' })
    a.add({ title: 'Gut', start: '2026-11-20T09:00:00Z', end: '2026-11-20T10:00:00Z' })
    const create = b.create.bind(b)
    b.create = async (event) => {
      if (event.title === 'Kaputt') throw new Error('abgelehnt')
      return create(event)
    }

    const result = await run()

    expect(result.created).toBe(1)
    expect(result.problems).toEqual(['«Kaputt» nach Outlook übertragen: abgelehnt'])
    expect(b.titles()).toEqual(['Gut'])
  })

  it('überträgt Serien mit ihrer Regel', async () => {
    const { a, b, run } = setup()
    a.add({ title: 'Training', recurrence: 'FREQ=WEEKLY;BYDAY=TU,TH' })

    await run()

    expect([...b.events.values()][0].recurrence).toBe('FREQ=WEEKLY;BYDAY=TU,TH')
  })
})
