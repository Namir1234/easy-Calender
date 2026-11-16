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

describe('MemoryStore: Konten verbinden und entfernen', () => {
  const google = (
    calendars: Array<[string, string]>
  ): Parameters<MemoryStore['saveAccount']>[0] => ({
    provider: 'google',
    email: 'ich@example.com',
    calendars: calendars.map(([remoteId, name]) => ({ remoteId, name, color: '#123456' }))
  })

  it('legt ein Konto mit Kalendern an', async () => {
    const store = new MemoryStore()
    const account = await store.saveAccount(google([['a', 'Privat']]))
    expect(account).toMatchObject({ provider: 'google', email: 'ich@example.com' })
    expect(await store.listCalendars()).toHaveLength(1)
  })

  it('gleicht Kalender ab und behält die Einstellungen bestehender', async () => {
    const store = new MemoryStore()
    await store.saveAccount(
      google([
        ['a', 'Privat'],
        ['b', 'Alt']
      ])
    )
    const [first] = await store.listCalendars()
    await store.setCalendarVisible(first.id, false)

    await store.saveAccount(
      google([
        ['a', 'Privat umbenannt'],
        ['c', 'Neu']
      ])
    )

    const calendars = await store.listCalendars()
    expect(await store.listAccounts()).toHaveLength(1)
    expect(calendars.map((calendar) => calendar.remoteId).sort()).toEqual(['a', 'c'])
    const kept = calendars.find((calendar) => calendar.remoteId === 'a')
    expect(kept).toMatchObject({ id: first.id, name: 'Privat umbenannt', visible: false })
  })

  it('entfernt ein Konto samt Kalendern und lässt andere stehen', async () => {
    const store = await seededStore()
    const account = await store.saveAccount(google([['a', 'Privat']]))
    const demoCalendars = (await store.listCalendars()).length - 1

    const removed = await store.removeAccount(account.id)

    expect(removed.email).toBe('ich@example.com')
    expect(await store.listCalendars()).toHaveLength(demoCalendars)
    await expect(store.removeAccount(account.id)).rejects.toThrow()
  })

  it('entfernt nur die Demo-Konten', async () => {
    const store = await seededStore()
    await store.saveAccount(google([['a', 'Privat']]))

    await store.removeDemoAccounts()

    expect((await store.listAccounts()).map((account) => account.provider)).toEqual(['google'])
    expect(await store.listCalendars()).toHaveLength(1)
  })
})
