// storage.js
// Handles local storage and settings persistence for FocusWeeks

const STORAGE_KEYS = {
  SETTINGS: 'focusweeks_settings',
  CALENDARS: 'focusweeks_calendars',
  LOCAL_EVENTS: 'focusweeks_local_events'
};

const DEFAULT_SETTINGS = {
  weekStart: 'monday',      // 'monday' or 'sunday'
  focusWeekSize: 3,        // 1, 2, or 3 (height multiplier)
  fontSize: 'medium'       // 'small', 'medium', 'large'
};

// Seed mock data matching the user's screenshots (May 2026)
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

// Seed events matching screenshot (May-June 2026)
const DEFAULT_EVENTS = [
  // Tuesday, May 19, 2026
  {
    id: 'seed_1',
    calendarId: 'cal_work',
    title: '齊藤祐介打ち合わせ',
    start: '2026-05-19T11:00:00',
    end: '2026-05-19T12:00:00',
    description: '打合せ'
  },
  {
    id: 'seed_2',
    calendarId: 'cal_private',
    title: '近藤さんウェブ面談',
    start: '2026-05-19T14:00:00',
    end: '2026-05-19T15:00:00',
    description: '定期面談'
  },
  // Wednesday, May 20, 2026
  {
    id: 'seed_3',
    calendarId: 'cal_work',
    title: '越野ｖｓ認証会議',
    start: '2026-05-20T13:30:00',
    end: '2026-05-20T14:30:00',
    description: ''
  },
  {
    id: 'seed_4',
    calendarId: 'cal_private',
    title: 'ハノイ神田打合せ',
    start: '2026-05-20T16:00:00',
    end: '2026-05-20T17:00:00',
    description: ''
  },
  // Thursday, May 21, 2026
  {
    id: 'seed_5',
    calendarId: 'cal_work',
    title: '東弁部会',
    start: '2026-05-21T14:30:00',
    end: '2026-05-21T15:30:00',
    description: ''
  },
  {
    id: 'seed_6',
    calendarId: 'cal_work',
    title: '東弁若手会合',
    start: '2026-05-21T15:00:00',
    end: '2026-05-21T16:00:00',
    description: ''
  },
  // Friday, May 22, 2026
  {
    id: 'seed_7',
    calendarId: 'cal_private',
    title: '後藤よしのり債権者集会',
    start: '2026-05-22T11:00:00',
    end: '2026-05-22T12:00:00',
    description: '債権者集会出席'
  },
  // Saturday, May 23, 2026
  {
    id: 'seed_8',
    calendarId: 'cal_family',
    title: '阪本小運動会',
    start: '2026-05-23T09:00:00',
    end: '2026-05-23T10:00:00',
    description: 'お弁当持参'
  },
  // Sunday, May 24, 2026 (Hourly view mock)
  {
    id: 'seed_9',
    calendarId: 'cal_private',
    title: '口おためし',
    start: '2026-05-24T09:00:00',
    end: '2026-05-24T10:00:00',
    description: 'サンプルイベント'
  },
  // Monday, May 25, 2026
  {
    id: 'seed_10',
    calendarId: 'cal_family',
    title: '阪本小振替休日',
    start: '2026-05-25T10:00:00',
    end: '2026-05-25T11:00:00',
    description: '学校休み'
  },
  // Tuesday, May 26, 2026
  {
    id: 'seed_11',
    calendarId: 'cal_work',
    title: '近藤行寛打ち合わせ',
    start: '2026-05-26T15:00:00',
    end: '2026-05-26T16:30:00',
    description: '進捗確認'
  },
  // Wednesday, May 27, 2026
  {
    id: 'seed_12',
    calendarId: 'cal_work',
    title: '人形町案件',
    start: '2026-05-27T10:00:00',
    end: '2026-05-27T11:00:00',
    description: ''
  },
  {
    id: 'seed_13',
    calendarId: 'cal_work',
    title: 'リックテレコ会議',
    start: '2026-05-27T13:00:00',
    end: '2026-05-27T14:00:00',
    description: ''
  },
  // Thursday, May 28, 2026
  {
    id: 'seed_14',
    calendarId: 'cal_family',
    title: '阪本小学校外学習',
    start: '2026-05-28T07:30:00',
    end: '2026-05-28T08:30:00',
    description: ''
  },
  {
    id: 'seed_15',
    calendarId: 'cal_work',
    title: 'リッケイ面談',
    start: '2026-05-28T11:00:00',
    end: '2026-05-28T12:00:00',
    description: ''
  },
  {
    id: 'seed_16',
    calendarId: 'cal_family',
    title: '阪本小３年校外学習',
    start: '2026-05-28T15:00:00',
    end: '2026-05-28T16:00:00',
    description: ''
  },
  // Thursday, June 4, 2026
  {
    id: 'seed_17',
    calendarId: 'cal_work',
    title: '弁護士業務研修',
    start: '2026-06-04T16:30:00',
    end: '2026-06-04T18:30:00',
    description: ''
  },
  // Saturday, June 13, 2026
  {
    id: 'seed_18',
    calendarId: 'cal_family',
    title: '阪本小土曜授業',
    start: '2026-06-13T09:00:00',
    end: '2026-06-13T10:00:00',
    description: ''
  }
];

export const StorageManager = {
  // Settings
  getSettings() {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Calendars
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

  // Events (both seeded & user created)
  getEvents() {
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

  // Helper to add a new event
  addEvent(event) {
    const events = this.getEvents();
    event.id = event.id || 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    events.push(event);
    this.saveEvents(events);
    return event;
  },

  // Helper to update an event
  updateEvent(updatedEvent) {
    let events = this.getEvents();
    events = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
    this.saveEvents(events);
  },

  // Helper to delete an event
  deleteEvent(eventId) {
    let events = this.getEvents();
    events = events.filter(e => e.id !== eventId);
    this.saveEvents(events);
  }
};
