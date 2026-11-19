import { useCallback, useMemo, useRef } from 'react'
import FullCalendar, { useCalendarController } from '@fullcalendar/react'
import type { DateSelectInfo, DatesSetInfo, EventClickInfo, EventInput } from '@fullcalendar/react'
import interactionPlugin from '@fullcalendar/react/interaction'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import listPlugin from '@fullcalendar/react/list'
import themePlugin from '@fullcalendar/react/themes/forma'
import deLocale from '@fullcalendar/react/locales/de'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/forma/theme.css'
import type { CalendarEvent } from '../../../src/shared/types'
import type { ColorScheme } from '../../../src/renderer/src/useColorScheme'
import type { WebCalendar } from '../google/api'
import type { ViewName } from '../store'
import {
  MONTH_STRIP,
  STRIP_VIEWS,
  monthShading,
  useMonthStrip
} from '../../../src/renderer/src/monthStrip'

/** Sichtbarer Zeitraum als lokale Tage, `end` exklusiv. */
export interface DayRange {
  start: string
  end: string
}

interface Props {
  calendars: WebCalendar[]
  events: CalendarEvent[]
  view: ViewName
  colorScheme: ColorScheme
  loading: boolean
  onView(view: ViewName): void
  onRange(range: DayRange): void
  onSelect(event: CalendarEvent): void
  onCreate(start: Date, end: Date, allDay: boolean): void
  onReload(): void
  onCalendars(): void
}

const PLUGINS = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, themePlugin]

const VIEWS: Array<[ViewName, string]> = [
  ['listWeek', 'Liste'],
  ['timeGridDay', 'Tag'],
  ['dayGridMonth', 'Monat']
]

const pad = (value: number): string => String(value).padStart(2, '0')
const toLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/**
 * Der Kalender fürs Handy: oben Titel und Blättern, darunter die Ansicht.
 * Wischen und Antippen statt Ziehen mit der Maus. Der Monat ist ein langes
 * Band von Wochen, durch das man stufenlos wischt.
 */
function MobileCalendar({
  calendars,
  events,
  view,
  colorScheme,
  loading,
  onView,
  onRange,
  onSelect,
  onCreate,
  onReload,
  onCalendars
}: Props): React.JSX.Element {
  const controller = useCalendarController()
  const viewRef = useRef<HTMLDivElement>(null)

  const isMonth = view === 'dayGridMonth'
  const strip = useMonthStrip(viewRef, isMonth, controller)
  const { rendered } = strip

  const handleDatesSet = useCallback(
    (info: DatesSetInfo) => {
      onRange({ start: toLocalDate(info.start), end: toLocalDate(info.end) })
      rendered(info.view.type)
    },
    [onRange, rendered]
  )

  const calendarEvents = useMemo<EventInput[]>(() => {
    const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]))
    return events.flatMap((event) => {
      const calendar = byId.get(event.calendarId)
      if (!calendar?.visible) return []
      return [
        {
          // Dieselbe Einladung kann in zwei Kalendern stehen.
          id: `${event.calendarId}|${event.id}`,
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

  const select = useCallback(
    (info: EventClickInfo) => onSelect(info.event.extendedProps.source as CalendarEvent),
    [onSelect]
  )

  const create = useCallback(
    (info: DateSelectInfo) => onCreate(info.start, info.end, info.allDay),
    [onCreate]
  )

  const changeView = (next: ViewName): void => {
    if (isMonth) strip.leave()
    controller.changeView(next === 'dayGridMonth' ? MONTH_STRIP : next)
    onView(next)
  }

  return (
    <div className="mobile-calendar">
      <header className="topbar">
        <div className="topbar-row">
          <button
            type="button"
            className="icon-button"
            onClick={() => (isMonth ? strip.step(-1) : controller.prev())}
            aria-label="Zurück"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <h1 className="topbar-title" aria-live="polite">
            {isMonth ? strip.title : (controller.view?.title ?? '')}
          </h1>
          <button
            type="button"
            className="icon-button"
            onClick={() => (isMonth ? strip.step(1) : controller.next())}
            aria-label="Weiter"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="topbar-row">
          <button
            type="button"
            className="chip"
            onClick={() => (isMonth ? strip.today() : controller.today())}
          >
            Heute
          </button>
          <div className="segmented" role="group" aria-label="Ansicht">
            {VIEWS.map(([name, label]) => (
              <button
                key={name}
                type="button"
                aria-pressed={view === name}
                onClick={() => changeView(name)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onReload}
            aria-label="Neu laden"
            data-busy={loading || undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
            </svg>
          </button>
          <button type="button" className="icon-button" onClick={onCalendars} aria-label="Kalender">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      <div className="mobile-view" ref={viewRef}>
        <style>{monthShading('.mobile-view', strip.month)}</style>
        <FullCalendar
          controller={controller}
          plugins={PLUGINS}
          locale={deLocale}
          colorScheme={colorScheme}
          initialView={view === 'dayGridMonth' ? MONTH_STRIP : view}
          views={STRIP_VIEWS}
          headerToolbar={false}
          height="100%"
          borderless
          firstDay={1}
          nowIndicator
          scrollTime="07:00:00"
          dayMaxEvents
          eventDisplay="block"
          events={calendarEvents}
          datesSet={handleDatesSet}
          eventClick={select}
          selectable
          selectLongPressDelay={400}
          select={create}
          noEventsText="Keine Termine in dieser Woche"
          // Schmale Tagesspalte: «Mi.» und «18. Nov.», damit der Titel Platz hat.
          listDayFormat={{ weekday: 'short' }}
          listDayAltFormat={{ day: 'numeric', month: 'short' }}
        />
      </div>
    </div>
  )
}

export default MobileCalendar
