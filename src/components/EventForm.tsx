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
    <div className="fullscreen-overlay active">
      <div className="fullscreen-header">
        <button onClick={onCancel} className="icon-btn" aria-label="キャンセル">
          <X size={24} />
        </button>
        <span className="fullscreen-title">
          {event ? '予定の編集' : '予定の追加'}
        </span>
        <button onClick={handleSubmit} className="icon-btn" aria-label="保存" style={{ color: 'var(--accent-color)' }}>
          <Check size={24} />
        </button>
      </div>

      <div className="fullscreen-body">
        <form onSubmit={handleSubmit}>
          {/* MEMO Field First (Crucial Requirement) */}
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

          <div className="form-group">
            <label className="form-label" htmlFor="event-title">タイトル</label>
            <input
              id="event-title"
              type="text"
              className="form-input"
              placeholder="タイトルを入力してください"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
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
            <label className="form-label" htmlFor="event-start-date">開始日</label>
            <input
              id="event-start-date"
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (new Date(e.target.value) > new Date(endDate)) {
                  setEndDate(e.target.value);
                }
              }}
            />
          </div>

          {!allDay && (
            <div className="form-group">
              <label className="form-label" htmlFor="event-start-time">開始時刻</label>
              <input
                id="event-start-time"
                type="time"
                className="form-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="event-end-date">終了日</label>
            <input
              id="event-end-date"
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>

          {!allDay && (
            <div className="form-group">
              <label className="form-label" htmlFor="event-end-time">終了時刻</label>
              <input
                id="event-end-time"
                type="time"
                className="form-input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          )}

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
  );
};
