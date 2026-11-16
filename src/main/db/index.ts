import { join } from 'path'
import type { DbStatus } from '../../shared/types'
import { readSupabaseConfig, type SupabaseEnv } from '../config'
import { DEMO_SEED } from './demoData'
import { MemoryStore } from './memoryStore'
import type { Store } from './store'
import { createEncryptedStorage } from '../secureStorage'
import { createSupabaseClient, ensureSession } from './supabaseClient'
import { SupabaseStore } from './supabaseStore'

export interface StoreContext {
  store: Store
  status: DbStatus
}

const CONNECT_TIMEOUT_MS = 10_000

async function memoryFallback(status: DbStatus): Promise<StoreContext> {
  const store = new MemoryStore()
  await store.seedIfEmpty(DEMO_SEED)
  return { store, status }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Keine Antwort von Supabase nach ${ms / 1000} Sekunden`)),
      ms
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * Wählt die Datenquelle. Mit gültigen Zugangsdaten in `.env` wird Supabase
 * verwendet. Fehlen sie oder ist Supabase nicht erreichbar, läuft die App
 * mit Demo-Daten im Arbeitsspeicher weiter und zeigt den Grund an.
 */
export async function initStore(env: SupabaseEnv, userDataPath: string): Promise<StoreContext> {
  const result = readSupabaseConfig(env)

  if (result.kind === 'missing') {
    return memoryFallback({
      mode: 'memory',
      ok: true,
      message: 'Supabase ist noch nicht eingerichtet.'
    })
  }
  if (result.kind === 'invalid') {
    return memoryFallback({
      mode: 'memory',
      ok: false,
      message: `${result.reason}. Die App zeigt Demo-Daten.`
    })
  }

  try {
    const storage = createEncryptedStorage(join(userDataPath, 'supabase-session.bin'))
    const client = createSupabaseClient(result.config, storage)
    const store = new SupabaseStore(client)
    await withTimeout(
      (async () => {
        await ensureSession(client)
        await store.seedIfEmpty(DEMO_SEED)
      })(),
      CONNECT_TIMEOUT_MS
    )
    return { store, status: { mode: 'supabase', ok: true, message: '' } }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return memoryFallback({
      mode: 'memory',
      ok: false,
      message: `${reason}. Die App zeigt Demo-Daten.`
    })
  }
}
