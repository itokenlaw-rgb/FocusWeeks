// app.js
// Main application coordinator & controller for FocusWeeks

import { StorageManager } from './storage.js';
import { ICalParser } from './ical-parser.js';
import { MonthCalendar } from './calendar-month.js';
import { WeekCalendar } from './calendar-week.js';
import { GoogleAuth } from './google-auth.js';

// Global state
let currentView = 'month'; // 'month' or 'week'
let selectedDate = new Date();

// DOM elements
const elMonthView = document.getElementById('month-view');
const elWeekView = document.getElementById('week-view');
const btnToggleMonth = document.getElementById('toggle-month-btn');
const btnToggleWeek = document.getElementById('toggle-week-btn');

const btnNavToday = document.getElementById('nav-today-btn');
const elNavDateDisplay = document.getElementById('nav-date-display');
const btnTodayIcon = document.getElementById('today-icon-btn');
const elTodayIconDay = document.getElementById('today-icon-day');

const btnSettingsOpen = document.getElementById('nav-settings-btn');
const btnMenuOpen = document.getElementById('menu-btn');
const modalSettings = document.getElementById('settings-modal');
const btnSettingsClose = document.getElementById('settings-close-btn');
const btnSettingsSave = document.getElementById('settings-save-btn');

const modalEvent = document.getElementById('event-modal');
const btnEventClose = document.getElementById('event-close-btn');
const btnEventCancel = document.getElementById('event-cancel-btn');
const btnEventDelete = document.getElementById('event-delete-btn');
const formEvent = document.getElementById('event-form');
const btnFloatingAdd = document.getElementById('floating-add-btn');

// Bottom sheet elements
const elBottomSheet = document.getElementById('schedule-bottom-sheet');
const elSheetSlots = document.getElementById('sheet-slots-container');

// Settings form inputs
const setWeekStart = document.getElementById('settings-weekstart');
const setWeekSize = document.getElementById('settings-weeksize');
const setFontSize = document.getElementById('settings-fontsize');
const elCalendarList = document.getElementById('calendar-list-manager');

// Import elements
const inputImportName = document.getElementById('import-cal-name');
const inputImportUrl = document.getElementById('import-cal-url');
const btnImportUrl = document.getElementById('import-url-btn');
const inputImportFile = document.getElementById('import-file-input');

// Initialize the app
async function init() {
  // Handle Google OAuth callback if redirected back
  if (window.location.search.includes('code=')) {
    await GoogleAuth.handleCallback();
  }

  // Load settings & apply styles
  applySettingsTheme();

  // Set today icon day number
  const today = new Date();
  if (elTodayIconDay) {
    elTodayIconDay.textContent = today.getDate();
  }

  // Initialize view calendars
  MonthCalendar.init(onDaySelected);
  WeekCalendar.init(onDaySelected, openAddModal, openEditModal);

// Switch to default view
  switchView('month');

  // 【変更】初期起動時は「今日」を選択しますが、ボトムシートは表示させないため
  // onDaySelected(selectedDate); の代わりに、ボトムシートを表示しない初期化を行います。
  selectedDate = new Date();
  populateBottomSheet(selectedDate);
  elBottomSheet.classList.remove('open'); // 初期状態は確実に閉じる

  // Bind core event listeners
  bindEvents();
}


