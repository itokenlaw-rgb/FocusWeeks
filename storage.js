// storage.js
// Handles local storage and settings persistence for FocusWeeks

const STORAGE_KEYS = {
  SETTINGS: 'focusweeks_settings',
  CALENDARS: 'focusweeks_calendars',
  LOCAL_EVENTS: 'focusweeks_local_events',
  DATA_VERSION: 'focusweeks_data_version'
};

// データバージョンを上げると古いlocalStorageが自動クリアされる
const CURRENT_DATA_VERSION = '2';

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

// 【大幅拡充】2026年5月（過去・先週）から未来1年分（2027年にかけて）の予定データを投入
const DEFAULT_EVENTS = [
  // --- 5月前半（過去・先週以前の予定） ---
  { id: 'evt_past_1', calendarId: 'cal_work', title: 'GW進捗確認ミーティング', start: '2026-05-01T10:00:00', end: '2026-05-01T11:30:00', allDay: false },
  { id: 'evt_past_2', calendarId: 'cal_private', title: '美容院予約', start: '2026-05-02T14:00:00', end: '2026-05-02T15:30:00', allDay: false },
  { id: 'evt_past_3', calendarId: 'cal_family', title: 'こどもの日 家族夕食', start: '2026-05-05T18:00:00', end: '2026-05-05T21:00:00', allDay: false },
  { id: 'evt_past_4', calendarId: 'cal_work', title: '先週の定例部会', start: '2026-05-11T09:30:00', end: '2026-05-11T11:00:00', allDay: false },
  { id: 'evt_past_5', calendarId: 'cal_private', title: 'ジムトレーニング', start: '2026-05-13T19:00:00', end: '2026-05-13T20:00:00', allDay: false },
  { id: 'evt_past_6', calendarId: 'cal_family', title: '学校提出書類 締め切り', start: '2026-05-15', end: '2026-05-15', allDay: true },

  // --- 5月中旬・今週（現在の画面で見えている付近） ---
  { id: 'evt_now_1', calendarId: 'cal_work', title: '企画レビュー会議', start: '2026-05-18T14:00:00', end: '2026-05-18T16:00:00', allDay: false },
  { id: 'evt_now_2', calendarId: 'cal_private', title: '歯医者定期検診', start: '2026-05-19T10:30:00', end: '2026-05-19T11:30:00', allDay: false },
  { id: 'evt_now_3', calendarId: 'cal_work', title: 'クライアント商談', start: '2026-05-20T13:00:00', end: '2026-05-20T14:30:00', allDay: false },
  { id: 'evt_now_4', calendarId: 'cal_family', title: '週末の買い物リスト作成', start: '2026-05-22T21:00:00', end: '2026-05-22T21:30:00', allDay: false },
  { id: 'evt_now_5', calendarId: 'cal_private', title: '友人宅でホムパ', start: '2026-05-23T12:00:00', end: '2026-05-23T17:00:00', allDay: false },
  { id: 'evt_now_6', calendarId: 'cal_family', title: '部屋の大掃除・衣替え', start: '2026-05-24', end: '2026-05-24', allDay: true },

  // --- 6月の予定（未来の予定その1） ---
  { id: 'evt_jun_1', calendarId: 'cal_work', title: 'プロモーション施策開始', start: '2026-06-01T09:00:00', end: '2026-06-01T10:00:00', allDay: false },
  { id: 'evt_jun_2', calendarId: 'cal_family', title: '学校日曜参観', start: '2026-06-07T08:45:00', end: '2026-06-07T12:00:00', allDay: false },
  { id: 'evt_jun_3', calendarId: 'cal_work', title: 'Q2中間振り返り面談', start: '2026-06-10T15:30:00', end: '2026-06-10T17:00:00', allDay: false },
  { id: 'evt_jun_4', calendarId: 'cal_private', title: '夏フェスチケット抽選発表', start: '2026-06-12', end: '2026-06-12', allDay: true },
  { id: 'evt_jun_5', calendarId: 'cal_work', title: '新プロジェクトキックオフ', start: '2026-06-16T13:00:00', end: '2026-06-16T15:00:00', allDay: false },
  { id: 'evt_jun_6', calendarId: 'cal_family', title: '衣類クリーニング引き取り', start: '2026-06-20T11:00:00', end: '2026-06-20T12:00:00', allDay: false },
  { id: 'evt_jun_7', calendarId: 'cal_private', title: '週末温泉旅行（箱根）', start: '2026-06-27', end: '2026-06-28', allDay: true },
  { id: 'evt_jun_8', calendarId: 'cal_work', title: '月末経費精算締め切り', start: '2026-06-30T17:00:00', end: '2026-06-30T18:00:00', allDay: false },

  // --- 7月の予定（未来の予定その2） ---
  { id: 'evt_jul_1', calendarId: 'cal_work', title: '下半期戦略会議', start: '2026-07-01T10:00:00', end: '2026-07-01T12:00:00', allDay: false },
  { id: 'evt_jul_2', calendarId: 'cal_family', title: '七夕 飾り付け', start: '2026-07-07', end: '2026-07-07', allDay: true },
  { id: 'evt_jul_3', calendarId: 'cal_private', title: '海開き・ビーチBBQ', start: '2026-07-11T11:00:00', end: '2026-07-11T16:00:00', allDay: false },
  { id: 'evt_jul_4', calendarId: 'cal_family', title: '子供の夏休みスタート', start: '2026-07-21', end: '2026-07-21', allDay: true },
  { id: 'evt_jul_5', calendarId: 'cal_work', title: 'クライアント夏季挨拶回り', start: '2026-07-24T14:00:00', end: '2026-07-24T16:00:00', allDay: false },

  // --- 8月の予定（未来の予定その3） ---
  { id: 'evt_aug_1', calendarId: 'cal_private', title: '花火大会観覧予約', start: '2026-08-08T18:30:00', end: '2026-08-08T21:00:00', allDay: false },
  { id: 'evt_aug_2', calendarId: 'cal_family', title: 'お盆休み帰省（実家）', start: '2026-08-12', end: '2026-08-16', allDay: true },
  { id: 'evt_aug_3', calendarId: 'cal_work', title: '夏季休暇明け全体ミーティング', start: '2026-08-17T09:30:00', end: '2026-08-17T11:00:00', allDay: false },

  // --- 9月〜12月（秋・冬の予定） ---
  { id: 'evt_sep_1', calendarId: 'cal_work', title: '期末決算説明会準備', start: '2026-09-15T13:00:00', end: '2026-09-15T15:00:00', Day: false },
  { id: 'evt_oct_1', calendarId: 'cal_family', title: '地域の秋祭り・運動会', start: '2026-10-11T09:00:00', end: '2026-10-11T15:00:00', allDay: false },
  { id: 'evt_nov_1', calendarId: 'cal_private', title: '紅葉狩りドライブ', start: '2026-11-14T08:00:00', end: '2026-11-14T17:00:00', allDay: false },
  { id: 'evt_dec_1', calendarId: 'cal_family', title: 'クリスマス家族パーティー', start: '2026-12-25T18:00:00', end: '2026-12-25T21:00:00', allDay: false },
  { id: 'evt_dec_2', calendarId: 'cal_work', title: '仕事納め・大掃除', start: '2026-12-28', end: '2026-12-28', allDay: true },

  // --- 来年（2027年1月以降） ---
  { id: 'evt_jan_1', calendarId: 'cal_private', title: '初詣・お正月休み', start: '2027-01-01', end: '2027-01-03', allDay: true },
  { id: 'evt_jan_2', calendarId: 'cal_work', title: '新年賀詞交歓会', start: '2027-01-05T11:00:00', end: '2027-01-05T13:00:00', allDay: false }
];

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