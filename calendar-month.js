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
    
    // Generate dates to display: from 8 weeks ago to 24 weeks in the future (total ~32 weeks)
    // This allows smooth scrolling without memory bloat
    const today = new Date();
    const startOffset = -8; // 8 weeks back
    const endOffset = 24;  // 24 weeks forward
    
    const startDate = this.getStartOfWeek(this.addWeeks(new Date(today), startOffset), settings.weekStart);
    const endDate = this.getEndOfWeek(this.addWeeks(new Date(today), endOffset), settings.weekStart);
    
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
        // Sort by start time first
        const timeA = a.start.includes('T') ? a.start.split('T')[1] : '00:00:00';
        const timeB = b.start.includes('T') ? b.start.split('T')[1] : '00:00:00';
        if (timeA !== timeB) return timeA.localeCompare(timeB);
        
        // Then by calendar priority order
        return calOrderMap[a.calendarId] - calOrderMap[b.calendarId];
      });
    });

    let current = new Date(startDate);
    let weekIndex = 0;
    
    // Find which week index contains the selected date
    let selectedWeekIndex = -1;
    const selectedDateKey = this.formatDateKey(this.selectedDate);

    // Temp array of weeks to build
    const weeksToRender = [];

    while (current <= endDate) {
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

      weekIndex++;
    }

    // Determine which week row gets the expanded height
    // If a day is selected, its week is expanded.
    // If no day is selected (selectedWeekIndex is -1), or by default, the week containing "today" (or the first row) is expanded.
    let expandedWeekIndex = selectedWeekIndex !== -1 ? selectedWeekIndex : weeksToRender.findIndex(w => w.containsToday);
    if (expandedWeekIndex === -1) expandedWeekIndex = 0; // Fallback to first row

    // Render each week
    weeksToRender.forEach(week => {
      const weekRow = document.createElement('div');
      weekRow.className = `week-row week-row-${week.index}`;
      weekRow.dataset.weekIndex = week.index;

      // Apply the selected focus height multiplier
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

        // --- 【追加】ここから：月の変わり目ジグザグ太線の判定 ---
        const currentMonth = day.date.getMonth();
        
        // ① 上隣のマスとの月比較（1日のマス、またはその週より上が別月の場合）
        // 1日、または1日より後の日付で、1マスの前の日（前日）が別月、あるいは週の初めで上方向が別月になる判定
        if (day.date.getDate() === 1) {
          // 1日なら確実に上側に境界線（週の途中の場合）
          dayCell.classList.add('month-border-top');
        } else {
          // 同一週の「上」のマスを想定し、7日前が違う月なら上線
          const sevenDaysAgo = new Date(day.date);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (sevenDaysAgo.getMonth() !== currentMonth) {
            dayCell.classList.add('month-border-top');
          }
        }

        // ② 左隣のマスとの月比較
        if (day.date.getDate() === 1) {
          // 1日のマスは、週の始まり（月曜始まりなら月曜日）でなければ、左側に境界線が必要
          // settings.weekStartの曜日インデックスに合わせて調整
          const isWeekStart = (settings.weekStart === 'sunday' && day.date.getDay() === 0) || 
                              (settings.weekStart === 'monday' && day.date.getDay() === 1);
          if (!isWeekStart) {
            dayCell.classList.add('month-border-left');
          }
        }

        // Is current day selected?
        if (day.dateKey === selectedDateKey) {
          dayCell.classList.add('selected');
        }

        // Highlight other months visually (like grey background)
        if (day.date.getMonth() !== this.selectedDate.getMonth()) {
          dayCell.classList.add('other-month');
        }

        // Day header (date number)
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        
        const dayNum = document.createElement('span');
        dayNum.className = 'day-number';
        // If it is the first of the month, display "M月1日" instead of just "1"
        if (day.date.getDate() === 1) {
          dayNum.textContent = `${day.date.getMonth() + 1}月1日`;
        } else {
          dayNum.textContent = day.date.getDate();
        }

        // Saturday / Sunday date text color
        const wday = day.date.getDay();
        if (wday === 0) dayNum.style.color = '#ef4444'; // Red
        else if (wday === 6) dayNum.style.color = '#3b82f6'; // Blue

        // Highlight today's date circle or bg
        if (day.isToday) {
          dayNum.style.background = '#0b57d0';
          dayNum.style.color = 'white';
          dayNum.style.borderRadius = '50%';
          dayNum.style.padding = '2px 6px';
          dayNum.style.display = 'inline-block';
        }

        dayHeader.appendChild(dayNum);
        dayCell.appendChild(dayHeader);

        // Event container inside cells
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'cell-events';

        const isWeekExpanded = (week.index === expandedWeekIndex);

        if (isWeekExpanded) {
          // Render detailed events with times
          day.events.forEach(evt => {
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
          // Render compact events (small lines / tiny text)
          day.events.slice(0, 2).forEach(evt => {
            const label = document.createElement('div');
            label.className = 'event-badge-compact';
            label.style.backgroundColor = calColorMap[evt.calendarId] || '#3b82f6';
            label.textContent = evt.title;
            eventsContainer.appendChild(label);
          });

          // Show indicator if there are more events
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

        // Click handler on day cell
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
    
    // Redraw selected state & animate heights
    const gridBody = document.getElementById(this.containerId);
    
    // 1. Remove selected highlight from all day cells
    gridBody.querySelectorAll('.day-cell').forEach(cell => {
      cell.classList.remove('selected');
    });

    // 2. Add selected highlight to current day cell
    const dateKey = this.formatDateKey(date);
    const targetCell = gridBody.querySelector(`.day-cell[data-date="${dateKey}"]`);
    if (targetCell) {
      targetCell.classList.add('selected');
    }

    // 3. Remove height classes from all week rows
    const multiplier = settings.focusWeekSize || 3;
    gridBody.querySelectorAll('.week-row').forEach(row => {
      row.classList.remove('height-2x', 'height-3x');
    });

    // 4. Add height class to focused week row (only if multiplier > 1)
    const targetRow = gridBody.querySelector(`.week-row-${weekIndex}`);
    if (targetRow && multiplier > 1) {
      targetRow.classList.add(`height-${multiplier}x`);
    }

    // Trigger re-render of cell events to show details in focused row and compact in others
    // To do this smoothly without disrupting the scroll, we can just rebuild the cells content.
    // However, rebuilding all cells is very fast. Let's trigger a full layout render or a partial cell swap.
    // A full render is extremely fast in Javascript (~5ms), but to maintain scroll positions,
    // we can just re-render the calendar. It's clean and safe!
    const scrollContainer = document.getElementById(this.scrollContainerId);
    const currentScrollTop = scrollContainer.scrollTop;
    
    this.renderWeeks(settings, StorageManager.getCalendars(), StorageManager.getEvents());
    
    // Restore scroll position
    scrollContainer.scrollTop = currentScrollTop;

    // Trigger callback to update Bottom Sheet & Footer
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
          // row.offsetTop をそのまま指定することで、
          // 前の週の一番下のライン（＝今週の一番上のライン）がコンテナの最上部に。
          const rowTop = row.offsetTop;
          scrollContainer.scrollTop = rowTop;
        }, 20);
      }
    }
  },

  handleScroll() {
    // Detect which week row is near the top of the scroll container
    // and update the month title accordingly
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
      // Find the first day cell inside this row
      const firstCell = topRow.querySelector('.day-cell');
      if (firstCell) {
        const dateStr = firstCell.dataset.date;
        if (dateStr) {
          const parts = dateStr.split('-');
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          
          // Update Month Indicator Text
// calendar-month.js の handleScroll() 内
// Update Month Indicator Text
const monthTxtEl = document.getElementById('current-month-txt');
if (monthTxtEl) {
  // 【変更】「年」の後に改行コード \n を挟む
  monthTxtEl.style.whiteSpace = "pre-line";
  monthTxtEl.innerHTML = `${year}年<br>${month}月`;
}
        }
      }
    }
  },

  // Helper date functions
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