// Format selected date for standard Japanese style, e.g. "2026年5月22日(金)"
function formatJapaneseDate(date) {
  const daysJa = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${daysJa[date.getDay()]})`;
}

// Update local state when a date is selected in calendars
function onDaySelected(date) {
  selectedDate = new Date(date);
  
  // Refresh bottom sheet list
  populateBottomSheet(selectedDate);
  
  // 【追加】日付がタップされたら個別予定欄（ボトムシート）を表示する
  if (currentView === 'month') {
    elBottomSheet.classList.add('open');
  }

  // Keep both calendars in sync
  if (currentView === 'month') {
    WeekCalendar.selectedDate = selectedDate;
  } else {
    MonthCalendar.selectedDate = selectedDate;
  }
}

// Render schedule list inside Bottom Sheet (3 slots min)
function populateBottomSheet(date) {
  const dateKey = formatDateKey(date);
  const calendars = StorageManager.getCalendars();
  const allEvents = StorageManager.getEvents();

  // Map calendar info
  const visibleCalIds = new Set(calendars.filter(c => c.visible).map(c => c.id));
  const calMap = {};
  calendars.forEach(c => { calMap[c.id] = c; });

  // Filter & Sort events for the day
  const dayEvents = allEvents.filter(evt => {
    if (!visibleCalIds.has(evt.calendarId)) return false;
    return evt.start.split('T')[0] === dateKey;
  }).sort((a, b) => {
    const timeA = a.start.includes('T') ? a.start.split('T')[1] : '00:00:00';
    const timeB = b.start.includes('T') ? b.start.split('T')[1] : '00:00:00';
    return timeA.localeCompare(timeB);
  });

  elSheetSlots.innerHTML = '';

  const slotsCount = 3;
  const listItems = [];

  // Create slot elements
  for (let i = 0; i < slotsCount; i++) {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'sheet-slot';

    if (dayEvents[i]) {
      // Filled Slot
      const evt = dayEvents[i];
      const cal = calMap[evt.calendarId] || { color: '#3b82f6' };

      slotDiv.classList.add('filled');
      
      const infoDiv = document.createElement('div');
      infoDiv.className = 'slot-event-info';

      const dot = document.createElement('span');
      dot.className = 'slot-event-color';
      dot.style.backgroundColor = cal.color;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'slot-event-time';
      if (evt.allDay) {
        timeSpan.textContent = '終日';
      } else {
        const startT = evt.start.split('T')[1]?.substring(0, 5) || '00:00';
        const endT = evt.end?.split('T')[1]?.substring(0, 5) || '';
        timeSpan.textContent = endT ? `${startT}～${endT}` : startT;
      }

      const titleSpan = document.createElement('span');
      titleSpan.className = 'slot-event-title';
      titleSpan.textContent = evt.title;

      infoDiv.appendChild(dot);
      infoDiv.appendChild(timeSpan);
      infoDiv.appendChild(titleSpan);

      const iconDiv = document.createElement('div');
      iconDiv.className = 'slot-event-icon';
      iconDiv.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>'; // Edit icon

      slotDiv.appendChild(infoDiv);
      slotDiv.appendChild(iconDiv);

      // Click to edit
      slotDiv.addEventListener('click', () => {
        openEditModal(evt);
      });
    } else {
      // Empty Slot
      if (dayEvents.length === 0 && i === 0) {
        // First slot shows "予定がありません" if zero events
        slotDiv.innerHTML = `<span class="slot-empty-msg">予定がありません (クリックして追加)</span>`;
      } else {
        slotDiv.innerHTML = `<span class="slot-empty-msg">+ 予定を追加</span>`;
      }

      // Default start hour for empty slots: e.g. slot 0 -> 10:00, slot 1 -> 13:00, slot 2 -> 15:00
      const defaultTimes = ['10:00', '13:00', '15:00'];
      slotDiv.addEventListener('click', () => {
        openAddModal(date, defaultTimes[i]);
      });
    }

    elSheetSlots.appendChild(slotDiv);
  }

  // If there are more than 3 events, append them below
  if (dayEvents.length > slotsCount) {
    for (let i = slotsCount; i < dayEvents.length; i++) {
      const evt = dayEvents[i];
      const cal = calMap[evt.calendarId] || { color: '#3b82f6' };

      const extraDiv = document.createElement('div');
      extraDiv.className = 'sheet-slot filled';

      const infoDiv = document.createElement('div');
      infoDiv.className = 'slot-event-info';

      const dot = document.createElement('span');
      dot.className = 'slot-event-color';
      dot.style.backgroundColor = cal.color;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'slot-event-time';
      if (evt.allDay) {
        timeSpan.textContent = '終日';
      } else {
        const startT = evt.start.split('T')[1]?.substring(0, 5) || '00:00';
        const endT = evt.end?.split('T')[1]?.substring(0, 5) || '';
        timeSpan.textContent = endT ? `${startT}～${endT}` : startT;
      }

      const titleSpan = document.createElement('span');
      titleSpan.className = 'slot-event-title';
      titleSpan.textContent = evt.title;

      infoDiv.appendChild(dot);
      infoDiv.appendChild(timeSpan);
      infoDiv.appendChild(titleSpan);

      const iconDiv = document.createElement('div');
      iconDiv.className = 'slot-event-icon';
      iconDiv.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';

      extraDiv.appendChild(infoDiv);
      extraDiv.appendChild(iconDiv);

      extraDiv.addEventListener('click', () => {
        openEditModal(evt);
      });

      elSheetSlots.appendChild(extraDiv);
    }
  }

// Ensure sheet slides up when day changes
  // 【変更】この自動で 'open' を付与する処理を削除、または条件付きにします。
  // 日付タップ時のみ開くようにするため、ここでは何もしません（selectDay側で制御します）。
  // elBottomSheet.classList.add('open'); <-- コメントアウトまたは削除
}

// Switch between Month View and Week View
function switchView(view) {
  currentView = view;
  if (view === 'month') {
    elMonthView.style.display = 'flex';
    elWeekView.style.display = 'none';
    btnToggleMonth.classList.add('active');
    btnToggleWeek.classList.remove('active');
    MonthCalendar.render();
  } else {
    elMonthView.style.display = 'none';
    elWeekView.style.display = 'flex';
    btnToggleMonth.classList.remove('active');
    btnToggleWeek.classList.add('active');
    WeekCalendar.render(selectedDate);
  }
}

// Load configurations and set body class font size scales
function applySettingsTheme() {
  const settings = StorageManager.getSettings();
  document.body.className = `font-${settings.fontSize}`;
}

// Open Event Add Modal
function openAddModal(date, defaultTime = '10:00') {
  document.getElementById('event-modal-title').textContent = '予定の追加';
  document.getElementById('event-id').value = '';
  document.getElementById('event-title').value = '';
  
  // Prefill calendar selector
  populateCalendarSelect();

  // Dates
  const dateKey = formatDateKey(date);
  document.getElementById('event-start-date').value = dateKey;
  document.getElementById('event-end-date').value = dateKey;

  // Times
  document.getElementById('event-start-time').value = defaultTime;
  // Default end time + 1 hour
  const [h, m] = defaultTime.split(':').map(Number);
  const endH = String((h + 1) % 24).padStart(2, '0');
  document.getElementById('event-end-time').value = `${endH}:${String(m).padStart(2, '0')}`;

  document.getElementById('event-allday').checked = false;
  document.getElementById('event-start-time-group').style.display = 'flex';
  document.getElementById('event-end-time-group').style.display = 'flex';
  document.getElementById('event-desc').value = '';

  btnEventDelete.style.display = 'none';
  modalEvent.classList.add('open');
}

// Open Event Edit Modal
function openEditModal(evt) {
  document.getElementById('event-modal-title').textContent = '予定の編集';
  document.getElementById('event-id').value = evt.id;
  document.getElementById('event-title').value = evt.title;
  
  populateCalendarSelect(evt.calendarId);

  // Parse start date & time
  const startParts = evt.start.split('T');
  document.getElementById('event-start-date').value = startParts[0];
  if (startParts[1]) {
    document.getElementById('event-start-time').value = startParts[1].substring(0, 5);
  } else {
    document.getElementById('event-start-time').value = '10:00';
  }

  // Parse end date & time
  if (evt.end) {
    const endParts = evt.end.split('T');
    document.getElementById('event-end-date').value = endParts[0];
    if (endParts[1]) {
      document.getElementById('event-end-time').value = endParts[1].substring(0, 5);
    } else {
      document.getElementById('event-end-time').value = '11:00';
    }
  } else {
    document.getElementById('event-end-date').value = startParts[0];
    document.getElementById('event-end-time').value = '11:00';
  }

  const allDay = !!evt.allDay;
  document.getElementById('event-allday').checked = allDay;
  document.getElementById('event-start-time-group').style.display = allDay ? 'none' : 'flex';
  document.getElementById('event-end-time-group').style.display = allDay ? 'none' : 'flex';

  document.getElementById('event-desc').value = evt.description || '';

  btnEventDelete.style.display = 'block';
  modalEvent.classList.add('open');
}

// Prefill event modal calendar drop down
function populateCalendarSelect(selectedId = '') {
  const select = document.getElementById('event-calendar');
  select.innerHTML = '';
  
  const calendars = StorageManager.getCalendars();
  calendars.forEach(cal => {
    const opt = document.createElement('option');
    opt.value = cal.id;
    opt.textContent = cal.name;
    if (cal.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

// Bind clicks & input changes
function bindEvents() {
  // View Toggle Buttons
  btnToggleMonth.addEventListener('click', () => switchView('month'));
  btnToggleWeek.addEventListener('click', () => switchView('week'));

  // Today actions
  btnNavToday.addEventListener('click', jumpToToday);
  btnTodayIcon.addEventListener('click', jumpToToday);

  // Settings Panel Buttons
  const toggleSettings = () => {
    if (modalSettings.classList.contains('open')) {
      modalSettings.classList.remove('open');
    } else {
      populateSettingsModal();
      modalSettings.classList.add('open');
    }
  };
  btnSettingsOpen.addEventListener('click', toggleSettings);
  btnMenuOpen.addEventListener('click', toggleSettings);
  btnSettingsClose.addEventListener('click', () => modalSettings.classList.remove('open'));
  btnSettingsSave.addEventListener('click', () => modalSettings.classList.remove('open'));

  // Event modal buttons
  btnEventClose.addEventListener('click', () => modalEvent.classList.remove('open'));
  btnEventCancel.addEventListener('click', () => modalEvent.classList.remove('open'));
  
  btnFloatingAdd.addEventListener('click', () => {
    openAddModal(selectedDate);
  });

  // Handle Event all day check toggle
  document.getElementById('event-allday').addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.getElementById('event-start-time-group').style.display = checked ? 'none' : 'flex';
    document.getElementById('event-end-time-group').style.display = checked ? 'none' : 'flex';
  });

  // Save/Add Event Form Submit
  formEvent.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = document.getElementById('event-id').value;
    const title = document.getElementById('event-title').value;
    const calendarId = document.getElementById('event-calendar').value;
    const startDate = document.getElementById('event-start-date').value;
    const endDate = document.getElementById('event-end-date').value;
    const allDay = document.getElementById('event-allday').checked;
    const desc = document.getElementById('event-desc').value;

    let start = startDate;
    let end = endDate;

    if (!allDay) {
      const startTime = document.getElementById('event-start-time').value || '00:00';
      const endTime = document.getElementById('event-end-time').value || '00:00';
      start = `${startDate}T${startTime}:00`;
      end = `${endDate}T${endTime}:00`;
    }

    const eventData = {
      id: id || null,
      calendarId,
      title,
      start,
      end,
      allDay,
      description: desc
    };

    if (id) {
      StorageManager.updateEvent(eventData);
    } else {
      StorageManager.addEvent(eventData);
    }

    modalEvent.classList.remove('open');
    refreshAllViews();
  });

  // Delete Event
  btnEventDelete.addEventListener('click', () => {
    const id = document.getElementById('event-id').value;
    if (id && confirm('この予定を削除しますか？')) {
      StorageManager.deleteEvent(id);
      modalEvent.classList.remove('open');
      refreshAllViews();
    }
  });

  // Settings Modifiers
  bindSettingsControl(setWeekStart, 'weekStart', () => refreshAllViews());
  bindSettingsControl(setWeekSize, 'focusWeekSize', () => refreshAllViews(), true);
  bindSettingsControl(setFontSize, 'fontSize', () => {
    applySettingsTheme();
    refreshAllViews();
  });

  // iCal Sync Buttons
  btnImportUrl.addEventListener('click', importCalendarFromUrl);
  inputImportFile.addEventListener('change', importCalendarFromFile);
}

// Bind segmented selector settings control
function bindSettingsControl(container, key, callback, isNumber = false) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented-btn');
    if (!btn) return;
    
    // Toggle active classes
    container.querySelectorAll('.segmented-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    let val = btn.dataset.value;
    if (isNumber) val = parseInt(val, 10);

    const settings = StorageManager.getSettings();
    settings[key] = val;
    StorageManager.saveSettings(settings);

    if (callback) callback();
  });
}

// Prefill setting components
function populateSettingsModal() {
  const settings = StorageManager.getSettings();

  // Segments
  selectSegmentValue(setWeekStart, settings.weekStart);
  selectSegmentValue(setWeekSize, settings.focusWeekSize);
  selectSegmentValue(setFontSize, settings.fontSize);

  // Calendar List Manager
  renderSettingsCalendars();

  // Google Calendar Auth Section
  renderGoogleAuthSection();
}

function selectSegmentValue(container, val) {
  container.querySelectorAll('.segmented-btn').forEach(btn => {
    if (btn.dataset.value == val) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Render Google Calendar authentication section
async function renderGoogleAuthSection() {
  const section = document.getElementById('google-auth-section');
  if (!section) return;

  if (GoogleAuth.isLoggedIn()) {
    const info = GoogleAuth.getAccountInfo();
    section.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; padding:10px; background:var(--bg-secondary); border-radius:10px; margin-bottom:10px;">
        ${info.picture ? `<img src="${info.picture}" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;" referrerpolicy="no-referrer">` : ''}
        <div style="flex:1; min-width:0;">
          <div style="font-size:var(--font-sm); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${info.name || ''}</div>
          <div style="font-size:11px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${info.email || ''}</div>
        </div>
        <button id="google-logout-btn" class="btn btn-secondary" style="font-size:12px; padding:6px 10px; flex-shrink:0;">ログアウト</button>
      </div>
      <button id="google-sync-btn" class="btn btn-primary" style="width:100%; padding:10px;">
        <span>Googleカレンダーを同期</span>
      </button>
      <div id="google-sync-status" style="font-size:12px; color:var(--text-secondary); margin-top:6px; text-align:center;"></div>
    `;

    document.getElementById('google-logout-btn').addEventListener('click', () => {
      GoogleAuth.logout();
      renderGoogleAuthSection();
    });

    document.getElementById('google-sync-btn').addEventListener('click', async () => {
      const syncBtn = document.getElementById('google-sync-btn');
      const statusEl = document.getElementById('google-sync-status');
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<span>取得中...</span>';
      statusEl.textContent = '';

      try {
        const calList = await GoogleAuth.fetchCalendarList();
        if (!calList.length) {
          statusEl.textContent = 'カレンダーが見つかりませんでした。';
          syncBtn.disabled = false;
          syncBtn.innerHTML = '<span>Googleカレンダーを同期</span>';
          return;
        }

        let totalSynced = 0;
        for (const gcal of calList) {
          statusEl.textContent = `同期中: ${gcal.summary}...`;
          const count = await GoogleAuth.syncCalendar(gcal);
          totalSynced += count;
        }

        statusEl.textContent = `✓ 同期完了（${totalSynced}件のイベントを取得）`;
        renderSettingsCalendars();
        refreshAllViews();
      } catch (err) {
        statusEl.textContent = `エラー: ${err.message}`;
      } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = '<span>Googleカレンダーを同期</span>';
      }
    });

  } else {
    section.innerHTML = `
      <p style="font-size:var(--font-sm); color:var(--text-secondary); margin-bottom:10px; line-height:1.5;">
        Googleアカウントでログインすると、Googleカレンダーの予定をこのアプリに取り込めます。
      </p>
      <button id="google-login-btn" class="btn btn-primary" style="width:100%; padding:10px; display:flex; align-items:center; justify-content:center; gap:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Googleでログイン
      </button>
    `;

    document.getElementById('google-login-btn').addEventListener('click', () => {
      GoogleAuth.startLogin();
    });
  }
}

// Render list of imported calendars with toggle visibility, reorder, and custom colors
function renderSettingsCalendars() {
  elCalendarList.innerHTML = '';
  const calendars = StorageManager.getCalendars();

  calendars.forEach((cal, index) => {
    const item = document.createElement('div');
    item.className = 'calendar-item';
    item.dataset.id = cal.id;

    const left = document.createElement('div');
    left.className = 'calendar-item-info';

    // Drag handle / Reorder buttons (▲ ▼)
    const upBtn = document.createElement('button');
    upBtn.className = 'icon-btn';
    upBtn.style.width = '24px';
    upBtn.style.height = '24px';
    upBtn.style.fontSize = '12px';
    upBtn.innerHTML = '▲';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveCalendar(index, -1));

    const downBtn = document.createElement('button');
    downBtn.className = 'icon-btn';
    downBtn.style.width = '24px';
    downBtn.style.height = '24px';
    downBtn.style.fontSize = '12px';
    downBtn.innerHTML = '▼';
    downBtn.disabled = index === calendars.length - 1;
    downBtn.addEventListener('click', () => moveCalendar(index, 1));

    // Color dot picker
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'calendar-color-dot';
    colorPicker.value = cal.color;
    colorPicker.style.padding = '0';
    colorPicker.style.border = 'none';
    colorPicker.addEventListener('change', (e) => {
      cal.color = e.target.value;
      StorageManager.saveCalendars(calendars);
      refreshAllViews();
    });

    const nameSpan = document.createElement('span');
    nameSpan.style.fontWeight = '600';
    nameSpan.style.fontSize = '14px';
    nameSpan.textContent = cal.name;

    left.appendChild(upBtn);
    left.appendChild(downBtn);
    left.appendChild(colorPicker);
    left.appendChild(nameSpan);

    const right = document.createElement('div');
    right.className = 'calendar-item-actions';

    // Visible checkbox
    const visibleChk = document.createElement('input');
    visibleChk.type = 'checkbox';
    visibleChk.checked = cal.visible;
    visibleChk.style.cursor = 'pointer';
    visibleChk.addEventListener('change', (e) => {
      cal.visible = e.target.checked;
      StorageManager.saveCalendars(calendars);
      refreshAllViews();
    });

    right.appendChild(visibleChk);

    // Delete calendar (only if it's not a seeded calendar or if custom imported)
    // To make it easy, allow deleting any calendar except it prompts confirm
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.style.width = '28px';
    delBtn.style.height = '28px';
    delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    delBtn.addEventListener('click', () => {
      if (confirm(`カレンダー「${cal.name}」とそれに紐づく予定をすべて削除しますか？`)) {
        // Delete calendar
        const updated = calendars.filter(c => c.id !== cal.id);
        StorageManager.saveCalendars(updated);
        // Delete all events in this calendar
        const events = StorageManager.getEvents().filter(e => e.calendarId !== cal.id);
        StorageManager.saveEvents(events);
        
        renderSettingsCalendars();
        refreshAllViews();
      }
    });
    right.appendChild(delBtn);

    item.appendChild(left);
    item.appendChild(right);
    elCalendarList.appendChild(item);
  });
}

// Reorder calendar order
function moveCalendar(index, direction) {
  const calendars = StorageManager.getCalendars();
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= calendars.length) return;

  // Swap order values
  const temp = calendars[index];
  calendars[index] = calendars[targetIndex];
  calendars[targetIndex] = temp;

  // Reset order indexes cleanly
  calendars.forEach((c, idx) => c.order = idx);

  StorageManager.saveCalendars(calendars);
  renderSettingsCalendars();
  refreshAllViews();
}

// Import calendar via Google Calendar public address url
async function importCalendarFromUrl() {
  const name = inputImportName.value.trim() || 'インポートカレンダー';
  const url = inputImportUrl.value.trim();

  if (!url) {
    alert('URLを入力してください。');
    return;
  }

  btnImportUrl.textContent = '読み込み中...';
  btnImportUrl.disabled = true;

  try {
    // Attempt fetch. Since CORS blocks might happen, we try direct first
    // If it fails, we inform the user to download the file, or try standard proxy
    let response;
    try {
      response = await fetch(url);
    } catch (corsErr) {
      // Proxy alternative to bypass CORS
      console.warn("Direct fetch blocked by CORS, trying open proxy...");
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      response = await fetch(proxyUrl);
    }

    if (!response.ok) throw new Error('カレンダーの取得に失敗しました。');
    
    const icsText = await response.text();
    const calendarId = 'cal_import_' + Date.now();
    const parsedEvents = ICalParser.parse(icsText, calendarId);

    if (parsedEvents.length === 0) {
      throw new Error('予定が見つからないか、iCalフォーマットが正しくありません。');
    }

    // Add calendar to settings
    const calendars = StorageManager.getCalendars();
    const colors = ['#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#a855f7']; // Cool pastel colors
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newCal = {
      id: calendarId,
      name: name,
      color: randomColor,
      visible: true,
      order: calendars.length,
      url: url
    };
    calendars.push(newCal);
    StorageManager.saveCalendars(calendars);

    // Save parsed events
    const allEvents = StorageManager.getEvents();
    StorageManager.saveEvents([...allEvents, ...parsedEvents]);

    // Reset inputs
    inputImportName.value = '';
    inputImportUrl.value = '';
    
    alert(`成功: ${parsedEvents.length} 件の予定をインポートしました！`);
    renderSettingsCalendars();
    refreshAllViews();
  } catch (err) {
    console.error(err);
    alert(`エラー: カレンダーを読み込めませんでした。\n理由: ${err.message}\n\n※ GoogleカレンダーのICSファイルをPC等でダウンロードし、下の「ICSファイルを選択」からアップロードすると確実にインポートできます。`);
  } finally {
    btnImportUrl.textContent = 'URLからインポート';
    btnImportUrl.disabled = false;
  }
}

// Import calendar via local uploaded ICS file (100% reliable - bypasses CORS)
function importCalendarFromFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const name = inputImportName.value.trim() || file.name.replace('.ics', '');
  const reader = new FileReader();

  reader.onload = function(evt) {
    try {
      const icsText = evt.target.result;
      const calendarId = 'cal_import_' + Date.now();
      const parsedEvents = ICalParser.parse(icsText, calendarId);

      if (parsedEvents.length === 0) {
        throw new Error('予定が見つからないか、iCalフォーマットが正しくありません。');
      }

      const calendars = StorageManager.getCalendars();
      const colors = ['#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#a855f7'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const newCal = {
        id: calendarId,
        name: name,
        color: randomColor,
        visible: true,
        order: calendars.length,
        url: 'file_upload'
      };
      calendars.push(newCal);
      StorageManager.saveCalendars(calendars);

      const allEvents = StorageManager.getEvents();
      StorageManager.saveEvents([...allEvents, ...parsedEvents]);

      // Reset
      inputImportName.value = '';
      inputImportFile.value = '';

      alert(`成功: ${parsedEvents.length} 件の予定をインポートしました！`);
      renderSettingsCalendars();
      refreshAllViews();
    } catch (err) {
      console.error(err);
      alert('ICSファイルの解析に失敗しました。ファイルが正しいiCal形式であることを確認してください。');
    }
  };

  reader.readAsText(file);
}

// Jump to today
function jumpToToday() {
  selectedDate = new Date();
  onDaySelected(selectedDate);
  
  if (currentView === 'month') {
    MonthCalendar.selectedDate = selectedDate;
    MonthCalendar.render();
    MonthCalendar.scrollToToday();
  } else {
    WeekCalendar.selectedDate = selectedDate;
    WeekCalendar.render(selectedDate);
  }
}

// Re-render and rebuild layouts
function refreshAllViews() {
  if (currentView === 'month') {
    MonthCalendar.render();
  } else {
    WeekCalendar.render(selectedDate);
  }
  populateBottomSheet(selectedDate);
}

// Helper date keys
function formatDateKey(date) {
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// PWA Service Workerの登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker 登録成功:', reg.scope))
      .catch((err) => console.error('Service Worker 登録失敗:', err));
  });
}

// Run initializer
init();

