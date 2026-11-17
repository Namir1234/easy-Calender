import type { NormalizedEvent } from '../../shared/types'
import type { ProviderEvent } from '../providers/types'
import { sameInAscii } from '../text'
import { contentHash, identityHash } from './hash'

/** Eine Seite eines Kalenderpaars: ein Kalender bei einem Anbieter. */
export interface SyncSide {
  /** Wie die Seite in Meldungen heisst, z. B. «Google» */
  label: string
  list(): Promise<ProviderEvent[]>
  get(id: string): Promise<ProviderEvent | null>
  create(event: NormalizedEvent): Promise<ProviderEvent>
  update(id: string, event: NormalizedEvent): Promise<ProviderEvent>
  remove(id: string): Promise<void>
}

/**
 * Verbindet einen Termin auf Seite A mit seinem Gegenstück auf Seite B.
 * Die Fingerabdrücke halten fest, wie jede Seite beim letzten Abgleich aussah.
 */
export interface EventLink {
  id?: string
  aId: string
  bId: string
  aHash: string
  bHash: string
}

export interface LinkStore {
  list(): Promise<EventLink[]>
  save(link: EventLink): Promise<void>
  remove(link: EventLink): Promise<void>
}

export interface SyncResult {
  created: number
  updated: number
  deleted: number
  /** Termine, die schon auf beiden Seiten standen und nur verknüpft wurden */
  linked: number
  problems: string[]
}

/** Mehr als so viele Löschungen auf einmal gelten als verdächtig. */
const MAX_DELETES = 15

function plain(event: ProviderEvent): NormalizedEvent {
  const copy: Partial<ProviderEvent> = { ...event }
  delete copy.id
  delete copy.updatedAt
  return copy as NormalizedEvent
}

/**
 * Der Termin der Quelle, wie er auf die Zielseite geschrieben wird. Hat die
 * Quelle die Notiz nur in umschriebener Form («Zuerich» statt «Zürich»),
 * bleibt die Notiz des Ziels stehen. So verliert Google keine Umlaute, nur
 * weil der Termin in Outlook angefasst wurde.
 */
