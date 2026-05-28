import React, { useRef, useEffect } from 'react';

// App.tsx から渡されるすべてのプロパティと型を完全に一致させます
interface MonthViewProps {
  weeks: any[][];
  events: any[];
  selectedDate: string | null;
  focusedWeekId: string | null;
  settings: {
    textSize: string;
    focusSize: number;
    weekStart: 'monday' | 'sunday';
    themeColor: string;
  };
  onSelectDay: (dateString: string, weekStartDate: string) => void;
  onVisibleMonthChange: (year: number, month: number) => void;
  duplicateMode: boolean;
  onPasteDuplicate: (targetDateString: string) => Promise<void>;
}

// ── イベントを時間帯別に5スロットへ振り分ける ──────────────────────────────
// スロット: 0=深夜〜9時前, 1=9〜12時, 2=12〜15時, 3=15〜18時, 4=18時以降
// 終日イベントはスロット0に配置
const getEventSlotIndex = (event: any): number => {
  if (event.allDay) return 0;
  try {
    const hours = new Date(event.start).getHours();
    if (hours < 9)  return 0;
    if (hours < 12) return 1;
    if (hours < 15) return 2;
    if (hours < 18) return 3;
    return 4;
  } catch {
    return 0;
  }
};

// ── イベントの開始時刻を "HH:MM"（終日は "終日"）で返す ────────────────────
const formatEventTime = (event: any): string => {
  if (event.allDay) return '終日';
  try {
    const d = new Date(event.start);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
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
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNotifiedMonth = useRef<{ year: number; month: number } | null>(null);

  // ── 初期表示時に「今日」の週へ自動スクロール ───────────────────────────────
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

  // ── クリーンアップ ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // ── スクロール中、画面中央の週から表示月を検出して通知 ───────────────────
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
          const middleDate: Date = week[3].date;
          const targetYear  = middleDate.getFullYear();
          const targetMonth = middleDate.getMonth();

          if (
            !lastNotifiedMonth.current ||
            lastNotifiedMonth.current.year  !== targetYear ||
            lastNotifiedMonth.current.month !== targetMonth
          ) {
            lastNotifiedMonth.current = { year: targetYear, month: targetMonth };
            onVisibleMonthChange(targetYear, targetMonth);
          }
        }
      }
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  };

  return (
    <div
      className="scroll-content"
      data-text-size={settings.textSize}
      ref={containerRef}
      onScroll={handleScroll}
    >
      <div className="month-container">
        {weeks.map((week, weekIndex) => {
          const weekStartDateStr = week[0]?.dateString || '';
          const isWeekFocused   = focusedWeekId === weekStartDateStr;
          const containsDates   = week.map((d: any) => d.dateString).join(',');

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
                const month      = date.getMonth(); // 0-11
                const dayOfMonth = date.getDate();
                const dayOfWeek  = date.getDay();
                const isSat      = dayOfWeek === 6;
                const isSun      = dayOfWeek === 0;
                const isSelected = selectedDate === dateString;

// ── 月の境目を階段状太線で強調（月曜始まり・日曜始まり両対応） ──
                let borderClasses = '';
                
                try {
                  // 1. 下線の判定：明日になったら月が変わる（月末日）なら、セルの下に太線
                  const tomorrow = new Date(year, month, dayOfMonth + 1);
                  if (tomorrow.getMonth() !== month) {
                    borderClasses += ' border-bottom-thick';
                  }

                  // 2. 左線の判定：1日（月初）の場合、左側に太線
                  // ※ただし、1日が週の先頭（月曜）の場合はカレンダーの外枠とかぶるので引かない、とする場合は「&& dayOfWeek !== 1」を足してください
                  if (dayOfMonth === 1) {
                    borderClasses += ' border-left-thick';
                  }

                  // 3. 上線の判定：自分が「新月（翌月）」のエリアに入っており、かつ「1日の曜日」に追いつくまでの間
                  // つまり、1日より左側にある「翌月の数日間」の上側に太線を引く
                  if (!isCurrentMonth && date > new Date(year, month, 1)) {
                    // 月曜始まりの場合、1日の前日（月末）がその週のどこにあるかで上線を引く範囲が決まります
                    // ここではシンプルに「今見ているセルの月」が、カレンダー上の当月より未来（翌月）であれば上線を引く
                    borderClasses += ' border-top-thick';
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

                    {/* ── フォーカス週：時間スロット5分割で表示 ── */}
                    {isWeekFocused ? (
                      <div
                        className="day-events-focused"
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 'calc(100% - 24px)' }}
                      >
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
                      /* ── 通常週：コンパクト表示（最大3件） ── */
                      <div className="day-events-compact">
                        {dayEvents.slice(0, 3).map((event, idx) => (
                          <div
                            key={event.id || idx}
                            className="compact-event"
                            title={`${formatEventTime(event)} ${event.title}`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="compact-event-more">
                            他 {dayEvents.length - 3} 件
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
