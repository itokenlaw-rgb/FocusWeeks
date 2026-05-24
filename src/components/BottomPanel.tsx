import React from 'react';
import type { CalendarEvent } from '../utils/googleCalendar';
import { Plus, Edit2, X } from 'lucide-react';

interface BottomPanelProps {
  isOpen: boolean;
  selectedDate: string | null;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddEventClick: (date: string, timeSlotIdx: number | null) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  isOpen,
  selectedDate,
  events,
  onClose,
  onEventClick,
  onAddEventClick,
}) => {
  if (!selectedDate) return null;

  // Filter events for this day
  const dayEvents = events.filter(e => e.start.substring(0, 10) === selectedDate);

  // Format event start/end time
  const formatTimeRange = (event: CalendarEvent) => {
    if (event.allDay) return '終日';
    try {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const startStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      const endStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      return `${startStr}～${endStr}`;
    } catch {
      return '';
    }
  };

  // Determine rows to render:
  // We want to always display at least 3 rows.
  // - If 0 events: 3 empty slots + "予定がありません" label.
  // - If 1 event: 1 event row + 2 empty slots.
  // - If 2 events: 2 event rows + 1 empty slot.
  // - If 3+ events: all event rows + 1 empty slot.
  const eventCount = dayEvents.length;
  const renderedElements: React.ReactNode[] = [];

  // Populate events
  dayEvents.forEach((event) => {
    renderedElements.push(
      <div 
        key={`event-${event.id}`} 
        className="panel-event-row"
        onClick={() => onEventClick(event)}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
          <span className="panel-event-time">{formatTimeRange(event)}</span>
          <span className="panel-event-title">{event.title}</span>
        </div>
        <Edit2 size={16} style={{ color: 'var(--text-secondary)', marginLeft: 8 }} />
      </div>
    );
  });

  // Calculate empty slots needed
  let emptySlotsCount = 0;
  if (eventCount === 0) {
    emptySlotsCount = 3;
  } else if (eventCount === 1) {
    emptySlotsCount = 2;
  } else if (eventCount === 2) {
    emptySlotsCount = 1;
  } else {
    emptySlotsCount = 1; // Always show at least 1 add slot at the end for 3+ events
  }

  // Populate empty slots
  for (let i = 0; i < emptySlotsCount; i++) {
    const slotIdx = eventCount + i;
    // Map empty slots to tentative default time ranges if possible (just as hints)
    // Slot 0 -> morning, Slot 1 -> midday, Slot 2 -> afternoon/evening
    const timeSlotHint = slotIdx < 5 ? slotIdx : null;
    
    renderedElements.push(
      <div 
        key={`empty-${i}`} 
        className="panel-empty-row"
        onClick={() => onAddEventClick(selectedDate, timeSlotHint)}
      >
        <Plus size={16} style={{ marginRight: 6 }} />
        予定を追加
      </div>
    );
  }

  const formattedDateLabel = (() => {
    try {
      const d = new Date(selectedDate);
      const days = ['日', '月', '火', '水', '木', '金', '土'];
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
    } catch {
      return selectedDate;
    }
  })();

  return (
    <div className={`bottom-panel-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
      <div className={`bottom-panel ${isOpen ? 'active' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="panel-drag-handle" onClick={onClose} style={{ cursor: 'pointer' }} />
        
        <div className="panel-header">
          <span className="panel-date-title">{formattedDateLabel}</span>
          <button onClick={onClose} className="icon-btn" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <div className="panel-body">
          {eventCount === 0 && (
            <div className="panel-no-events-text">予定がありません</div>
          )}
          {renderedElements}
        </div>
      </div>
    </div>
  );
};
