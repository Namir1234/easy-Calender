import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { Ref } from 'react'
import FullCalendar from '@fullcalendar/react'
import type {
  CalendarRef,
  DateSelectInfo,
  DatesSetInfo,
  EventClickInfo,
  EventDropInfo,
  EventInput,
  EventResizeDoneInfo
} from '@fullcalendar/react'
import interactionPlugin from '@fullcalendar/react/interaction'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import listPlugin from '@fullcalendar/react/list'
import themePlugin from '@fullcalendar/react/themes/forma'
import deLocale from '@fullcalendar/react/locales/de'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/forma/theme.css'
import type {
  Calendar,
  CalendarEvent,
  Category,
  DateRange,
  EventInput as AppEventInput,
  ViewSettings
} from '../../../shared/types'
import type { ColorScheme } from '../useColorScheme'
import { eventColor, toLocalDate, VIEWS, type ViewName } from '../calendarViews'
import type { AnchorRect } from './EventDetails'

/** Was die App von aussen mit dem Kalender tun kann. */
export interface CalendarHandle {
  gotoDate(date: Date): void
  changeView(view: ViewName): void
  today(): void
  prev(): void
  next(): void
}

/** Der sichtbare Zeitraum und das Datum, um das es geht. */
export interface VisibleRange {
  start: Date
  /** exklusiv */
  end: Date
  current: Date
  view: ViewName
}

interface Props {
  ref?: Ref<CalendarHandle>
  calendars: Calendar[]
  categories: Category[]
  view: ViewSettings
  colorScheme: ColorScheme
  /** Ändert sich der Wert, werden die Termine neu geladen. */
  reloadKey: number
  onSelect(event: CalendarEvent, anchor: AnchorRect): void
  /** Im Kalender wurde ein freier Zeitraum markiert. */
  onCreate(start: Date, end: Date, allDay: boolean): void
  /** Ein Termin wurde mit der Maus verschoben oder in der Länge geändert. */
  onChanged(): void
  onRangeChange(range: VisibleRange): void
  onPrint(): void
  onError(message: string): void
}

const PLUGINS = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, themePlugin]

const TOOLBAR = {
  start: 'prev,next today',
  center: 'title',
  end: `${VIEWS.map((view) => view.name).join(',')} print`
}

const STORED_VIEW = 'easy-calender:view'

function storedView(): ViewName {
  try {
    const value = localStorage.getItem(STORED_VIEW)
    if (VIEWS.some((view) => view.name === value)) return value as ViewName
  } catch {
    // Ohne Speicher gilt die Wochenansicht.
  }
  return 'timeGridWeek'
}

/** Baut aus einem verschobenen Termin, was der Main-Prozess zum Speichern braucht. */
function movedInput(info: EventDropInfo | EventResizeDoneInfo): AppEventInput | null {
  const source = info.event.extendedProps.source as CalendarEvent
  const start = info.event.start
  if (!start) return null
  const allDay = info.event.allDay
  let end = info.event.end
  if (!end) {
    end = new Date(start)
    if (allDay) end.setDate(end.getDate() + 1)
    else end.setHours(end.getHours() + 1)
  }
  return {
    title: source.title,
    description: source.description,
    location: source.location,
    timeZone: source.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    recurrence: source.recurrence,
    // Die Erinnerung bleibt weg: So behält Google eine Standard-Erinnerung als Standard.
    showAs: source.showAs,
    private: source.private,
    categories: source.categories,
    allDay,
    start: allDay ? toLocalDate(start) : start.toISOString(),
    end: allDay ? toLocalDate(end) : end.toISOString()
  }
}

