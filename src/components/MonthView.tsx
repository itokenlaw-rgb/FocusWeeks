import React, { useRef, useEffect } from 'react';
import type { CalendarEvent } from '../utils/googleCalendar';

interface MonthViewProps {
  weeks: any[][];
  events: CalendarEvent[];
  selectedDate: string | null;
  focusedWeekId: string | null; 
  settings: {
    textSize: string;
    focusSize: number;
    weekStart: 'monday' | 'sunday';
    themeColor: string;
    focusSize3: { before: number; after: number };
    focusSize5: { before: number; after: number };
    useGoogleColors: boolean; // ★ Props型定義に追加
  };
  onSelectDay: (dateString: string, weekStartDate: string) => void;
  onVisibleMonthChange: (year: number, month: number) => void;
  duplicateMode: boolean;
  duplicateTargetDates: string[];
  onPasteDuplicate: (targetDateString: string) => Promise<void>;
}

const getEventSlotIndex = (event: CalendarEvent): number => {
  if (event.allDay) return 0;
  try {
    const date = new Date(event.start);
    const hour = date.getHours();
    if (hour < 9) return 0;       
    if (hour < 12) return 1;      
    if (hour < 15) return 2;      
    if (hour < 18) return 3;      
    return 4;                     
  } catch {
    return 0;
  }
};

