import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  label: string
  children: ReactNode
  onClose(): void
}

/**
 * Ein Blatt, das von unten über die Ansicht kommt. Antippen daneben,
 * «Schliessen» oder die Zurück-Taste schliesst es.
 */
function Sheet({ label, children, onClose }: Props): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // Ein Tipp auf den abgedunkelten Rand trifft das Dialog-Element selbst.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="sheet-body">{children}</div>
    </dialog>
  )
}

export default Sheet
