interface Props {
  clientIdMissing: boolean
  ready: boolean
  busy: boolean
  /** Schon einmal angemeldet: «Wieder anmelden» */
  again: boolean
  error: string | null
  onSignIn(): void
}

/** Erster Bildschirm: Anmeldung bei Google. */
function SignInScreen({
  clientIdMissing,
  ready,
  busy,
  again,
  error,
  onSignIn
}: Props): React.JSX.Element {
  return (
    <main className="welcome">
      <h1 className="wordmark">easy-Calender</h1>
      <p className="welcome-text">
        Deine Kalender auf dem Handy. Die App spricht direkt mit Google. Deine Termine gehen über
        keinen anderen Server.
      </p>
      {clientIdMissing ? (
        <p className="form-problem" role="alert">
          Für diese Version ist noch kein Google-Zugang eingerichtet (siehe docs/SETUP.md,
          Handy-Version).
        </p>
      ) : (
        <button
          type="button"
          className="button button-strong welcome-button"
          onClick={onSignIn}
          disabled={!ready || busy}
        >
          {busy ? 'Warte auf Google …' : again ? 'Wieder anmelden' : 'Mit Google anmelden'}
        </button>
      )}
      {error && (
        <p className="form-problem" role="alert">
          {error}
        </p>
      )}
    </main>
  )
}

export default SignInScreen
