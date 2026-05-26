import { useState, useEffect, useCallback } from 'react';
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
import { Search, Settings as SettingsIcon, Plus, ChevronDown } from 'lucide-react';

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
  // Global Settings State
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('focusweeks_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      textSize: 'medium',
      focusSize: 3,
      weekStart: 'monday',
      themeColor: 'blue',
    };
  });

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

  // Re-generate weeks on weekStart configuration change & initial default focused week
  useEffect(() => {
    const base = new Date();
    const list = generateWeeksList(base, settings.weekStart, 10, 40);
    setWeeks(list);

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
    }
  };

  // Sync periodic check
  useEffect(() => {
    if (googleToken) {
      syncEvents(googleToken);
    }
  }, [googleToken]);

  // Select a day (Month View)
  const handleSelectDay = (dateString: string, weekStartDate: string) => {
    setSelectedDate(dateString);
    setFocusedWeekId(weekStartDate);
    setIsBottomPanelOpen(true);
  };

  // Callback when month scrolls and header needs updating
  const handleVisibleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  // Save Event Action (Insert or Update)
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
      {/* Duplication Active Banner */}
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
            <button 
              className="header-month icon-btn" 
              style={{ padding: '0 4px', borderRadius: '4px' }}
              onClick={() => setShowMonthDropdown(!showMonthDropdown)}
            >
              {currentMonth + 1}月
              <ChevronDown size={16} />
            </button>
            
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
          <button className="icon-btn" aria-label="検索" onClick={() => alert('検索機能は開発中です。')}>
            <Search size={20} />
          </button>
          
          <div className="view-switch">
            <button 
              className={`switch-btn ${view === 'month' ? 'active' : ''}`}
              onClick={() => setView('month')}
            >
              月
            </button>
            <button 
              className={`switch-btn ${view === 'week' ? 'active' : ''}`}
              onClick={() => setView('week')}
            >
              週
            </button>
          </div>
        </div>
      </header>

      {/* Weekday labels row for Month view */}
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

      {/* Main Content Areas */}
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
            onEventClick={handleOpenEditForm}
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
          />
        )}

        {/* Floating Add Event Button in Month View */}
        {view === 'month' && !selectedDate && (
          <button 
            className="floating-add-btn" 
            onClick={() => handleOpenAddForm(getFormattedDateString(new Date()), null)}
            aria-label="予定を追加"
          >
            <Plus size={24} />
          </button>
        )}

        {/* Bottom Panel Wrapper */}
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

      {/* Sticky Bottom Bar */}
      <footer className="app-navbar">
        <button 
          className="nav-today-btn" 
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
        <span className="nav-date-label">
          {view === 'month' ? 'FocusWeeks' : '週表示'}
        </span>
        <button 
          className="nav-settings-btn" 
          onClick={() => setShowSettings(true)}
          aria-label="設定"
        >
          <SettingsIcon size={20} />
        </button>
      </footer>

      {/* Fullscreen Forms */}
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