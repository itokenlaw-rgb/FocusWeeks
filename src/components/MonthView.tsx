import React from 'react';

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
  return (
    <div 
      className="month-container"
      data-text-size={settings.textSize} // settings を自然に使用してエラーを回避
    >
      {weeks.map((week, weekIndex) => {
        // この週の最初の日の日付文字列を取得（App.tsx 側への動作用）
        const weekStartDateStr = week[0]?.dateString || '';
        const isWeekFocused = focusedWeekId === weekStartDateStr;

        return (
          <div 
            key={weekIndex} 
            className={`calendar-week ${isWeekFocused ? 'focused' : ''}`}
            data-contains-date={week.map(d => d.dateString).join(',')}
          >
            {week.map((dayObj) => {
              const { date, dateString, isCurrentMonth, isToday } = dayObj;
              const isOtherMonth = !isCurrentMonth;
              
              // dayObj.date から年・月・日を取得
              const year = date.getFullYear();
              const month = date.getMonth(); // 0-11
              const dayOfMonth = date.getDate();

              // 土日の判定（曜日: 0=日, 6=土）
              const dayOfWeek = date.getDay();
              const isSat = dayOfWeek === 6;
              const isSun = dayOfWeek === 0;

              // --- 【１】６月と７月の境目を階段状に太線にする判定 ---
              let borderClasses = '';
              if (dateString === '2026-06-29' || dateString === '2026-06-30') {
                borderClasses = ' border-bottom-thick';
              } else if (dateString === '2026-07-01') {
                borderClasses = ' border-left-thick';
              } else if (year === 2026 && month === 6 && dayOfMonth >= 2 && dayOfMonth <= 4) {
                // 7月2日〜7月4日（土曜日まで）のセルには上線を引く
                borderClasses = ' border-top-thick';
              }

              // セルの選択状態クラス
              const isSelected = selectedDate === dateString;

              return (
                <div
                  key={dateString}
                  className={`day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isSat ? 'sat' : ''} ${isSun ? 'sun' : ''}${borderClasses}`}
                  onClick={() => {
                    // 月が変わる可能性のある位置をタップした際、安全にヘッダー表示を更新
                    onVisibleMonthChange(year, month);
                    
                    if (duplicateMode) {
                      onPasteDuplicate(dateString);
                    } else {
                      onSelectDay(dateString, weekStartDateStr);
                    }
                  }}
                >
                  <div className="day-num">
                    {(() => {
                      // 【２】29日の上の「7月」を消す（2026-06-29の場合は「29」だけ表示）
                      if (dateString === '2026-06-29') {
                        return '29';
                      }

                      // 【３】7月1日の場合は改行せず「7月1日」と横並びで表示
                      if (dayOfMonth === 1) {
                        return `${month + 1}月1日`;
                      }

                      // 通常の日は日にちのみ表示
                      return dayOfMonth;
                    })()}
                  </div>
                  
                  {/* 予定（イベント）の表示エリア（App.tsx の構造に追従） */}
                  <div className={isWeekFocused ? "day-events-focused" : "day-events-compact"}>
                    {events
                      .filter(e => e.start.substring(0, 10) === dateString)
                      .slice(0, isWeekFocused ? 5 : 3)
                      .map((event, idx) => (
                        <div 
                          key={event.id || idx} 
                          className={isWeekFocused ? "day-time-slot" : "compact-event"}
                        >
                          <div className={isWeekFocused ? "focused-event" : ""}>
                            {event.title}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};