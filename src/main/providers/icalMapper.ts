import ICAL from 'ical.js'
import type { EventStatus, NormalizedEvent } from '../../shared/types'
import { wallTime } from './microsoftMapper'
import { SERIES_INSTANCE, seriesRule, type ProviderEvent } from './types'

type Component = InstanceType<typeof ICAL.Component>
type Time = InstanceType<typeof ICAL.Time>

/** Schutz vor endlosen Serien beim Auflösen in einzelne Vorkommen */
const MAX_OCCURRENCES = 20_000
const DAY_MS = 86_400_000

const STATUSES: Record<string, EventStatus> = {
  CONFIRMED: 'confirmed',
  TENTATIVE: 'tentative',
  CANCELLED: 'cancelled'
}

/** Ob `Intl` die Zeitzone kennt (`Europe/Zurich` ja, `W. Europe Standard Time` nein). */
export function isKnownZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return true
  } catch {
    return false
  }
}

/** Die Zeitverschiebung einer Zone zu einem Zeitpunkt, in Minuten. */
function offsetMinutes(timeZone: string, ms: number): number {
  const whole = Math.floor(ms / 60_000) * 60_000
  return Math.round(
    (Date.parse(`${wallTime(new Date(whole).toISOString(), timeZone)}Z`) - whole) / 60_000
  )
}

/** Eine Uhrzeit in einer Zone (`YYYY-MM-DDTHH:mm:ss`) als Zeitpunkt. */
export function zonedToInstant(wall: string, timeZone: string): Date {
  const asUtc = Date.parse(`${wall}Z`)
  // Zweimal nachrechnen genügt auch rund um die Zeitumstellung.
  let guess = asUtc - offsetMinutes(timeZone, asUtc) * 60_000
  guess = asUtc - offsetMinutes(timeZone, guess) * 60_000
  return new Date(guess)
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0')

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** Der `n`-te Wochentag eines Monats (n = -1: der letzte). */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay()
  return lastDay - ((last - weekday + 7) % 7)
}

/**
 * Baut eine VTIMEZONE für eine Zone aus den Daten von `Intl`. Die Regeln der
 * Zeitumstellung werden am angegebenen Jahr abgelesen («letzter Sonntag im
 * März um 2 Uhr»). Für Zonen ohne Zeitumstellung gibt es nur eine Standardzeit.
 */
export function buildTimezone(timeZone: string, year: number): string {
  const transitions: Array<{ at: number; from: number; to: number }> = []
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  let previous = offsetMinutes(timeZone, start)
  for (let day = start + DAY_MS; day <= end; day += DAY_MS) {
    const current = offsetMinutes(timeZone, day)
    if (current === previous) continue
    // Den Wechsel auf die Minute genau suchen.
    let low = day - DAY_MS
    let high = day
    while (high - low > 60_000) {
      const middle = Math.floor((low + high) / 2 / 60_000) * 60_000
      if (offsetMinutes(timeZone, middle) === previous) low = middle
      else high = middle
    }
    transitions.push({ at: high, from: previous, to: current })
    previous = current
  }

  const lines = ['BEGIN:VTIMEZONE', `TZID:${timeZone}`]
  if (transitions.length === 0) {
    const offset = formatOffset(previous)
    lines.push(
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      `TZOFFSETFROM:${offset}`,
      `TZOFFSETTO:${offset}`,
      'END:STANDARD'
    )
  }
  for (const transition of transitions) {
    // Die Uhrzeit des Wechsels, wie sie vor dem Wechsel auf der Uhr stand.
    const local = new Date(transition.at + transition.from * 60_000)
    const month = local.getUTCMonth() + 1
    const day = local.getUTCDate()
    const weekday = local.getUTCDay()
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const n = day + 7 > daysInMonth ? -1 : Math.ceil(day / 7)
    const kind = transition.to > transition.from ? 'DAYLIGHT' : 'STANDARD'
    const firstDay = nthWeekday(1970, month, weekday, n)
    lines.push(
      `BEGIN:${kind}`,
      `DTSTART:1970${pad(month)}${pad(firstDay)}T${pad(local.getUTCHours())}${pad(local.getUTCMinutes())}00`,
      `RRULE:FREQ=YEARLY;BYMONTH=${month};BYDAY=${n}${WEEKDAYS[weekday]}`,
      `TZOFFSETFROM:${formatOffset(transition.from)}`,
      `TZOFFSETTO:${formatOffset(transition.to)}`,
      `END:${kind}`
    )
  }
  lines.push('END:VTIMEZONE')
  return lines.join('\r\n')
}

