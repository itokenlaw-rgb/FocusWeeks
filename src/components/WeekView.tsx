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
  onNavigateWeek: (direction: 'prev' | 'next') => void;
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
  onNavigateWeek,
}) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingActiveRef = useRef(false);
  const dragDistanceRef = useRef(0);
  
  // スワイプ管理用のRef
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const isSwipingRef = useRef(false);

  // ★ アニメーション制御用のStateを追加
  const [slideDirection, setSlideDirection] = useState<'none' | 'slide-out-left' | 'slide-out-right' | 'slide-in-left' | 'slide-in-right'>('none');
  // 連続スワイプによるバグを防ぐフラグ
  const isAnimatingRef = useRef(false);

  // 最外殻（week-container）または全体のタッチ開始処理
  const handleContainerTouchStart = (e: React.TouchEvent) => {
    // アニメーション中、またはドラッグ中はスワイプさせない
    if (isAnimatingRef.current || isDraggingActiveRef.current || (e.target as HTMLElement).closest('.week-event-card')) {
      return;
    }

    const touch = e.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    isSwipingRef.current = false;
  };

  // タッチ移動時の制御（縦スクロールと横スワイプの競合を防ぐ）
  const handleContainerTouchMove = (e: React.TouchEvent) => {
    if (!swipeStartRef.current || isDraggingActiveRef.current) return;

    const touch = e.touches[0];
    const diffX = touch.clientX - swipeStartRef.current.x;
    const diffY = touch.clientY - swipeStartRef.current.y;

    // 左右の動きの方が上下より大きい場合、スワイプモードとしてロックする
    if (!isSwipingRef.current && Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
      isSwipingRef.current = true;
    }

    // 横スワイプ中であれば、ブラウザの縦スクロール挙動を無効化する
    if (isSwipingRef.current) {
      if (e.cancelable) e.preventDefault();
    }
  };

  // ★ アニメーションを伴う週移動の共通処理
  const triggerWeekNavigation = (direction: 'prev' | 'next') => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    // 1. まずは現在のグリッドを画面外へスライドアウトさせる
    setSlideDirection(direction === 'next' ? 'slide-out-left' : 'slide-out-right');

    // 2. スライドアウト（200ms）が終わるタイミングでデータを切り替える
    setTimeout(() => {
      onNavigateWeek(direction);
      
      // 3. データが切り替わったら、反対側の画面外に一瞬で配置（アニメーションなし）
      setSlideDirection(direction === 'next' ? 'slide-in-right' : 'slide-in-left');
      
      // 4. 次のレンダリングを待って、画面内にスッと戻すアニメーションを発火
      requestAnimationFrame(() => {
        setTimeout(() => {
          setSlideDirection('none');
          isAnimatingRef.current = false;
        }, 20);
      });
    }, 200); // index.cssの transition 速度と合わせます
  };

  // タッチ終了時に安全に週移動をトリガー
  const handleContainerTouchEnd = (e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;

    // 予定の長押しドラッグ中だった場合はスワイプを無視
    if (isDraggingActiveRef.current) {
      swipeStartRef.current = null;
      isSwipingRef.current = false;
      return;
    }

    const touch = e.changedTouches[0];
    const diffX = touch.clientX - swipeStartRef.current.x;
    const diffY = touch.clientY - swipeStartRef.current.y;

    const SWIPE_THRESHOLD = 40; // 判定しきい値(px)
    
    if (isSwipingRef.current || (Math.abs(diffX) > SWIPE_THRESHOLD && Math.abs(diffX) > Math.abs(diffY))) {
      // ★ 共通のアニメーション付き関数を呼ぶように変更
      if (diffX > 0) {
        triggerWeekNavigation('prev');
      } else {
        triggerWeekNavigation('next');
      }
      e.stopPropagation();
    }

    swipeStartRef.current = null;
    isSwipingRef.current = false;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * 60 - 20;
    }
  }, []);

  const getEventsForDate = (dateString: string) => {
    return events.filter(e => e.start.substring(0, 10) === dateString);
  };

  const getDayName = (date: Date): string => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
  };

  const getEventLayout = (event: CalendarEvent) => {
    if (event.allDay) {
      return { top: 0, height: 45, timeLabel: '終日', isAllDay: true };
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

  const handleDragStart = (clientX: number, clientY: number, event: CalendarEvent) => {
    dragDistanceRef.current = 0;
    isDraggingActiveRef.current = false;
    touchStartPosRef.current = { x: clientX, y: clientY };

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
      const timeColWidth = 50;
      const dayColWidth = (gridRect.width - timeColWidth) / 7;

      const relativeX = dragState.currentX - gridRect.left;
      const relativeY = dragState.currentY - gridRect.top;

      let dayIdx = Math.floor((relativeX - timeColWidth) / dayColWidth);
      dayIdx = Math.max(0, Math.min(6, dayIdx));

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

  const handleMouseDown = (e: React.MouseEvent, event: CalendarEvent) => {
    if (e.button !== 0) return;
    handleDragStart(e.clientX, e.clientY, event);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  const handleTouchStart = (e: React.TouchEvent, event: CalendarEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY, event);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDraggingActiveRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  };

  const getDragTranslation = (event: CalendarEvent) => {
    if (!dragState || dragState.event.id !== event.id || !gridRef.current) return null;

    const gridRect = gridRef.current.getBoundingClientRect();
    const timeColWidth = 50;
    const dayColWidth = (gridRect.width - timeColWidth) / 7;

    const dx = dragState.currentX - dragState.startX;
    const dy = dragState.currentY - dragState.startY;

    const snapX = Math.round(dx / dayColWidth) * dayColWidth;
    const snapY = Math.round(dy / 30) * 30;

    return { x: snapX, y: snapY };
  };

  return (
    <div 
      className="week-container"
      onTouchStart={handleContainerTouchStart}
      onTouchMove={handleContainerTouchMove}
      onTouchEnd={handleContainerTouchEnd}
      style={{ touchAction: 'pan-y' }} 
    >
      {/* アニメーション用のコンテナ wrapper */}
      <div className={`week-animate-wrapper ${slideDirection}`}>
        {/* 曜日ヘッダー */}
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
          <div />
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

        {/* スクロールコンテンツエリア */}
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
            onTouchEnd={handleMouseUp}
          >
            {/* 時間軸ラベル */}
            <div className="week-time-col">
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="week-time-label">
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* 日ごと・時間スロット・イベントカードのレンダリング */}
            {weekDays.map((day) => {
              const dayEvents = getEventsForDate(day.dateString);
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
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div 
                      key={h} 
                      className="week-day-hour-slot" 
                      onClick={() => {
                        if (dragDistanceRef.current < 5 && !isSwipingRef.current) {
                          onAddEventClick(day.dateString, h);
                        }
                      }}
                    />
                  ))}

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
                          touchAction: 'none',
                        }}
                        onMouseDown={(e) => handleMouseDown(e, event)}
                        onTouchStart={(e) => handleTouchStart(e, event)}
                        onTouchMove={handleTouchMove}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (dragDistanceRef.current < 5 && !isSwipingRef.current) {
                            onEventClick(event);
                          }
                        }}
                      >
                        <div className="week-event-card-title">{event.title}</div>
                        <div className="week-event-card-time">{layout.timeLabel}</div>
                      </div>
                    );
                  })}

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
                        if (!isSwipingRef.current) {
                          onEventClick(event);
                        }
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
    </div>
  );
};

export type { DayData as WeekDayData };