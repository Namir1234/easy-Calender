import { describe, expect, it } from 'vitest'
import { DEFAULT_DESIGN, DESIGNS, isDesignId, loadDesign } from './design'

const storageWith = (value: string | null): Pick<Storage, 'getItem'> => ({ getItem: () => value })

describe('Design-Auswahl', () => {
  it('kennt die vier Designs', () => {
    expect(DESIGNS.map((design) => design.id)).toEqual(['dose', 'classic', 'coral', 'terrazzo'])
  })

  it('liest ein gespeichertes Design', () => {
    expect(loadDesign(storageWith('terrazzo'))).toBe('terrazzo')
  })

  it('nimmt das Standard-Design, wenn nichts oder Unbekanntes gespeichert ist', () => {
    expect(loadDesign(storageWith(null))).toBe(DEFAULT_DESIGN)
    expect(loadDesign(storageWith('ultraviolet'))).toBe(DEFAULT_DESIGN)
    expect(loadDesign(undefined)).toBe(DEFAULT_DESIGN)
  })

  it('nimmt das Standard-Design, wenn der Speicher nicht lesbar ist', () => {
    const broken = {
      getItem: () => {
        throw new Error('gesperrt')
      }
    }
    expect(loadDesign(broken)).toBe(DEFAULT_DESIGN)
  })

  it('prüft Design-Namen', () => {
    expect(isDesignId('coral')).toBe(true)
    expect(isDesignId('Coral')).toBe(false)
    expect(isDesignId(42)).toBe(false)
  })
})