/** Liest den Text einer `.ics`-Datei. */
export function parseCalendar(data: string): Component {
  const calendar = new ICAL.Component(ICAL.parse(data))
  if (calendar.name !== 'vcalendar') throw new Error('Keine Kalenderdatei')
  return calendar
}

const isException = (vevent: Component): boolean => vevent.hasProperty('recurrence-id')

/** Der Haupttermin einer Datei: der VEVENT ohne RECURRENCE-ID. */
function masterOf(calendar: Component): Component | null {
  return calendar.getAllSubcomponents('vevent').find((vevent) => !isException(vevent)) ?? null
}

function tzidOf(vevent: Component, name: string): string | undefined {
  const value = vevent.getFirstProperty(name)?.getParameter('tzid')
  return typeof value === 'string' ? value : undefined
}

function dateOf(time: Time): string {
  return `${pad(time.year, 4)}-${pad(time.month)}-${pad(time.day)}`
}

function wallOf(time: Time): string {
  return `${dateOf(time)}T${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}`
}

/**
 * Eine Zeit aus der Datei als Wert des normalisierten Modells: Datum bei
 * ganztägigen Terminen, sonst ein Zeitpunkt in UTC. Kennt die Datei die
 * Zone nicht, rechnet `Intl` um. Ganz ohne Zone bleibt es Ortszeit.
 */
export function timeValue(time: Time, tzid?: string): string {
  if (time.isDate) return dateOf(time)
  const zone = time.zone
  if (zone && zone !== ICAL.Timezone.localTimezone) return time.toJSDate().toISOString()
  if (isKnownZone(tzid)) return zonedToInstant(wallOf(time), tzid).toISOString()
  return wallOf(time)
}

function text(vevent: Component, name: string): string | undefined {
  const value = vevent.getFirstPropertyValue(name)
  if (typeof value !== 'string') return undefined
  return value.trim() === '' ? undefined : value
}

