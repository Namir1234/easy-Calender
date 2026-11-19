import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DESIGN,
  DESIGNS,
  isDesignId,
  isModeId,
  loadDesign,
  loadMode,
  resolveScheme
} from './design'

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

  it('folgt dem System, solange nichts anderes gewählt ist', () => {
    expect(loadMode(storageWith(null))).toBe('system')
    expect(loadMode(storageWith('hell'))).toBe('system')
    expect(resolveScheme('system', true)).toBe('dark')
    expect(resolveScheme('system', false)).toBe('light')
  })

  it('nimmt hell oder dunkel, wenn es gewählt ist, egal wie das System steht', () => {
    expect(loadMode(storageWith('light'))).toBe('light')
    expect(resolveScheme('light', true)).toBe('light')
    expect(resolveScheme('dark', false)).toBe('dark')
    expect(isModeId('dark')).toBe(true)
    expect(isModeId('night')).toBe(false)
  })

  it('prüft Design-Namen', () => {
    expect(isDesignId('coral')).toBe(true)
    expect(isDesignId('Coral')).toBe(false)
    expect(isDesignId(42)).toBe(false)
  })
})
