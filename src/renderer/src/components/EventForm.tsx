import { useEffect, useRef, useState } from 'react'
import type {
  Calendar,
  CalendarEvent,
  Category,
  EventExtras,
  EventInput,
  ShowAs
} from '../../../shared/types'
import { addDays, parseLocal, REMINDER_OPTIONS, SHOW_AS_LABELS } from '../dates'
import {
  defaultRepeat,
  fromRrule,
  toRrule,
  weekdayPosition,
  type Frequency,
  type Repeat
} from '../recurrence'

/** Vorgaben für einen neuen Termin, z. B. aus dem Assistenten oder beim Duplizieren. */
export interface FormDraft extends EventExtras {
  title: string
  calendarId: string
  location?: string
  description?: string
}

/** Ein neuer Termin mit Vorgabe für die Zeit, oder ein bestehender zum Ändern. */
export type FormTarget =
  | { kind: 'create'; start: Date; end: Date; allDay: boolean; draft?: FormDraft }
  | { kind: 'edit'; event: CalendarEvent }

interface Props {
  target: FormTarget
  calendars: Calendar[]
  categories: Category[]
  onSaved(): void
  onClose(): void
}

/** Markiert ein einzelnes Vorkommen einer Serie (wie im Main-Prozess) */
const SERIES_INSTANCE = 'SERIE'

const FREQUENCIES: Array<[Frequency | '', string]> = [
  ['', 'Nie'],
  ['DAILY', 'Täglich'],
  ['WEEKLY', 'Wöchentlich'],
  ['MONTHLY', 'Monatlich'],
  ['YEARLY', 'Jährlich']
]
const UNITS: Record<Frequency, string> = {
  DAILY: 'Tage',
  WEEKLY: 'Wochen',
  MONTHLY: 'Monate',
  YEARLY: 'Jahre'
}
const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const WEEKDAY_LONG = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag'
]
const ORDINALS = ['ersten', 'zweiten', 'dritten', 'vierten']

/** Outlook-Vorgaben: Termine mit Uhrzeit «gebucht», 15 Minuten; ganztägige «frei», 18 Stunden. */
const DEFAULTS = {
  timed: { showAs: 'busy' as ShowAs, reminder: '15' },
  allDay: { showAs: 'free' as ShowAs, reminder: '1080' }
}

