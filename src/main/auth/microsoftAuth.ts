import { createHash, randomBytes } from 'crypto'
import type { MicrosoftConfig } from '../config'
import type { SecureStorage } from '../secureStorage'
import { startLoopback } from './loopback'

/**
 * Was die App bei Microsoft darf: Kalender und Termine lesen und schreiben.
 * `offline_access` liefert das Refresh-Token, damit die Anmeldung hält.
 */
const SCOPES = ['openid', 'email', 'offline_access', 'User.Read', 'Calendars.ReadWrite']

// «common» lässt private Konten sowie Schul- und Firmenkonten zu.
const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const LOGIN_TIMEOUT_MS = 5 * 60_000

const tokenKey = (email: string): string => `microsoft:${email.toLowerCase()}`

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  id_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`${AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params)
  })
  const data = (await response.json().catch(() => ({}))) as TokenResponse
  if (!response.ok || data.error) {
    const detail = data.error_description?.split('\n')[0] ?? data.error ?? response.statusText
    throw new Error(`Microsoft hat die Anmeldung abgelehnt: ${detail}`)
  }
  return data
}

/** Liest die E-Mail-Adresse aus dem ID-Token, das direkt von Microsoft kam. */
function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split('.')[1], 'base64url').toString('utf8'))
    const email = payload.email ?? payload.preferred_username
    return typeof email === 'string' && email.includes('@') ? email : null
  } catch {
    return null
  }
}

/**
 * Meldet ein Microsoft-Konto an: gleicher Ablauf wie bei Google (Browser,
 * Rückweg auf diesen Rechner, PKCE), aber ohne Client-Secret, weil die App
 * bei Microsoft als öffentlicher Client eingetragen ist.
 *
 * @returns die E-Mail-Adresse des angemeldeten Kontos
 */
export async function loginWithMicrosoft(
  config: MicrosoftConfig,
  tokens: SecureStorage,
  openBrowser: (url: string) => Promise<void>,
  signal?: AbortSignal
): Promise<string> {
  const state = randomBytes(24).toString('base64url')
  const loopback = await startLoopback(state, LOGIN_TIMEOUT_MS)
  signal?.addEventListener('abort', loopback.cancel, { once: true })

  try {
    // Microsoft verlangt für Desktop-Apps `localhost`, der Port ist frei wählbar.
    const redirectUri = loopback.redirectUri.replace('127.0.0.1', 'localhost')
    const codeVerifier = randomBytes(48).toString('base64url')
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    const scope = SCOPES.join(' ')

    await openBrowser(
      `${AUTHORITY}/authorize?${new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        response_mode: 'query',
        redirect_uri: redirectUri,
        scope,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account'
      })}`
    )

    const code = await loopback.code
    const received = await requestToken({
      client_id: config.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      scope
    })

    const email = emailFromIdToken(received.id_token)
    if (!email) throw new Error('Microsoft hat keine E-Mail-Adresse geliefert')
    if (!received.refresh_token) {
      throw new Error('Microsoft hat kein Refresh-Token geliefert. Bitte nochmals anmelden.')
    }
    tokens.setItem(tokenKey(email), received.refresh_token)
    return email
  } finally {
    signal?.removeEventListener('abort', loopback.cancel)
    loopback.close()
  }
}

/**
 * Hält das Access-Token eines verbundenen Kontos bereit und erneuert es
 * über das Refresh-Token, kurz bevor es abläuft.
 */
export class MicrosoftSession {
  private accessToken: string | null = null
  private expiresAt = 0
  private refreshing: Promise<string> | null = null

  constructor(
    private readonly config: MicrosoftConfig,
    private readonly tokens: SecureStorage,
    private readonly email: string
  ) {}

  async token(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 60_000) return this.accessToken
    // Mehrere Abfragen gleichzeitig teilen sich eine Erneuerung.
    this.refreshing ??= this.refresh().finally(() => (this.refreshing = null))
    return this.refreshing
  }

  private async refresh(): Promise<string> {
    const refreshToken = this.tokens.getItem(tokenKey(this.email))
    if (!refreshToken) {
      throw new Error(
        `Für ${this.email} ist keine Anmeldung gespeichert. Bitte das Konto neu verbinden.`
      )
    }
    const received = await requestToken({
      client_id: this.config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: SCOPES.join(' ')
    })
    if (!received.access_token) throw new Error('Microsoft hat kein Access-Token geliefert')
    // Microsoft tauscht das Refresh-Token bei jeder Erneuerung aus.
    if (received.refresh_token) this.tokens.setItem(tokenKey(this.email), received.refresh_token)
    this.accessToken = received.access_token
    this.expiresAt = Date.now() + (received.expires_in ?? 3600) * 1000
    return this.accessToken
  }
}

/** Löscht das gespeicherte Token. Einen Widerruf per API bietet Microsoft nicht an. */
export function forgetMicrosoftAccount(tokens: SecureStorage, email: string): void {
  tokens.removeItem(tokenKey(email))
}
