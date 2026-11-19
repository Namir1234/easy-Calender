import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar, { useCalendarController } from '@fullcalendar/react'
import type {
  DateSelectInfo,
  DatesSetInfo,
  EventClickInfo,
  EventInput,
  EventTextInfo
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

const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin, themePlugin]
/** Uhrzeiten in der Etikett-Schrift, «Ganztägig» nicht. */ const timeClass = (
  info: EventTextInfo
): string | undefined => (info.event.allDay ? undefined : 'cal-time')

const TOOLBAR = {
  start: 'prev,next today',
  center: 'title',
  end: 'dayGridMonth,timeGridWeek,timeGridDay'
}

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
          extendedProps: { source: event }
        }
      ]
    })
  }, [events, calendars])

  const handleEventClick = useCallback(
    (info: EventClickInfo) => {
      const { top, bottom, left, right } = info.el.getBoundingClientRect()
      onSelect(info.event.extendedProps.source as CalendarEvent, { top, bottom, left, right })
    },
    [onSelect]
  )

  const handleSelect = useCallback(
    (info: DateSelectInfo) => onCreate(info.start, info.end, info.allDay),
    [onCreate]
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
        toolbarTitleClass="cal-title"
        slotHeaderInnerClass="cal-time"
        eventTimeClass={timeClass}
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        selectable
        select={handleSelect}
      />
    </div>
  )
}

export default CalendarView
