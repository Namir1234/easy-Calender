import { useEffect, useRef, useState } from 'react'
import type { Calendar, CalendarEvent, EventInput } from '../../../shared/types'

/** Ein neuer Termin mit Vorgabe für die Zeit, oder ein bestehender zum Ändern. */
export type FormTarget =
  | { kind: 'create'; start: Date; end: Date; allDay: boolean }
  | { kind: 'edit'; event: CalendarEvent }

interface Props {
  target: FormTarget
  calendars: Calendar[]
  onSaved(): void
  onClose(): void
}

const REPEAT_OPTIONS = [
  ['', 'Nie'],
  ['FREQ=DAILY', 'Jeden Tag'],
  ['FREQ=WEEKLY', 'Jede Woche'],
  ['FREQ=MONTHLY', 'Jeden Monat'],
  ['FREQ=YEARLY', 'Jedes Jahr']
]

const pad = (value: number): string => String(value).padStart(2, '0')
const toDateField = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const toTimeField = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`

/** Liest ein reines Datum als lokalen Tag, alles andere als Zeitpunkt. */
function parseLocal(value: string): Date {
  if (value.includes('T')) return new Date(value)
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(dateField: string, days: number): string {
  const date = parseLocal(dateField)
  date.setDate(date.getDate() + days)
  return toDateField(date)
}

interface Fields {
  title: string
  calendarId: string
  allDay: boolean
  startDate: string
  startTime: string
  /** Bei ganztägigen Terminen der letzte Tag (inklusiv), wie man ihn erwartet */
  endDate: string
  endTime: string
  repeat: string
  location: string
  description: string
}

function initialFields(target: FormTarget, calendars: Calendar[]): Fields {
  if (target.kind === 'edit') {
    const { event } = target
    const start = parseLocal(event.start)
    const end = parseLocal(event.end)
    return {
      title: event.title,
      calendarId: event.calendarId,
      allDay: event.allDay,
      startDate: toDateField(start),
      startTime: event.allDay ? '09:00' : toTimeField(start),
      endDate: event.allDay ? addDays(toDateField(end), -1) : toDateField(end),
      endTime: event.allDay ? '10:00' : toTimeField(end),
      repeat: '',
      location: event.location ?? '',
      description: event.description ?? ''
    }
  }
  const lastDay = new Date(target.end)
  if (target.allDay) lastDay.setDate(lastDay.getDate() - 1)
  return {
    title: '',
    calendarId: calendars[0]?.id ?? '',
    allDay: target.allDay,
    startDate: toDateField(target.start),
    startTime: target.allDay ? '09:00' : toTimeField(target.start),
    endDate: toDateField(target.allDay ? lastDay : target.end),
    endTime: target.allDay ? '10:00' : toTimeField(target.end),
    repeat: '',
    location: '',
    description: ''
  }
}

/** Baut aus den Feldern den Termin für den Main-Prozess. Wirft bei unstimmigen Zeiten. */
function toInput(fields: Fields, target: FormTarget): EventInput {
  const base = {
    title: fields.title,
    description: fields.description,
    location: fields.location,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // Beim Ändern bleibt die Wiederholung, wie sie ist.
    recurrence: target.kind === 'edit' ? target.event.recurrence : fields.repeat || null
  }
  if (fields.allDay) {
    if (fields.endDate < fields.startDate) throw new Error('Das Ende liegt vor dem Beginn.')
    return { ...base, allDay: true, start: fields.startDate, end: addDays(fields.endDate, 1) }
  }
  const start = new Date(`${fields.startDate}T${fields.startTime}:00`)
  const end = new Date(`${fields.endDate}T${fields.endTime}:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Bitte Datum und Uhrzeit ausfüllen.')
  }
  if (end <= start) throw new Error('Das Ende muss nach dem Beginn liegen.')
  return { ...base, allDay: false, start: start.toISOString(), end: end.toISOString() }
}

/**
 * Formular zum Erstellen und Ändern eines Termins. Es liegt als Popover
 * über dem Kalender. Escape oder «Abbrechen» schliesst es ohne Speichern.
 */
