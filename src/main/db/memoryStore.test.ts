import { describe, expect, it } from 'vitest'
import { DEMO_SEED } from './demoData'
import { MemoryStore } from './memoryStore'

async function seededStore(): Promise<MemoryStore> {
  const store = new MemoryStore()
  await store.seedIfEmpty(DEMO_SEED)
  return store
}

describe('MemoryStore', () => {
  it('ist am Anfang leer', async () => {
    const store = new MemoryStore()
    expect(await store.listAccounts()).toEqual([])
    expect(await store.listCalendars()).toEqual([])
  })

  it('legt die Demo-Konten mit ihren Kalendern an', async () => {
    const store = await seededStore()
    const accounts = await store.listAccounts()
    const calendars = await store.listCalendars()

    expect(accounts).toHaveLength(DEMO_SEED.length)
    expect(calendars).toHaveLength(DEMO_SEED.flatMap((entry) => entry.calendars).length)
    expect(new Set(calendars.map((calendar) => calendar.id)).size).toBe(calendars.length)
    for (const calendar of calendars) {
      expect(accounts.some((account) => account.id === calendar.accountId)).toBe(true)
      expect(calendar.visible).toBe(true)
      expect(calendar.syncEnabled).toBe(false)
    }
  })

  it('legt die Demo-Daten nicht doppelt an', async () => {
    const store = await seededStore()
    await store.seedIfEmpty(DEMO_SEED)
    expect(await store.listAccounts()).toHaveLength(DEMO_SEED.length)
  })

  it('merkt sich, ob ein Kalender sichtbar ist', async () => {
    const store = await seededStore()
    const [first, second] = await store.listCalendars()

    await store.setCalendarVisible(first.id, false)

    const after = await store.listCalendars()
    expect(after.find((calendar) => calendar.id === first.id)?.visible).toBe(false)
    expect(after.find((calendar) => calendar.id === second.id)?.visible).toBe(true)
  })

  it('meldet einen unbekannten Kalender als Fehler', async () => {
    const store = await seededStore()
    await expect(store.setCalendarVisible('gibt-es-nicht', false)).rejects.toThrow()
  })

  it('gibt Kopien heraus, die den Speicher nicht verändern', async () => {
    const store = await seededStore()
    const [calendar] = await store.listCalendars()
    calendar.visible = false
    expect((await store.listCalendars())[0].visible).toBe(true)
  })
})