const formatEventTime = (event: CalendarEvent): string => {
  if (event.allDay) return '終日';
  try {
    const d = new Date(event.start);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
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
  duplicateTargetDates, 
  onPasteDuplicate, 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const _unusedChecks = () => {
    if (duplicateMode) onPasteDuplicate('');
  };

  useEffect(() => {
    if (focusedWeekId && containerRef.current) {
      const targetEl = containerRef.current.querySelector(`[data-week-id="${focusedWeekId}"]`);
      if (targetEl) {
        targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [focusedWeekId]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const containerCenter = container.getBoundingClientRect().top + container.clientHeight / 2;

    const weekElements = container.querySelectorAll('.calendar-week');
    let currentWeekEl: Element | null = null;

    for (let i = 0; i < weekElements.length; i++) {
      const rect = weekElements[i].getBoundingClientRect();
      if (rect.top <= containerCenter && rect.bottom >= containerCenter) {
        currentWeekEl = weekElements[i];
        break;
      }
    }

    if (currentWeekEl) {
      const containsDatesAttr = currentWeekEl.getAttribute('data-contains-date');
      if (containsDatesAttr) {
        const dates = containsDatesAttr.split(',');
        const midDateStr = dates[3] || dates[0];
        const midDate = new Date(midDateStr);
        if (!isNaN(midDate.getTime())) {
          onVisibleMonthChange(midDate.getFullYear(), midDate.getMonth());
        }
      }
    }
  };

  const getFocusedWeekIndices = (): number[] => {
    if (!focusedWeekId) return [];
    
    const baseIndex = weeks.findIndex(w => w[0]?.dateString === focusedWeekId);
    if (baseIndex === -1) return [];

    const currentRange = settings.focusSize === 3 ? (settings as any).focusSize3 : (settings as any).focusSize5;
    
    const focusBefore = currentRange ? currentRange.before : 0;
    const focusAfter = currentRange ? currentRange.after : 0;

    const indices: number[] = [];
    const start = baseIndex - focusBefore;
    const end = baseIndex + focusAfter;

    for (let i = start; i <= end; i++) {
      if (i >= 0 && i < weeks.length) {
        indices.push(i);
      }
    }
    return indices;
  };

  const focusedWeekIndices = getFocusedWeekIndices();

  return (
    <div className="scroll-content" data-text-size={settings.textSize} ref={containerRef} onScroll={handleScroll} onClick={_unusedChecks}>
      <div className="month-container">
        {weeks.map((week, weekIndex) => {
          const weekStartDateStr = week[0]?.dateString || '';
          const isWeekFocused = focusedWeekIndices.includes(weekIndex);
          const containsDates = week.map((d: any) => d.dateString).join(',');

          return (
            <div
              key={weekIndex}
              className={`calendar-week ${isWeekFocused ? 'focused' : ''}`}
              data-week-id={weekStartDateStr}
              data-week-index={weekIndex}
              data-contains-date={containsDates}
              style={{
                '--focus-height-multiplier': settings.focusSize,
              } as React.CSSProperties}
            >
              {week.map((dayObj: any) => {
                const { date, dateString, isCurrentMonth, isToday } = dayObj;
                const isOtherMonth = !isCurrentMonth;

                const year       = date.getFullYear();
                const month      = date.getMonth(); 
                const dayOfMonth = date.getDate();
                const dayOfWeek  = date.getDay();
                const isSat      = dayOfWeek === 6;
                const isSun      = dayOfWeek === 0;
                const isSelected = selectedDate === dateString;
                const isDuplicateTarget = duplicateTargetDates.includes(dateString);

                let borderClasses = '';
                try {
                  if (dayOfMonth === 1) {
                    borderClasses += ' border-top-thick';
                  } else {
                    const sevenDaysAgo = new Date(year, month, dayOfMonth - 7);
                    if (sevenDaysAgo.getMonth() !== month) {
                      borderClasses += ' border-top-thick';
                    }
                  }

                  if (dayOfMonth === 1) {
                    const isWeekStart =
                      (settings.weekStart === 'sunday' && dayOfWeek === 0) ||
                      (settings.weekStart === 'monday' && dayOfWeek === 1);
                    if (!isWeekStart) {
                      borderClasses += ' border-left-thick';
                    }
                  }
                } catch (e) {
                  console.error(e);
                }

                const dayEvents = events.filter(
                  e => e.start.substring(0, 10) === dateString
                );

                return (
                  <div
                    key={dateString}
                    className={`day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isDuplicateTarget ? 'duplicate-selected' : ''} ${isSat ? 'sat' : ''} ${isSun ? 'sun' : ''}${borderClasses}`}
                    onClick={() => {
                      onVisibleMonthChange(year, month);
                      onSelectDay(dateString, weekStartDateStr);
                    }}
                  >
                    <div className="day-num">
                      {dayOfMonth === 1 ? `1日` : dayOfMonth}
                    </div>

                    {isWeekFocused ? (
                      <div
                        className="day-events-focused"
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 'calc(100% - 24px)' }}
                      >
                        {Array.from({ length: 5 }).map((_, slotIdx) => {
                          const slotEvents = dayEvents.filter(
                            e => getEventSlotIndex(e) === slotIdx
                          );

                          let lineClamp = 3; 
                          let maxVisibleEvents = 1; 

                          if (settings.focusSize === 5) {
                            maxVisibleEvents = slotEvents.length; 
                            
                            if (slotEvents.length === 1) {
                              lineClamp = 4; 
                            } else if (slotEvents.length === 2) {
                              lineClamp = 2; 
                            } else if (slotEvents.length >= 3) {
                              lineClamp = 1; 
                            }
                          }

                          const visibleEvents = slotEvents.slice(0, maxVisibleEvents);

                          return (
                            <div 
                              key={slotIdx} 
                              className="day-time-slot"
                              style={{ flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}
                            >
                              {visibleEvents.map(event => {
                                // ★ 正しいJavaScript実行可能領域で変数を定義
                                const colorClass = settings.useGoogleColors && event.colorId ? `gcal-color-${event.colorId}` : '';
                                return (
                                  <div
                                    key={event.id}
                                    className={`focused-event ${colorClass}`}
                                    title={`${formatEventTime(event)} ${event.title}`}
                                    style={{
                                      WebkitLineClamp: lineClamp,
                                      maxHeight: `${lineClamp * 1.2}em`, 
                                    }}
                                  >
                                    {event.title}
                                  </div>
                                );
                              })}
                              
                              {settings.focusSize === 3 && slotEvents.length > 1 && (
                                <span style={{ fontSize: '8px', color: 'var(--text-secondary)', alignSelf: 'flex-end', position: 'absolute', right: 2, bottom: 2 }}>
                                  +{slotEvents.length - 1}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="day-events-compact">
                        {dayEvents.slice(0, 2).map((event: any) => {
                          const colorClass = settings.useGoogleColors && event.colorId ? `gcal-color-${event.colorId}` : '';
                          return (
                            <div
                              key={event.id}
                              className={`compact-event ${colorClass}`}
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          );
                        })}
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
          );
        })}
      </div>
    </div>
  );
};