function forTarget(source: ProviderEvent, target: ProviderEvent): NormalizedEvent {
  const event = plain(source)
  if (
    source.description !== target.description &&
    sameInAscii(source.description, target.description)
  ) {
    event.description = target.description
  }
  return event
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function newer(a: ProviderEvent, b: ProviderEvent): 'a' | 'b' {
  const timeA = Date.parse(a.updatedAt ?? '')
  const timeB = Date.parse(b.updatedAt ?? '')
  // Ohne Angabe oder bei Gleichstand gewinnt Seite A.
  return timeB > timeA ? 'b' : 'a'
}

/**
 * Gleicht zwei Kalender in beide Richtungen ab.
 *
 * Jede Seite wird mit ihrem Stand vom letzten Abgleich verglichen. Was sich
 * nur auf einer Seite geändert hat, wandert auf die andere. Haben sich beide
 * geändert, gewinnt die jüngere Änderung. Wurde ein Termin auf einer Seite
 * gelöscht und auf der anderen nicht angefasst, wird er auch dort gelöscht.
 * Wurde er dort inzwischen geändert, wird er stattdessen wiederhergestellt.
 *
 * Weil nach jedem Schreiben der gespeicherte Stand der Zielseite neu
 * festgehalten wird, löst ein Abgleich nie den nächsten aus.
 */
export async function syncPair(a: SyncSide, b: SyncSide, links: LinkStore): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, linked: 0, problems: [] }
  const [aList, bList, linkList] = await Promise.all([a.list(), b.list(), links.list()])
  const aById = new Map(aList.map((event) => [event.id, event]))
  const bById = new Map(bList.map((event) => [event.id, event]))
  const linkedA = new Set<string>()
  const linkedB = new Set<string>()
  const deletes: Array<{ side: SyncSide; id: string; title: string; link: EventLink }> = []

  const attempt = async (what: string, work: () => Promise<void>): Promise<void> => {
    try {
      await work()
    } catch (error) {
      result.problems.push(`${what}: ${reason(error)}`)
    }
  }

  for (const link of linkList) {
    linkedA.add(link.aId)
    linkedB.add(link.bId)
    await attempt('Termin abgleichen', async () => {
      // Fehlt ein Termin in der Liste, kann er auch nur aus dem Zeitraum
      // gerutscht sein. Darum wird einzeln nachgefragt, bevor er als gelöscht gilt.
      const eventA = aById.get(link.aId) ?? (await a.get(link.aId))
      const eventB = bById.get(link.bId) ?? (await b.get(link.bId))

      if (!eventA && !eventB) {
        await links.remove(link)
        return
      }

      if (eventA && eventB) {
        const hashA = contentHash(eventA)
        const hashB = contentHash(eventB)
        const changedA = hashA !== link.aHash
        const changedB = hashB !== link.bHash
        if (!changedA && !changedB) return
        if (changedA && changedB && hashA === hashB) {
          await links.save({ ...link, aHash: hashA, bHash: hashB })
          return
        }
        const source = changedA && changedB ? newer(eventA, eventB) : changedA ? 'a' : 'b'
        if (source === 'a') {
          const written = await b.update(link.bId, forTarget(eventA, eventB))
          await links.save({ ...link, aHash: hashA, bHash: contentHash(written) })
        } else {
          const written = await a.update(link.aId, forTarget(eventB, eventA))
          await links.save({ ...link, aHash: contentHash(written), bHash: hashB })
        }
        result.updated++
        return
      }

      // Genau eine Seite fehlt: dort wurde der Termin gelöscht.
      const [present, presentSide, goneSide] = eventA
        ? ([eventA, a, b] as const)
        : ([eventB!, b, a] as const)
      const lastHash = eventA ? link.aHash : link.bHash
      if (contentHash(present) === lastHash) {
        deletes.push({ side: presentSide, id: present.id, title: present.title, link })
        return
      }
      // Seit dem Löschen wurde der Termin auf der anderen Seite geändert:
      // Die Änderung ist jünger und gewinnt, der Termin kommt zurück.
      const written = await goneSide.create(plain(present))
      await links.save(
        eventA
          ? { ...link, bId: written.id, aHash: contentHash(present), bHash: contentHash(written) }
          : { ...link, aId: written.id, aHash: contentHash(written), bHash: contentHash(present) }
      )
      result.created++
    })
  }

  // Termine ohne Verknüpfung. Steht derselbe Termin schon auf beiden Seiten
  // (erster Abgleich), wird er nur verknüpft und nicht verdoppelt.
  const newA = aList.filter((event) => !linkedA.has(event.id))
  const newB = bList.filter((event) => !linkedB.has(event.id))
  const twins = new Map<string, ProviderEvent[]>()
  for (const event of newB) {
    const key = identityHash(event)
    twins.set(key, [...(twins.get(key) ?? []), event])
  }
  const matchedB = new Set<string>()

  for (const event of newA) {
    await attempt(`«${event.title}» nach ${b.label} übertragen`, async () => {
      const twin = twins.get(identityHash(event))?.shift()
      if (twin) {
        matchedB.add(twin.id)
        await links.save({
          aId: event.id,
          bId: twin.id,
          aHash: contentHash(event),
          bHash: contentHash(twin)
        })
        result.linked++
        return
      }
      const written = await b.create(plain(event))
      await links.save({
        aId: event.id,
        bId: written.id,
        aHash: contentHash(event),
        bHash: contentHash(written)
      })
      result.created++
    })
  }

  for (const event of newB) {
    if (matchedB.has(event.id)) continue
    await attempt(`«${event.title}» nach ${a.label} übertragen`, async () => {
      const written = await a.create(plain(event))
      await links.save({
        aId: written.id,
        bId: event.id,
        aHash: contentHash(written),
        bHash: contentHash(event)
      })
      result.created++
    })
  }

  // Löschungen zuletzt und nur in vernünftiger Menge. Liefert ein Anbieter
  // wegen einer Störung eine leere Liste, soll das keinen Kalender leeren.
  if (deletes.length > MAX_DELETES && deletes.length > linkList.length / 2) {
    result.problems.push(
      `Sicherheitsstopp: ${deletes.length} Termine wären gelöscht worden. Es wurde nichts gelöscht.`
    )
    return result
  }
  for (const entry of deletes) {
    await attempt(`«${entry.title}» in ${entry.side.label} löschen`, async () => {
      await entry.side.remove(entry.id)
      await links.remove(entry.link)
      result.deleted++
    })
  }

  return result
}
