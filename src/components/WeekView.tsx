import React, { useState, useRef, useEffect } from 'react';
import type { CalendarEvent } from '../utils/googleCalendar';

interface DayData {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfMonth: number;
}

interface WeekViewProps {
  weekDays: DayData[];
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onAddEventClick: (date: string, hour: number) => void;
  onMoveEvent: (eventId: string, newStart: string, newEnd: string) => void;
onNavigateWeek: (direction: 'prev' | 'next') => void; // 追加
}

interface DragState {
  event: CalendarEvent;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  originalStart: string;
}

export const WeekView: React.FC<WeekViewProps> = ({
  weekDays,
  events,
  onEventClick,
  onAddEventClick,
  onMoveEvent,
onNavigateWeek, // 追加
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingActiveRef = useRef(false);
  const dragDistanceRef = useRef(0);
const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleGridTouchStart = (e: React.TouchEvent) => {
    // タッチされた要素がイベントカード内（week-event-card）でない場合のみスワイプ判定を開始
    if ((e.target as HTMLElement).closest('.week-event-card')) return;

    const touch = e.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleGridTouchEnd = (e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;

    const touch = e.changedTouches[0];
    const diffX = touch.clientX - swipeStartRef.current.x;
    const diffY = touch.clientY - swipeStartRef.current.y;

    // 誤作動を防ぐための閾値設定（横に50px以上動き、かつ縦の動きの方が小さかった場合）
    const SWIPE_THRESHOLD = 50;
    if (Math.abs(diffX) > SWIPE_THRESHOLD && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        onNavigateWeek('prev'); // 右スワイプ ＝ 前の週へ
      } else {
        onNavigateWeek('next'); // 左スワイプ ＝ 次の週へ
      }
    }
    swipeStartRef.current = null;
  };
  // Scroll to 8:00 AM on initial load so the user sees business hours first
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * 60 - 20; // 8 hours * 60px - small offset
    }
  }, []);

  const getEventsForDate = (dateString: string) => {
    return events.filter(e => e.start.substring(0, 10) === dateString);
  };

  const getDayName = (date: Date): string => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
  };

  // Calculate top & height for event cards in the 24h view
  const getEventLayout = (event: CalendarEvent) => {
    if (event.allDay) {
      return {
        top: 0,
        height: 45,
        timeLabel: '終日',
        isAllDay: true,
      };
    }

    try {
      const start = new Date(event.start);
      const end = new Date(event.end);
      
      const startHour = start.getHours() + start.getMinutes() / 60;
      const endHour = end.getHours() + end.getMinutes() / 60;
      
      const top = startHour * 60;
      const height = Math.max(30, (endHour - startHour) * 60);

      const formatTime = (d: Date) => 
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      return {
        top,
        height,
        timeLabel: `${formatTime(start)}～${formatTime(end)}`,
        isAllDay: false,
      };
    } catch {
      return null;
    }
  };

  // Drag and Drop Logic
  const handleDragStart = (clientX: number, clientY: number, event: CalendarEvent) => {
    dragDistanceRef.current = 0;
    isDraggingActiveRef.current = false;
    touchStartPosRef.current = { x: clientX, y: clientY };

    // Set long press timer (350ms)
    longPressTimerRef.current = setTimeout(() => {
      isDraggingActiveRef.current = true;
      setDragState({
        event,
        startX: clientX,
        startY: clientY,
        currentX: clientX,
        currentY: clientY,
        originalStart: event.start,
      });
      // Vibrate if available for haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 350);
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (touchStartPosRef.current) {
      const dx = clientX - touchStartPosRef.current.x;
      const dy = clientY - touchStartPosRef.current.y;
      dragDistanceRef.current = Math.sqrt(dx * dx + dy * dy);

      // If they move too much before the long press completes, cancel it
      if (!isDraggingActiveRef.current && dragDistanceRef.current > 10) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
    }

    if (isDraggingActiveRef.current && dragState) {
      setDragState({
        ...dragState,
        currentX: clientX,
        currentY: clientY,
      });
    }
  };

  const handleDragEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isDraggingActiveRef.current && dragState && gridRef.current) {
      const gridRect = gridRef.current.getBoundingClientRect();
      
      // First column is time labels (50px wide)
      const timeColWidth = 50;
      const dayColWidth = (gridRect.width - timeColWidth) / 7;

      const relativeX = dragState.currentX - gridRect.left;
      const relativeY = dragState.currentY - gridRect.top;

      // Find day index based on coordinates
      let dayIdx = Math.floor((relativeX - timeColWidth) / dayColWidth);
      dayIdx = Math.max(0, Math.min(6, dayIdx));

      // Find hour (60px per hour)
      let hour = Math.floor(relativeY / 60);
      hour = Math.max(0, Math.min(23, hour));

      const targetDay = weekDays[dayIdx];
      const event = dragState.event;

      if (targetDay) {
        const start = new Date(event.start);
        const end = new Date(event.end);
        const duration = end.getTime() - start.getTime();

        const newStart = new Date(targetDay.dateString);
        newStart.setHours(hour);
        newStart.setMinutes(0);
        newStart.setSeconds(0);
        newStart.setMilliseconds(0);

        const newEnd = new Date(newStart.getTime() + duration);

        onMoveEvent(event.id, newStart.toISOString(), newEnd.toISOString());
      }
    }

    setDragState(null);
    isDraggingActiveRef.current = false;
    touchStartPosRef.current = null;
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent, event: CalendarEvent) => {
    // Only drag with left click
    if (e.button !== 0) return;
    handleDragStart(e.clientX, e.clientY, event);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent, event: CalendarEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY, event);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDraggingActiveRef.current) {
      e.preventDefault(); // Stop scrolling while dragging
    }
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Calculate visual translation for active dragging
  const getDragTranslation = (event: CalendarEvent) => {
    if (!dragState || dragState.event.id !== event.id || !gridRef.current) return null;

    const gridRect = gridRef.current.getBoundingClientRect();
    const timeColWidth = 50;
    const dayColWidth = (gridRect.width - timeColWidth) / 7;

    const dx = dragState.currentX - dragState.startX;
    const dy = dragState.currentY - dragState.startY;

    // Snap to columns and half-hour increments for feedback
    const snapX = Math.round(dx / dayColWidth) * dayColWidth;
    const snapY = Math.round(dy / 30) * 30;

    return {
      x: snapX,
      y: snapY,
    };
  };

  return (
    <div className="week-container">
      {/* Sticky header showing day names and dates */}
      <div 
        className="weekday-header"
        style={{
          display: 'grid',
          gridTemplateColumns: '50px repeat(7, 1fr)',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          zIndex: 10,
        }}
      >
        <div /> {/* Time column spacer */}

{/* 24時間グリッドのコンテナ */}
      <div 
        className="scroll-content" 
        ref={scrollRef}
        style={{ borderTop: 'none', position: 'relative' }}
        // ここにグリッド全体用のタッチイベントを追加します
        onTouchStart={handleGridTouchStart}
        onTouchEnd={handleGridTouchEnd}
      >
        <div 
          className="week-grid" 
          ref={gridRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={(e) => {
            // 既存のドラッグ終了処理を呼び出しつつ、スワイプ側の処理と干渉させない
            handleMouseUp();
          }}
        >

        {weekDays.map((day) => {
          const isSat = day.date.getDay() === 6;
          const isSun = day.date.getDay() === 0;
          return (
            <div 
              key={day.dateString}
              className={`weekday-cell ${day.isToday ? 'today' : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4px 0',
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {getDayName(day.date)}
              </span>
              <span 
                className="day-num"
                style={{
                  margin: '2px 0 0 0',
                  backgroundColor: day.isToday ? 'var(--accent-color)' : 'transparent',
                  color: day.isToday 
                    ? 'var(--bg-card)' 
                    : isSat 
                      ? 'var(--saturday-color)' 
                      : isSun 
                        ? 'var(--sunday-color)' 
                        : 'var(--text-primary)',
                }}
              >
                {day.dayOfMonth}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable 24-hour grid */}
      <div 
        className="scroll-content" 
        ref={scrollRef}
        style={{
          borderTop: 'none',
          position: 'relative',
        }}
      >
        <div 
          className="week-grid" 
          ref={gridRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Time Sidebar */}
          <div className="week-time-col">
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="week-time-label">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* 7 Columns */}
          {weekDays.map((day) => {
            const dayEvents = getEventsForDate(day.dateString);
            
            // Separate all-day events and timed events
            const allDayEvents = dayEvents.filter(e => e.allDay);
            const timedEvents = dayEvents.filter(e => !e.allDay);

            return (
              <div 
                key={day.dateString} 
                className="week-day-col"
                style={{
                  backgroundColor: day.isToday ? 'rgba(var(--accent-color), 0.02)' : 'transparent',
                }}
              >
                {/* 24 slots for direct clicking to add */}
                {Array.from({ length: 24 }).map((_, h) => (
                  <div 
                    key={h} 
                    className="week-day-hour-slot" 
                    onClick={() => {
                      // Only open add event if not finishing a drag
                      if (dragDistanceRef.current < 5) {
                        onAddEventClick(day.dateString, h);
                      }
                    }}
                  />
                ))}

                {/* Render Timed Events */}
                {timedEvents.map((event) => {
                  const layout = getEventLayout(event);
                  if (!layout) return null;

                  const isDragging = dragState?.event.id === event.id;
                  const translation = getDragTranslation(event);

                  return (
                    <div
                      key={event.id}
                      className={`week-event-card ${isDragging ? 'dragging' : ''}`}
                      style={{
                        top: layout.top,
                        height: layout.height,
                        transform: translation 
                          ? `translate(${translation.x}px, ${translation.y}px)` 
                          : 'none',
                        zIndex: isDragging ? 100 : 10,
                        touchAction: 'none', // Prevents browser scrolling during touch drag
                      }}
                      onMouseDown={(e) => handleMouseDown(e, event)}
                      onTouchStart={(e) => handleTouchStart(e, event)}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Click only if it wasn't dragged
                        if (dragDistanceRef.current < 5) {
                          onEventClick(event);
                        }
                      }}
                    >
                      <div className="week-event-card-title">{event.title}</div>
                      <div className="week-event-card-time">{layout.timeLabel}</div>
                    </div>
                  );
                })}

                {/* Render All Day Events stacked at the very top (first slot) */}
                {allDayEvents.map((event, idx) => (
                  <div
                    key={event.id}
                    className="week-event-card"
                    style={{
                      top: idx * 24 + 2,
                      height: 22,
                      backgroundColor: 'var(--accent-color)',
                      color: 'var(--bg-card)',
                      fontSize: '9px',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 15,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <div className="week-event-card-title">{event.title}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export type { DayData as WeekDayData };
