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

  // 同期中（ローディング）の状態を管理（消失していたのを復元）
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

    setActive