import type { DbStatus } from '../../../shared/types'

interface Props {
  status: DbStatus | null
}

function StatusBadge({ status }: Props): React.JSX.Element | null {
  if (!status) return null

  const kind = !status.ok ? 'error' : status.mode === 'supabase' ? 'ok' : 'notice'
  const label = !status.ok
    ? 'Supabase-Fehler'
    : status.mode === 'supabase'
      ? 'Supabase verbunden'
      : 'Demo-Daten'

  return (
    <footer className={`status status-${kind}`}>
      <p className="status-label">
        <span className="status-dot" aria-hidden="true" />
        {label}
      </p>
      {status.message && <p className="status-message">{status.message}</p>}
    </footer>
  )
}

export default StatusBadge
