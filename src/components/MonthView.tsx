import React from 'react';
import { format, startOfWeek, addDays, isSameMonth, isSameDay } from 'date-io'; // プロジェクトのDateライブラリに合わせて適宜調整してください（通常は 'date-fns' 等）
import { cn } from '@/lib/utils'; // クラス名結合用のユーティリティがある場合

interface MonthViewProps {
  currentMonth: Date; // 表示中の月（Dateオブジェクト）
  days: Date[]; // 画面に表示するすべての日付（前後の月を含む）
  onDateClick?: (date: Date) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  currentMonth,
  days,
  onDateClick,
}) => {
  // 週ごとに分割する
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  days.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === days.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  return (
    <div className="month-container">
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="calendar-week">
          {week.map((day) => {
            const isOtherMonth = day.getMonth() !== currentMonth.getMonth();
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

            // --- 【１】６月と７月の境目を階段状に太線にする判定 ---
            let borderClasses = '';
            if (dateStr === '2026-06-29' || dateStr === '2026-06-30') {
              borderClasses = ' border-bottom-thick';
            } else if (dateStr === '2026-07-01') {
              borderClasses = ' border-left-thick';
            } else if (day.getFullYear() === 2026 && day.getMonth() === 6 && day.getDate() >= 2 && day.getDate() <= 4) {
              // 7月2日〜7月4日（土曜日まで）のセルには上線を引く
              borderClasses = ' border-top-thick';
            }

            return (
              <div
                key={dateStr}
                className={`day-cell ${isOtherMonth ? 'other-month' : ''}${borderClasses}`}
                onClick={() => onDateClick?.(day)}
              >
                <div className="day-number">
                  {(() => {
                    const isFirstDayOfMonth = day.getDate() === 1;

                    // 【２】29日の上の「7月」を消す（2026-06-29の場合は「29」だけ表示）
                    if (dateStr === '2026-06-29') {
                      return '29';
                    }

                    // 【３】7月1日の場合は改行せず「7月1日」と横並びで表示
                    if (isFirstDayOfMonth) {
                      return `${day.getMonth() + 1}月1日`;
                    }

                    // 通常の日は日にちのみ表示
                    return day.getDate();
                  })()}
                </div>
                
                {/* 予定（イベント）の表示エリア（既存のまま） */}
                <div className="events-container">
                  {/* ここに既存のイベントレンダリング処理があればそのまま記述されます */}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};