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
    
    // ① 0:00 ～ 8:59 -> 1番目の枠 (index: 0)
    if (hours < 9) return 0;
    
    // ② 9:00 ～ 11:59 -> 2番目の枠 (index: 1)
    if (hours < 12) return 1;
    
    // ③ 12:00 ～ 14:59 -> 3番目の枠 (index: 2)
    if (hours < 15) return 2;
    
    // ④ 15:00 ～ 17:59 -> 4番目の枠 (index: 3)
    if (hours < 18) return 3;
    
    // ⑤ 18:00 ～ 23:59 -> 5番目の枠 (index: 4)
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
const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); 
  
  // 無限ループ・過剰な親への通知を防ぐため、最後に通知した年月を記録
  const lastNotifiedMonth = useRef<{ year: number; month: number } | null>(null);

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

  // Scroll to today's week on initial mount so it appears at the top
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
    
    // Use setTimeout to ensure DOM has rendered
    const timer = setTimeout(scrollToToday, 50);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

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
          const targetYear = middleDate.getFullYear();
          const targetMonth = middleDate.getMonth();

          // 前回通知した年月と異なる場合のみ親に通知（無限ループ・負荷対策）
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

    // Reset scrolling flag after scroll stops (Using safe useRef)
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  };

  // クリーンアップ処理（コンポーネントがアンマウントされた際のタイマー解除）
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
          
          // Check if this week contains the 1st of any month
          // If so, we'll draw a thick divider above it!
          const firstDayOfMonth = week.find(day => day.dayOfMonth === 1);
          const hasDivider = !!firstDayOfMonth;
          const dividerMonthName = firstDayOfMonth 
            ? `${firstDayOfMonth.date.getMonth() + 1}月`
            : '';

          // Data attribute for search
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
      // 【修正】e.stopPropagation() と onEventClick(event) を削除し、
      // クリックしても親の day-cell (日の選択) が反応するようにします
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
      // 【修正】ここも同様に中身を空にするか、onClick 自体を削除します
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