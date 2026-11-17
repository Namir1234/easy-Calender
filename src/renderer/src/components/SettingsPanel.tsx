import { useState } from 'react'
import type { Category, Settings, ViewSettings } from '../../../shared/types'

interface Props {
  settings: Settings
  onChange(settings: Settings): void
}

const WEEKDAYS: Array<[number, string]> = [
  [1, 'Mo'],
  [2, 'Di'],
  [3, 'Mi'],
  [4, 'Do'],
  [5, 'Fr'],
  [6, 'Sa'],
  [0, 'So']
]
const WEEKDAY_LONG = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag'
]
const SLOTS = [5, 10, 15, 30, 60]
/** Farben für neue Kategorien, der Reihe nach */
const NEW_COLORS = ['#038387', '#c239b3', '#986f0b', '#567c73', '#8e562e', '#4f6bed']

/**
 * Die Einstellungen in der Seitenleiste: allgemein, Kalenderoptionen wie in
 * Outlook (Arbeitszeit, Wochenbeginn, Zeitraster) und die farbigen Kategorien.
 */
function SettingsPanel({ settings, onChange }: Props): React.JSX.Element {
  const [newCategory, setNewCategory] = useState('')
  const { view } = settings
  const setView = (change: Partial<ViewSettings>): void =>
    onChange({ ...settings, view: { ...view, ...change } })
  const setCategories = (categories: Category[]): void => onChange({ ...settings, categories })

  const toggleWorkDay = (day: number): void => {
    const days = view.workDays.includes(day)
      ? view.workDays.filter((entry) => entry !== day)
      : [...view.workDays, day]
    // Mindestens ein Arbeitstag muss bleiben.
    if (days.length > 0) setView({ workDays: days.sort((a, b) => a - b) })
  }

  const addCategory = (event: React.FormEvent): void => {
    event.preventDefault()
    const name = newCategory.trim().replace(/[,;]/g, '')
    if (
      !name ||
      settings.categories.some((entry) => entry.name.toLowerCase() === name.toLowerCase())
    ) {
      return
    }
    const color = NEW_COLORS[settings.categories.length % NEW_COLORS.length]
    setCategories([...settings.categories, { name, color }])
    setNewCategory('')
  }

  return (
    <section className="settings" aria-label="Einstellungen">
      <h2 className="section-title">Einstellungen</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.autostart}
          onChange={(event) => onChange({ ...settings, autostart: event.target.checked })}
        />
        <span>Mit Windows starten</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.closeToTray}
          onChange={(event) => onChange({ ...settings, closeToTray: event.target.checked })}
        />
        <span>Beim Schliessen im Hintergrund weiterlaufen</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.reminders}
          onChange={(event) => onChange({ ...settings, reminders: event.target.checked })}
        />
        <span>An Google-Termine erinnern</span>
      </label>

      <details className="settings-group">
        <summary>Kalenderoptionen</summary>
        <div className="settings-body">
          <fieldset className="settings-fieldset">
            <legend>Arbeitstage</legend>
            <div className="weekday-picker">
              {WEEKDAYS.map(([day, label]) => (
                <button
                  key={day}
                  type="button"
                  className="weekday"
                  aria-pressed={view.workDays.includes(day)}
                  aria-label={WEEKDAY_LONG[day]}
                  onClick={() => toggleWorkDay(day)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="field-row">
            <label className="field">
              <span>Arbeitszeit von</span>
              <input
                type="time"
                value={view.workStart}
                onChange={(event) =>
                  event.target.value < view.workEnd && setView({ workStart: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>bis</span>
              <input
                type="time"
                value={view.workEnd}
                onChange={(event) =>
                  event.target.value > view.workStart && setView({ workEnd: event.target.value })
                }
              />
            </label>
          </div>
          <label className="field">
            <span>Erster Tag der Woche</span>
            <select
              value={view.firstDay}
              onChange={(event) => setView({ firstDay: Number(event.target.value) })}
            >
              {[1, 0, 6].map((day) => (
                <option key={day} value={day}>
                  {WEEKDAY_LONG[day]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Zeitraster</span>
            <select
              value={view.slotMinutes}
              onChange={(event) => setView({ slotMinutes: Number(event.target.value) })}
            >
              {SLOTS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} Minuten
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={view.weekNumbers}
              onChange={(event) => setView({ weekNumbers: event.target.checked })}
            />
            <span>Kalenderwochen anzeigen</span>
          </label>
        </div>
      </details>

      <details className="settings-group">
        <summary>Kategorien</summary>
        <div className="settings-body">
          <ul className="category-settings">
            {settings.categories.map((category, index) => (
              <li key={`${index}-${category.name}`}>
                <input
                  type="color"
                  value={category.color}
                  aria-label={`Farbe von ${category.name}`}
                  onChange={(event) =>
                    setCategories(
                      settings.categories.map((entry, position) =>
                        position === index ? { ...entry, color: event.target.value } : entry
                      )
                    )
                  }
                />
                <input
                  type="text"
                  defaultValue={category.name}
                  maxLength={60}
                  aria-label="Name der Kategorie"
                  onBlur={(event) => {
                    const name = event.target.value.trim().replace(/[,;]/g, '')
                    const taken = settings.categories.some(
                      (entry, position) =>
                        position !== index && entry.name.toLowerCase() === name.toLowerCase()
                    )
                    if (!name || taken) {
                      event.target.value = category.name
                      return
                    }
                    if (name !== category.name) {
                      setCategories(
                        settings.categories.map((entry, position) =>
                          position === index ? { ...entry, name } : entry
                        )
                      )
                    }
                  }}
                />
                <button
                  type="button"
                  className="link-button"
                  aria-label={`${category.name} entfernen`}
                  onClick={() =>
                    setCategories(settings.categories.filter((_, position) => position !== index))
                  }
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
          <form className="category-new" onSubmit={addCategory}>
            <input
              type="text"
              value={newCategory}
              maxLength={60}
              placeholder="Neue Kategorie"
              aria-label="Neue Kategorie"
              onChange={(event) => setNewCategory(event.target.value)}
            />
            <button type="submit" className="button button-inline" disabled={!newCategory.trim()}>
              Hinzufügen
            </button>
          </form>
          <p className="section-hint">
            Die Kategorien stehen im Termin selbst. Umbenennen ändert bestehende Termine nicht.
          </p>
        </div>
      </details>
    </section>
  )
}

export default SettingsPanel
