import { randomBytes } from 'crypto'
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library'
import type { GoogleConfig } from '../config'
import type { SecureStorage } from '../secureStorage'
import { startLoopback } from './loopback'

/**
 * Was die App bei Google darf: die Kalenderliste lesen und Termine lesen
 * und schreiben. Schreiben wird ab Etappe 4 gebraucht und schon jetzt
 * angefragt, damit später keine zweite Zustimmung nötig ist.
 */
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events'
]

const LOGIN_TIMEOUT_MS = 5 * 60_000

const tokenKey = (email: string): string => `google:${email.toLowerCase()}`

/**
 * Meldet ein Google-Konto an (OAuth 2.0 für Desktop-Apps): Der
 * Standardbrowser öffnet die Google-Anmeldung und kommt danach auf einen
 * lokalen Server zurück. PKCE bindet den Code an diese eine Anmeldung.
 * Das Refresh-Token wird verschlüsselt gespeichert.
 *
 * @returns die E-Mail-Adresse des angemeldeten Kontos
 */
export async function loginWithGoogle(
  config: GoogleConfig,
  tokens: SecureStorage,
  openBrowser: (url: string) => Promise<void>,
  signal?: AbortSignal
): Promise<string> {
  const state = randomBytes(24).toString('base64url')
  const loopback = await startLoopback(state, LOGIN_TIMEOUT_MS)
  signal?.addEventListener('abort', loopback.cancel, { once: true })

  try {
    const client = new OAuth2Client({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: loopback.redirectUri
    })
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync()

    await openBrowser(
      client.generateAuthUrl({
        access_type: 'offline',
        // «consent» erzwingt, dass Google ein Refresh-Token mitliefert.
        prompt: 'consent',
        scope: SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256
      })
    )

    const code = await loopback.code
    const { tokens: received } = await client.getToken({
      code,
      codeVerifier,
      redirect_uri: loopback.redirectUri
    })

    if (!received.id_token) throw new Error('Google hat keine Konto-Information geliefert')
    const ticket = await client.verifyIdToken({
      idToken: received.id_token,
      audience: config.clientId
    })
    const email = ticket.getPayload()?.email
    if (!email) throw new Error('Google hat keine E-Mail-Adresse geliefert')

    if (!received.refresh_token) {
      throw new Error('Google hat kein Refresh-Token geliefert. Bitte nochmals anmelden.')
    }
    tokens.setItem(tokenKey(email), received.refresh_token)
    return email
  } finally {
    signal?.removeEventListener('abort', loopback.cancel)
    loopback.close()
  }
}

/**
 * Liefert einen angemeldeten Client für ein bereits verbundenes Konto.
 * Access-Tokens holt die Bibliothek bei Bedarf selbst über das Refresh-Token.
 */
export function clientForAccount(
  config: GoogleConfig,
  tokens: SecureStorage,
  email: string
): OAuth2Client {
  const refreshToken = tokens.getItem(tokenKey(email))
  if (!refreshToken) {
    throw new Error(`Für ${email} ist keine Anmeldung gespeichert. Bitte das Konto neu verbinden.`)
  }
  const client = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret
  })
  client.setCredentials({ refresh_token: refreshToken })
  // Google kann das Refresh-Token erneuern. Dann wird das neue gespeichert.
  client.on('tokens', (fresh) => {
    if (fresh.refresh_token) tokens.setItem(tokenKey(email), fresh.refresh_token)
  })
  return client
}

/** Meldet ein Konto bei Google ab und löscht das gespeicherte Token. */
export async function forgetGoogleAccount(
  config: GoogleConfig | null,
  tokens: SecureStorage,
  email: string
): Promise<void> {
  const refreshToken = tokens.getItem(tokenKey(email))
  tokens.removeItem(tokenKey(email))
  if (!refreshToken || !config) return
  try {
    await new OAuth2Client({ clientId: config.clientId }).revokeToken(refreshToken)
  } catch {
    // Widerruf ist ein Zusatz. Lokal ist das Token bereits gelöscht.
  }
}
