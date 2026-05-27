import React, { useState, useEffect } from 'react';
import type { CalendarEvent } from '../utils/googleCalendar';
import { X, Copy, Trash2, Check } from 'lucide-react';

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
        // Date-only string or ISO date part
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
      
      // Determine default times based on time slot if available
      if (initialTimeSlot !== null) {
        if (initialTimeSlot >= 0 && initialTimeSlot <= 4) {
          // Focused 5 time periods:
          // 0: 0:00 - 8:59, 1: 9:00 - 11:59, 2: 12:00 - 14:59, 3: 15:00 - 17:59, 4: 18:00 - 23:59
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
          // Hour (0-23) passed from WeekView
          const startHourStr = String(initialTimeSlot).padStart(2, '0');
          const endHourStr = String((initialTimeSlot + 1) % 24).padStart(2, '0');
          setStartTime(`${startHourStr}:00`);
          setEndTime(`${endHourStr}:00`);
        }
      } else {
        // Default time
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleDuplicateClick = () => {
    if (event) {
      onDuplicate(event);
    } else {
      // If creating new but want to duplicate the current form inputs
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
      {/* 内枠コンテナを追加し、横幅いっぱいのクラスを付与。内側のタップイベント伝播を防止 */}
<div className="fullscreen-event-content" onClick={(e) => e.stopPropagation()}>
  
  {/* ヘッダーを丸ごと削除 */}        
<div className="fullscreen-body">
          <form onSubmit={handleSubmit}>
            {/* --- 既存のフォームの中身（MEMOフィールド、タイトル等）はそのまま --- */}
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
            
            {/* ... (中略、残りのフォーム項目は元のコードのまま) ... */}
            
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
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};
