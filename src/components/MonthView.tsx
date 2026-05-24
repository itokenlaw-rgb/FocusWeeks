import React, { useRef, useEffect } from 'react';
import type { CalendarEvent } from '../utils/googleCalendar';
import type { Settings } from './SettingsView';

interface DayData {
  date: Date;
  dateString: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfMonth: number;
  monthLabel?: string;
}

interface MonthViewProps {
  weeks: DayData[][];
  events: CalendarEvent[];
  selectedDate: string | null;
  focusedWeekId: string | null; // start date of the focused week
  settings: Settings;
  onSelectDay: (dateString: string, weekStartDateString: string) => void;
  onVisibleMonthChange: (year: number, month: number) => void;
  onEventClick: (event: CalendarEvent) => void;
  duplicateMode: boolean;
  onPasteDuplicate: (targetDate: string) => void;
}

export const getEventSlotIndex = (event: CalendarEvent): number => {
  if (event.allDay) return 0;
  try {
    const d = new Date(event.start);
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const timeVal = hours + minutes / 60;
    if (timeVal < 9) return 0;
    if (timeVal < 12) return 1;
    if (timeVal < 15) return 2;
    if (timeVal < 18) return 3;
    return 4;
  } catch {
    return 0;
  }
};

export const MonthView: React.FC<MonthViewProps> = ({
  weeks,
  events,
  selectedDate,
  focusedWeekId,
  settings,
  onSelectDay,
  onVisibleMonthChange,
  onEventClick,
  duplicateMode,
  onPasteDuplicate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // Filter events for a specific date
  const getEventsForDate = (dateString: string) => {
    return events.filter(e => e.start.substring(0, 10) === dateString);
  };

  // Format event time for display
  const formatEventTime = (event: CalendarEvent) => {
    if (event.allDay) return '終日';
    try {
      const d = new Date(event.start);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  // Scroll to active month on load or when selected month changes from header
  // Note: we only do it if the user isn't scrolling actively to prevent scroll fights
  useEffect(() => {
    if (isScrollingRef.current) return;
    
    // Find week that contains today or the selectedDate and scroll to it
    const targetDate = selectedDate || new Date().toISOString().substring(0, 10);
    const targetWeekEl = containerRef.current?.querySelector(`[data-contains-date="${targetDate}"]`);
    
    if (targetWeekEl) {
      targetWeekEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [selectedDate]);

  // Scroll event handler to detect visible month
  const handleScroll = () => {
    isScrollingRef.current = true;
    
    if (!containerRef.current) return;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;
    
    // Find the week element in the middle of the scroll viewport
    const weekElements = container.querySelectorAll('.calendar-week');
    let middleWeekEl: Element | null = null;
    
    for (let i = 0; i < weekElements.length; i++) {
      const rect = weekElements[i].getBoundingClientRect();
      if (rect.top <= centerY && rect.bottom >= centerY) {
        middleWeekEl = weekElements[i];
        break;
      }
    }

    if (middleWeekEl) {
      const weekIndexAttr = middleWeekEl.getAttribute('data-week-index');
      if (weekIndexAttr !== null) {
        const weekIndex = parseInt(weekIndexAttr, 10);
        const week = weeks[weekIndex];
        if (week && week.length > 3) {
          // Use the Wednesday (middle day) of the week to define the active month
          const middleDate = week[3].date;
          onVisibleMonthChange(middleDate.getFullYear(), middleDate.getMonth());
        }
      }
    }

    // Reset scrolling flag after scroll stops
    clearTimeout((window as any).scrollTimeout);
    (window as any).scrollTimeout = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  };

  return (
    <div 
      className="scroll-content" 
      ref={containerRef} 
      onScroll={handleScroll}
      style={{ borderTop: '1px solid var(--border-color)' }}
    >
      <div className="month-container">
        {weeks.map((week, weekIndex) => {
          const weekId = week[0].dateString;
          const isFocused = weekId === focusedWeekId;
          
          // Check if this week contains the 1st of any month
          // If so, we'll draw a thick divider above it!
          const firstDayOfMonth = week.find(day => day.dayOfMonth === 1);
          const hasDivider = !!firstDayOfMonth;
          const dividerMonthName = firstDayOfMonth 
            ? `${firstDayOfMonth.date.getFullYear()}年 ${firstDayOfMonth.date.getMonth() + 1}月`
            : '';

          // Data attribute for search
          const containsDates = week.map(d => d.dateString);

          return (
            <React.Fragment key={weekId}>
              {hasDivider && (
                <div className="month-divider-line" style={{ position: 'relative' }}>
                  <span className="month-divider-label">{dividerMonthName}</span>
                </div>
              )}
              
              <div 
                className={`calendar-week ${isFocused ? 'focused' : ''}`}
                data-week-id={weekId}
                data-week-index={weekIndex}
                data-contains-date={containsDates.join(',')}
                style={{
                  // Set height multipliers dynamically based on focus and settings
                  '--focus-height-multiplier': settings.focusSize,
                } as React.CSSProperties}
              >
                {week.map((day) => {
                  const dayEvents = getEventsForDate(day.dateString);
                  const isSelected = selectedDate === day.dateString;
                  
                  // Setup days classes
                  const isSat = day.date.getDay() === 6;
                  const isSun = day.date.getDay() === 0;
                  
                  let dayClass = 'day-cell';
                  if (!day.isCurrentMonth) dayClass += ' other-month';
                  if (day.isToday) dayClass += ' today';
                  if (isSelected) dayClass += ' selected';
                  if (isSat) dayClass += ' sat';
                  if (isSun) dayClass += ' sun';

                  return (
                    <div 
                      key={day.dateString} 
                      className={dayClass}
                      onClick={() => {
                        if (duplicateMode) {
                          onPasteDuplicate(day.dateString);
                        } else {
                          onSelectDay(day.dateString, weekId);
                        }
                      }}
                    >
                      {/* Date label: "6月1日" vs just "1" */}
                      <span className="day-num">
                        {day.monthLabel ? day.monthLabel : day.dayOfMonth}
                      </span>

                      {/* Display content based on focus */}
                      {isFocused ? (
                        <div className="day-events-focused">
                          {/* Render 5 time slots */}
                          {Array.from({ length: 5 }).map((_, slotIdx) => {
                            const slotEvents = dayEvents.filter(
                              e => getEventSlotIndex(e) === slotIdx
                            );
                            
                            return (
                              <div key={slotIdx} className="day-time-slot">
                                {slotEvents.slice(0, 1).map(event => (
                                  <div 
                                    key={event.id}
                                    className="focused-event"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEventClick(event);
                                    }}
                                    title={`${formatEventTime(event)} ${event.title}`}
                                  >
                                    {event.title}
                                  </div>
                                ))}
                                {slotEvents.length > 1 && (
                                  <span style={{ fontSize: '8px', color: 'var(--text-secondary)', alignSelf: 'center' }}>
                                    +{slotEvents.length - 1}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="day-events-compact">
                          {dayEvents.slice(0, 2).map((event) => (
                            <div 
                              key={event.id} 
                              className="compact-event"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick(event);
                              }}
                              title={`${formatEventTime(event)} ${event.title}`}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="compact-event-more">
                              他 {dayEvents.length - 2} 件
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
export type { DayData };
