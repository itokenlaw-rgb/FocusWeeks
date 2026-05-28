import React, { useRef, useEffect } from 'react';
import type { CalendarEvent } from '../utils/googleCalendar';

interface MonthViewProps {
  weeks: any[][];
  events: CalendarEvent[];
  selectedDate: string | null;
  focusedWeekId: string | null; 
  // 👇 ここを新構造の Settings 型（あるいはSettingsViewからimport）に合わせます
  settings: {
    textSize: string;
    focusSize: number;
    weekStart: 'monday' | 'sunday';
    themeColor: string;
    focusSize3: { before: number; after: number }; // 追加
    focusSize5: { before: number; after: number }; // 追加
  };
  onSelectDay: (dateString: string, weekStartDate: string) => void;
  onVisibleMonthChange: (year: number, month: number) => void;
  duplicateMode: boolean;
  onPasteDuplicate: (targetDateString: string) => Promise<void>;
}

// 予定の時間からどのスロットに配置するかを決定するヘルパー関数
const getEventSlotIndex = (event: CalendarEvent): number => {
  if (event.allDay) return 0;
  try {
    const date = new Date(event.start);
    const hour = date.getHours();
    if (hour < 9) return 0;       // 9時前
    if (hour < 12) return 1;      // 9時〜12時
    if (hour < 15) return 2;      // 12時〜15時
    if (hour < 18) return 3;      // 15時〜18時
    return 4;                     // 18時以降
  } catch {
    return 0;
  }
};

// 予定の時間をフォーマットするヘルパー関数
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
  onPasteDuplicate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 起動時、またはfocusedWeekIdが変化した時にフォーカス週をスクロール表示する処理
  useEffect(() => {
    if (focusedWeekId && containerRef.current) {
      const targetEl = containerRef.current.querySelector(`[data-week-id="${focusedWeekId}"]`);
      if (targetEl) {
        targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [focusedWeekId]);

  // スクロール時に見えている年月のラベルを親コンポーネントへ伝える処理
  const handleScroll = () => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const containerCenter = container.getBoundingClientRect().top + container.clientHeight / 2;

    // 画面中央に位置する週の要素を見つける
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
        // その週の真ん中の日(4番目の要素)を基準にする
        const midDateStr = dates[3] || dates[0];
        const midDate = new Date(midDateStr);
        if (!isNaN(midDate.getTime())) {
          onVisibleMonthChange(midDate.getFullYear(), midDate.getMonth());
        }
      }
    }
  };

// 現在フォーカスすべき週のインデックス一覧を計算する
  const getFocusedWeekIndices = (): number[] => {
    if (!focusedWeekId) return [];
    
    // 基準週のインデックスを探す
    const baseIndex = weeks.findIndex(w => w[0]?.dateString === focusedWeekId);
    if (baseIndex === -1) return [];

    // 現在の focusSize に応じて、どの before/after 設定を使うか決定する
    const currentRange = settings.focusSize === 3 ? (settings as any).focusSize3 : (settings as any).focusSize5;
    
    // 万が一、古いLocalStorageデータ等の理由で未定義だった場合のフォールバック
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
    <div className="scroll-content" data-text-size={settings.textSize} ref={containerRef} onScroll={handleScroll}>
      <div className="month-container">
        {weeks.map((week, weekIndex) => {
          const weekStartDateStr = week[0]?.dateString || '';
          
          // 現在の週インデックスが、フォーカス範囲に含まれているか判定
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

                // 月の境目を階段状太線で強調
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

                // この日のイベント一覧
                const dayEvents = events.filter(
                  e => e.start.substring(0, 10) === dateString
                );

                return (
                  <div
                    key={dateString}
                    className={`day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isSat ? 'sat' : ''} ${isSun ? 'sun' : ''}${borderClasses}`}
                    onClick={() => {
                      onVisibleMonthChange(year, month);
                      if (duplicateMode) {
                        onPasteDuplicate(dateString);
                      } else {
                        onSelectDay(dateString, weekStartDateStr);
                      }
                    }}
                  >
                    {/* 日付数字 */}
                    <div className="day-num">
                      {(() => {
                        if (dateString === '2026-06-29') return '29';
                        if (dayOfMonth === 1) return `${month + 1}月1日`;
                        return dayOfMonth;
                      })()}
                    </div>

                    {/* フォーカス週：時間スロット5分割で表示 */}
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
                              {visibleEvents.map(event => (
                                <div
                                  key={event.id}
                                  className="focused-event"
                                  title={`${formatEventTime(event)} ${event.title}`}
                                  style={{
                                    WebkitLineClamp: lineClamp,
                                    maxHeight: `${lineClamp * 1.2}em`, 
                                  }}
                                >
                                  {event.title}
                                </div>
                              ))}
                              
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
                      /* 通常週（未フォーカス）：コンパクトに2件まで表示 */
                      <div className="day-events-compact">
                        {dayEvents.slice(0, 2).map((event: any) => (
                          <div
                            key={event.id}
                            className="compact-event"
                            title={event.title}
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
          );
        })}
      </div>
    </div>
  );
};