function EventForm({ target, calendars, onSaved, onClose }: Props): React.JSX.Element {
  const popoverRef = useRef<HTMLFormElement>(null)
  const [fields, setFields] = useState(() => initialFields(target, calendars))
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const editing = target.kind === 'edit'

  useEffect(() => {
    const popover = popoverRef.current
    if (popover && !popover.matches(':popover-open')) popover.showPopover()
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const set = <K extends keyof Fields>(key: K, value: Fields[K]): void =>
    setFields((current) => {
      const next = { ...current, [key]: value }
      // Wandert der Beginn hinter das Ende, zieht das Ende mit.
      if (key === 'startDate' && next.endDate < next.startDate) next.endDate = next.startDate
      return next
    })

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    let input: EventInput
    try {
      input = toInput(fields, target)
    } catch (inputError) {
      setProblem(inputError instanceof Error ? inputError.message : String(inputError))
      return
    }
    setSaving(true)
    setProblem(null)
    const request =
      target.kind === 'edit'
        ? window.api.updateEvent(target.event.calendarId, target.event.id, input)
        : window.api.createEvent(fields.calendarId, input)
    request.then(onSaved).catch((saveError) => {
      const text = saveError instanceof Error ? saveError.message : String(saveError)
      setProblem(text.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      setSaving(false)
    })
  }

  return (
    <form
      ref={popoverRef}
      popover="manual"
      className="event-form"
      aria-label={editing ? 'Termin ändern' : 'Neuer Termin'}
      onSubmit={submit}
    >
      <h2>{editing ? 'Termin ändern' : 'Neuer Termin'}</h2>

      <label className="field">
        <span>Titel</span>
        <input
          type="text"
          value={fields.title}
          onChange={(event) => set('title', event.target.value)}
          maxLength={500}
          autoFocus
        />
      </label>

      {editing ? (
        target.event.recurrence && (
          <p className="form-note">Geändert wird nur dieser eine Termin der Serie.</p>
        )
      ) : (
        <label className="field">
          <span>Kalender</span>
          <select
            value={fields.calendarId}
            onChange={(event) => set('calendarId', event.target.value)}
          >
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="check">
        <input
          type="checkbox"
          checked={fields.allDay}
          onChange={(event) => set('allDay', event.target.checked)}
        />
        <span>Ganztägig</span>
      </label>

      <div className="field-row">
        <label className="field">
          <span>Beginn</span>
          <input
            type="date"
            value={fields.startDate}
            onChange={(event) => set('startDate', event.target.value)}
            required
          />
        </label>
        {!fields.allDay && (
          <label className="field field-time">
            <span>Uhrzeit</span>
            <input
              type="time"
              value={fields.startTime}
              onChange={(event) => set('startTime', event.target.value)}
              required
            />
          </label>
        )}
      </div>

      <div className="field-row">
        <label className="field">
          <span>Ende</span>
          <input
            type="date"
            value={fields.endDate}
            min={fields.startDate}
            onChange={(event) => set('endDate', event.target.value)}
            required
          />
        </label>
        {!fields.allDay && (
          <label className="field field-time">
            <span>Uhrzeit</span>
            <input
              type="time"
              value={fields.endTime}
              onChange={(event) => set('endTime', event.target.value)}
              required
            />
          </label>
        )}
      </div>

      {!editing && (
        <label className="field">
          <span>Wiederholen</span>
          <select value={fields.repeat} onChange={(event) => set('repeat', event.target.value)}>
            {REPEAT_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>Ort</span>
        <input
          type="text"
          value={fields.location}
          onChange={(event) => set('location', event.target.value)}
          maxLength={500}
        />
      </label>

      <label className="field">
        <span>Notiz</span>
        <textarea
          value={fields.description}
          onChange={(event) => set('description', event.target.value)}
          rows={3}
          maxLength={8000}
        />
      </label>

      {problem && (
        <p className="form-problem" role="alert">
          {problem}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="button" onClick={onClose}>
          Abbrechen
        </button>
        <button type="submit" className="button button-strong" disabled={saving}>
          {saving ? 'Speichert …' : 'Speichern'}
        </button>
      </div>
    </form>
  )
}

export default EventForm
