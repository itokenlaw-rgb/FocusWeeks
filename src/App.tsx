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

import { useHolidays, DEFAULT_HOLIDAY_REGION } from './utils/holidays';

import { Settings as SettingsIcon, Plus, ChevronDown, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';

const getFormattedDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
};

// 表示期間設定（週数）。normal は従来どおり、wide は過去6ヶ月・未来12ヶ月ぶんを
// 週カレンダーの表示範囲と、Googleカレンダーから同期する範囲の両方に使う。
function getRangeWeeks(calendarRange: 'normal' | 'wide') {
  return calendarRange === 'wide'
    ? { before: 26, after: 52 } // 過去約6ヶ月・未来約12ヶ月
    : { before: 10, after: 40 }; // 従来の範囲
}

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
      holidayRegion: DEFAULT_HOLIDAY_REGION, // 祝日の地域（デフォルト: 日本）
      calendarRange: 'normal', // 予定を読み込む期間（デフォルト: 標準）
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
        if (parsed.calendarRange === undefined) {
          parsed.calendarRange = 'normal';
        }
        // 旧バージョンのアプリ内通知設定は使わなくなったため破棄
        delete parsed.notificationEnabled;
        delete parsed.notificationMinutes;

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

  // 設定した地域の祝日（Google Calendar API の祝日カレンダー）
const holidays = useHolidays(settings.holidayRegion) as unknown as Record<string, string>;

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

  // オフライン対応：端末のネット接続状況を監視する
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

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

  // ログイン状態を永続化（オフライン起動時に「未ログイン」と誤判定してキャッシュを消さないため）
  useEffect(() => {
    localStorage.setItem('focusweeks_isLoggedIn', String(isLoggedIn));
  }, [isLoggedIn]);

  // 予定の通知はアプリ内では行わず、Googleカレンダー側の通知設定に委ねる
  // （設定画面の「予定の通知」からGoogleカレンダーの通知設定ページを開けるようにしている）

  useEffect(() => {
    const base = new Date();
    const { before: listBefore, after: listAfter } = getRangeWeeks(settings.calendarRange);
    const list = generateWeeksList(base, settings.weekStart, listBefore, listAfter);
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
  }, [settings.weekStart, settings.calendarRange]);

  const syncEvents = useCallback(async (loggedIn?: boolean) => {
    const currentlyLoggedIn = loggedIn !== undefined ? loggedIn : isLoggedInRef.current;
    setIsSyncing(true);
    try {
      const { before: syncBeforeWeeks, after: syncAfterWeeks } = getRangeWeeks(settings.calendarRange);
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - syncBeforeWeeks * 7);
      const end = new Date(today);
      end.setDate(today.getDate() + syncAfterWeeks * 7);

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
      } else if (error.message === 'NETWORK_ERROR') {
        // オフライン等で通信できなかっただけ。ログイン状態やキャッシュ済みの
        // イベントはそのまま維持し、接続が戻った時に再同期させる。
        setIsOnline(false);
      } else {
        console.error('Error syncing events:', error);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [settings.calendarRange]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hasAuthSuccess = url.searchParams.has('auth_success');
    const hasAuthError = url.searchParams.has('auth_error');

    if (hasAuthSuccess || hasAuthError) {
      url.searchParams.delete('auth_success');
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', url.toString());
    }

    if (hasAuthSuccess) {
      // auth_success の場合はリトライ付きでチェック（Safari でCookie反映が遅い対策）
      let retryCount = 0;
      const maxRetries = 10;

const tryCheck = () => {
  checkLoginStatus().then(loggedIn => {
    if (loggedIn) {
      isLoggedInRef.current = true;
      setIsLoggedIn(true);
      syncEvents(true);
    } else if (retryCount < maxRetries) {
      retryCount++;
      setTimeout(tryCheck, 500);
    }
  }).catch(() => {
    // ネットワーク不通（オフライン等）。少し待って再試行する。
    if (retryCount < maxRetries) {
      retryCount++;
      setTimeout(tryCheck, 500);
    }
  });
};

      setTimeout(tryCheck, 300);
    } else if (!navigator.onLine) {
      // 起動時点でオフライン：ネットワークには触れず、前回のログイン状態と
      // localStorage にキャッシュされた予定をそのまま表示する（events は useState の
      // 初期化時に localStorage から既に読み込み済み）。
      const cachedLoggedIn = localStorage.getItem('focusweeks_isLoggedIn') === 'true';
      isLoggedInRef.current = cachedLoggedIn;
      setIsLoggedIn(cachedLoggedIn);
    } else {
      checkLoginStatus().then(loggedIn => {
        isLoggedInRef.current = loggedIn;
        setIsLoggedIn(loggedIn);
        if (!loggedIn) {
          // 未ログインなら localStorage の予定もクリア
          setEvents([]);
          localStorage.removeItem('focusweeks_events');
        }
        if (loggedIn) syncEvents(loggedIn);
      }).catch(() => {
        // NETWORK_ERROR: サーバーに到達できなかっただけなので、ログアウト扱いにせず
        // 直前のログイン状態とキャッシュ済みの予定をそのまま維持する。
        const cachedLoggedIn = localStorage.getItem('focusweeks_isLoggedIn') === 'true';
        isLoggedInRef.current = cachedLoggedIn;
        setIsLoggedIn(cachedLoggedIn);
      });
    }
  }, [syncEvents]);

  // オンライン／オフラインの切り替わりを監視し、復帰時はシームレスに再同期する
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkLoginStatus().then(loggedIn => {
        isLoggedInRef.current = loggedIn;
        setIsLoggedIn(loggedIn);
        if (loggedIn) {
          syncEvents(loggedIn);
        }
      }).catch(() => {
        // 復帰直後でまだ本当には繋がっていない等。次の online イベントや
        // 手動同期ボタンで再試行される。
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncEvents]);

const handleLogout = useCallback(async () => {
  await logout();
  setIsLoggedIn(false);
  setEvents([]);
  localStorage.removeItem('focusweeks_events'); // ← 追加
}, []);

  const handleSaveEvent = async (eventData: Omit<CalendarEvent, 'id'> & { id?: string }) => {
    const isEdit = !!eventData.id;
    let finalEvent: CalendarEvent;
    const isGoogleEvent = isEdit && eventData.id && !eventData.id.startsWith('local-');

    if (isLoggedIn && isOnline) {
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
    
    if (isLoggedIn && isOnline && hasGoogleId) {
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

    if (isLoggedIn && isOnline && !eventId.startsWith('local-')) {
      try {
        await updateGoogleEvent(eventId, updatedEvent);
        // 更新直後のsyncは省略（Google側反映前にfetchすると古いデータで上書きされるため）
      } catch (err) {
        console.error('Google API update failed on move:', err);
      }
    }
  };

  const handleManualSync = () => {
    if (!isOnline) {
      alert('オフラインです。ネットに繋がったら自動的に同期されます。');
      return;
    }
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
          {!isOnline && (
            <span
              className="offline-badge"
              title="オフラインです。キャッシュされた予定を表示しています。接続が戻ると自動的に同期します。"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'var(--bg-card)',
                whiteSpace: 'nowrap',
              }}
            >
              オフライン
            </span>
          )}

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
    opacity: isLoggedIn && isOnline ? 1 : 0.4,
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
            holidays={holidays}
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
            holidays={holidays}
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
