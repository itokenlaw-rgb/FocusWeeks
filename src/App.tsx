import { useState, useEffect, useCallback, useRef } from 'react';
import { MonthView } from './components/MonthView';
import { WeekView } from './components/WeekView';
import { BottomPanel } from './components/BottomPanel';
import { EventForm } from './components/EventForm';
import { SettingsView } from './components/SettingsView';
import type { Settings } from './components/SettingsView';
import { 
  redirectToGoogleLogin,
  checkLoginStatus,
  logout,
  fetchGoogleEvents,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent
} from './utils/googleCalendar';
import type { CalendarEvent } from './utils/googleCalendar';
import { Settings as SettingsIcon, Plus, ChevronDown, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';

const getFormattedDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
};

function generateWeeksList(baseDate: Date, weekStart: 'monday' | 'sunday', countBefore = 10, countAfter = 30) {
  const weeks = [];
  
  const currentMonthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const startDay = currentMonthStart.getDay(); 
  
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
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('focusweeks_settings');
    
    const defaultSettings: Settings = {
      textSize: 'medium',
      focusSize: 3,
      weekStart: 'monday',
      themeColor: 'blue',
      eventColor: 'default',
      focusSize3: { before: 0, after: 0 },
      focusSize5: { before: 0, after: 0 },
      useGoogleColors: true,
      notificationEnabled: true,
      notificationMinutes: [5],
    };

    if (saved) {
      try { 
        const parsed = JSON.parse(saved);

        if (parsed.useGoogleColors === undefined) {
          parsed.useGoogleColors = true;
        }
        if (parsed.eventColor === undefined) {
          parsed.eventColor = 'default';
        }
        if (parsed.notificationEnabled === undefined) {
          parsed.notificationEnabled = true;
        }
        if (parsed.notificationMinutes === undefined) {
          parsed.notificationMinutes = [5];
        }
        
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

        delete parsed.focusBefore;
        delete parsed.focusAfter;

        return { ...defaultSettings, ...parsed }; 
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('focusweeks_settings', JSON.stringify(settings));
  }, [settings]);

  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    document.body.classList.remove(
      'theme-monochrome', 'theme-red', 'theme-blue', 'theme-yellow', 'theme-green',
      'size-small', 'size-medium', 'size-large'
    );
    
    document.body.classList.add(`theme-${settings.themeColor}`);
    document.body.classList.add(`size-${settings.textSize}`);
  }, [settings.themeColor, settings.textSize]);

  useEffect(() => {
    const colorMap: Record<string, { bg: string; border: string; text: string }> = {
      default:    { bg: '', border: '', text: '' }, // テーマのデフォルトを使う
      monochrome: { bg: '#f3f4f6', border: '#9ca3af', text: '#1f2937' },
      red:        { bg: '#ffe4e6', border: '#f43f5e', text: '#9f1239' },
      blue:       { bg: '#bfdbfe', border: '#3b82f6', text: '#1e3a8a' },
      yellow:     { bg: '#fef3c7', border: '#d97706', text: '#78350f' },
      green:      { bg: '#dcfce7', border: '#22c55e', text: '#14532d' },
      purple:     { bg: '#ede9fe', border: '#7c3aed', text: '#3b0764' },
      pink:       { bg: '#fce7f3', border: '#ec4899', text: '#831843' },
      orange:     { bg: '#ffedd5', border: '#ea580c', text: '#7c2d12' },
      teal:       { bg: '#ccfbf1', border: '#14b8a6', text: '#134e4a' },
    };
    const root = document.documentElement;
    const c = colorMap[settings.eventColor] ?? colorMap['default'];
    if (settings.eventColor === 'default' || !c.bg) {
      root.style.removeProperty('--event-bg-custom');
      root.style.removeProperty('--event-border-custom');
      root.style.removeProperty('--event-text-custom');
    } else {
      root.style.setProperty('--event-bg-custom', c.bg);
      root.style.setProperty('--event-border-custom', c.border);
      root.style.setProperty('--event-text-custom', c.text);
    }
  }, [settings.eventColor]);

  const [view, setView] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [focusedWeekId, setFocusedWeekId] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<any[][]>([]);
  
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);

  const [activeForm, setActiveForm] = useState<{
    event: CalendarEvent | null;
    date: string;
    timeSlot: number | null;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [duplicateEvent, setDuplicateEvent] = useState<CalendarEvent | null>(null);
  const [duplicateTargetDates, setDuplicateTargetDates] = useState<string[]>([]); 

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // isLoggedIn / events の最新値をrefで保持（useCallback内のstaleクロージャ対策）
  const isLoggedInRef = useRef<boolean>(false);
  const eventsRef = useRef<CalendarEvent[]>([]);

  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('focusweeks_events');
    return saved ? JSON.parse(saved) : [];
  });

  // eventsRefをeventsと同期
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // isLoggedInRefをisLoggedInと同期
  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  const [currentTime, setCurrentTime] = useState(new Date());
  const lastCheckedMinute = useRef<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const currentHM = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    
    if (lastCheckedMinute.current === currentHM) return;
    lastCheckedMinute.current = currentHM;

    // 通知がオフ、または通知分数が未設定の場合はスキップ
    if (!settings.notificationEnabled) return;
    if (settings.notificationMinutes.length === 0) return;

    const todayStr = getFormattedDateString(currentTime);

    events.forEach((event) => {
      if (event.allDay) return;

      try {
        const eventDate = new Date(event.start);

        settings.notificationMinutes.forEach((minutesBefore) => {
          // イベント開始時刻から minutesBefore 分前の時刻を計算
          const notifyTime = new Date(eventDate.getTime() - minutesBefore * 60 * 1000);
          const notifyDateStr = getFormattedDateString(notifyTime);
          const notifyHM = `${String(notifyTime.getHours()).padStart(2, '0')}:${String(notifyTime.getMinutes()).padStart(2, '0')}`;

          if (notifyDateStr === todayStr && notifyHM === currentHM) {
            const eventHM = `${String(eventDate.getHours()).padStart(2, '0')}:${String(eventDate.getMinutes()).padStart(2, '0')}`;
            const label = minutesBefore === 0 ? `予定の時間になりました（${eventHM}〜）` : `${minutesBefore}分後に予定があります（${eventHM}〜）`;
            triggerNotification(event.title, label);
          }
        });
      } catch (e) {
        console.error('Failed to parse event date for notification:', e);
      }
    });
  }, [currentTime, events, settings.notificationEnabled, settings.notificationMinutes]);

  const triggerNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    } else {
      alert(`【通知】\n${title}\n${body}`);
    }
  };

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

  const syncEvents = useCallback(async (loggedIn?: boolean) => {
    const currentlyLoggedIn = loggedIn !== undefined ? loggedIn : isLoggedInRef.current;
    setIsSyncing(true);
    try {
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 12 * 7);
      const end = new Date(today);
      end.setDate(today.getDate() + 42 * 7);

      if (currentlyLoggedIn) {
        const localEvents = eventsRef.current.filter(e => e.id.startsWith('local-'));
        for (const localEv of localEvents) {
          try {
            const { id, ...eventDataWithoutId } = localEv;
            await createGoogleEvent(eventDataWithoutId);
          } catch (err) {
            console.error('ローカル予定のアウトプットに失敗しました:', localEv.title, err);
          }
        }
      }

      const items = await fetchGoogleEvents(start.toISOString(), end.toISOString());
      setEvents(items);
      localStorage.setItem('focusweeks_events', JSON.stringify(items));
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        setIsLoggedIn(false);
        isLoggedInRef.current = false;
      } else {
        console.error('Error syncing events:', error);
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
const url = new URL(window.location.href);
// auth_success だけでなく、URLに「code」が含まれている場合も成功とみなす
const hasAuthSuccess = url.searchParams.has('auth_success') || url.searchParams.has('code');
const hasAuthError = url.searchParams.has('auth_error');

    // [修正] OAuthコールバック直後（auth_success）はCookieがブラウザに
    // セットされるまで少し待つ。通常の初回ロードは即座にチェック。
    const delay = hasAuthSuccess ? 300 : 0;

    const timer = setTimeout(() => {
      checkLoginStatus().then(loggedIn => {
        // refを先に更新してからsyncEventsを呼ぶ（stateの非同期更新前にrefが参照される対策）
        isLoggedInRef.current = loggedIn;
        setIsLoggedIn(loggedIn);
        // [修正] loggedIn を直接引数で渡し、ref の更新タイミング問題を回避
        if (loggedIn) syncEvents(loggedIn);

if (hasAuthSuccess || hasAuthError) {
  url.searchParams.delete('auth_success');
  url.searchParams.delete('auth_error');
  url.searchParams.delete('code'); // <-- これを追加
  url.searchParams.delete('iss');  // <-- ついでにこれも追加しておくとURLがスッキリします
  window.history.replaceState({}, '', url.toString());
}
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [syncEvents]);


  const handleLogout = useCallback(async () => {
    await logout();
    setIsLoggedIn(false);
    isLoggedInRef.current = false; // [修正] ref も同期して更新
  }, []);

  const handleSaveEvent = async (eventData: Omit<CalendarEvent, 'id'> & { id?: string }) => {
    const isEdit = !!eventData.id;
    let finalEvent: CalendarEvent;
    const isGoogleEvent = isEdit && eventData.id && !eventData.id.startsWith('local-');

    if (isLoggedIn) {
      try {
        if (isGoogleEvent && eventData.id) {
          const updated = await updateGoogleEvent(eventData.id, eventData);
          finalEvent = updated;
        } else if (!isEdit) {
          const created = await createGoogleEvent(eventData);
          finalEvent = created;
        } else {
          // ローカルイベントを編集してGoogleに送る場合など
          finalEvent = { ...eventData, id: eventData.id as string };
        }
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

    // Googleへの送信成否に関わらず、ローカルの状態を確実に更新する
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
    // 保存直後にsyncEventsを呼ぶと、Google側への書き込みが
    // まだ反映されていない状態でfetchしてしまい予定が消える。
    // ローカルstateへの反映のみで完結させ、同期は手動ボタンに委ねる。
  };

  const handleDeleteEvent = async (id: string) => {
    const hasGoogleId = !id.startsWith('local-');
    
    if (isLoggedIn && hasGoogleId) {
      try {
        await deleteGoogleEvent(id);
      } catch (err) {
        console.error('Google API delete error:', err);
      }
    }

    // Google側の削除成否に関わらず、ローカルから削除を実行する
    const newEvents = events.filter(e => e.id !== id);
    setEvents(newEvents);
    localStorage.setItem('focusweeks_events', JSON.stringify(newEvents));
    
    setActiveForm(null);
    setIsBottomPanelOpen(false);
    // 削除後も即座にsyncすると削除反映前のデータで上書きされる可能性があるため省略
  };

  const handleMoveEvent = async (eventId: string, newStart: string, newEnd: string) => {
    const eventToMove = events.find(e => e.id === eventId);
    if (!eventToMove) return;

    const updatedEvent = {
      ...eventToMove,
      start: newStart,
      end: newEnd,
    };

    // 先にローカルの状態を更新して画面のガタつきを防ぐ（楽観的アップデート）
    const newEvents = events.map(e => e.id === eventId ? updatedEvent : e);
    setEvents(newEvents);
    localStorage.setItem('focusweeks_events', JSON.stringify(newEvents));

    if (isLoggedIn && !eventId.startsWith('local-')) {
      try {
        await updateGoogleEvent(eventId, updatedEvent);
        // 更新直後のsyncは省略（Google側反映前にfetchすると古いデータで上書きされるため）
      } catch (err) {
        console.error('Google API update failed on move:', err);
      }
    }
  };

  const handleManualSync = () => {
    if (isLoggedIn) {
      syncEvents();
    } else {
      alert('Googleアカウントにログインしていません。設定画面からログインしてください。');
    }
  };

  const handleSelectDay = (dateString: string, weekStartDate: string) => {
    if (duplicateEvent) {
      setDuplicateTargetDates(prev => 
        prev.includes(dateString)
          ? prev.filter(d => d !== dateString)
          : [...prev, dateString]
      );
      return;
    }

    if (isBottomPanelOpen && selectedDate === dateString) {
      setSelectedDate(null);
      setIsBottomPanelOpen(false);
    } else {
      setSelectedDate(dateString);
      setFocusedWeekId(weekStartDate);
      setIsBottomPanelOpen(true);
    }
  };

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

  const handleTriggerDuplicate = (event: CalendarEvent) => {
    setDuplicateEvent(event);
    setDuplicateTargetDates([]); 
    setActiveForm(null); 
    setIsBottomPanelOpen(false); 
    setView('month'); 
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicateEvent || duplicateTargetDates.length === 0) return;

    const originalStart = new Date(duplicateEvent.start);
    const originalEnd = new Date(duplicateEvent.end);
    const duration = originalEnd.getTime() - originalStart.getTime();

    const createdEvents: CalendarEvent[] = [];

    for (const targetDate of duplicateTargetDates) {
      const newStart = new Date(targetDate);
      if (!duplicateEvent.allDay) {
        newStart.setHours(originalStart.getHours());
        newStart.setMinutes(originalStart.getMinutes());
        newStart.setSeconds(0);
        newStart.setMilliseconds(0);
      }

      const newEnd = duplicateEvent.allDay
        ? targetDate
        : new Date(newStart.getTime() + duration).toISOString();

      const duplicatedData: Omit<CalendarEvent, 'id'> = {
        title: duplicateEvent.title,
        start: duplicateEvent.allDay ? targetDate : newStart.toISOString(),
        end: newEnd,
        allDay: duplicateEvent.allDay,
        memo: duplicateEvent.memo,
      };

      let finalEvent: CalendarEvent;

      if (isLoggedIn) {
        try {
          const created = await createGoogleEvent(duplicatedData);
          finalEvent = created;
        } catch {
          finalEvent = {
            ...duplicatedData,
            id: 'local-' + Date.now() + '-' + Math.random(),
          };
        }
      } else {
        finalEvent = {
          ...duplicatedData,
          id: 'local-' + Date.now() + '-' + Math.random(),
        };
      }
      createdEvents.push(finalEvent);
    }

    const newEvents = [...events, ...createdEvents];
    setEvents(newEvents);
    localStorage.setItem('focusweeks_events', JSON.stringify(newEvents));
    
    setDuplicateEvent(null);
    setDuplicateTargetDates([]);
    // 複製直後のsyncも省略（Google反映前にfetchすると複製分が消える）
  };

  const handleOpenAddForm = (date: string, timeSlot: number | null) => {
    setActiveForm({
      event: null,
      date,
      timeSlot,
    });
  };

  const handleOpenEditForm = (event: CalendarEvent) => {
    setActiveForm({
      event,
      date: event.start.substring(0, 10),
      timeSlot: null,
    });
  };

  const getWeekDaysForSelectedWeek = (): any[] => {
    if (!focusedWeekId || weeks.length === 0) return [];
    const activeWeek = weeks.find(w => w[0].dateString === focusedWeekId);
    return activeWeek || [];
  };

  return (
    <div className="app-container">
      {duplicateEvent && (
        <div className="duplicate-banner">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span>予定の複製中: 「{duplicateEvent.title}」</span>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>
              {duplicateTargetDates.length > 0 
                ? `選択中: ${duplicateTargetDates.length} 日分 (仮押さえ)` 
                : 'カレンダーから複製先（複数選択可）を選択してください'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '4px 10px', fontSize: 'var(--text-xs)', width: 'auto' }}
              onClick={() => {
                setDuplicateEvent(null);
                setDuplicateTargetDates([]);
              }}
            >
              キャンセル
            </button>
            <button 
              className="btn btn-primary" 
              style={{ 
                padding: '4px 14px', 
                fontSize: 'var(--text-xs)', 
                width: 'auto',
                backgroundColor: duplicateTargetDates.length > 0 ? 'var(--bg-card)' : 'rgba(255,255,255,0.3)',
                color: duplicateTargetDates.length > 0 ? 'var(--accent-color)' : 'rgba(255,255,255,0.6)'
              }}
              disabled={duplicateTargetDates.length === 0}
              onClick={handleConfirmDuplicate}
            >
              完了
            </button>
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="header-left">
          <div className="header-title-container">
            <span className="header-year">{currentYear}年</span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<button 
  // 必要に応じて icon-btn を外し、独自のクラスにするかインラインで制御します
  className="header-month" 
  style={{ 
    padding: '0 4px', 
    borderRadius: '4px',
    background: 'none',             // 背景を透明に固定
    border: 'none',                 // 枠線を消す
    color: 'inherit',               // 文字色は親要素の白（または元々の色）を引き継ぐ
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    cursor: 'pointer',
    outline: 'none',                // クリック時の青い枠線などを防止
    WebkitTapHighlightColor: 'transparent' // スマホ等でのタップ時ハイライトを防止
  }}
  onClick={() => setShowMonthDropdown(!showMonthDropdown)}
>
  {currentMonth + 1}月
  <ChevronDown size={16} />
</button>
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
                          targetWeekEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
            className="header-focus-toggle-btn"
            onClick={() => {
              setSettings(prev => ({
                ...prev,
                focusSize: prev.focusSize === 3 ? 5 : 3
              }));
            }}
            title={`フォーカスサイズを${settings.focusSize === 3 ? '大' : '小'}に切り替え`}
          >
            {settings.focusSize === 3 ? (
              <>
                <Minimize2 size={14} />
                <span style={{ fontSize: '11px' }}>小</span>
              </>
            ) : (
              <>
                <Maximize2 size={14} />
                <span style={{ fontSize: '11px' }}>大</span>
              </>
            )}
          </button>

          <button 
            className="switch-btn" 
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'var(--bg-card)', padding: '6px 12px' }}
            onClick={() => {
              const today = new Date();
              const todayStr = getFormattedDateString(today);
              setSelectedDate(null);
              
              const targetWeekEl = document.querySelector(`[data-contains-date*="${todayStr}"]`);
              if (targetWeekEl) {
                targetWeekEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
  className={`sync-btn ${isSyncing ? 'spinning' : ''}`} // 反転の原因と思われる icon-btn クラスを外すか、下で上書き
  onClick={handleManualSync}
  disabled={isSyncing}
  aria-label="Googleカレンダーと同期"
  style={{ 
    opacity: isLoggedIn ? 1 : 0.4,
    background: 'none',             // 背景が白く反転するのを防止
    border: 'none',
    color: 'inherit',               // アイコンの色をそのまま維持
    cursor: 'pointer',
    padding: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent' // タップ時の反転防止
  }}
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
            duplicateTargetDates={duplicateTargetDates} 
            onPasteDuplicate={async () => {}}
          />
        ) : (
          <WeekView
            weekDays={getWeekDaysForSelectedWeek()}
            events={events}
            onEventClick={handleOpenEditForm}
            onAddEventClick={(date, hour) => handleOpenAddForm(date, hour)}
            onMoveEvent={handleMoveEvent}
            onNavigateWeek={handleNavigateWeek}
            useGoogleColors={settings.useGoogleColors}
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
          isLoggedIn={isLoggedIn}
          onLogin={redirectToGoogleLogin}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}