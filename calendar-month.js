// calendar-month.js
// Monthly vertical scroll calendar engine

import { StorageManager } from './storage.js';

export const MonthCalendar = {
  containerId: 'month-grid-body',
  scrollContainerId: 'month-scroll-container',
  weekdaysHeaderId: 'month-week-days',
  
  selectedDate: null, // Date object
  currentCenterDate: null, // Used to track which month is currently visible
  
  // Callback when a day is clicked
  onDaySelectedCallback: null,

  init(onDaySelected) {
    this.onDaySelectedCallback = onDaySelected;
    this.selectedDate = new Date(); // Default selection is today
    this.currentCenterDate = new Date();
    
    // Initial render
    this.render();
    
    // Set up scroll listener to update header month display
    const scrollContainer = document.getElementById(this.scrollContainerId);
    scrollContainer.addEventListener('scroll', () => this.handleScroll());
  },

  render() {
    const settings = StorageManager.getSettings();
    const calendars = StorageManager.getCalendars();
    const events = StorageManager.getEvents();
    
    // Render weekday headers
    this.renderWeekdays(settings.weekStart);
    
    // Generate and render calendar weeks
    this.renderWeeks(settings, calendars, events);
    
    // Scroll to center / today initially
    this.scrollToToday();
  },

  renderWeekdays(weekStart) {
    const header = document.getElementById(this.weekdaysHeaderId);
    header.innerHTML = '';
    
    const daysJa = weekStart === 'sunday' 
      ? ['日', '月', '火', '水', '木', '金', '土']
      : ['月', '火', '水', '木', '金', '土', '日'];
      
    daysJa.forEach((day, index) => {
      const dayDiv = document.createElement('div');
      dayDiv.textContent = day;
      
      // Saturday/Sunday coloring
      if (weekStart === 'sunday') {
        if (index === 0) dayDiv.className = 'sun';
        else if (index === 6) dayDiv.className = 'sat';
      } else {
        if (index === 5) dayDiv.className = 'sat';
        else if (index === 6) dayDiv.className = 'sun';
      }
      
      header.appendChild(dayDiv);
    });
  },

  renderWeeks(settings, calendars, events) {
    const gridBody = document.getElementById(this.containerId);
    gridBody.innerHTML = '';
    
    const today = new Date();
    const baseDate = this.selectedDate || today;

    // 開始位置：今日（または選択日）の2週間前から生成スタート
    let current = this.addWeeks(baseDate, -2);
    current = this.getStartOfWeek(current, settings.weekStart);
    
    // Filter active (visible) calendars and sort them by order
    const visibleCalIds = new Set(calendars.filter(c => c.visible).map(c => c.id));
    const calColorMap = {};
    const calOrderMap = {};
    calendars.forEach(c => {
      calColorMap[c.id] = c.color;
      calOrderMap[c.id] = c.order ?? 99;
    });

    // Group events by YYYY-MM-DD
    const eventsByDate = {};
    events.forEach(evt => {
      if (!visibleCalIds.has(evt.calendarId)) return;
      
      const dateKey = evt.start.split('T')[0];
      if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
      eventsByDate[dateKey].push(evt);
    });

    // Sort events in each date by start time, and then by calendar order
    Object.keys(eventsByDate).forEach(dateKey => {
      eventsByDate[dateKey].sort((a, b) => {
        const timeA = a.start.includes('T') ? a.start.split('T')[1] : '00:00:00';
        const timeB = b.start.includes('T') ? b.start.split('T')[1] : '00:00:00';
        if (timeA !== timeB) return timeA.localeCompare(timeB);
        return calOrderMap[a.calendarId] - calOrderMap[b.calendarId];
      });
    });
    
    // Find which week index contains the selected date
    let selectedWeekIndex = -1;
    const selectedDateKey = this.formatDateKey(this.selectedDate);

    // Temp array of weeks to build
    const weeksToRender = [];

    // 【変更】未来約1年分（54週間分）をきれいにループ処理で生成
    for (let weekIndex = 0; weekIndex < 54; weekIndex++) {
      const weekDays = [];
      let containsSelected = false;
      let containsToday = false;

      for (let i = 0; i < 7; i++) {
        const dayCopy = new Date(current);
        const dateKey = this.formatDateKey(dayCopy);
        
        if (dateKey === selectedDateKey) {
          containsSelected = true;
        }
        if (this.isSameDay(dayCopy, today)) {
          containsToday = true;
        }

        weekDays.push({
          date: dayCopy,
          dateKey: dateKey,
          isToday: this.isSameDay(dayCopy, today),
          events: eventsByDate[dateKey] || []
        });

        current.setDate(current.getDate() + 1);
      }

      if (containsSelected) {
        selectedWeekIndex = weekIndex;
      }

      weeksToRender.push({
        days: weekDays,
        index: weekIndex,
        containsToday: containsToday
      });
    }

    // Determine which week row gets the expanded height
    let expandedWeekIndex = selectedWeekIndex !== -1 ? selectedWeekIndex : weeksToRender.findIndex(w => w.containsToday);
    if (expandedWeekIndex === -1) expandedWeekIndex = 0;

    // Render each week
    weeksToRender.forEach(week => {
      const weekRow = document.createElement('div');
      weekRow.className = `week-row week-row-${week.index}`;
      weekRow.dataset.weekIndex = week.index;

      if (week.index === expandedWeekIndex) {
        const multiplier = settings.focusWeekSize || 3;
        if (multiplier > 1) {
          weekRow.classList.add(`height-${multiplier}x`);
        }
      }

      week.days.forEach(day => {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        dayCell.dataset.date = day.dateKey;

        // --- 月の変わり目ジグザグ太線の判定 ---
        const currentMonth = day.date.getMonth();
        
        if (day.date.getDate() === 1) {
          dayCell.classList.add('month-border-top');
        } else {
          const sevenDaysAgo = new Date(day.date);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (sevenDaysAgo.getMonth() !== currentMonth) {
            dayCell.classList.add('month-border-top');
          }
        }

        if (day.date.getDate() === 1) {
          const isWeekStart = (settings.weekStart === 'sunday' && day.date.getDay() === 0) || 
                              (settings.weekStart === 'monday' && day.date.getDay() === 1);
          if (!isWeekStart) {
            dayCell.classList.add('month-border-left');
          }
        }

        if (day.dateKey === selectedDateKey) {
          dayCell.classList.add('selected');
        }

        if (day.date.getMonth() !== this.selectedDate.getMonth()) {
          dayCell.classList.add('other-month');
        }

        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        
        const dayNum = document.createElement('span');
        dayNum.className = 'day-number';
        if (day.date.getDate() === 1) {
          dayNum.textContent = `${day.date.getMonth() + 1}月1日`;
        } else {
          dayNum.textContent = day.date.getDate();
        }

        const wday = day.date.getDay();
        if (wday === 0) dayNum.style.color = '#ef4444';
        else if (wday === 6) dayNum.style.color = '#3b82f6';

        if (day.isToday) {
          dayNum.style.background = '#0b57d0';
          dayNum.style.color = 'white';
          dayNum.style.borderRadius = '50%';
          dayNum.style.padding = '2px 6px';
          dayNum.style.display = 'inline-block';
        }

        dayHeader.appendChild(dayNum);
        dayCell.appendChild(dayHeader);

        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'cell-events';

        const isWeekExpanded = (week.index === expandedWeekIndex);

        if (isWeekExpanded) {
          // --- 3倍拡大枠内を5つの時間帯に分類して配置 ---
          const slots = [
            { id: 0, label: '0:00～8:59',   events: [], check: (h) => h >= 0 && h < 9 },
            { id: 1, label: '9:00～11:59',  events: [], check: (h) => h >= 9 && h < 12 },
            { id: 2, label: '12:00～14:59', events: [], check: (h) => h >= 12 && h < 15 },
            { id: 3, label: '15:00～17:59', events: [], check: (h) => h >= 15 && h < 18 },
            { id: 4, label: '18:00～23:59', events: [], check: (h) => h >= 18 && h <= 24 }
          ];

          day.events.forEach(evt => {
            if (evt.allDay) {
              slots[0].events.push(evt);
              return;
            }
            const timePart = evt.start.split('T')[1] || '00:00:00';
            const parts = timePart.split(':').map(Number);
            const hourDecimal = parts[0] + (parts[1] / 60);

            const targetSlot = slots.find(s => s.check(hourDecimal));
            if (targetSlot) {
              targetSlot.events.push(evt);
            } else {
              slots[0].events.push(evt);
            }
          });

          slots.forEach(slot => {
            if (slot.events.length > 0) {
              slot.events.forEach(evt => {
                const badge = document.createElement('div');
                badge.className = 'event-badge-detailed';
                badge.style.borderLeftColor = calColorMap[evt.calendarId] || '#3b82f6';
                badge.style.backgroundColor = this.hexToRgba(calColorMap[evt.calendarId] || '#3b82f6', 0.1);
                badge.dataset.eventId = evt.id;

                const timeSpan = document.createElement('span');
                timeSpan.className = 'event-time';
                if (evt.allDay) {
                  timeSpan.textContent = '終日';
                } else {
                  const startT = evt.start.split('T')[1]?.substring(0, 5) || '';
                  const endT = evt.end?.split('T')[1]?.substring(0, 5) || '';
                  timeSpan.textContent = endT ? `${startT}～${endT}` : startT;
                }

                const titleSpan = document.createElement('span');
                titleSpan.className = 'event-title';
                titleSpan.textContent = evt.title;

                badge.appendChild(timeSpan);
                badge.appendChild(titleSpan);
                eventsContainer.appendChild(badge);
              });
            } else {
              const spacer = document.createElement('div');
              spacer.className = 'event-slot-spacer';
              spacer.style.height = '24px'; 
              spacer.style.margin = '2px 0';
              eventsContainer.appendChild(spacer);
            }
          });
        } else {
          // 通常時のコンパクト表示
          day.events.slice(0, 2).forEach(evt => {
            const label = document.createElement('div');
            label.className = 'event-badge-compact';
            label.style.backgroundColor = calColorMap[evt.calendarId] || '#3b82f6';
            label.textContent = evt.title;
            eventsContainer.appendChild(label);
          });

          if (day.events.length > 2) {
            const moreIndicator = document.createElement('div');
            moreIndicator.style.fontSize = '8px';
            moreIndicator.style.textAlign = 'center';
            moreIndicator.style.color = '#64748b';
            moreIndicator.textContent = `他 ${day.events.length - 2} 件`;
            eventsContainer.appendChild(moreIndicator);
          }
        }

        dayCell.appendChild(eventsContainer);

        dayCell.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectDay(day.date, week.index);
        });

        weekRow.appendChild(dayCell);
      });

      gridBody.appendChild(weekRow);
    });
  },

  selectDay(date, weekIndex) {
    const settings = StorageManager.getSettings();
    this.selectedDate = new Date(date);
    const gridBody = document.getElementById(this.containerId);
    
    gridBody.querySelectorAll('.day-cell').forEach(cell => {
      cell.classList.remove('selected');
    });

    const dateKey = this.formatDateKey(date);
    const targetCell = gridBody.querySelector(`.day-cell[data-date="${dateKey}"]`);
    if (targetCell) {
      targetCell.classList.add('selected');
    }

    const multiplier = settings.focusWeekSize || 3;
    gridBody.querySelectorAll('.week-row').forEach(row => {
      row.classList.remove('height-2x', 'height-3x');
    });

    const targetRow = gridBody.querySelector(`.week-row-${weekIndex}`);
    if (targetRow && multiplier > 1) {
      targetRow.classList.add(`height-${multiplier}x`);
    }

    const scrollContainer = document.getElementById(this.scrollContainerId);
    const currentScrollTop = scrollContainer.scrollTop;
    
    this.renderWeeks(settings, StorageManager.getCalendars(), StorageManager.getEvents());
    scrollContainer.scrollTop = currentScrollTop;

    if (this.onDaySelectedCallback) {
      this.onDaySelectedCallback(this.selectedDate);
    }
  },

  scrollToToday() {
    const todayKey = this.formatDateKey(new Date());
    const scrollContainer = document.getElementById(this.scrollContainerId);
    const todayCell = scrollContainer.querySelector(`.day-cell[data-date="${todayKey}"]`);
    
    if (todayCell) {
      const row = todayCell.closest('.week-row');
      if (row) {
        setTimeout(() => {
          const rowTop = row.offsetTop;
          const offset = 85; 
          scrollContainer.scrollTop = Math.max(0, rowTop - offset);
        }, 100);
      }
    }
  },

  handleScroll() {
    const scrollContainer = document.getElementById(this.scrollContainerId);
    const scrollTop = scrollContainer.scrollTop;
    const rows = scrollContainer.querySelectorAll('.week-row');
    let topRow = null;
    
    for (let row of rows) {
      if (row.offsetTop >= scrollTop) {
        topRow = row;
        break;
      }
    }

    if (topRow) {
      const firstCell = topRow.querySelector('.day-cell');
      if (firstCell) {
        const dateStr = firstCell.dataset.date;
        if (dateStr) {
          const parts = dateStr.split('-');
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          
          const monthTxtEl = document.getElementById('current-month-txt');
          if (monthTxtEl) {
            monthTxtEl.style.whiteSpace = "pre-line";
            monthTxtEl.innerHTML = `${year}年<br>${month}月`;
          }
        }
      }
    }
  },

  getStartOfWeek(date, weekStart) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (weekStart === 'monday' ? (day === 0 ? -6 : 1) : 0);
    return new Date(d.setDate(diff));
  },

  getEndOfWeek(date, weekStart) {
    const start = this.getStartOfWeek(date, weekStart);
    return new Date(start.setDate(start.getDate() + 6));
  },

  addWeeks(date, weeks) {
    const d = new Date(date);
    d.setDate(d.getDate() + weeks * 7);
    return d;
  },

  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  },

  formatDateKey(date) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  },

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
};