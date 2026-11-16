import type { Account } from '../shared/types'
import { clientForAccount, forgetGoogleAccount, loginWithGoogle } from './auth/googleAuth'
import { forgetMicrosoftAccount, loginWithMicrosoft, MicrosoftSession } from './auth/microsoftAuth'
import type {
  GoogleConfig,
  GoogleConfigResult,
  MicrosoftConfig,
  MicrosoftConfigResult
} from './config'
import { DEMO_SEED } from './db/demoData'
import type { RemoteCalendar, Store } from './db/store'
import { DemoProvider } from './providers/demo'
import { GoogleProvider } from './providers/google'
import { MicrosoftProvider } from './providers/microsoft'
import type { CalendarProvider } from './providers/types'
import type { SecureStorage } from './secureStorage'

export interface AccountServiceOptions {
  store: Store
  tokens: SecureStorage
  google: GoogleConfigResult
  microsoft: MicrosoftConfigResult
  openBrowser(url: string): Promise<void>
  copyText(text: string): void
}

type RealProvider = 'google' | 'microsoft'

/**
 * Verbindet und entfernt Konten und liefert zu jedem Konto den passenden
 * Anbieter. Hier laufen Anmeldung, Token-Speicher und Datenschicht zusammen.
 */
export class AccountService {
  private readonly demo = new DemoProvider()
  private readonly googleProviders = new Map<string, GoogleProvider>()
  private readonly microsoftProviders = new Map<string, MicrosoftProvider>()
  /** Die laufende Anmeldung: ihre Adresse beim Anbieter und der Abbruch */
  private login: { url: string | null; abort: AbortController } | null = null

  constructor(private readonly options: AccountServiceOptions) {}

  /** Meldet ein Google-Konto an und speichert es mit seinen Kalendern. */
  connectGoogle(): Promise<Account> {
    const config = this.requireGoogleConfig()
    return this.connect('google', (open, signal) =>
      loginWithGoogle(config, this.options.tokens, open, signal)
    )
  }

  /** Meldet ein Microsoft-Konto an und speichert es mit seinen Kalendern. */
  connectMicrosoft(): Promise<Account> {
    const config = this.requireMicrosoftConfig()
    return this.connect('microsoft', (open, signal) =>
      loginWithMicrosoft(config, this.options.tokens, open, signal)
    )
  }

  private async connect(
    provider: RealProvider,
    login: (open: (url: string) => Promise<void>, signal: AbortSignal) => Promise<string>
  ): Promise<Account> {
    if (this.login) {
      throw new Error('Es läuft bereits eine Anmeldung. Schliesse sie zuerst im Browser ab.')
    }

    const current = { url: null as string | null, abort: new AbortController() }
    this.login = current
    try {
      const { store, openBrowser } = this.options
      const email = await login((url) => {
        current.url = url
        return openBrowser(url)
      }, current.abort.signal)
      this.googleProviders.delete(email)
      this.microsoftProviders.delete(email)
      const calendars = await this.listRemoteCalendars(provider, email)
      const account = await store.saveAccount({ provider, email, calendars })
      // Mit dem ersten echten Konto haben die Demo-Daten ausgedient.
      await store.removeDemoAccounts()
      return account
    } finally {
      this.login = null
    }
  }

  /** Öffnet die Anmeldeseite der laufenden Anmeldung nochmals im Browser. */
  async reopenLogin(): Promise<void> {
    await this.options.openBrowser(this.requireLoginUrl())
  }

  /** Legt die Adresse der laufenden Anmeldung in die Zwischenablage. */
  copyLoginLink(): void {
    this.options.copyText(this.requireLoginUrl())
  }

  /** Bricht die laufende Anmeldung ab. Ohne laufende Anmeldung passiert nichts. */
  cancelLogin(): void {
    this.login?.abort.abort()
  }

  private requireLoginUrl(): string {
    if (!this.login?.url) throw new Error('Es läuft gerade keine Anmeldung')
    return this.login.url
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
    } else if (account.provider === 'microsoft') {
      this.microsoftProviders.delete(account.email)
      forgetMicrosoftAccount(tokens, account.email)
    }
    await store.seedIfEmpty(DEMO_SEED)
  }

  /**
   * Gleicht beim Start die Kalenderlisten aller echten Konten ab. Fehler
   * (kein Netz, Anmeldung abgelaufen) werden gesammelt zurückgegeben, die
   * gespeicherten Kalender bleiben dann unverändert.
   */
  async refreshCalendars(): Promise<string[]> {
    const problems: string[] = []
    for (const account of await this.options.store.listAccounts()) {
      if (account.provider === 'demo') continue
      try {
        const calendars = await this.listRemoteCalendars(account.provider, account.email)
        await this.options.store.saveAccount({
          provider: account.provider,
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
        return this.microsoftProvider(account.email)
    }
  }

  private listRemoteCalendars(provider: RealProvider, email: string): Promise<RemoteCalendar[]> {
    return provider === 'google'
      ? this.googleProvider(email).listCalendars()
      : this.microsoftProvider(email).listCalendars()
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

  private microsoftProvider(email: string): MicrosoftProvider {
    let provider = this.microsoftProviders.get(email)
    if (!provider) {
      const session = new MicrosoftSession(
        this.requireMicrosoftConfig(),
        this.options.tokens,
        email
      )
      provider = new MicrosoftProvider(() => session.token())
      this.microsoftProviders.set(email, provider)
    }
    return provider
  }

  private requireGoogleConfig(): GoogleConfig {
    const { google } = this.options
    if (google.kind === 'configured') return google.config
    throw new Error(
      google.kind === 'missing'
        ? 'Google ist noch nicht eingerichtet: MAIN_VITE_GOOGLE_CLIENT_ID und MAIN_VITE_GOOGLE_CLIENT_SECRET fehlen in .env'
        : google.reason
    )
  }

  private requireMicrosoftConfig(): MicrosoftConfig {
    const { microsoft } = this.options
    if (microsoft.kind === 'configured') return microsoft.config
    throw new Error(
      microsoft.kind === 'missing'
        ? 'Microsoft ist noch nicht eingerichtet: MAIN_VITE_MS_CLIENT_ID fehlt in .env (siehe docs/SETUP.md)'
        : microsoft.reason
    )
  }
}
