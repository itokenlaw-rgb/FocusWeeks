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

  // 現在時刻