import React, { useState, useEffect } from 'react';
import type { CalendarEvent } from '../utils/googleCalendar';
import { Trash2, Copy, X } from 'lucide-react'; // 【修正】使われていない Check を削

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
        // initialTimeSlot can be index (0-4) or explicit hour
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

  // --- 【新設】開始時間から1時間後の時間を計算するヘルパー関数 ---
  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);

    // "HH:MM" 形式をパース
    const [hoursStr, minutesStr] = newStartTime.split(':');
    if (hoursStr && minutesStr) {
      let hours = parseInt(hoursStr, 10);
      let minutes = parseInt(minutesStr, 10);

      // 1時間進める
      hours = (hours + 1) % 24;

      // 新しい終了時間を "HH:MM" 形式にする
      const newEndTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      setEndTime(newEndTime);

      // 日またぎの簡易ケア（23:00 → 00:00 になった場合、終了日を翌日に進める設定も可能）
      // 今回はシンプルに時間のみ連動させています
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="modal-overlay">
      <div className="modal-container">
        
        <div className="modal-header">

              <button
                type="button"
                className="btn btn-secondary btn-close-footer"
                onClick={onCancel}
              >
                <X size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                閉じる
              </button>


          <h2 className="modal-title">{event ? '予定の編集' : '予定の追加'}</h2>

          <button type="button" className="icon-btn" onClick={onCancel} aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
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

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="allDay" 
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              <label htmlFor="allDay" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>終日</label>
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
                    // 【修正】通常の setStartTime から、連動関数に変更します
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