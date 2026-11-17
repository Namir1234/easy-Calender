/**
 * Anmeldung bei Google im Browser (Google Identity Services, Token-Modell).
 * Die App bekommt ein Zugriffs-Token für eine Stunde. Ein Client-Secret
 * oder ein eigener Server ist dafür nicht nötig.
 */

/** Was die App darf: Kalenderliste lesen, Termine lesen und schreiben. */
export const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events'
].join(' ')

export interface Session {
  token: string
  /** Millisekunden seit 1970 */
  expiresAt: number
  email: string
}

const SESSION_KEY = 'easy-calender.session'
const HINT_KEY = 'easy-calender.email'
/** So viel früher gilt ein Token als abgelaufen, damit keine Anfrage ins Leere geht. */
const MARGIN_MS = 60_000

interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  scope?: string
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void
}

interface GoogleOauth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type?: string; message?: string }) => void
  }): TokenClient
  hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean
  revoke(token: string, done?: () => void): void
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOauth2 } }
  }
}

/** Ein Speicher wie localStorage, damit Tests einen eigenen geben können. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Liest die gespeicherte Anmeldung. Abgelaufene gelten als keine. */
export function loadSession(store: KeyValueStore, now = Date.now()): Session | null {
  try {
    const raw = JSON.parse(store.getItem(SESSION_KEY) ?? 'null') as Partial<Session> | null
    if (
      !raw ||
      typeof raw.token !== 'string' ||
      typeof raw.email !== 'string' ||
      typeof raw.expiresAt !== 'number'
    ) {
      return null
    }
    return raw.expiresAt - MARGIN_MS > now ? (raw as Session) : null
  } catch {
    return null
  }
}

export function saveSession(store: KeyValueStore, session: Session): void {
  store.setItem(SESSION_KEY, JSON.stringify(session))
  store.setItem(HINT_KEY, session.email)
}

/** Die zuletzt angemeldete Adresse, damit Google das Konto vorschlägt. */
export function lastEmail(store: KeyValueStore): string | undefined {
  return store.getItem(HINT_KEY) ?? undefined
}

export function clearSession(store: KeyValueStore, forget = false): void {
  store.removeItem(SESSION_KEY)
  if (forget) store.removeItem(HINT_KEY)
}

let loading: Promise<void> | null = null

/** Lädt die Google-Bibliothek einmal. Erst danach geht die Anmeldung. */
export function loadGoogleLibrary(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error('Die Google-Anmeldung lässt sich nicht laden. Bist du online?'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/**
 * Öffnet die Google-Anmeldung. Muss direkt aus einem Tipp auf einen Knopf
 * kommen, sonst blockiert der Browser das Fenster (vor allem auf dem iPhone).
 */
export function signIn(clientId: string, hint?: string): Promise<Session> {
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) return Promise.reject(new Error('Die Google-Anmeldung ist noch nicht geladen.'))

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || 'Die Anmeldung hat nicht geklappt.'))
          return
        }
        if (
          !oauth2.hasGrantedAllScopes(
            response,
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
          )
        ) {
          reject(
            new Error(
              'Ohne Zugriff auf deine Kalender geht es nicht. Melde dich nochmals an und setze alle Häkchen.'
            )
          )
          return
        }
        const token = response.access_token
        const expiresAt = Date.now() + Number(response.expires_in ?? 3600) * 1000
        fetchEmail(token)
          .then((email) => resolve({ token, expiresAt, email }))
          .catch(reject)
      },
      error_callback: (error) =>
        reject(
          new Error(
            error.type === 'popup_closed'
              ? 'Die Anmeldung wurde geschlossen.'
              : error.type === 'popup_failed_to_open'
                ? 'Das Anmeldefenster liess sich nicht öffnen. Erlaube Pop-ups für diese Seite.'
                : (error.message ?? 'Die Anmeldung hat nicht geklappt.')
          )
        )
    })
    // Mit bekannter Adresse fragt Google meist nicht nochmals nach.
    client.requestAccessToken(hint ? { prompt: '', login_hint: hint } : { prompt: 'consent' })
  })
}

async function fetchEmail(token: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Google hat die Adresse des Kontos nicht geliefert.')
  const data = (await response.json()) as { email?: string }
  if (!data.email) throw new Error('Google hat die Adresse des Kontos nicht geliefert.')
  return data.email
}

/** Gibt das Token bei Google zurück. Die App hat danach keinen Zugriff mehr. */
export function revoke(token: string): void {
  window.google?.accounts?.oauth2?.revoke(token)
}
