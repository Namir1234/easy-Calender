import { describe, expect, it } from 'vitest'
import { startLoopback } from './loopback'

describe('startLoopback', () => {
  it('liefert den Code, wenn der Browser mit dem richtigen state zurückkommt', async () => {
    const session = await startLoopback('geheim', 5_000)
    expect(session.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)

    const response = await fetch(`${session.redirectUri}/?state=geheim&code=abc123`)
    expect(response.status).toBe(200)
    await expect(session.code).resolves.toBe('abc123')
  })

  it('ignoriert Anfragen mit falschem state und wartet weiter', async () => {
    const session = await startLoopback('geheim', 5_000)

    const forged = await fetch(`${session.redirectUri}/?state=falsch&code=boese`)
    expect(forged.status).toBe(400)

    await fetch(`${session.redirectUri}/?state=geheim&code=echt`)
    await expect(session.code).resolves.toBe('echt')
  })

  it('meldet einen Abbruch durch den Benutzer', async () => {
    const session = await startLoopback('geheim', 5_000)
    const outcome = expect(session.code).rejects.toThrow('abgebrochen')
    await fetch(`${session.redirectUri}/?state=geheim&error=access_denied`)
    await outcome
  })

  it('lässt sich von der App aus abbrechen', async () => {
    const session = await startLoopback('geheim', 5_000)
    const outcome = expect(session.code).rejects.toThrow('abgebrochen')
    session.cancel()
    await outcome
    await expect(fetch(session.redirectUri)).rejects.toThrow()
  })

  it('gibt nach Ablauf der Frist auf', async () => {
    const session = await startLoopback('geheim', 50)
    await expect(session.code).rejects.toThrow('nicht rechtzeitig')
  })

  it('ist nach dem Abschluss nicht mehr erreichbar', async () => {
    const session = await startLoopback('geheim', 5_000)
    await fetch(`${session.redirectUri}/?state=geheim&code=abc`)
    await session.code
    await expect(fetch(session.redirectUri)).rejects.toThrow()
  })
})
