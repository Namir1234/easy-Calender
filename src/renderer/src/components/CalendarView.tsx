import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar, { useCalendarController } from '@fullcalendar/react'
import type {
  DateSelectInfo,
  DatesSetInfo,
  EventClickInfo,
  EventDisplayInfo,
  EventInput
} from '@fullcalendar/react'
import interactionPlugin from '@fullcalendar/react/interaction'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import themePlugin from '@fullcalendar/react/themes/forma'
import deLocale from '@fullcalendar/react/locales/de'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/forma/theme.css'
import type { Calendar, CalendarEvent, DateRange } from '../../../shared/types'
import type { ColorScheme } from '../useColorScheme'
import type { AnchorRect } from './EventDetails'
import { useMonthScroll } from '../monthScroll'
import { backgroundLabel, type BackgroundLabel } from '../backgroundLabel'

interface Props {
  calendars: Calendar[]
  colorScheme: ColorScheme
  /** Ändert sich der Wert, werden die Termine neu geladen. */
  reloadKey: number
  onSelect(event: CalendarEvent, anchor: AnchorRect): void
  /** Im Kalender wurde ein freier Zeitraum markiert. */
  onCreate(start: Date, end: Date, allDay: boolean): void
  onError(message: string): void
}

/** Länge eines Zeitfelds in der Wochenansicht (Vorgabe von FullCalendar: 30 Minuten) */
const SLOT_MS = 30 * 60 * 1000

const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin, themePlugin]

const TOOLBAR = {
  start: 'prev,next today',
  center: 'title',
  end: 'dayGridMonth,timeGridWeek,timeGridDay'
}

const TIME = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' })

