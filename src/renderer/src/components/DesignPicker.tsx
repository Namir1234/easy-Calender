import { DESIGNS, isDesignId, useDesign } from '../design'

/** Auswahl des Designs. Die Wahl gilt sofort und bleibt auf diesem Gerät gespeichert. */
function DesignPicker(): React.JSX.Element {
  const [design, setDesign] = useDesign()
  const hint = DESIGNS.find((entry) => entry.id === design)?.hint

  return (
    <label className="field design-picker">
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
  )
}

export default DesignPicker
