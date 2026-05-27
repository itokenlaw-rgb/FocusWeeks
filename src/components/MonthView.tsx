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
  // 【修正】TypeScriptエラー回避のため、使用しなくなった onEventClick を Props から削除
  duplicateMode: boolean;
  onPasteDuplicate: (targetDate: string) => void;
}

export const getEventSlotIndex = (event: CalendarEvent): number => {
  if (event.allDay) return 0;
  try {
    const d = new Date(event.start);
    const hours = d.getHours();
    
    if (hours < 9) return 0;
    if (hours < 12) return 1;
    if (hours < 15) return 2;
    if (hours < 18) return 3;
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
  duplicateMode,
  onPasteDuplicate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); 
  const lastNotifiedMonth = useRef<{ year: number; month: number } | null>(null);

  const getEventsForDate = (dateString: string) => {
    return events.filter(e => e.start.substring(0, 10) === dateString);
  };

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

  useEffect(() => {
    const scrollToToday = () => {
      const todayStr = new Date().toISOString().substring(0, 10);
      const allWeekEls = containerRef.current?.querySelectorAll('.calendar-week');
      if (!allWeekEls) return;

      for (let i = 0; i < allWeekEls.length; i++) {
        const el = allWeekEls[i] as HTMLElement;
        const containsAttr = el.getAttribute('data-contains-date') || '';
        if (containsAttr.split(',').includes(todayStr)) {
          el.scrollIntoView({ block: 'start', behavior: 'auto' });
          break;
        }
      }
    };
    
    const timer = setTimeout(scrollToToday, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleScroll = () => {
    isScrollingRef.current = true;
    if (!containerRef.current) return;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;
    
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
          const middleDate = week[3].date;
          const targetYear = middleDate.getFullYear();
          const targetMonth = middleDate.getMonth();

          if (
            !lastNotifiedMonth.current ||
            lastNotifiedMonth.current.year !== targetYear ||
            lastNotifiedMonth.current.month !== targetMonth
          ) {
            lastNotifiedMonth.current = { year: targetYear, month: targetMonth };
            onVisibleMonthChange(targetYear, targetMonth);
          }
        }
      }
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

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
          const firstDayOfMonth = week.find(day => day.dayOfMonth === 1);
          const hasDivider = !!firstDayOfMonth;
          const dividerMonthName = firstDayOfMonth ? `${firstDayOfMonth.date.getMonth() + 1}月` : '';
          const containsDates = week.map(d => d.dateString);

          return (
            <React.Fragment key={weekId}>
              {hasDivider && (
                <div className="month-divider-line">
                  <span className="month-divider-label">{dividerMonthName}</span>
                </div>
              )}
              
              <div 
                className={`calendar-week ${isFocused ? 'focused' : ''}`}
                data-week-id={weekId}
                data-week-index={weekIndex}
                data-contains-date={containsDates.join(',')}
                style={{
                  '--focus-height-multiplier': settings.focusSize,
                } as React.CSSProperties}
              >
                {week.map((day) => {
                  const dayEvents = getEventsForDate(day.dateString);
                  const isSelected = selectedDate === day.dateString;
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
                      <span className="day-num">
                        {day.monthLabel ? day.monthLabel : day.dayOfMonth}
                      </span>

                      {isFocused ? (
                        <div className="day-events-focused">
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
                                    // 【修正】TypeScript エラーの原因となる (e) と不要な onClick 自体を削除
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
                              // 【修正】同じく不要な引数 (e) と onClick を削除
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