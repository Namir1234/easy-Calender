import type { SeedAccount } from './store'

/**
 * Demo-Konten für Etappe 1. Sie werden entfernt, sobald echte Konten
 * verbunden werden können (Etappe 2 und 3).
 */
export const DEMO_SEED: SeedAccount[] = [
  {
    provider: 'demo',
    email: 'privat@example.com',
    calendars: [
      { remoteId: 'demo-privat', name: 'Privat', color: '#2563a8' },
      { remoteId: 'demo-sport', name: 'Sport', color: '#2e7d5b' }
    ]
  },
  {
    provider: 'demo',
    email: 'schule@example.com',
    calendars: [{ remoteId: 'demo-schule', name: 'Schule', color: '#a8580c' }]
  },
  {
    provider: 'demo',
    email: 'firma@example.com',
    calendars: [{ remoteId: 'demo-firma', name: 'Firma', color: '#8e3a80' }]
  }
]
