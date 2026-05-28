import React, { useState, useEffect } from 'react';
import type { CalendarEvent } from '../utils/googleCalendar';
import { Trash2, Copy, X, Check } from 'lucide-react'; // ★ Check アイコンを追加

interface EventFormProps {
  event: CalendarEvent | null;
  initialDate: string; // YYYY-MM-DD
  initialTimeSlot: number | null; // 0-4 (from focused slots) or hour (from week view)
  onSave: (eventData: Omit<CalendarEvent, 'id'> & { id?: string }) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
  onDuplicate: (event: CalendarEvent) => void;
}

export const EventForm: React.FC<EventFormProps> = ({
  event,
  initialDate,
  initialTimeSlot,
  onSave,
  onDelete,
  onCancel,
  onDuplicate,
}) => {
  const [memo, setMemo] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setMemo(event.memo || '');
      setAllDay(event.allDay);
      
      const startDateTime = new Date(event.start);
      const endDateTime = new Date(event.end);
      
      if (event.allDay) {
        setStartDate(event.start.substring(0, 10));
        setEndDate(event.end.substring(0, 10));
        setStartTime('00:00');
        setEndTime('00:00');
      } else {
        setStartDate(formatLocalDateString(startDateTime));
        setStartTime(formatLocalTimeString(startDateTime));
        setEndDate(formatLocalDateString(endDateTime));
        setEndTime(formatLocalTimeString(endDateTime));
      }
    } else {
      setTitle('');
      setMemo('');
      setAllDay(false);
      setStartDate(initialDate);
      setEndDate(initialDate);
      
      if (initialTimeSlot !== null) {
        if (initialTimeSlot >= 0 && initialTimeSlot <= 4) {
          const slotTimes = [
            { start: '08:00', end: '08:50' },
            { start: '10:00', end: '11:00' },
            { start: '13:00', end: '14:00' },
            { start: '16:00', end: '17:00' },
            { start: '19:00', end: '20:00' }
          ];
          setStartTime(slotTimes[initialTimeSlot].start);
          setEndTime(slotTimes[initialTimeSlot].end);
        } else {
          const startHourStr = String(initialTimeSlot).padStart(2, '0');
          const endHourStr = String((initialTimeSlot + 1) % 24).padStart(2, '0');
          setStartTime(`${startHourStr}:00`);
          setEndTime(`${endHourStr}:00`);
        }
      } else {
        const now = new Date();
        const currentHour = now.getHours();
        const startHourStr = String((currentHour + 1) % 24).padStart(2, '0');
        const endHourStr = String((currentHour + 2) % 24).padStart(2, '0');
        setStartTime(`${startHourStr}:00`);
        setEndTime(`${endHourStr}:00`);
      }
    }
  }, [event, initialDate, initialTimeSlot]);

  const formatLocalDateString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatLocalTimeString = (d: Date): string => {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  // 共通のバリデーション・保存ロジックを関数化
  const executeSave = () => {
    if (!title.trim()) {
      alert('タイトルを入力してください。');
      return;
    }

    let startIso = '';
    let endIso = '';

    if (allDay) {
      startIso = startDate;
      endIso = endDate;
    } else {
      startIso = new Date(`${startDate}T${startTime}`).toISOString();
      endIso = new Date(`${endDate}T${endTime}`).toISOString();
      
      if (new Date(startIso) >= new Date(endIso)) {
        alert('終了日時は開始日時より後に設定してください。');
        return;
      }
    }

    onSave({
      id: event?.id,
      title: title.trim(),
      start: startIso,
      end: endIso,
      allDay,
      memo: memo.trim(),
      googleEventId: event?.googleEventId,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave();
  };

  const handleDuplicateClick = () => {
    if (event) {
      onDuplicate(event);
    } else {
      let startIso = '';
      let endIso = '';
      if (allDay) {
        startIso = startDate;
        endIso = endDate;
      } else {
        startIso = new Date(`${startDate}T${startTime}`).toISOString();
        endIso = new Date(`${endDate}T${endTime}`).toISOString();
      }
      onDuplicate({
        id: 'temp-' + Date.now(),
        title: title.trim() || '(タイトルなし)',
        start: startIso,
        end: endIso,
        allDay,
        memo: memo.trim(),
      });
    }
  };

  return (
    <div className="fullscreen-overlay active" onClick={onCancel}>
      <div className="fullscreen-event-content" onClick={(e) => e.stopPropagation()}>
        
        {/* ヘッダー領域：右上のアイコンを ☑ ボタン（保存）に変更 */}
        <div 
          className="fullscreen-header" 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <span className="fullscreen-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
            {event ? '予定の編集' : '予定の追加'}
          </span>
          <button 
            type="button" 
            onClick={executeSave} // ★ クリック時に保存を実行
            className="icon-btn" 
            aria-label="保存する"
            style={{ color: 'var(--accent-color)' }} // アクセントカラーで目立たせる
          >
            <Check size={24} />
          </button>
        </div>

        <div className="fullscreen-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="event-title">タイトル</label>
              <input
                id="event-title"
                type="text"
                className="form-input"
                placeholder="タイトルを入力してください"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="event-memo">メモ</label>
              <textarea
                id="event-memo"
                className="form-textarea"
                placeholder="メモを入力してください"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>
            
            <div className="form-group-row">
              <span className="form-label">終日</span>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={allDay} 
                  onChange={(e) => setAllDay(e.target.checked)} 
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">開始日時</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="date" 
                  className="form-input" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
                {!allDay && (
                  <input 
                    type="time" 
                    className="form-input" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)} 
                  />
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">終了日時</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="date" 
                  className="form-input" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
                {!allDay && (
                  <input 
                    type="time" 
                    className="form-input" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)} 
                  />
                )}
              </div>
            </div>
            
            {/* ボタン配置：既存の保存を残しつつ、右端に閉じるボタンを追加 */}
            <div className="button-row">
              {event && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => onDelete(event.id)}
                >
                  <Trash2 size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  削除
                </button>
              )}

              <button
                type="button"
                className="btn btn-duplicate"
                onClick={handleDuplicateClick}
              >
                <Copy size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                複製
              </button>

              <button type="submit" className="btn btn-primary">
                保存
              </button>

              {/* ★ 新設：右下の「× 閉じる」ボタン */}
              <button
                type="button"
                className="btn btn-secondary btn-close-footer"
                onClick={onCancel}
              >
                <X size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                閉じる
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};