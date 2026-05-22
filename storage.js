// storage.js
// Handles local storage and settings persistence for FocusWeeks

const STORAGE_KEYS = {
  SETTINGS: 'focusweeks_settings',
  CALENDARS: 'focusweeks_calendars',
  LOCAL_EVENTS: 'focusweeks_local_events',
  DATA_VERSION: 'focusweeks_data_version'
};

// データバージョンを上げると古いlocalStorageが自動クリアされる
const CURRENT_DATA_VERSION = '3';

const DEFAULT_SETTINGS = {
  weekStart: 'monday',      // 'monday' or 'sunday'
  focusWeekSize: 3,        // 1, 2, or 3 (height multiplier)
  fontSize: 'medium'       // 'small', 'medium', 'large'
};

const DEFAULT_CALENDARS = [
  {
    id: 'cal_work',
    name: '仕事 (Work)',
    color: '#3b82f6', // Premium Blue
    visible: true,
    order: 0,
    url: ''
  },
  {
    id: 'cal_private',
    name: 'プライベート (Private)',
    color: '#10b981', // Premium Green
    visible: true,
    order: 1,
    url: ''
  },
  {
    id: 'cal_family',
    name: '家族・学校 (Family/School)',
    color: '#f59e0b', // Premium Orange/Amber
    visible: true,
    order: 2,
    url: ''
  }
];

const DEFAULT_EVENTS = [];

export const StorageManager = {
  // Settings Management
  getSettings() {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      this.saveSettings(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Calendars Management
  getCalendars() {
    const raw = localStorage.getItem(STORAGE_KEYS.CALENDARS);
    if (!raw) {
      this.saveCalendars(DEFAULT_CALENDARS);
      return [...DEFAULT_CALENDARS];
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch (e) {
      return [...DEFAULT_CALENDARS];
    }
  },

  saveCalendars(calendars) {
    localStorage.setItem(STORAGE_KEYS.CALENDARS, JSON.stringify(calendars));
  },

  // データバージョンをチェックし、古ければキャッシュをリセットする
  checkAndMigrateData() {
    const storedVersion = localStorage.getItem(STORAGE_KEYS.DATA_VERSION);
    if (storedVersion !== CURRENT_DATA_VERSION) {
      localStorage.removeItem(STORAGE_KEYS.LOCAL_EVENTS);
      localStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
    }
  },

  // Events Management (Gets cleared if you need to force-reload defaults)
  getEvents() {
    this.checkAndMigrateData();
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_EVENTS);
    if (!raw) {
      this.saveEvents(DEFAULT_EVENTS);
      return [...DEFAULT_EVENTS];
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [...DEFAULT_EVENTS];
    }
  },

  saveEvents(events) {
    localStorage.setItem(STORAGE_KEYS.LOCAL_EVENTS, JSON.stringify(events));
  },

  addEvent(event) {
    const events = this.getEvents();
    event.id = event.id || 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    events.push(event);
    this.saveEvents(events);
    return event;
  },

  updateEvent(updatedEvent) {
    let events = this.getEvents();
    events = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
    this.saveEvents(events);
    return updatedEvent;
  },

  deleteEvent(eventId) {
    let events = this.getEvents();
    events = events.filter(e => e.id !== eventId);
    this.saveEvents(events);
  },

  // 【重要】ブラウザのキャッシュ（古いデータ）を強制クリアして、上記の新しいデータを読み込ませる関数
  forceResetToNewDefaults() {
    localStorage.removeItem(STORAGE_KEYS.LOCAL_EVENTS);
    this.saveEvents(DEFAULT_EVENTS);
  }
};