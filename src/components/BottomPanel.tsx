import React, { useState, useRef, useEffect } from 'react';
import type { CalendarEvent } from '../utils/googleCalendar';
import { Plus, Edit2, X } from 'lucide-react';

interface BottomPanelProps {
  isOpen: boolean;
  selectedDate: string | null;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddEventClick: (date: string, timeSlotIdx: number | null) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  isOpen,
  selectedDate,
  events,
  onClose,
  onEventClick,
  onAddEventClick,
}) => {
  // --- ドラッグによる高さ調整のロジックを追加 ---
  const [panelHeight, setPanelHeight] = useState<string>('35vh');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // パネルが開いたときにデフォルトの高さ（35vh）にリセット
  useEffect(() => {
    if (isOpen) {
      setPanelHeight('35vh');
    }
  }, [isOpen, selectedDate]);

  if (!selectedDate) return null;

  // ドラッグ開始
  const handleDragStart = (clientY: number) => {
    if (!panelRef.current) return;
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartHeight.current = panelRef.current.getBoundingClientRect().height;
  };

  // ドラッグ中
  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const deltaY = dragStartY.current - clientY; // 上に引っ張るとプラスになる
    const newHeight = dragStartHeight.current + deltaY;

    // 画面の高さに対する制限（最小: 20vh相当、最大: 画面の高さの90%）
    const minHeight = window.innerHeight * 0.2;
    const maxHeight = window.innerHeight * 0.9;

    const boundedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    setPanelHeight(`${boundedHeight}px`);
  };

  // ドラッグ終了
  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // 指やマウスを離した際、中途半端な位置ならキリの良い高さにスナップさせる（お好みで調整可能）
    if (panelRef.current) {
      const currentPx = panelRef.current.getBoundingClientRect().height;
      // 画面の70%以上まで引き上げられていたら、最大化(85vh)にスナップ
      if (currentPx > window.innerHeight * 0.6) {
        setPanelHeight('85vh');
      } else if (currentPx < window.innerHeight * 0.28) {
        // あまりに下に引っ張られたら閉じる
        onClose();
      } else {
        // それ以外は通常の高さに戻すか、そのままで維持（ここではそのまま or 35vh）
        // 予定が多い場合は伸ばした位置で維持した方が使いやすいため、35vhより高ければそのまま保持します
        if (currentPx < window.innerHeight * 0.4) {
          setPanelHeight('35vh');
        }
      }
    }
  };

  // Filter events for this day
  const dayEvents = events.filter(e => e.start.substring(0, 10) === selectedDate);

  // Format event start/end time
  const formatTimeRange = (event: CalendarEvent) => {
    if (event.allDay) return '終日';
    try {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const startStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      const endStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      return `${startStr}～${endStr}`;
    } catch {
      return '';
    }
  };

  const eventCount = dayEvents.length;
  const renderedElements: React.ReactNode[] = [];

  // Populate events
  dayEvents.forEach((event) => {
    renderedElements.push(
      <div 
        key={`event-${event.id}`} 
        className="panel-event-row"
        onClick={() => onEventClick(event)}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
          <span className="panel-event-time">{formatTimeRange(event)}</span>
          <span className="panel-event-title">{event.title}</span>
        </div>
        <Edit2 size={16} style={{ color: 'var(--text-secondary)', marginLeft: 8 }} />
      </div>
    );
  });

  // Calculate empty slots needed
  let emptySlotsCount = 0;
  if (eventCount === 0) {
    emptySlotsCount = 3;
  } else if (eventCount === 1) {
    emptySlotsCount = 2;
  } else if (eventCount === 2) {
    emptySlotsCount = 1;
  } else {
    emptySlotsCount = 1;
  }

  // Populate empty slots
  for (let i = 0; i < emptySlotsCount; i++) {
    const slotIdx = eventCount + i;
    const timeSlotHint = slotIdx < 5 ? slotIdx : null;
    
    renderedElements.push(
      <div 
        key={`empty-${i}`} 
        className="panel-empty-row"
        onClick={() => onAddEventClick(selectedDate, timeSlotHint)}
      >
        <Plus size={16} style={{ marginRight: 6 }} />
        予定を追加
      </div>
    );
  }

  const formattedDateLabel = (() => {
    try {
      const d = new Date(selectedDate);
      const days = ['日', '月', '火', '水', '木', '金', '土'];
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
    } catch {
      return selectedDate;
    }
  })();

  return (
    <div 
      ref={panelRef}
      className={`bottom-panel-container ${isOpen ? 'active' : ''}`}
      style={{ 
        height: isOpen ? panelHeight : '0px',
        // ドラッグ中はアニメーション（transition）を切ることで、指に吸い付くように追従させます
        transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div className="bottom-panel">
        {/* ドラッグハンドル部分にイベントをバインド */}
        <div 
          className="panel-drag-handle" 
          style={{ cursor: 'ns-resize', padding: '8px 0', margin: '0 auto' }} 
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          onMouseDown={(e) => handleDragStart(e.clientY)}
          onMouseMove={(e) => {
            if (isDragging) handleDragMove(e.clientY);
          }}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        />
        
        <div className="panel-header">
          <span className="panel-date-title">{formattedDateLabel}</span>
          <button onClick={onClose} className="icon-btn" aria-label="閉じる">
            <X size={20} style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>

        <div className="panel-body">
          {eventCount === 0 && (
            <div className="panel-no-events-text">予定がありません</div>
          )}
          {renderedElements}
        </div>
      </div>
    </div>
  );
};