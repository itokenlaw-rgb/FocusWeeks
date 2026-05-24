// calendar-week.js
// Weekly hourly grid view calendar engine (Image 1 style)

import { StorageManager } from './storage.js';

export const WeekCalendar = {
  headerId: 'week-grid-hdr',
  axisId: 'week-time-axis',
  linesId: 'week-grid-lines',
  columnsId: 'week-columns-container',
  
  selectedDate: null,
  onDaySelectedCallback: null,
  onAddEventCallback: null,
  onEditEventCallback: null,
  
  startHour: 8,
  endHour: 23, // Up to 23:59
  hourHeight: 60, // pixels per hour

  init(onDaySelected, onAddEvent, onEditEvent) {
    this.onDaySelectedCallback = onDaySelected;
    this.onAddEventCallback = onAddEvent;
    this.onEditEventCallback = onEditEvent;
    this.selectedDate = new Date();
  },

  render(targetDate = null) {
    if (targetDate) {
      this.selectedDate = new Date(targetDate);
    }
    
    const settings = StorageManager.getSettings();
    const calendars = StorageManager.getCalendars();
    const events = StorageManager.getEvents();
    
    const weekStart = settings.weekStart;
    const startOfWeek = this.getStartOfWeek(this.selectedDate, weekStart);
    
    // Group active calendars
    const visibleCalIds = new Set(calendars.filter(c => c.visible).map(c => c.id));
    const calColorMap = {};
    calendars.forEach(c => { calColorMap[c.id] = c.color; });

    // Render header days
    this.renderHeader(startOfWeek, weekStart);
    
    // Render time axis labels (8:00 - 23:00)
    this.renderTimeAxis();

    // Render background lines
    this.renderGridLines();

    // Render day columns and events
    this.renderColumns(startOfWeek, events, visibleCalIds, calColorMap);
  },

  renderHeader(startOfWeek, weekStart) {
    const header = document.getElementById(this.headerId);
    header.innerHTML = '';
    
    // Empty spacer cell for time column
    const spacer = document.createElement('div');
    spacer.className = 'time-header-lbl';
    header.appendChild(spacer);
    
    const wdayNames = weekStart === 'sunday'
      ? ['日', '月', '火', '水', '木', '金', '土']
      : ['月', '火', '水', '木', '金', '土', '日'];

    let current = new Date(startOfWeek);
    for (let i = 0; i < 7; i++) {
      const colDate = new Date(current);
      const headerCell = document.createElement('div');
      headerCell.className = 'day-col-header';
      
      const wday = colDate.getDay();
      if (wday === 0) headerCell.classList.add('sun');
      if (wday === 6) headerCell.classList.add('sat');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'day-col-name';
      nameSpan.textContent = wdayNames[i];

      const numSpan = document.createElement('span');
      numSpan.className = 'day-col-num';
      numSpan.textContent = colDate.getDate();

      // Highlight selected date or today
      const today = new Date();
      if (this.isSameDay(colDate, today)) {
        numSpan.style.background = '#0b57d0';
        numSpan.style.color = 'white';
        numSpan.style.borderRadius = '50%';
        numSpan.style.width = '24px';
        numSpan.style.height = '24px';
        numSpan.style.display = 'inline-flex';
        numSpan.style.alignItems = 'center';
        numSpan.style.justifyContent = 'center';
      } else if (this.isSameDay(colDate, this.selectedDate)) {
        numSpan.style.border = '2px solid #facc15';
        numSpan.style.borderRadius = '50%';
        numSpan.style.width = '24px';
        numSpan.style.height = '24px';
        numSpan.style.display = 'inline-flex';
        numSpan.style.alignItems = 'center';
        numSpan.style.justifyContent = 'center';
      }

      headerCell.appendChild(nameSpan);
      headerCell.appendChild(numSpan);
      
      // Let header click select the day
      headerCell.addEventListener('click', () => {
        this.selectedDate = colDate;
        if (this.onDaySelectedCallback) {
          this.onDaySelectedCallback(colDate);
        }
        this.render(); // Re-render to update highlights
      });

      header.appendChild(headerCell);
      current.setDate(current.getDate() + 1);
    }
  },

  renderTimeAxis() {
    const axis = document.getElementById(this.axisId);
    axis.innerHTML = '';
    
    for (let h = this.startHour; h <= this.endHour; h++) {
      const label = document.createElement('div');
      label.className = 'time-axis-label';
      label.textContent = `${h}:00`;
      axis.appendChild(label);
    }
  },

  renderGridLines() {
    const layer = document.getElementById(this.linesId);
    layer.innerHTML = '';
    
    const count = this.endHour - this.startHour + 1;
    for (let i = 0; i < count; i++) {
      const line = document.createElement('div');
      line.className = 'grid-line';
      layer.appendChild(line);
    }
  },

  renderColumns(startOfWeek, events, visibleCalIds, calColorMap) {
    const container = document.getElementById(this.columnsId);
    container.innerHTML = '';
    
    let current = new Date(startOfWeek);
    for (let i = 0; i < 7; i++) {
      const colDate = new Date(current);
      const dateKey = this.formatDateKey(colDate);

      const colDiv = document.createElement('div');
      colDiv.className = 'week-grid-column';
      colDiv.dataset.date = dateKey;

      // Filter events for this day
      const dayEvents = events.filter(evt => {
        if (!visibleCalIds.has(evt.calendarId)) return false;
        return evt.start.split('T')[0] === dateKey;
      });

      // Render event cards
      dayEvents.forEach(evt => {
        if (evt.allDay) return; // All day events handled separately if needed, or clamped at 8:00

        // Parse start and end hours
        const startTimeStr = evt.start.split('T')[1] || '00:00:00';
        const endTimeStr = evt.end?.split('T')[1] || '23:59:59';

        const startParts = startTimeStr.split(':').map(Number);
        const endParts = endTimeStr.split(':').map(Number);

        const sHour = startParts[0] + (startParts[1] / 60);
        const eHour = endParts[0] + (endParts[1] / 60);

        // Map to grid timeline (startHour to endHour + 1)
        if (eHour < this.startHour || sHour > (this.endHour + 1)) return; // Out of bounds

        const clampedStart = Math.max(sHour, this.startHour);
        const clampedEnd = Math.min(eHour, this.endHour + 1);

        const top = (clampedStart - this.startHour) * this.hourHeight;
        const height = (clampedEnd - clampedStart) * this.hourHeight;

        const card = document.createElement('div');
        card.className = 'hourly-event-card';
        card.style.top = `${top}px`;
        card.style.height = `${height}px`;
        card.style.backgroundColor = calColorMap[evt.calendarId] || '#3b82f6';
        card.dataset.eventId = evt.id;

        const titleSpan = document.createElement('div');
        titleSpan.textContent = evt.title;
        titleSpan.style.whiteSpace = 'nowrap';
        titleSpan.style.textOverflow = 'ellipsis';
        titleSpan.style.overflow = 'hidden';

        const timeSpan = document.createElement('div');
        timeSpan.style.fontSize = '9px';
        timeSpan.style.opacity = '0.9';
        timeSpan.textContent = `${startTimeStr.substring(0, 5)} - ${endTimeStr.substring(0, 5)}`;

        card.appendChild(titleSpan);
        card.appendChild(timeSpan);

        // Edit handler
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onEditEventCallback) {
            this.onEditEventCallback(evt);
          }
        });

        colDiv.appendChild(card);
      });

      // Click on blank area in column to add a new event
      colDiv.addEventListener('click', (e) => {
        const rect = colDiv.getBoundingClientRect();
        const clickedY = e.clientY - rect.top;
        const clickedHourDecimal = this.startHour + (clickedY / this.hourHeight);
        
        // Round to nearest 15 minutes (0.25 hours)
        const roundedHour = Math.floor(clickedHourDecimal);
        const fraction = clickedHourDecimal - roundedHour;
        let minutes = 0;
        if (fraction >= 0.125 && fraction < 0.375) minutes = 15;
        else if (fraction >= 0.375 && fraction < 0.625) minutes = 30;
        else if (fraction >= 0.625 && fraction < 0.875) minutes = 45;
        else if (fraction >= 0.875) minutes = 0; // rounds up next hour
        
        const hourStr = String(minutes === 0 && fraction >= 0.875 ? roundedHour + 1 : roundedHour).padStart(2, '0');
        const minStr = String(minutes).padStart(2, '0');
        
        if (this.onAddEventCallback) {
          this.onAddEventCallback(colDate, `${hourStr}:${minStr}`);
        }
      });

      container.appendChild(colDiv);
      current.setDate(current.getDate() + 1);
    }
  },

  // Helper date functions
  getStartOfWeek(date, weekStart) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (weekStart === 'monday' ? (day === 0 ? -6 : 1) : 0);
    return new Date(d.setDate(diff));
  },

  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  },

  formatDateKey(date) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
};
