import { safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SupabaseConfig } from '../config'

interface AuthStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * Speichert die Supabase-Sitzung verschlüsselt in einer Datei. Die
 * Verschlüsselung übernimmt Electron `safeStorage` (unter Windows DPAPI).
 * Ist keine Verschlüsselung verfügbar, bleibt die Sitzung nur im
 * Arbeitsspeicher, damit nie ein Token im Klartext auf der Festplatte landet.
 */
export function createEncryptedStorage(filePath: string): AuthStorage {
  const canPersist = safeStorage.isEncryptionAvailable()
  let cache: Record<string, string> | null = null

  function load(): Record<string, string> {
    if (cache) return cache
    cache = {}
    if (canPersist && existsSync(filePath)) {
      try {
        cache = JSON.parse(safeStorage.decryptString(readFileSync(filePath)))
      } catch {
        // Datei beschädigt oder von einem anderen Windows-Benutzer: neu anfangen.
        cache = {}
      }
    }
    return cache as Record<string, string>
  }

  function save(): void {
    if (!canPersist || !cache) return
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, safeStorage.encryptString(JSON.stringify(cache)))
  }

  return {
    getItem: (key) => load()[key] ?? null,
    setItem: (key, value) => {
      load()[key] = value
      save()
    },
    removeItem: (key) => {
      delete load()[key]
      save()
    }
  }
}

export function createSupabaseClient(config: SupabaseConfig, storage: AuthStorage): SupabaseClient {
  return createClient(config.url, config.key, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  })
}

/**
 * Stellt sicher, dass ein Supabase-Benutzer angemeldet ist. Beim ersten
 * Start wird ein anonymer Benutzer angelegt. Ihm gehören alle Zeilen,
 * die diese Installation schreibt.
 */
export async function ensureSession(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error(`Sitzung konnte nicht gelesen werden: ${error.message}`)
  if (data.session) return

  const result = await client.auth.signInAnonymously()
  if (result.error) {
    throw new Error(
      `Anonyme Anmeldung fehlgeschlagen (${result.error.message}). ` +
        'Prüfe, ob «Anonymous sign-ins» im Supabase-Projekt aktiviert ist'
    )
  }
}
