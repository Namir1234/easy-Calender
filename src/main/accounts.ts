import type { Account } from '../shared/types'
import { clientForAccount, forgetGoogleAccount, loginWithGoogle } from './auth/googleAuth'
import type { GoogleConfigResult } from './config'
import { DEMO_SEED } from './db/demoData'
import type { Store } from './db/store'
import { DemoProvider } from './providers/demo'
import { GoogleProvider } from './providers/google'
import type { CalendarProvider } from './providers/types'
import type { SecureStorage } from './secureStorage'

export interface AccountServiceOptions {
  store: Store
  tokens: SecureStorage
  google: GoogleConfigResult
  openBrowser(url: string): Promise<void>
}

/**
 * Verbindet und entfernt Konten und liefert zu jedem Konto den passenden
 * Anbieter. Hier laufen Anmeldung, Token-Speicher und Datenschicht zusammen.
 */
export class AccountService {
  private readonly demo = new DemoProvider()
  private readonly googleProviders = new Map<string, GoogleProvider>()
  private loginRunning = false

  constructor(private readonly options: AccountServiceOptions) {}

  /** Meldet ein Google-Konto an und speichert es mit seinen Kalendern. */
  async connectGoogle(): Promise<Account> {
    const config = this.requireGoogleConfig()
    if (this.loginRunning) {
      throw new Error('Es läuft bereits eine Anmeldung. Schliesse sie zuerst im Browser ab.')
    }

    this.loginRunning = true
    try {
      const { store, tokens, openBrowser } = this.options
      const email = await loginWithGoogle(config, tokens, openBrowser)
      this.googleProviders.delete(email)
      const calendars = await this.googleProvider(email).listCalendars()
      const account = await store.saveAccount({ provider: 'google', email, calendars })
      // Mit dem ersten echten Konto haben die Demo-Daten ausgedient.
      await store.removeDemoAccounts()
      return account
    } finally {
      this.loginRunning = false
    }
  }

  /** Entfernt ein Konto. Bleibt keines übrig, kommen die Demo-Daten zurück. */
  async remove(accountId: string): Promise<void> {
    const { store, tokens, google } = this.options
    const account = await store.removeAccount(accountId)
    if (account.provider === 'google') {
      this.googleProviders.delete(account.email)
      await forgetGoogleAccount(
        google.kind === 'configured' ? google.config : null,
        tokens,
        account.email
      )
    }
    await store.seedIfEmpty(DEMO_SEED)
  }

  /**
   * Gleicht beim Start die Kalenderlisten aller Google-Konten ab. Fehler
   * (kein Netz, Anmeldung abgelaufen) werden gesammelt zurückgegeben, die
   * gespeicherten Kalender bleiben dann unverändert.
   */
  async refreshCalendars(): Promise<string[]> {
    const problems: string[] = []
    for (const account of await this.options.store.listAccounts()) {
      if (account.provider !== 'google') continue
      try {
        const calendars = await this.googleProvider(account.email).listCalendars()
        await this.options.store.saveAccount({
          provider: 'google',
          email: account.email,
          calendars
        })
      } catch (error) {
        problems.push(`${account.email}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return problems
  }

  providerFor(account: Account): CalendarProvider {
    switch (account.provider) {
      case 'demo':
        return this.demo
      case 'google':
        return this.googleProvider(account.email)
      case 'microsoft':
        throw new Error('Microsoft-Konten werden erst ab Etappe 3 unterstützt')
    }
  }

  private googleProvider(email: string): GoogleProvider {
    let provider = this.googleProviders.get(email)
    if (!provider) {
      const config = this.requireGoogleConfig()
      provider = new GoogleProvider(clientForAccount(config, this.options.tokens, email))
      this.googleProviders.set(email, provider)
    }
    return provider
  }

  private requireGoogleConfig(): Extract<GoogleConfigResult, { kind: 'configured' }>['config'] {
    const { google } = this.options
    if (google.kind === 'configured') return google.config
    throw new Error(
      google.kind === 'missing'
        ? 'Google ist noch nicht eingerichtet: MAIN_VITE_GOOGLE_CLIENT_ID und MAIN_VITE_GOOGLE_CLIENT_SECRET fehlen in .env'
        : google.reason
    )
  }
}
