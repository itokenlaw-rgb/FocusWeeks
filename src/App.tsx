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
      focusSize3: { before: 0, after: 0 },
      focusSize5: { before: 0, after: 0 },
      useGoogleColors: true, 
    };

    if (saved) {
      try { 
        const parsed = JSON.parse(saved);

        if (parsed.useGoogleColors === undefined) {
          parsed.useGoogleColors = true;
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

  useEffect(() => {
    checkLoginStatus().then(loggedIn => {
      setIsLoggedIn(loggedIn);
      if (loggedIn) syncEvents();

      const url = new URL(window.location.href);
      if (url.searchParams.has('auth_success') || url.searchParams.has('auth_error')) {
        url.searchParams.delete('auth_success');
        url.searchParams.delete('auth_error');
        window.history.replaceState({}, '', url.toString());
      }
    });
  }, []);
  
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('focusweeks_events');
    return saved ? JSON.parse(saved) : [];
  });

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

  const handleLogout = useCallback(async () => {
    await logout();
    setIsLoggedIn(false);
  }, []);

  const syncEvents = async () => {
    setIsSyncing(true);
    try {
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 12 * 7);
      const end = new Date(today);
      end.setDate(today.getDate() + 42 * 7);

      if (isLoggedIn) {
        const localEvents = events.filter(e => e.id.startsWith('local-'));
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
      } else {
        console.error('Error syncing events:', error);
      }
    } finally {
      setIsSyncing(false);
    }
  };

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
          finalEvent = { ...eventData, id: eventData.id as string };
        }
        
        await syncEvents();
        setActiveForm(null);
        setIsBottomPanelOpen(false);
        return; 
      } catch (err) {
        console.error('Google API error, saving locally only:', err);
        finalEvent = {
          ...eventData,
          id: eventData.id || 'local-' + Date.now(),
        };
      }
    } else {
      finalEvent = {
        ...eventData