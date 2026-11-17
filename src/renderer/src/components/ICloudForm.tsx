import { useState } from 'react'

interface Props {
  busy: boolean
  /** Verbindet das Konto. Bei einem Fehler bleibt das Formular offen. */
  onConnect(appleId: string, password: string): Promise<void>
  onCancel(): void
}

const APPLE_ACCOUNT_URL = 'https://account.apple.com/account/manage'

/**
 * Anmeldung bei iCloud. Apple erlaubt fremden Apps keinen Zugriff mit dem
 * normalen Passwort, sondern nur mit einem app-spezifischen Passwort.
 */
function ICloudForm({ busy, onConnect, onCancel }: Props): React.JSX.Element {
  const [appleId, setAppleId] = useState('')
  const [password, setPassword] = useState('')

  return (
    <form
      className="icloud-form"
      onSubmit={(event) => {
        event.preventDefault()
        onConnect(appleId, password)
          .then(() => setPassword(''))
          .catch(() => undefined)
      }}
    >
      <p>
        iCloud braucht ein app-spezifisches Passwort. Du erstellst es unter{' '}
        <a href={APPLE_ACCOUNT_URL} target="_blank" rel="noreferrer">
          account.apple.com
        </a>{' '}
        → «Anmelden und Sicherheit» → «App-spezifische Passwörter».
      </p>
      <label className="field">
        <span>Apple-ID</span>
        <input
          type="email"
          value={appleId}
          onChange={(event) => setAppleId(event.target.value)}
          autoComplete="username"
          maxLength={200}
          required
          autoFocus
        />
      </label>
      <label className="field">
        <span>App-spezifisches Passwort</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="off"
          placeholder="abcd-efgh-ijkl-mnop"
          maxLength={100}
          required
        />
      </label>
      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel} disabled={busy}>
          Abbrechen
        </button>
        <button type="submit" className="button button-strong" disabled={busy}>
          {busy ? 'Wird geprüft …' : 'Verbinden'}
        </button>
      </div>
    </form>
  )
}

export default ICloudForm
