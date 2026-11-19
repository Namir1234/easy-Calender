import { DESIGNS, MODES, isDesignId, isModeId, useDesign, useMode } from '../design'

/** Auswahl von Design und Hell/Dunkel. Gilt sofort und bleibt auf diesem Gerät gespeichert. */
function DesignPicker(): React.JSX.Element {
  const [design, setDesign] = useDesign()
  const [mode, setMode] = useMode()
  const hint = DESIGNS.find((entry) => entry.id === design)?.hint

  return (
    <div className="design-picker">
      <label className="field">
        <span>Design</span>
        <select
          value={design}
          onChange={(event) => {
            if (isDesignId(event.target.value)) setDesign(event.target.value)
          }}
        >
          {DESIGNS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        {hint && <small className="design-hint">{hint}</small>}
      </label>
      <label className="field">
        <span>Hell oder dunkel</span>
        <select
          value={mode}
          onChange={(event) => {
            if (isModeId(event.target.value)) setMode(event.target.value)
          }}
        >
          {MODES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export default DesignPicker
