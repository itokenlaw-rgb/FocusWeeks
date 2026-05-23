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
  // Google OAuth コールバック処理（リダイレクト後）
  if (window.location.search.includes('code=')) {
    const success = await GoogleAuth.handleCallback();
    if (success) {
      // URLから認可コードパラメータを綺麗に削除
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // バックグラウンドで全自動同期を開始（完了を待つ）
      await syncAllGoogleCalendarsBackground();
    }
  }

  // Load settings & apply styles
  applySettingsTheme();

  // 起動時、またはログイン直後にUI状態（ボタン表示など）を最新にする
  renderGoogleAuthSection();
  renderSettingsCalendars();

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

  // 初期状態は確実に閉じる
  selectedDate = new Date();
  populateBottomSheet(selectedDate);
  elBottomSheet.classList.remove('open');

  // Bind core event listeners
  bindEvents();
}

// 追加：ログイン直後にすべてを全自動・バックグラウンドで同期するロジック
async function syncAllGoogleCalendarsBackground() {
  try {
    // 1. カレンダー一覧をAPIから取得
    const gcals = await GoogleAuth.fetchCalendarList();
    if (!gcals || !gcals.length) return;

    // 2. すべてのカレンダーを対象に、バックグラウンドで並列同期処理を実行
    const syncPromises = gcals.map(async (gcal) => {
      try {
        await GoogleAuth.syncCalendar(gcal);
      } catch (err) {
        console.error(`バックグラウンド同期エラー (${gcal.summary}):`, err);
      }
    });

    // すべての同期処理の完了を待つ
    await Promise.all(syncPromises);

    // 3. 同期が完了したら画面表示を完全に更新（予定がカレンダーに現れる）
    renderSettingsCalendars();
    renderGoogleAuthSection();
    refreshAllViews();
    
    console.log("Googleカレンダーの全自動バックグラウンド同期が完了しました。");
  } catch (error) {
    console.error("全自動バックグラウンド同期の開始に失敗しました:", error);
  }
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
      populateSettingsModal(); // ここで renderGoogleAuthSection() が実行されます
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

  // Google Auth Section
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
    let response;
    try {
      response = await fetch(url);
    } catch (corsErr) {
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

    const calendars = StorageManager.getCalendars();
    const colors = ['#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#a855f7'];
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

    const allEvents = StorageManager.getEvents();
    StorageManager.saveEvents([...allEvents, ...parsedEvents]);

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

// Import calendar via local uploaded ICS file
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

// ---- Google Calendar Sync UI ----

function renderGoogleAuthSection() {
  const container = document.getElementById('google-auth-section');
  if (!container) return;
  container.innerHTML = '';

  if (!GoogleAuth.isLoggedIn()) {
    // 未ログイン
    container.innerHTML = `
      <button id="google-login-btn" class="btn btn-google" style="width:100%; display:flex; align-items:center; justify-content:center; gap:10px; padding:10px 16px; background:#fff; color:#3c4043; border:1.5px solid #dadce0; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer;">
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Googleでログイン
      </button>
      <p style="font-size:11px; color:var(--text-secondary); text-align:center; margin-top:6px; line-height:1.4;">
        Googleカレンダーの予定を直接同期できます。
      </p>
    `;
    document.getElementById('google-login-btn').addEventListener('click', () => GoogleAuth.startLogin());
  } else {
    // ログイン済み
    const info = GoogleAuth.getAccountInfo();
    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--bg-secondary); border-radius:8px; margin-bottom:10px;">
        ${info.picture ? `<img src="${info.picture}" style="width:32px;height:32px;border-radius:50%;" referrerpolicy="no-referrer">` : ''}
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${info.name || ''}</div>
          <div style="font-size:11px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${info.email || ''}</div>
        </div>
        <button id="google-logout-btn" class="btn btn-secondary" style="font-size:11px; padding:4px 10px; white-space:nowrap;">ログアウト</button>
      </div>
      <button id="google-sync-btn" class="btn btn-primary" style="width:100%; padding:9px; display:flex; align-items:center; justify-content:center; gap:8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        カレンダーを選択して同期
      </button>
    `;
    document.getElementById('google-logout-btn').addEventListener('click', () => {
      if (confirm('Googleアカウントとの連携を解除しますか？\n（同期済みの予定はそのまま残ります）')) {
        GoogleAuth.logout();
        renderGoogleAuthSection();
      }
    });
    document.getElementById('google-sync-btn').addEventListener('click', openGoogleCalendarPicker);
  }
}

async function openGoogleCalendarPicker() {
  const btn = document.getElementById('google-sync-btn');
  if (btn) { btn.textContent = '取得中...'; btn.disabled = true; }

  try {
    const gcals = await GoogleAuth.fetchCalendarList();
    if (!gcals.length) {
      alert('Googleカレンダーが見つかりませんでした。');
      return;
    }
    showGoogleCalendarPickerModal(gcals);
  } catch (err) {
    alert('カレンダー一覧の取得に失敗しました。\n再ログインしてみてください。');
    console.error(err);
  } finally {
    if (btn) { btn.textContent = 'カレンダーを選択して同期'; btn.disabled = false; }
  }
}

function showGoogleCalendarPickerModal(gcals) {
  let modal = document.getElementById('gcal-picker-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'gcal-picker-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">同期するカレンダーを選択</h2>
          <button id="gcal-picker-close" class="icon-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div id="gcal-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px; max-height:300px; overflow-y:auto;"></div>
        <div class="modal-buttons">
          <button id="gcal-picker-cancel" class="btn btn-secondary">キャンセル</button>
          <button id="gcal-picker-sync" class="btn btn-primary">同期開始</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const listEl = modal.querySelector('#gcal-list');
  listEl.innerHTML = '';

  gcals.forEach((gcal) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px 10px; border:1.5px solid var(--border-color); border-radius:8px; cursor:pointer;';
    const color = gcal.backgroundColor || '#4285f4';
    row.innerHTML = `
      <input type="checkbox" checked style="width:16px;height:16px;cursor:pointer;" data-id="${gcal.id}">
      <span style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0;"></span>
      <span style="font-size:13px; font-weight:500; flex:1;">${gcal.summary}</span>
    `;
    listEl.appendChild(row);
  });

  modal.classList.add('open');

  modal.querySelector('#gcal-picker-close').onclick = () => modal.classList.remove('open');
  modal.querySelector('#gcal-picker-cancel').onclick = () => modal.classList.remove('open');

  modal.querySelector('#gcal-picker-sync').onclick = async () => {
    const selectedIds = [...listEl.querySelectorAll('input[type=checkbox]:checked')]
      .map((cb) => cb.dataset.id);

    if (!selectedIds.length) {
      alert('カレンダーを1つ以上選択してください。');
      return;
    }

    const syncBtn = modal.querySelector('#gcal-picker-sync');
    syncBtn.disabled = true;
    syncBtn.textContent = '同期中...';

    const gcalMap = Object.fromEntries(gcals.map((g) => [g.id, g]));
    let totalCount = 0;
    const errors = [];

    for (const id of selectedIds) {
      try {
        const count = await GoogleAuth.syncCalendar(gcalMap[id]);
        totalCount += count;
      } catch (err) {
        errors.push(gcalMap[id].summary);
        console.error(err);
      }
    }

    modal.classList.remove('open');
    renderSettingsCalendars();
    renderGoogleAuthSection();
    refreshAllViews();

    if (errors.length) {
      alert(`同期完了: ${totalCount} 件\n\n以下のカレンダーでエラーが発生しました:\n${errors.join('\n')}`);
    } else {
      alert(`✓ ${totalCount} 件の予定を同期しました！`);
    }
  };
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