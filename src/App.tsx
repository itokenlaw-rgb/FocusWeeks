import { useState, useEffect, useCallback, useRef } from 'react';
import { MonthView } from './components/MonthView';
import { WeekView } from './components/WeekView';
import { BottomPanel } from './components/BottomPanel';
import { EventForm } from './components/EventForm';
import { SettingsView } from './components/SettingsView';
import type { Settings } from './components/SettingsView';
import { 
  loadGoogleScript, 
  initOAuthClient, 
  fetchGoogleEvents,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent
} from './utils/googleCalendar';
import type { CalendarEvent } from './utils/googleCalendar';
import { Settings as SettingsIcon, Plus, ChevronDown, RefreshCw } from 'lucide-react';

// Get ISO Date format string in Local Time zone (YYYY-MM-DD)
const getFormattedDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
};

// Generate weeks helper
function generateWeeksList(baseDate: Date, weekStart: 'monday' | 'sunday', countBefore = 10, countAfter = 30) {
  const weeks = [];
  
  const currentMonthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const startDay = currentMonthStart.getDay(); // 0 = Sun, 1 = Mon
  
  let diff = 0;
  if (weekStart === 'sunday') {
    diff = startDay;
  } else {
    diff = startDay === 0 ? 6 : startDay - 1;
  }
  
  const calendarStart = new Date(currentMonthStart);
  calendarStart.setDate(currentMonthStart.getDate() - diff - (countBefore * 7));
  
  const totalWeeks = countBefore + 1 + countAfter;
  const todayStr = getFormattedDateString(new Date());
  
  const cursor = new Date(calendarStart);
  for (let w = 0; w < totalWeeks; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateCopy = new Date(cursor);
      const dateString = getFormattedDateString(dateCopy);
      
      const isToday = dateString === todayStr;
      
      let monthLabel = '';
      if (dateCopy.getDate() === 1) {
        monthLabel = `${dateCopy.getMonth() + 1}月1日`;
      }
      
      week.push({
        date: dateCopy,
        dateString,
        isCurrentMonth: dateCopy.getMonth() === baseDate.getMonth() && dateCopy.getFullYear() === baseDate.getFullYear(),
        isToday,
        dayOfMonth: dateCopy.getDate(),
        monthLabel
      });
      
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  
  return weeks;
}

export default function App() {
  // Global Settings State（マイグレーション対応版）
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('focusweeks_settings');
    
    const defaultSettings: Settings = {
      textSize: 'medium',
      focusSize: 3,
      weekStart: 'monday',
      themeColor: 'blue',
      focusSize3: { before: 0, after: 0 },
      focusSize5: { before: 0, after: 0 },
    };

    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        
        // 旧バージョン（focusBefore / focusAfter）から新構造（focusSize3 / focusSize5）への移行
        if (parsed.focusSize3 === undefined) {
          parsed.focusSize3 = {
            before: parsed.focusBefore !== undefined ? parsed.focusBefore : 0,
            after: parsed.focusAfter !== undefined ? parsed.focusAfter : 0
          };
        }
        if (parsed.focusSize5 === undefined) {
          parsed.focusSize5 = {
            before: parsed.focusBefore !== undefined ? parsed.focusBefore : 0,
            after: parsed.focusAfter !== undefined ? parsed.focusAfter : 0
          };
        }

        // 不要になった古いキーの削除
        delete parsed.focusBefore;
        delete parsed.focusAfter;

        return { ...defaultSettings, ...parsed }; 
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  // 設定項目（settings）が変更されたら自動で localStorage へ同期・保存する
  useEffect(() => {
    localStorage.setItem('focusweeks_settings', JSON.stringify(settings));
  }, [settings]);

  // 同期中（ローディング）の状態を管理
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    document.body.classList.remove(
      'theme-monochrome', 'theme-red', 'theme-blue', 'theme-yellow', 'theme-green',
      'size-small', 'size-medium', 'size-large'
    );
    
    document.body.classList.add(`theme-${settings.themeColor}`);
    document.body.classList.add(`size-${settings.textSize}`);
  }, [settings.themeColor, settings.textSize]);

  // Views and Dates States
  const [view, setView] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [focusedWeekId, setFocusedWeekId] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<any[][]>([]);
  
  // Header Month display
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);

  // Bottom panel sliding state
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);

  // Forms and settings screen states
  const [activeForm, setActiveForm] = useState<{
    event: CalendarEvent | null;
    date: string;
    timeSlot: number | null;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Duplicate Mode State
  const [duplicateEvent, setDuplicateEvent] = useState<CalendarEvent | null>(null);

  // Google OAuth States
  const [googleToken, setGoogleToken] = useState<string | null>(() => {
    const token = localStorage.getItem('google_access_token');
    const expiresAt = localStorage.getItem('google_token_expires_at');
    if (token && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
      return token;
    }
    return null;
  });
  
  // Event Caches
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('focusweeks_events');
    return saved ? JSON.parse(saved) : [];
  });

  // 現在時刻を管理するState
  const [currentTime, setCurrentTime] = useState(new Date());

  // 重複通知を防ぐため、最後に通知をチェックした「時:分」を保持するRef
  const lastCheckedMinute = useRef<string>('');

  // 1秒ごとに時刻を更新するタイマー
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 時刻を「00:00」形式にするフォーマット関数
  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // 予定の通知チェックロジック
  useEffect(() => {
    const currentHM = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    
    if (lastCheckedMinute.current === currentHM) return;
    lastCheckedMinute.current = currentHM;

    const todayStr = getFormattedDateString(currentTime);

    events.forEach((event) => {
      if (event.allDay) return;

      try {
        const eventDate = new Date(event.start);
        const eventDateStr = getFormattedDateString(eventDate);
        const eventHM = `${String(eventDate.getHours()).padStart(2, '0')}:${String(eventDate.getMinutes()).padStart(2, '0')}`;

        if (eventDateStr === todayStr && eventHM === currentHM) {
          triggerNotification(event.title, `予定の時間になりました（${eventHM}〜）`);
        }
      } catch (e) {
        console.error('Failed to parse event date for notification:', e);
      }
    });
  }, [currentTime, events]);

  // 通知を実際にトリガーする関数
  const triggerNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    } else {
      alert(`【通知】\n${title}\n${body}`);
    }
  };

  // Re-generate weeks on weekStart configuration change
  useEffect(() => {
    const base = new Date();
    const list = generateWeeksList(base, settings.weekStart, 10, 40);
    setWeeks(list);

    if (list.length > 0 && list[0].length > 0) {
      const firstDayOfFirstWeek = list[0][0].date;
      setCurrentYear(firstDayOfFirstWeek.getFullYear());
      setCurrentMonth(firstDayOfFirstWeek.getMonth());
    }

    const todayStr = getFormattedDateString(base);
    const defaultFocusedWeek = list.find(week => 
      week.some(day => day.dateString === todayStr)
    );
    
    if (defaultFocusedWeek) {
      setFocusedWeekId(defaultFocusedWeek[0].dateString);
    }
  }, [settings.weekStart]);

  // Google Script & OAuth Client Loader
  const handleTokenReceived = useCallback((token: string, expiresAt: number) => {
    setGoogleToken(token);
    localStorage.setItem('google_access_token', token);
    localStorage.setItem('google_token_expires_at', String(expiresAt));
    syncEvents(token);
  }, []);

  const handleLogout = useCallback(() => {
    setGoogleToken(null);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expires_at');
  }, []);

  useEffect(() => {
    loadGoogleScript()
      .then(() => {
        initOAuthClient(handleTokenReceived);
      })
      .catch((err) => {
        console.error('Could not initialize Google client:', err);
      });
  }, [handleTokenReceived]);

  // Sync Google Events
  const syncEvents = async (token: string) => {
    setIsSyncing(true);
    try {
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 12 * 7);
      const end = new Date(today);
      end.setDate(today.getDate() + 42 * 7);

      const items = await fetchGoogleEvents(token, start.toISOString(), end.toISOString());
      setEvents(items);
      localStorage.setItem('focusweeks_events', JSON.stringify(items));
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        handleLogout();
      } else {
        console.error('Error syncing events:', error);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // 手動同期ボタンのハンドラー
  const handleManualSync = () => {
    if (googleToken) {
      syncEvents(googleToken);
    } else {
      alert('Googleアカウントにログインしていません。設定画面からログインしてください。');
    }
  };

  // Select a day (Month View)
  const handleSelectDay = (dateString: string, weekStartDate: string) => {
    if (isBottomPanelOpen && selectedDate === dateString) {
      setSelectedDate(null);
      setIsBottomPanelOpen(false);
    } else {
      setSelectedDate(dateString);
      setFocusedWeekId(weekStartDate);
      setIsBottomPanelOpen(true);
    }
  };

  // Callback when month scrolls and header needs updating
  const handleVisibleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const handleNavigateWeek = (direction: 'prev' | 'next') => {
    if (!focusedWeekId || weeks.length === 0) return;

    const currentWeekIdx = weeks.findIndex(w => w[0].dateString === focusedWeekId);
    if (currentWeekIdx === -1) return;

    let targetWeekIdx = currentWeekIdx;
    if (direction === 'prev' && currentWeekIdx > 0) {
      targetWeekIdx = currentWeekIdx - 1;
    } else if (direction === 'next' && currentWeekIdx < weeks.length - 1) {
      targetWeekIdx = currentWeekIdx + 1;
    }

    if (targetWeekIdx !== currentWeekIdx) {
      const targetWeek = weeks[targetWeekIdx];
      setFocusedWeekId(targetWeek[0].dateString);
      handleVisibleMonthChange(targetWeek[0].date.getFullYear(), targetWeek[0].date.getMonth());
    }
  };

  // Save Event Action
  const handleSaveEvent = async (eventData: Omit<CalendarEvent, 'id'> & { id?: string }) => {
    const isEdit = !!eventData.id;
    let finalEvent: CalendarEvent;

    if (googleToken) {
      try {
        if (isEdit && eventData.id) {
          const updated = await updateGoogleEvent(googleToken, eventData.id, eventData);
          finalEvent = updated;
        } else {
          const created = await createGoogleEvent(googleToken, eventData);
          finalEvent = created;
        }
        syncEvents(googleToken);
      } catch (err) {
        console.error('Google API error, saving locally only:', err);
        finalEvent = {
          ...eventData,
          id: eventData.id || 'local-' + Date.now(),
        };
      }
    } else {
      finalEvent = {
        ...eventData,
        id: eventData.id || 'local-' + Date.now(),
      };
    }

    let newEvents = [...events];
    if (isEdit) {
      newEvents = newEvents.map(e => e.id === finalEvent.id ? finalEvent : e);
    } else {
      newEvents.push(finalEvent);
    }

    setEvents(newEvents);
    localStorage.setItem('focusweeks_events', JSON.stringify(newEvents));

    setActiveForm(null);
    setIsBottomPanelOpen(false);
  };

  // Delete Event Action
  const handleDeleteEvent = async (id: string) => {
    const hasGoogleId = !id.startsWith('local-');
    
    if (googleToken && hasGoogleId) {
      try {
        await deleteGoogleEvent(googleToken, id);
        syncEvents(googleToken);
      } catch (err) {
        console.error('Google API delete error:', err);
      }
    }

    const newEvents = events.filter(e => e.id !== id);
    setEvents(newEvents);
    localStorage.setItem('focusweeks_events', JSON.stringify(newEvents));
    
    setActiveForm(null);
    setIsBottomPanelOpen(false);
  };

  // Move Event (Week drag & drop)
  const handleMoveEvent = async (eventId: string, newStart: string, newEnd: string) => {
    const eventToMove = events.find(e => e.id === eventId);
    if (!eventToMove) return;

    const updatedEvent = {
      ...eventToMove,
      start: newStart,
      end: newEnd,
    };

    if (googleToken && !eventId.startsWith('local-')) {
      try {
        await updateGoogleEvent(googleToken, eventId, updatedEvent);
        syncEvents(googleToken);
      } catch (err) {
        console.error('Google API update failed on move:', err);
      }
    }

    const newEvents = events.map(e => e.id === eventId ? updatedEvent : e);
    setEvents(newEvents);
    localStorage.setItem('focusweeks_events', JSON.stringify(newEvents));
  };

  // Duplicate Mode Triggers
  const handleTriggerDuplicate = (event: CalendarEvent) => {
    setDuplicateEvent(event);
    setActiveForm(null); 
    setIsBottomPanelOpen(false); 
  };

  // Paste Duplicated Event
  const handlePasteDuplicate = async (targetDateString: string) => {
    if (!duplicateEvent) return;

    const originalStart = new Date(duplicateEvent.start);
    const originalEnd = new Date(duplicateEvent.end);
    const duration = originalEnd.getTime() - originalStart.getTime();

    const newStart = new Date(targetDateString);
    if (!duplicateEvent.allDay) {
      newStart.setHours(originalStart.getHours());
      newStart.setMinutes(originalStart.getMinutes());
      newStart.setSeconds(0);
      newStart.setMilliseconds(0);
    }

    const newEnd = duplicateEvent.allDay
      ? targetDateString
      : new Date(newStart.getTime() + duration).toISOString();

    const duplicatedData: Omit<CalendarEvent, 'id'> = {
      title: `${duplicateEvent.title} (コピー)`,
      start: duplicateEvent.allDay ? targetDateString : newStart.toISOString(),
      end: newEnd,
      allDay: duplicateEvent.allDay,
      memo: duplicateEvent.memo,
    };

    let finalEvent: CalendarEvent;

    if (googleToken) {
      try {
        const created = await createGoogleEvent(googleToken, duplicatedData);
        finalEvent = created;
        syncEvents(googleToken);
      } catch {
        finalEvent = {
          ...duplicatedData,
          id: 'local-' + Date.now(),
        };
      }
    } else {
      finalEvent = {
        ...duplicatedData,
        id: 'local-' + Date.now(),
      };
    }

    const newEvents = [...events, finalEvent];
    setEvents(newEvents);
    localStorage.setItem('focusweeks_events', JSON.stringify(newEvents));
    setDuplicateEvent(null);
  };

  // Open Add Dialog from empty slots
  const handleOpenAddForm = (date: string, timeSlot: number | null) => {
    setActiveForm({
      event: null,
      date,
      timeSlot,
    });
  };

  // Open Edit Dialog from clicking event card/row
  const handleOpenEditForm = (event: CalendarEvent) => {
    setActiveForm({
      event,
      date: event.start.substring(0, 10),
      timeSlot: null,
    });
  };

  // Generate week-based days array for WeekView
  const getWeekDaysForSelectedWeek = (): any[] => {
    if (!focusedWeekId || weeks.length === 0) return [];
    const activeWeek = weeks.find(w => w[0].dateString === focusedWeekId);
    return activeWeek || [];
  };

  return (
    <div className="app-container">
      {duplicateEvent && (
        <div className="duplicate-banner">
          <span>予定の複製中: 「{duplicateEvent.title}」</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '4px 10px', fontSize: 'var(--text-xs)' }}
              onClick={() => setDuplicateEvent(null)}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="header-title-container">
            <span className="header-year">{currentYear}年</span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                className="header-month icon-btn" 
                style={{ padding: '0 4px', borderRadius: '4px' }}
                onClick={() => setShowMonthDropdown(!showMonthDropdown)}
              >
                {currentMonth + 1}月
                <ChevronDown size={16} />
              </button>

              <span 
                style={{ 
                  fontSize: 'var(--text-md)', 
                  fontWeight: '500', 
                  opacity: 0.9,
                  marginLeft: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  letterSpacing: '0.02em'
                }}
              >
                {formatTime(currentTime)}
              </span>
            </div>
            
            {showMonthDropdown && (
              <div 
                style={{
                  position: 'absolute',
                  top: 50,
                  left: 16,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 200,
                  overflowY: 'auto'
                }}
              >
                {Array.from({ length: 12 }).map((_, idx) => {
                  const target = new Date();
                  target.setMonth(target.getMonth() - 3 + idx);
                  const year = target.getFullYear();
                  const month = target.getMonth();
                  return (
                    <button
                      key={idx}
                      style={{
                        padding: '10px 16px',
                        border: 'none',
                        background: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-primary)',
                        borderBottom: '1px solid var(--border-color)'
                      }}
                      onClick={() => {
                        handleVisibleMonthChange(year, month);
                        const dateStr = getFormattedDateString(new Date(year, month, 1));
                        const targetWeekEl = document.querySelector(`[data-contains-date*="${dateStr}"]`);
                        if (targetWeekEl) {
                          targetWeekEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                        }
                        setShowMonthDropdown(false);
                      }}
                    >
                      {year}年 {month + 1}月
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="header-right">
          <button 
            className="switch-btn" 
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'var(--bg-card)', padding: '6px 12px' }}
            onClick={() => {
              const today = new Date();
              const todayStr = getFormattedDateString(today);
              setSelectedDate(null);
              
              const targetWeekEl = document.querySelector(`[data-contains-date*="${todayStr}"]`);
              if (targetWeekEl) {
                targetWeekEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }
              
              if (weeks.length > 0) {
                const currentWeek = weeks.find(w => w.some(d => d.dateString === todayStr));
                if (currentWeek) {
                  setFocusedWeekId(currentWeek[0].dateString);
                }
              }
              
              handleVisibleMonthChange(today.getFullYear(), today.getMonth());
            }}
          >
            今日
          </button>
          
          <div className="view-switch" style={{ borderColor: 'rgba(255, 255, 255, 0.3)', backgroundColor: 'rgba(0, 0, 0, 0.1)' }}>
            <button 
              className={`switch-btn ${view === 'month' ? 'active' : ''}`}
              style={{ color: view === 'month' ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.7)' }}
              onClick={() => setView('month')}
            >
              月
            </button>
            <button 
              className={`switch-btn ${view === 'week' ? 'active' : ''}`}
              style={{ color: view === 'week' ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.7)' }}
              onClick={() => setView('week')}
            >
              週
            </button>
          </div>

          <button 
            className={`icon-btn sync-btn ${isSyncing ? 'spinning' : ''}`}
            onClick={handleManualSync}
            disabled={isSyncing}
            aria-label="Googleカレンダーと同期"
            style={{ opacity: googleToken ? 1 : 0.4 }}
          >
            <RefreshCw size={18} />
          </button>

          <button 
            className="icon-btn" 
            onClick={() => {
              setShowSettings(true);
              setIsBottomPanelOpen(false);
            }}
            aria-label="設定"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      {view === 'month' && (
        <div className="weekday-header">
          {settings.weekStart === 'sunday' ? (
            <>
              <span className="sun">日</span>
              <span>月</span>
              <span>火</span>
              <span>水</span>
              <span>木</span>
              <span>金</span>
              <span className="sat">土</span>
            </>
          ) : (
            <>
              <span>月</span>
              <span>火</span>
              <span>水</span>
              <span>木</span>
              <span>金</span>
              <span className="sat">土</span>
              <span className="sun">日</span>
            </>
          )}
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'month' ? (
          <MonthView
            weeks={weeks}
            events={events}
            selectedDate={selectedDate}
            focusedWeekId={focusedWeekId}
            settings={settings}
            onSelectDay={handleSelectDay}
            onVisibleMonthChange={handleVisibleMonthChange}
            duplicateMode={!!duplicateEvent}
            onPasteDuplicate={handlePasteDuplicate}
          />
        ) : (
          <WeekView
            weekDays={getWeekDaysForSelectedWeek()}
            events={events}
            onEventClick={handleOpenEditForm}
            onAddEventClick={(date, hour) => handleOpenAddForm(date, hour)}
            onMoveEvent={handleMoveEvent}
            onNavigateWeek={handleNavigateWeek}
          />
        )}

        {view === 'month' && !selectedDate && (
          <button 
            className="floating-add-btn" 
            onClick={() => handleOpenAddForm(getFormattedDateString(new Date()), null)}
            aria-label="予定を追加"
          >
            <Plus size={24} />
          </button>
        )}

        {view === 'month' && (
          <div className={`bottom-panel-container ${isBottomPanelOpen ? 'active' : ''}`}>
            <BottomPanel
              isOpen={isBottomPanelOpen}
              selectedDate={selectedDate}
              events={events}
              onClose={() => {
                setIsBottomPanelOpen(false);
                setSelectedDate(null);
              }}
              onEventClick={handleOpenEditForm}
              onAddEventClick={handleOpenAddForm}
            />
          </div>
        )}
      </div>

      {activeForm && (
        <EventForm
          event={activeForm.event}
          initialDate={activeForm.date}
          initialTimeSlot={activeForm.timeSlot}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onCancel={() => setActiveForm(null)}
          onDuplicate={handleTriggerDuplicate}
        />
      )}

      {showSettings && (
        <SettingsView
          settings={settings}
          onUpdateSettings={setSettings}
          onClose={() => setShowSettings(false)}
          googleToken={googleToken}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}