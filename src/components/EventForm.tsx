import React, { useState, useEffect } from 'react';
import type { CalendarEvent } from '../utils/googleCalendar';
import { Trash2, Copy, X, Check } from 'lucide-react';

interface EventFormProps {
  event: CalendarEvent | null;
  initialDate: string; // YYYY-MM-DD
  initialTimeSlot: number | null;
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
      
      setStartDate(startDateTime.toISOString().substring(0, 10));
      setStartTime(`${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`);
      setEndDate(endDateTime.toISOString().substring(0, 10));
      setEndTime(`${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`);
    } else {
      setTitle('');
      setMemo('');
      setAllDay(false);
      setStartDate(initialDate);
      setEndDate(initialDate);
      
      if (initialTimeSlot !== null) {
        let hour = 9;
        if (initialTimeSlot >= 0 && initialTimeSlot < 5) {
          const slots = [9, 12, 15, 18, 21];
          hour = slots[initialTimeSlot];
        } else {
          hour = initialTimeSlot;
        }
        const formattedStart = `${String(hour).padStart(2, '0')}:00`;
        const formattedEnd = `${String((hour + 1) % 24).padStart(2, '0')}:00`;
        setStartTime(formattedStart);
        setEndTime(formattedEnd);
      } else {
        setStartTime('09:00');
        setEndTime('10:00');
      }
    }
  }, [event, initialDate, initialTimeSlot]);

  // 【１】開始時間変更時に、終了時間を自動的に1時間後にする関数
  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);

    const [hoursStr, minutesStr] = newStartTime.split(':');
    if (hoursStr && minutesStr) {
      let hours = parseInt(hoursStr, 10);
      let minutes = parseInt(minutesStr, 10);

      // 1時間進める (23時の次は00時になるよう % 24)
      hours = (hours + 1) % 24;

      const newEndTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      setEndTime(newEndTime);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    let startIso = `${startDate}T00:00:00`;
    let endIso = `${endDate}T23:59:59`;

    if (!allDay) {
      startIso = `${startDate}T${startTime}:00`;
      endIso = `${endDate}T${endTime}:00`;
    }

    onSave({
      title,
      memo,
      start: startIso,
      end: endIso,
      allDay,
      id: event?.id
    });
  };

  const handleDuplicateClick = () => {
    if (!event) return;
    onDuplicate(event);
  };

  return (
    <div className="fullscreen-overlay" onClick={onCancel}>
      <div className="fullscreen-modal-content" onClick={(e) => e.stopPropagation()}>

        {/* ヘッダー：左に×、中央にタイトル、右にチェック(保存) */}
        <div className="fullscreen-header">
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="閉じる">
            <X size={22} />
          </button>

          <span className="fullscreen-title">
            {event ? '予定の編集' : '予定の追加'}
          </span>

          <button type="button" className="icon-btn" onClick={() => handleSubmit()} aria-label="保存" style={{ color: 'var(--accent-color)' }}>
            <Check size={22} />
          </button>
        </div>

        <div className="fullscreen-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">タイトル</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="タイトルを入力"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">メモ</label>
              <textarea 
                className="form-input" 
                placeholder="メモを入力"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label">開始日時</label>
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
                    onChange={(e) => handleStartTimeChange(e.target.value)} 
                  />
                )}
              </div>

              <div className="form-group flex-1">
                <label className="form-label">終了日時</label>
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
            
{/* 【３】一番下の行：左から削除、複製、保存の並び */}
<div className="button-row" style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
  <button
    type="button"
    className="btn btn-danger"
    onClick={() => event && onDelete(event.id)}
    disabled={!event}
    style={{ 
      flex: 1, 
      padding: '8px 4px', 
      fontSize: '14px',
      whiteSpace: 'nowrap',
      opacity: event ? 1 : 0.5,
      cursor: event ? 'pointer' : 'not-allowed'
    }}
  >
    <Trash2 size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
    削除
  </button>

  <button
    type="button"
    className="btn btn-duplicate"
    onClick={handleDuplicateClick}
    style={{ flex: 1, padding: '8px 4px', fontSize: '14px', whiteSpace: 'nowrap' }}
  >
    <Copy size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
    複製
  </button>

  <button 
    type="submit" 
    className="btn btn-primary"
    style={{ flex: 1, padding: '8px 4px', fontSize: '14px', whiteSpace: 'nowrap' }}
  >
    保存
  </button>
</div>
          </form>
        </div>{/* fullscreen-body */}

      </div>{/* fullscreen-modal-content */}
    </div>
  );
};