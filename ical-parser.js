// ical-parser.js
// Utility to parse iCalendar (.ics) files, typical of public Google Calendar exports

export const ICalParser = {
  /**
   * Parse ICS file content into a list of event objects
   * @param {string} icsText 
   * @param {string} calendarId 
   * @returns {Array} List of events
   */
  parse(icsText, calendarId) {
    if (!icsText) return [];

    // Unfold lines (iCal format wraps lines with a leading space or tab)
    const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    
    const events = [];
    let currentEvent = null;
    let inEvent = false;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = { calendarId };
        inEvent = true;
        continue;
      }

      if (line.startsWith('END:VEVENT')) {
        if (currentEvent && currentEvent.start) {
          events.push(currentEvent);
        }
        inEvent = false;
        currentEvent = null;
        continue;
      }

      if (inEvent && currentEvent) {
        // Find first colon
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const keyPart = line.substring(0, colonIdx);
        const value = line.substring(colonIdx + 1);

        // Parse key parameters, e.g. DTSTART;VALUE=DATE or DTSTART;TZID=Asia/Tokyo
        const keyMatch = keyPart.split(';');
        const key = keyMatch[0].toUpperCase();
        const params = {};
        for (let i = 1; i < keyMatch.length; i++) {
          const pair = keyMatch[i].split('=');
          if (pair.length === 2) {
            params[pair[0].toUpperCase()] = pair[1];
          }
        }

        switch (key) {
          case 'UID':
            currentEvent.id = value;
            break;
          case 'SUMMARY':
            currentEvent.title = this.unescapeText(value);
            break;
          case 'DESCRIPTION':
            currentEvent.description = this.unescapeText(value);
            break;
          case 'LOCATION':
            currentEvent.location = this.unescapeText(value);
            break;
          case 'DTSTART':
            const parsedStart = this.parseDate(value, params);
            currentEvent.start = parsedStart.iso;
            currentEvent.allDay = parsedStart.dateOnly;
            break;
          case 'DTEND':
            const parsedEnd = this.parseDate(value, params);
            currentEvent.end = parsedEnd.iso;
            break;
          case 'RRULE':
            currentEvent.rrule = value;
            break;
        }
      }
    }

    // Process recurrences if any to expand events within a timeframe (-1 to +2 years from now)
    return this.expandRecurrences(events);
  },

  unescapeText(str) {
    if (!str) return '';
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  },

  parseDate(value, params) {
    // Check for VALUE=DATE (all day event)
    if (params['VALUE'] === 'DATE' || value.length === 8) {
      const y = value.substring(0, 4);
      const m = value.substring(4, 6);
      const d = value.substring(6, 8);
      return { dateOnly: true, iso: `${y}-${m}-${d}` };
    }

    // E.g. 20260522T110000Z or 20260522T110000
    const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
    if (match) {
      const [_, y, m, d, hh, mm, ss, z] = match;
      if (z) {
        // UTC format
        return { dateOnly: false, iso: `${y}-${m}-${d}T${hh}:${mm}:${ss}Z` };
      } else {
        // Local format, if TZID parameter is Asia/Tokyo or similar
        // For local display in browser, we can keep local date-time format
        return { dateOnly: false, iso: `${y}-${m}-${d}T${hh}:${mm}:${ss}` };
      }
    }

    return { dateOnly: false, iso: value };
  },

  expandRecurrences(events) {
    const expanded = [];
    const now = new Date();
    // Expand events starting 6 months ago up to 2 years in the future
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const rangeEnd = new Date(now.getFullYear() + 2, now.getMonth(), 1);

    for (const evt of events) {
      if (!evt.rrule) {
        expanded.push(evt);
        continue;
      }

      // Add the base event if it's within range
      const baseStart = new Date(evt.start);
      if (baseStart >= rangeStart && baseStart <= rangeEnd) {
        expanded.push({ ...evt });
      }

      // Parse RRULE
      // E.g., FREQ=WEEKLY;UNTIL=20261231T235959Z;INTERVAL=1;BYDAY=FR
      const rruleMap = {};
      evt.rrule.split(';').forEach(part => {
        const pair = part.split('=');
        if (pair.length === 2) rruleMap[pair[0].toUpperCase()] = pair[1];
      });

      const freq = rruleMap['FREQ'];
      if (!freq) {
        expanded.push(evt);
        continue;
      }

      let interval = parseInt(rruleMap['INTERVAL'] || '1', 10);
      let until = null;
      if (rruleMap['UNTIL']) {
        const parsedUntil = this.parseDate(rruleMap['UNTIL']);
        until = new Date(parsedUntil.iso);
      }

      let count = parseInt(rruleMap['COUNT'] || '999', 10);
      let occurrencesGenerated = 1; // Base event is #1

      let currentStart = new Date(evt.start);
      let currentEnd = evt.end ? new Date(evt.end) : null;
      const durationMs = currentEnd ? (currentEnd.getTime() - currentStart.getTime()) : 0;

      // Keep generating until boundaries
      while (occurrencesGenerated < count) {
        // Increment date based on frequency
        if (freq === 'DAILY') {
          currentStart.setDate(currentStart.getDate() + interval);
        } else if (freq === 'WEEKLY') {
          currentStart.setDate(currentStart.getDate() + 7 * interval);
        } else if (freq === 'MONTHLY') {
          currentStart.setMonth(currentStart.getMonth() + interval);
        } else if (freq === 'YEARLY') {
          currentStart.setFullYear(currentStart.getFullYear() + interval);
        } else {
          break; // Unsupported frequency
        }

        if (until && currentStart > until) break;
        if (currentStart > rangeEnd) break;

        if (currentStart >= rangeStart) {
          const newStartIso = this.formatIso(currentStart, evt.allDay);
          const newEndIso = currentEnd ? this.formatIso(new Date(currentStart.getTime() + durationMs), evt.allDay) : newStartIso;

          expanded.push({
            ...evt,
            id: `${evt.id}_rec_${occurrencesGenerated}`,
            start: newStartIso,
            end: newEndIso,
            isRecurrence: true
          });
        }

        occurrencesGenerated++;
      }
    }

    return expanded;
  },

  formatIso(date, allDay) {
    const pad = (num) => String(num).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    if (allDay) {
      return `${y}-${m}-${d}`;
    }
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
  }
};
