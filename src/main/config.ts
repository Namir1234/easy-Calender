export interface SupabaseConfig {
  url: string
  key: string
}

/** Die Umgebungsvariablen, die für Supabase gelesen werden. */
export interface SupabaseEnv {
  MAIN_VITE_SUPABASE_URL?: unknown
  MAIN_VITE_SUPABASE_KEY?: unknown
}

export type SupabaseConfigResult =
  | { kind: 'configured'; config: SupabaseConfig }
  | { kind: 'missing' }
  | { kind: 'invalid'; reason: string }

/**
 * Liest die Supabase-Zugangsdaten aus den Umgebungsvariablen.
 * Erlaubt ist nur der öffentliche Schlüssel (Publishable bzw. anon Key).
 * Ein geheimer Schlüssel würde die Zugriffsregeln der Datenbank umgehen
 * und hat in einer Desktop-App nichts verloren.
 */
export function readSupabaseConfig(env: SupabaseEnv): SupabaseConfigResult {
  const url = asTrimmedString(env.MAIN_VITE_SUPABASE_URL)
  const key = asTrimmedString(env.MAIN_VITE_SUPABASE_KEY)

  if (!url && !key) return { kind: 'missing' }
  if (!url) return { kind: 'invalid', reason: 'MAIN_VITE_SUPABASE_URL fehlt in .env' }
  if (!key) return { kind: 'invalid', reason: 'MAIN_VITE_SUPABASE_KEY fehlt in .env' }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { kind: 'invalid', reason: 'MAIN_VITE_SUPABASE_URL ist keine gültige URL' }
  }
  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  if (parsed.protocol !== 'https:' && !isLocal) {
    return { kind: 'invalid', reason: 'MAIN_VITE_SUPABASE_URL muss mit https:// beginnen' }
  }

  if (isSecretKey(key)) {
    return {
      kind: 'invalid',
      reason:
        'MAIN_VITE_SUPABASE_KEY ist ein geheimer Schlüssel. Verwende den Publishable Key (früher «anon key»).'
    }
  }

  return { kind: 'configured', config: { url: parsed.origin, key } }
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  // Ältere Schlüssel sind JWTs, die Rolle steht im Payload.
  const parts = key.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

export interface GoogleConfig {
  clientId: string
  clientSecret: string
}

/** Die Umgebungsvariablen, die für Google gelesen werden. */
export interface GoogleEnv {
  MAIN_VITE_GOOGLE_CLIENT_ID?: unknown
  MAIN_VITE_GOOGLE_CLIENT_SECRET?: unknown
}

export type GoogleConfigResult =
  | { kind: 'configured'; config: GoogleConfig }
  | { kind: 'missing' }
  | { kind: 'invalid'; reason: string }

/**
 * Liest die Zugangsdaten des Google-OAuth-Clients vom Typ «Desktop app».
 * Das Client-Secret eines Desktop-Clients gilt bei Google nicht als geheim,
 * es wird aber trotzdem für den Tausch des Codes verlangt.
 */
export function readGoogleConfig(env: GoogleEnv): GoogleConfigResult {
  const clientId = asTrimmedString(env.MAIN_VITE_GOOGLE_CLIENT_ID)
  const clientSecret = asTrimmedString(env.MAIN_VITE_GOOGLE_CLIENT_SECRET)

  if (!clientId && !clientSecret) return { kind: 'missing' }
  if (!clientId) return { kind: 'invalid', reason: 'MAIN_VITE_GOOGLE_CLIENT_ID fehlt in .env' }
  if (!clientSecret) {
    return { kind: 'invalid', reason: 'MAIN_VITE_GOOGLE_CLIENT_SECRET fehlt in .env' }
  }
  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    return {
      kind: 'invalid',
      reason: 'MAIN_VITE_GOOGLE_CLIENT_ID muss auf .apps.googleusercontent.com enden'
    }
  }
  return { kind: 'configured', config: { clientId, clientSecret } }
}

export interface MicrosoftConfig {
  clientId: string
}

/** Die Umgebungsvariable, die für Microsoft gelesen wird. */
export interface MicrosoftEnv {
  MAIN_VITE_MS_CLIENT_ID?: unknown
}

export type MicrosoftConfigResult =
  | { kind: 'configured'; config: MicrosoftConfig }
  | { kind: 'missing' }
  | { kind: 'invalid'; reason: string }

/**
 * Liest die Anwendungs-ID der App-Registrierung bei Microsoft (Azure).
 * Ein Secret gibt es nicht: Die App ist dort ein öffentlicher Client.
 */
export function readMicrosoftConfig(env: MicrosoftEnv): MicrosoftConfigResult {
  const clientId = asTrimmedString(env.MAIN_VITE_MS_CLIENT_ID)
  if (!clientId) return { kind: 'missing' }
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(clientId)) {
    return {
      kind: 'invalid',
      reason:
        'MAIN_VITE_MS_CLIENT_ID muss eine Anwendungs-ID sein (Form 00000000-0000-0000-0000-000000000000)'
    }
  }
  return { kind: 'configured', config: { clientId } }
}