const pad = (value: number): string => String(value).padStart(2, '0')
const toDateField = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const toTimeField = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`
const reminderKey = (minutes: number | null | undefined): string =>
  minutes === null ? 'none' : minutes === undefined ? '' : String(minutes)

function shiftDate(dateField: string, days: number): string {
  return toDateField(addDays(parseLocal(dateField), days))
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
  /** `null`: keine Wiederholung */
  repeat: Repeat | null
  location: string
  description: string
  showAs: ShowAs
  private: boolean
  /** `none` keine Erinnerung, sonst Minuten als Text. Leer: unbekannt, bleibt beim Anbieter. */
  reminder: string
  categories: string[]
}

function initialFields(target: FormTarget, calendars: Calendar[]): Fields {
  if (target.kind === 'edit') {
    const { event } = target
    const start = parseLocal(event.start)
    const end = parseLocal(event.end)
    const rule = event.recurrence && event.recurrence !== SERIES_INSTANCE ? event.recurrence : null
    return {
      title: event.title,
      calendarId: event.calendarId,
      allDay: event.allDay,
      startDate: toDateField(start),
      startTime: event.allDay ? '09:00' : toTimeField(start),
      endDate: event.allDay ? shiftDate(toDateField(end), -1) : toDateField(end),
      endTime: event.allDay ? '10:00' : toTimeField(end),
      repeat: rule ? fromRrule(rule, start) : null,
      location: event.location ?? '',
      description: event.description ?? '',
      showAs: event.showAs ?? 'busy',
      private: Boolean(event.private),
      reminder: reminderKey(event.reminderMinutes),
      categories: event.categories ?? []
    }
  }
  const lastDay = new Date(target.end)
  if (target.allDay) lastDay.setDate(lastDay.getDate() - 1)
  const { draft } = target
  const defaults = target.allDay ? DEFAULTS.allDay : DEFAULTS.timed
  return {
    title: draft?.title ?? '',
    calendarId:
      calendars.find((calendar) => calendar.id === draft?.calendarId)?.id ?? calendars[0]?.id ?? '',
    allDay: target.allDay,
    startDate: toDateField(target.start),
    startTime: target.allDay ? '09:00' : toTimeField(target.start),
    endDate: toDateField(target.allDay ? lastDay : target.end),
    endTime: target.allDay ? '10:00' : toTimeField(target.end),
    repeat: null,
    location: draft?.location ?? '',
    description: draft?.description ?? '',
    showAs: draft?.showAs ?? defaults.showAs,
    private: Boolean(draft?.private),
    reminder:
      draft?.reminderMinutes !== undefined ? reminderKey(draft.reminderMinutes) : defaults.reminder,
    categories: draft?.categories ?? []
  }
}

/** Baut aus den Feldern den Termin für den Main-Prozess. Wirft bei unstimmigen Zeiten. */
function toInput(fields: Fields, target: FormTarget): EventInput {
  const instance = target.kind === 'edit' && target.event.recurrence === SERIES_INSTANCE
  const original = target.kind === 'edit' ? target.event.recurrence : null
  const startDay = parseLocal(fields.startDate)
  let recurrence: string | null
  if (instance) recurrence = SERIES_INSTANCE
  else if (fields.repeat) recurrence = toRrule(fields.repeat, startDay)
  // Eine Regel, die das Formular nicht abbilden kann, bleibt, wie sie ist.
  else if (original && !fromRrule(original, startDay) && original !== SERIES_INSTANCE) {
    recurrence = original
  } else recurrence = null

  const base = {
    title: fields.title,
    description: fields.description,
    location: fields.location,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recurrence,
    showAs: fields.showAs,
    private: fields.private,
    categories: fields.categories,
    ...(fields.reminder === ''
      ? {}
      : { reminderMinutes: fields.reminder === 'none' ? null : Number(fields.reminder) })
  }
  if (fields.allDay) {
    if (fields.endDate < fields.startDate) throw new Error('Das Ende liegt vor dem Beginn.')
    return { ...base, allDay: true, start: fields.startDate, end: shiftDate(fields.endDate, 1) }
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
function EventForm({ target, calendars, categories, onSaved, onClose }: Props): React.JSX.Element {
  const popoverRef = useRef<HTMLFormElement>(null)
  const [fields, setFields] = useState(() => initialFields(target, calendars))
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const editing = target.kind === 'edit'
  const instance = editing && target.event.recurrence === SERIES_INSTANCE
  const seriesMaster = editing && Boolean(target.event.recurrence) && !instance
  // Eine Regel, die das Formular nicht lesen kann, wird nicht angeboten.
  const [unreadableRule] = useState(
    () => seriesMaster && initialFields(target, calendars).repeat === null
  )

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
      // Beim Umschalten auf ganztägig gelten die Vorgaben von Outlook, solange nichts geändert wurde.
      if (key === 'allDay' && !editing) {
        const from = value ? DEFAULTS.timed : DEFAULTS.allDay
        const to = value ? DEFAULTS.allDay : DEFAULTS.timed
        if (current.showAs === from.showAs) next.showAs = to.showAs
        if (current.reminder === from.reminder) next.reminder = to.reminder
      }
      return next
    })

  const setRepeat = (change: Partial<Repeat>): void =>
    setFields((current) =>
      current.repeat ? { ...current, repeat: { ...current.repeat, ...change } } : current
    )

  const chooseFrequency = (value: Frequency | ''): void => {
    if (!value) set('repeat', null)
    else if (fields.repeat) setRepeat({ frequency: value })
    else set('repeat', defaultRepeat(value, parseLocal(fields.startDate)))
  }

  const toggleCategory = (name: string): void =>
    set(
      'categories',
      fields.categories.includes(name)
        ? fields.categories.filter((entry) => entry !== name)
        : [...fields.categories, name]
    )

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
      target.kind === 'create'
        ? window.api.createEvent(fields.calendarId, input)
        : fields.calendarId !== target.event.calendarId
          ? window.api.moveEvent(target.event.calendarId, target.event.id, fields.calendarId, input)
          : window.api.updateEvent(target.event.calendarId, target.event.id, input)
    request.then(onSaved).catch((saveError) => {
      const text = saveError instanceof Error ? saveError.message : String(saveError)
      setProblem(text.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      setSaving(false)
    })
  }

  const startDay = parseLocal(fields.startDate)
  const reminderOptions = REMINDER_OPTIONS.map(([value, label]) => [reminderKey(value), label])
  if (fields.reminder && !reminderOptions.some(([key]) => key === fields.reminder)) {
    reminderOptions.push([fields.reminder, `${fields.reminder} Minuten vorher`])
  }
  const categoryNames = [
    ...categories,
    ...fields.categories
      .filter((name) => !categories.some((category) => category.name === name))
      .map((name) => ({ name, color: 'transparent' }))
  ]
  const heading = editing ? (seriesMaster ? 'Serie ändern' : 'Termin ändern') : 'Neuer Termin'

  return (
    <form
      ref={popoverRef}
      popover="manual"
      className="event-form"
      aria-label={heading}
      onSubmit={submit}
    >
      <h2>{heading}</h2>

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

      {instance && <p className="form-note">Geändert wird nur dieser eine Termin der Serie.</p>}
      {seriesMaster && (
        <p className="form-note">
          Geändert wird die ganze Serie. Beginn und Ende gelten für den ersten Termin.
        </p>
      )}

      {!instance && (
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

      {!instance && !unreadableRule && (
        <fieldset className="repeat">
          <label className="field">
            <span>Wiederholen</span>
            <select
              value={fields.repeat?.frequency ?? ''}
              onChange={(event) => chooseFrequency(event.target.value as Frequency | '')}
            >
              {FREQUENCIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {fields.repeat && (
            <>
              <label className="inline-field">
                <span>Alle</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={fields.repeat.interval}
                  onChange={(event) =>
                    setRepeat({
                      interval: Math.max(1, Math.min(99, Number(event.target.value) || 1))
                    })
                  }
                />
                <span>{UNITS[fields.repeat.frequency]}</span>
              </label>

              {fields.repeat.frequency === 'WEEKLY' && (
                <div className="weekday-picker" role="group" aria-label="Wochentage">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                    const on = fields.repeat!.weekdays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        className="weekday"
                        aria-pressed={on}
                        aria-label={WEEKDAY_LONG[day]}
                        onClick={() =>
                          setRepeat({
                            weekdays: on
                              ? fields.repeat!.weekdays.filter((entry) => entry !== day)
                              : [...fields.repeat!.weekdays, day]
                          })
                        }
                      >
                        {WEEKDAY_SHORT[day]}
                      </button>
                    )
                  })}
                </div>
              )}

              {(fields.repeat.frequency === 'MONTHLY' || fields.repeat.frequency === 'YEARLY') && (
                <label className="field">
                  <span>Am</span>
                  <select
                    value={fields.repeat.monthlyBy}
                    onChange={(event) =>
                      setRepeat({ monthlyBy: event.target.value as Repeat['monthlyBy'] })
                    }
                  >
                    <option value="date">{startDay.getDate()}. des Monats</option>
                    <option value="weekday">
                      {(() => {
                        const position = weekdayPosition(startDay)
                        const nth = position < 0 ? 'letzten' : ORDINALS[position - 1]
                        return `${nth} ${WEEKDAY_LONG[startDay.getDay()]}`
                      })()}
                    </option>
                  </select>
                </label>
              )}

              <div className="field-row">
                <label className="field">
                  <span>Endet</span>
                  <select
                    value={fields.repeat.end}
                    onChange={(event) => setRepeat({ end: event.target.value as Repeat['end'] })}
                  >
                    <option value="never">Nie</option>
                    <option value="count">Nach Anzahl</option>
                    <option value="until">Am Datum</option>
                  </select>
                </label>
                {fields.repeat.end === 'count' && (
                  <label className="field field-time">
                    <span>Termine</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={fields.repeat.count}
                      onChange={(event) =>
                        setRepeat({
                          count: Math.max(1, Math.min(999, Number(event.target.value) || 1))
                        })
                      }
                    />
                  </label>
                )}
                {fields.repeat.end === 'until' && (
                  <label className="field">
                    <span>Letzter Tag</span>
                    <input
                      type="date"
                      min={fields.startDate}
                      value={fields.repeat.until}
                      onChange={(event) => setRepeat({ until: event.target.value })}
                      required
                    />
                  </label>
                )}
              </div>
            </>
          )}
        </fieldset>
      )}
      {unreadableRule && (
        <p className="form-note">
          Die Wiederholung bleibt, wie sie ist. Ändern lässt sie sich beim Anbieter.
        </p>
      )}

      <div className="field-row">
        <label className="field">
          <span>Anzeigen als</span>
          <select
            value={fields.showAs}
            onChange={(event) => set('showAs', event.target.value as ShowAs)}
          >
            {Object.entries(SHOW_AS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Erinnerung</span>
          <select value={fields.reminder} onChange={(event) => set('reminder', event.target.value)}>
            {fields.reminder === '' && <option value="">Standard des Kalenders</option>}
            {reminderOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={fields.private}
          onChange={(event) => set('private', event.target.checked)}
        />
        <span>Privat</span>
      </label>

      {categoryNames.length > 0 && (
        <fieldset className="category-picker">
          <legend>Kategorien</legend>
          {categoryNames.map((category) => (
            <label key={category.name} className="check">
              <input
                type="checkbox"
                checked={fields.categories.includes(category.name)}
                onChange={() => toggleCategory(category.name)}
              />
              <span
                className="calendar-swatch"
                style={{ background: category.color }}
                aria-hidden="true"
              />
              <span>{category.name}</span>
            </label>
          ))}
        </fieldset>
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
