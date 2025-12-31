'use client';

import { useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useLocale } from 'next-intl';

interface CalendarViewProps {
  events: any[];
  onEventClick?: (info: any) => void;
}

export default function CalendarView({ events, onEventClick }: CalendarViewProps) {
  const calendarRef = useRef<any>(null);
  const locale = useLocale();

  return (
    <>
      <style jsx global>{`
        .fullcalendar-wrapper {
          --fc-border-color: #e5e7eb;
          --fc-button-bg-color: #8b5cf6;
          --fc-button-border-color: #7c3aed;
          --fc-button-hover-bg-color: #7c3aed;
          --fc-button-hover-border-color: #6d28d9;
          --fc-button-active-bg-color: #6d28d9;
          --fc-button-active-border-color: #5b21b6;
        }
        .fc-event {
          cursor: pointer;
          border-radius: 4px;
          padding: 2px 4px;
        }
        .fc-daygrid-event {
          white-space: normal !important;
          align-items: normal !important;
        }
        .fc-event-title {
          font-size: 0.875rem;
          font-weight: 500;
        }
      `}</style>
      <div className="fullcalendar-wrapper">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          locale={locale}
          events={events}
          height="auto"
          slotMinTime="06:00:00"
          slotMaxTime="24:00:00"
          allDaySlot={false}
          eventClick={onEventClick}
          eventContent={(arg) => {
            return {
              html: `<div class="p-1">${arg.event.title}</div>`
            };
          }}
        />
      </div>
    </>
  );
}
