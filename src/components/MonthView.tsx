// ─── MonthView.tsx ───

interface MonthViewProps {
  weeks: any[][];
  events: any[];
  selectedDate: string | null;
  focusedWeekId: string | null; // これを「基準となる週のID」として扱います
  settings: {
    textSize: string;
    focusSize: number;
    weekStart: 'monday' | 'sunday';
    themeColor: string;
    focusBefore: number; // 追加
    focusAfter: number;  // 追加
  };
  onSelectDay: (dateString: string, weekStartDate: string) => void;
  onVisibleMonthChange: (year: number, month: number) => void;
  duplicateMode: boolean;
  onPasteDuplicate: (targetDateString: string) => Promise<void>;
}

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
  
  // ── 既存の ref や useEffect、handleScroll はそのまま ──

  // ★ 追加：現在フォーカスすべき週のインデックス一覧を計算する
  const getFocusedWeekIndices = (): number[] => {
    if (!focusedWeekId) return [];
    
    // 基準週のインデックスを探す
    const baseIndex = weeks.findIndex(w => w[0]?.dateString === focusedWeekId);
    if (baseIndex === -1) return [];

    const indices: number[] = [];
    const start = baseIndex - settings.focusBefore;
    const end = baseIndex + settings.focusAfter;

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
          
          // ★ 修正：現在の週インデックスが、フォーカス範囲に含まれているか判定
          const isWeekFocused = focusedWeekIndices.includes(weekIndex);
          
          const containsDates = week.map((d: any) => d.dateString).join(',');

          return (
            <div
              key={weekIndex}
              className={`calendar-week ${isWeekFocused ? 'focused' : ''}`} // 範囲内なら focused になる
              data-week-id={weekStartDateStr}
              data-week-index={weekIndex}
              data-contains-date={containsDates}
              style={{
                '--focus-height-multiplier': settings.focusSize,
              } as React.CSSProperties}
            >
              {/* 週の中身（day.map...）の処理は1行も変えずにそのままで動作します */}
              {week.map((dayObj: any) => {

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
                  // ① 上線の判定：
                  //    a) 1日のセル → 確実に上側が別月なので上線を引く
                  //    b) 7日前（真上のセル）が別月 → 上線を引く
                  if (dayOfMonth === 1) {
                    borderClasses += ' border-top-thick';
                  } else {
                    const sevenDaysAgo = new Date(year, month, dayOfMonth - 7);
                    if (sevenDaysAgo.getMonth() !== month) {
                      borderClasses += ' border-top-thick';
                    }
                  }

                  // ② 左線の判定：
                  //    1日のセルが週の途中（週始まり曜日でない位置）にある場合のみ左線を引く
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
                      /* ── 通常週（未フォーカス）：コンパクトに2件まで表示 ── */
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