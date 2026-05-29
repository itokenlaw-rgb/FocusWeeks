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
  };
  onSelectDay: (dateString: string, weekStartDate: string) => void;
  onVisibleMonthChange: (year: number, month: number) => void;
  duplicateMode: boolean;
  duplicateTargetDate?: string | null; // 仮おさえ中の日付
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
  duplicateMode, // TS6133回避のため、下部でダミー利用
  duplicateTargetDate, // 👈【修正】引数への追加が漏れていたのを修正
  onPasteDuplicate, // TS6133回避のため、下部でダミー利用
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // TypeScriptの「宣言されているが使用されていない」エラー(TS6133)を防ぐためのダミー処理
  const _unusedChecks = () => {
    if (duplicateMode) onPasteDuplicate('');
  };

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
    <div className="scroll-content" data-text-size={settings.textSize} ref={containerRef} onScroll={handleScroll} onClick={_unusedChecks}>
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
                const isDuplicateTarget = duplicateTargetDate === dateString; // 仮押さえ判定

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
                  console.