function CalendarView({
  ref,
  calendars,
  categories,
  view,
  colorScheme,
  reloadKey,
  onSelect,
  onCreate,
  onChanged,
  onRangeChange,
  onPrint,
  onError
}: Props): React.JSX.Element {
  const calendarRef = useRef<CalendarRef>(null)
  const [range, setRange] = useState<DateRange | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [initialView] = useState(storedView)

  useImperativeHandle(ref, () => {
    const api = (): ReturnType<CalendarRef['getApi']> | undefined => calendarRef.current?.getApi()
    return {
      gotoDate: (date) => api()?.gotoDate(date),
      changeView: (name) => api()?.changeView(name),
      today: () => api()?.today(),
      prev: () => api()?.prev(),
      next: () => api()?.next()
    }
  }, [])

  const handleDatesSet = useCallback(
    (info: DatesSetInfo) => {
      const start = toLocalDate(info.start)
      const end = toLocalDate(info.end)
      setRange((current) =>
        current && current.start === start && current.end === end ? current : { start, end }
      )
      const name = info.view.type as ViewName
      try {
        localStorage.setItem(STORED_VIEW, name)
      } catch {
        // Die Ansicht merkt sich die App nur, wenn es geht.
      }
      onRangeChange({
        start: info.start,
        end: info.end,
        current: calendarRef.current?.getApi().getDate() ?? info.start,
        view: name
      })
    },
    [onRangeChange]
  )

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
      const classes = [`show-${event.showAs ?? 'busy'}`]
      if (event.private) classes.push('is-private')
      if (event.recurrence) classes.push('is-series')
      return [
        {
          id: `${event.calendarId}|${event.id}`,
          title: event.title,
          start: event.start,
          end: event.end,
          allDay: event.allDay,
          color: eventColor(event, calendar, categories),
          className: classes.join(' '),
          extendedProps: { source: event }
        }
      ]
    })
  }, [events, calendars, categories])

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

  // Verschieben und Länge ändern mit der Maus, wie in Outlook. Bei einer Serie
  // ändert sich nur dieses eine Vorkommen.
  const handleChange = useCallback(
    (info: EventDropInfo | EventResizeDoneInfo) => {
      const source = info.event.extendedProps.source as CalendarEvent
      const input = movedInput(info)
      if (!input) {
        info.revert()
        return
      }
      window.api
        .updateEvent(source.calendarId, source.id, input)
        .then(onChanged)
        .catch((error) => {
          info.revert()
          const text = error instanceof Error ? error.message : String(error)
          onError(text.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
        })
    },
    [onChanged, onError]
  )

  // Neu berechnet wird nur, wenn sich die Arbeitstage wirklich ändern.
  const workDaysKey = view.workDays.join(',')
  const views = useMemo(() => {
    const workDays = workDaysKey.split(',').map(Number)
    return {
      timeGridWorkWeek: {
        type: 'timeGrid',
        duration: { weeks: 1 },
        hiddenDays: [0, 1, 2, 3, 4, 5, 6].filter((day) => !workDays.includes(day))
      }
    }
  }, [workDaysKey])
  // Die Knöpfe der Ansichten heissen wie in Outlook.
  const buttons = useMemo(
    () => ({
      ...Object.fromEntries(VIEWS.map((entry) => [entry.name, { text: entry.label }])),
      print: { text: 'Drucken', click: onPrint }
    }),
    [onPrint]
  )
  const businessHours = useMemo(
    () => ({
      daysOfWeek: workDaysKey.split(',').map(Number),
      startTime: view.workStart,
      endTime: view.workEnd
    }),
    [workDaysKey, view.workStart, view.workEnd]
  )
  const minutes = String(view.slotMinutes % 60).padStart(2, '0')
  const slotDuration = `${String(Math.floor(view.slotMinutes / 60)).padStart(2, '0')}:${minutes}:00`

  return (
    <div className="calendar-view">
      <FullCalendar
        ref={calendarRef}
        plugins={PLUGINS}
        locale={deLocale}
        colorScheme={colorScheme}
        initialView={initialView}
        headerToolbar={TOOLBAR}
        views={views}
        buttons={buttons}
        height="100%"
        borderless
        firstDay={view.firstDay}
        weekNumbers={view.weekNumbers}
        businessHours={businessHours}
        slotDuration={slotDuration}
        scrollTime={`${view.workStart}:00`}
        nowIndicator
        navLinks
        dayMaxEvents
        eventDisplay="block"
        events={calendarEvents}
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        selectable
        select={handleSelect}
        editable
        eventDrop={handleChange}
        eventResize={handleChange}
      />
    </div>
  )
}

export default CalendarView