function toEvent(
  id: string,
  vevent: Component,
  start: Time,
  end: Time,
  tzid: string | undefined,
  recurrence: string | null,
  fallbackTimeZone: string
): ProviderEvent {
  const allDay = start.isDate
  let endValue = timeValue(end, tzidOf(vevent, 'dtend') ?? tzid)
  const startValue = timeValue(start, tzid)
  // Ganztägig ohne Ende heisst: ein Tag.
  if (allDay && endValue <= startValue) {
    endValue = new Date(Date.parse(`${startValue}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10)
  }
  const modified =
    vevent.getFirstPropertyValue('last-modified') ?? vevent.getFirstPropertyValue('dtstamp')
  const status = vevent.getFirstPropertyValue('status')
  return {
    id,
    title: text(vevent, 'summary')?.trim() || '(Ohne Titel)',
    description: text(vevent, 'description'),
    location: text(vevent, 'location'),
    start: startValue,
    end: endValue,
    allDay,
    timeZone: isKnownZone(tzid) ? tzid : fallbackTimeZone,
    recurrence,
    status: STATUSES[typeof status === 'string' ? status.toUpperCase() : ''] ?? 'confirmed',
    updatedAt: modified instanceof ICAL.Time ? modified.toJSDate().toISOString() : undefined
  }
}

function ruleOf(vevent: Component): string | null {
  const rule = vevent.getFirstPropertyValue('rrule')
  return rule instanceof ICAL.Recur ? rule.toString() : null
}

/**
 * Der Termin einer Datei für den Abgleich: ein Einzeltermin oder eine Serie
 * als Ganzes, mit RRULE. Ausnahmen einzelner Vorkommen bleiben aussen vor.
 */
export function seriesEvent(
  id: string,
  data: string,
  fallbackTimeZone: string
): ProviderEvent | null {
  const master = masterOf(parseCalendar(data))
  if (!master) return null
  const event = new ICAL.Event(master)
  return toEvent(
    id,
    master,
    event.startDate,
    event.endDate,
    tzidOf(master, 'dtstart'),
    ruleOf(master),
    fallbackTimeZone
  )
}

interface Occurrence {
  /** Schlüssel des Vorkommens: sein ursprünglicher Beginn als Wert des Modells */
  key: string
  item: Component
  /** Der ursprüngliche Beginn, in der Form des DTSTART der Serie */
  recurrenceId: Time
  start: Time
  end: Time
}

/** Geht die Vorkommen einer Serie der Reihe nach durch, Ausnahmen eingerechnet. */
function* occurrences(calendar: Component, master: Component): Generator<Occurrence> {
  const exceptions = calendar.getAllSubcomponents('vevent').filter(isException)
  const event = new ICAL.Event(master, { exceptions, strictExceptions: true })
  const tzid = tzidOf(master, 'dtstart')
  const iterator = event.iterator()
  for (let count = 0; count < MAX_OCCURRENCES; count++) {
    const next = iterator.next()
    if (!next) return
    const details = event.getOccurrenceDetails(next)
    yield {
      key: timeValue(details.recurrenceId, tzid),
      item: details.item.component,
      recurrenceId: details.recurrenceId,
      start: details.startDate,
      end: details.endDate
    }
  }
}

/** Beginn und Ende für den Vergleich mit dem Zeitraum, in Millisekunden. */
function epoch(time: Time, tzid: string | undefined): number {
  const value = timeValue(time, tzid)
  return Date.parse(time.isDate ? `${value}T00:00:00` : value)
}

/**
 * Die Termine einer Datei für die Anzeige. Serien werden in einzelne
 * Vorkommen aufgelöst. Ein Vorkommen hat die ID `<Adresse>#<Schlüssel>`.
 */
export function displayEvents(
  url: string,
  data: string,
  range: { start: Date; end: Date },
  fallbackTimeZone: string
): ProviderEvent[] {
  const calendar = parseCalendar(data)
  const master = masterOf(calendar)
  if (!master) return []
  const tzid = tzidOf(master, 'dtstart')
  const from = range.start.getTime()
  const until = range.end.getTime()

  if (!master.hasProperty('rrule') && !master.hasProperty('rdate')) {
    const event = seriesEvent(url, data, fallbackTimeZone)
    return event && event.status !== 'cancelled' ? [event] : []
  }

  const events: ProviderEvent[] = []
  for (const occurrence of occurrences(calendar, master)) {
    if (epoch(occurrence.start, tzid) >= until) break
    if (epoch(occurrence.end, tzid) <= from) continue
    const event = toEvent(
      `${url}#${occurrence.key}`,
      occurrence.item,
      occurrence.start,
      occurrence.end,
      tzidOf(occurrence.item, 'dtstart') ?? tzid,
      SERIES_INSTANCE,
      fallbackTimeZone
    )
    if (event.status !== 'cancelled') events.push(event)
  }
  return events
}

/** Sucht ein Vorkommen einer Serie über seinen Schlüssel. */
function findOccurrence(calendar: Component, master: Component, key: string): Occurrence | null {
  for (const occurrence of occurrences(calendar, master)) {
    if (occurrence.key === key) return occurrence
    // Die Vorkommen kommen der Reihe nach. Ist das gesuchte vorbei, gibt es es nicht.
    if (occurrence.key > key && occurrence.key.length === key.length) return null
  }
  return null
}

/** Ein einzelnes Vorkommen einer Serie, wie es angezeigt wird. */
export function occurrenceEvent(
  url: string,
  data: string,
  key: string,
  fallbackTimeZone: string
): ProviderEvent | null {
  const calendar = parseCalendar(data)
  const master = masterOf(calendar)
  const found = master && findOccurrence(calendar, master, key)
  if (!master || !found) return null
  const event = toEvent(
    `${url}#${key}`,
    found.item,
    found.start,
    found.end,
    tzidOf(found.item, 'dtstart') ?? tzidOf(master, 'dtstart'),
    SERIES_INSTANCE,
    fallbackTimeZone
  )
  return event.status === 'cancelled' ? null : event
}

// ---------------------------------------------------------------- Schreiben

function stamp(vevent: Component, now: Date): void {
  const utc = ICAL.Time.fromJSDate(now, true)
  vevent.updatePropertyWithValue('dtstamp', utc)
  vevent.updatePropertyWithValue('last-modified', utc)
  const sequence = vevent.getFirstPropertyValue('sequence')
  vevent.updatePropertyWithValue('sequence', (typeof sequence === 'number' ? sequence : 0) + 1)
}

function setText(vevent: Component, name: string, value: string | undefined): void {
  if (value && value.trim()) vevent.updatePropertyWithValue(name, value)
  else vevent.removeAllProperties(name)
}

/** Hängt die Beschreibung der Zone an, falls die Datei sie noch nicht hat. */
function ensureTimezone(calendar: Component, timeZone: string, year: number): void {
  const known = calendar
    .getAllSubcomponents('vtimezone')
    .some((zone) => zone.getFirstPropertyValue('tzid') === timeZone)
  if (!known) calendar.addSubcomponent(parseCalendarPart(buildTimezone(timeZone, year)))
}

function parseCalendarPart(text: string): Component {
  return new ICAL.Component(ICAL.parse(text))
}

/** Die Zone, in der ein Termin geschrieben wird. Ohne brauchbare Zone in UTC. */
function writeZone(event: NormalizedEvent): string | null {
  return isKnownZone(event.timeZone) && event.timeZone !== 'UTC' ? event.timeZone : null
}

function makeTime(value: string, allDay: boolean, zone: string | null): Time {
  if (allDay) return ICAL.Time.fromDateString(value.slice(0, 10))
  const instant = new Date(Date.parse(value))
  if (Number.isNaN(instant.getTime())) throw new Error(`Ungültige Zeit: ${value}`)
  if (!zone) return ICAL.Time.fromJSDate(instant, true)
  return ICAL.Time.fromDateTimeString(wallTime(instant.toISOString(), zone))
}

/** Setzt eine Zeit-Eigenschaft (DTSTART, DTEND, RECURRENCE-ID) samt Zone. */
function setTime(vevent: Component, name: string, time: Time, zone: string | null): void {
  vevent.removeAllProperties(name)
  const property = new ICAL.Property(name, vevent)
  property.setValue(time)
  if (zone && !time.isDate) property.setParameter('tzid', zone)
  vevent.addProperty(property)
}

/** Schreibt die abgeglichenen Felder in einen VEVENT. Alles andere bleibt stehen. */
function applyFields(
  calendar: Component,
  vevent: Component,
  event: NormalizedEvent,
  options: { withRule: boolean }
): void {
  vevent.updatePropertyWithValue('summary', event.title)
  setText(vevent, 'description', event.description)
  setText(vevent, 'location', event.location)
  const zone = event.allDay ? null : writeZone(event)
  setTime(vevent, 'dtstart', makeTime(event.start, event.allDay, zone), zone)
  setTime(vevent, 'dtend', makeTime(event.end, event.allDay, zone), zone)
  vevent.removeAllProperties('duration')
  if (zone) ensureTimezone(calendar, zone, Number(event.start.slice(0, 4)) || 2026)
  if (!options.withRule) return
  const rule = seriesRule(event)
  if (rule) vevent.updatePropertyWithValue('rrule', ICAL.Recur.fromString(rule))
  else if (event.recurrence === null) {
    for (const name of ['rrule', 'rdate', 'exdate']) vevent.removeAllProperties(name)
  }
}

/** Eine neue Kalenderdatei mit einem Termin. */
export function buildCalendar(event: NormalizedEvent, uid: string, now: Date): string {
  const calendar = new ICAL.Component(['vcalendar', [], []])
  calendar.updatePropertyWithValue('version', '2.0')
  calendar.updatePropertyWithValue('prodid', '-//easy-Calender//DE')
  calendar.updatePropertyWithValue('calscale', 'GREGORIAN')
  const vevent = new ICAL.Component('vevent', calendar)
  vevent.updatePropertyWithValue('uid', uid)
  vevent.updatePropertyWithValue('created', ICAL.Time.fromJSDate(now, true))
  applyFields(calendar, vevent, event, { withRule: true })
  calendar.addSubcomponent(vevent)
  stamp(vevent, now)
  vevent.updatePropertyWithValue('sequence', 0)
  return calendar.toString()
}

/** Ändert den Haupttermin einer Datei (Einzeltermin oder ganze Serie). */
export function updateSeries(data: string, event: NormalizedEvent, now: Date): string {
  const calendar = parseCalendar(data)
  const master = masterOf(calendar)
  if (!master) throw new Error('Die Kalenderdatei enthält keinen Termin')
  applyFields(calendar, master, event, { withRule: true })
  stamp(master, now)
  // Ohne Serie haben auch die Ausnahmen einzelner Vorkommen keinen Platz mehr.
  if (event.recurrence === null) {
    for (const vevent of calendar.getAllSubcomponents('vevent')) {
      if (isException(vevent)) calendar.removeSubcomponent(vevent)
    }
  }
  return calendar.toString()
}

/**
 * Ändert ein einzelnes Vorkommen einer Serie. Es wird als Ausnahme mit
 * RECURRENCE-ID gespeichert, die Serie selbst bleibt, wie sie ist.
 */
export function updateOccurrence(
  data: string,
  key: string,
  event: NormalizedEvent,
  now: Date
): string {
  const calendar = parseCalendar(data)
  const master = masterOf(calendar)
  const found = master && findOccurrence(calendar, master, key)
  if (!master || !found) throw new Error('Dieses Vorkommen der Serie gibt es nicht mehr')

  let exception = found.item === master ? null : found.item
  if (!exception) {
    exception = new ICAL.Component('vevent', calendar)
    exception.updatePropertyWithValue('uid', master.getFirstPropertyValue('uid'))
    const tzid = tzidOf(master, 'dtstart')
    // Die RECURRENCE-ID ist der ursprüngliche Beginn, in der Form des DTSTART der Serie.
    const property = new ICAL.Property('recurrence-id', exception)
    property.setValue(found.recurrenceId)
    if (tzid && !found.recurrenceId.isDate) property.setParameter('tzid', tzid)
    exception.addProperty(property)
    calendar.addSubcomponent(exception)
  }
  applyFields(calendar, exception, event, { withRule: false })
  stamp(exception, now)
  return calendar.toString()
}

/** Entfernt ein einzelnes Vorkommen einer Serie (EXDATE). */
export function removeOccurrence(data: string, key: string, now: Date): string {
  const calendar = parseCalendar(data)
  const master = masterOf(calendar)
  const found = master && findOccurrence(calendar, master, key)
  if (!master || !found) return calendar.toString()

  for (const vevent of calendar.getAllSubcomponents('vevent')) {
    if (vevent !== master && vevent === found.item) calendar.removeSubcomponent(vevent)
  }
  const recurrenceStart = found.recurrenceId
  const tzid = tzidOf(master, 'dtstart')
  const property = new ICAL.Property('exdate', master)
  property.setValue(recurrenceStart)
  if (tzid && !recurrenceStart.isDate) property.setParameter('tzid', tzid)
  master.addProperty(property)
  stamp(master, now)
  return calendar.toString()
}

/** Trennt die ID eines Termins in die Adresse der Datei und den Schlüssel eines Vorkommens. */
export function splitEventId(id: string): { url: string; key: string | null } {
  const at = id.lastIndexOf('#')
  return at === -1 ? { url: id, key: null } : { url: id.slice(0, at), key: id.slice(at + 1) }
}