/** Lokales Datum als `YYYY-MM-DD`, ohne Umweg über UTC. */
function toLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function CalendarView({
  calendars,
  colorScheme,
  reloadKey,
  onSelect,
  onCreate,
  onError
}: Props): React.JSX.Element {
  const [range, setRange] = useState<DateRange | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [viewType, setViewType] = useState('timeGridWeek')
  const controller = useCalendarController()
  const viewRef = useRef<HTMLDivElement>(null)

  // In der Monatsansicht blättern Mausrad und Touchpad durch die Monate.
  useMonthScroll(viewRef, viewType === 'dayGridMonth', (step) =>
    step > 0 ? controller.next() : controller.prev()
  )

  const handleDatesSet = useCallback((info: DatesSetInfo) => {
    setViewType(info.view.type)
    const start = toLocalDate(info.start)
    const end = toLocalDate(info.end)
    setRange((current) =>
      current && current.start === start && current.end === end ? current : { start, end }
    )
  }, [])

  // Der Main-Prozess fragt nur sichtbare Kalender ab. Ändert sich die
  // Auswahl oder die Kalenderliste, wird darum neu geladen.
  const visibleKey = calendars
    .filter((calendar) => calendar.visible && !calendar.hidden)
    .map((calendar) => calendar.id)
    .join(',')

  // Termine für den sichtbaren Zeitraum laden. Antworten auf einen
  // inzwischen verlassenen Zeitraum werden verworfen.
  useEffect(() => {
    if (!range) return
    let cancelled = false
    window.api
      .listEvents(range)
      .then((loaded) => {
        if (cancelled) return
        setEvents(loaded.events)
        if (loaded.problems.length > 0) {
          onError(`Nicht alle Kalender konnten geladen werden. ${loaded.problems.join(' · ')}`)
        }
      })
      .catch((error) => {
        if (!cancelled) onError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      cancelled = true
    }
  }, [range, visibleKey, reloadKey, onError])

  // Hintergrund-Kalender (etwa der Stundenplan) liegen in Wochen- und
  // Tagesansicht als Fläche hinter allem. So bekommen andere Termine die
  // volle Breite, statt sich die Spalte mit der Schule zu teilen. In der
  // Monatsansicht zeigt FullCalendar Hintergrund-Termine nur ganztägig,
  // darum bleiben sie dort normale Termine.
  const isTimeGrid = viewType.startsWith('timeGrid')

  const calendarEvents = useMemo<EventInput[]>(() => {
    const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]))
    return events.flatMap((event) => {
      const calendar = byId.get(event.calendarId)
      if (!calendar || !calendar.visible || calendar.hidden) return []
      return [
        {
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end,
          allDay: event.allDay,
          color: calendar.color,
          ...(calendar.background && isTimeGrid && !event.allDay
            ? { display: 'background', className: 'is-background-calendar' }
            : {}),
          extendedProps: { source: event }
        }
      ]
    })
  }, [events, calendars, isTimeGrid])

  // Wo der Text jeder Lektion stehen kann, ohne dass ein anderer Termin ihn
  // verdeckt. Termine über einer ganz verdeckten Lektion nennen sie selbst.
  const labels = useMemo(() => {
    const range = (event: EventInput): [number, number] => [
      Date.parse(String(event.start)),
      Date.parse(String(event.end))
    ]
    const foreground = calendarEvents.filter(
      (event) => event.display !== 'background' && !event.allDay
    )
    const covers = foreground.map(range)
    const byId = new Map<string, BackgroundLabel>()
    const hidden: Array<{ title: string; range: [number, number] }> = []
    for (const event of calendarEvents) {
      if (event.display !== 'background') continue
      const [start, end] = range(event)
      const label = backgroundLabel(start, end, covers)
      byId.set(String(event.id), label)
      if (!label.fits) hidden.push({ title: String(event.title), range: [start, end] })
    }
    return { byId, hidden }
  }, [calendarEvents])

  /**
   * Inhalt eines Hintergrund-Termins. FullCalendar zeigt dort nur den Titel,
   * blass und kursiv. Die Lektion soll aber aussehen wie ein normaler Termin,
   * und ihr Text darf nicht unter einem anderen Termin verschwinden: Liegt
   * einer über dem oberen Rand, rutscht der Text in die nächste freie Lücke.
   */
  const renderBackgroundEvent = useCallback(
    ({ event }: EventDisplayInfo): React.JSX.Element => {
      const offset = labels.byId.get(event.id)?.offset ?? 0
      const time =
        event.start && event.end ? `${TIME.format(event.start)}–${TIME.format(event.end)} Uhr` : ''
      return (
        <div className="background-event-content" style={{ top: `${offset * 100}%` }}>
          {time && <div className="background-event-time">{time}</div>}
          <div className="background-event-title">{event.title}</div>
        </div>
      )
    },
    [labels]
  )

  /**
   * Inhalt eines normalen Termins: wie bei FullCalendar Zeit und Titel. Liegt
   * er über einer Lektion, deren Text nirgends Platz hat, steht sie darunter.
   */
  const renderEvent = useCallback(
    (info: EventDisplayInfo): React.JSX.Element | true => {
      const { event } = info
      if (event.allDay || !event.start || !event.end) return true
      const start = event.start.getTime()
      const end = event.end.getTime()
      const covered = labels.hidden
        .filter(({ range: [from, to] }) => from < end && start < to)
        .map(({ title }) => title)
      if (covered.length === 0) return true
      return (
        <>
          {info.timeText && <div className={info.timeClass}>{info.timeText}</div>}
          <div className={info.titleClass}>{event.title}</div>
          <div className="covered-lesson">{covered.join(' · ')}</div>
        </>
      )
    },
    [labels]
  )

  const handleEventClick = useCallback(
    (info: EventClickInfo) => {
      const { top, bottom, left, right } = info.el.getBoundingClientRect()
      onSelect(info.event.extendedProps.source as CalendarEvent, { top, bottom, left, right })
    },
    [onSelect]
  )

  const handleSelect = useCallback(
    (info: DateSelectInfo) => {
      // Hintergrund-Termine liegen unter der Ebene der übrigen Termine und
      // bekommen darum selbst keinen Klick. Ein einfacher Klick (kein
      // Ziehen über mehrere Felder) auf einen davon zeigt seine Details.
      const isClick = info.end.getTime() - info.start.getTime() <= SLOT_MS
      if (info.jsEvent && isClick && !info.allDay) {
        const clicked = info.start.getTime()
        const source = calendarEvents.find(
          (event) =>
            event.display === 'background' &&
            Date.parse(String(event.start)) <= clicked &&
            clicked < Date.parse(String(event.end))
        )?.extendedProps?.source as CalendarEvent | undefined
        if (source) {
          // Das Popover erscheint auf Höhe des Klicks neben der Tagesspalte.
          const { clientX, clientY } = info.jsEvent
          const block = document
            .elementsFromPoint(clientX, clientY)
            .find((el) => el.classList.contains('is-background-calendar'))
          const { left, right } = block?.getBoundingClientRect() ?? {
            left: clientX,
            right: clientX
          }
          onSelect(source, { top: clientY, bottom: clientY, left, right })
          return
        }
      }
      onCreate(info.start, info.end, info.allDay)
    },
    [calendarEvents, onCreate, onSelect]
  )

  return (
    <div className="calendar-view" ref={viewRef}>
      <FullCalendar
        controller={controller}
        plugins={PLUGINS}
        locale={deLocale}
        colorScheme={colorScheme}
        initialView="timeGridWeek"
        headerToolbar={TOOLBAR}
        height="100%"
        borderless
        firstDay={1}
        nowIndicator
        scrollTime="07:00:00"
        dayMaxEvents
        eventDisplay="block"
        events={calendarEvents}
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        selectable
        select={handleSelect}
        backgroundEventContent={renderBackgroundEvent}
        eventContent={renderEvent}
      />
    </div>
  )
}

export default CalendarView
