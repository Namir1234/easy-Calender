import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SupabaseConfig } from '../config'
import type { SecureStorage } from '../secureStorage'

export function createSupabaseClient(
  config: SupabaseConfig,
  storage: SecureStorage
): SupabaseClient {
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
