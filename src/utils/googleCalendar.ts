export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO DateTime string or YYYY-MM-DD
  end: string;   // ISO DateTime string or YYYY-MM-DD
  allDay: boolean;
  memo?: string;
  googleEventId?: string; // Links to Google Event ID if loaded from API
}

export function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('google-gsi-client')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('Google Identity Services SDK loaded.');
      resolve();
    };
    script.onerror = (err) => {
      console.error('Failed to load Google Identity Services SDK.');
      reject(err);
    };
    document.head.appendChild(script);
  });
}

let tokenClient: any = null;

export function initOAuthClient(onTokenReceived: (token: string, expiresAt: number) => void) {
  if (typeof window === 'undefined' || !(window as any).google) {
    console.warn('Google SDK not loaded yet.');
    return;
  }
  
  try {
    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: '1005545288287-apf5ubci7csiqvr8g83sq2aurnh85ooi.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: (response: any) => {
        if (response.error) {
          console.error('OAuth token client error:', response);
          return;
        }
        if (response.access_token) {
          // Token expires in response.expires_in seconds
          const expiresAt = Date.now() + (parseInt(response.expires_in, 10) || 3600) * 1000;
          onTokenReceived(response.access_token, expiresAt);
        }
      },
    });
    console.log('Token client initialized successfully.');
  } catch (error) {
    console.error('Error initializing OAuth client:', error);
  }
}

export function requestAccessToken() {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    // If client wasn't initialized, try to re-init first
    console.error('OAuth token client is not initialized.');
  }
}

export async function fetchGoogleEvents(accessToken: string, timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;
  
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw new Error('Failed to fetch events from Google Calendar.');
  }

  const data = await res.json();
  const items = data.items || [];

  return items.map((item: any) => {
    const allDay = !item.start.dateTime;
    return {
      id: item.id,
      title: item.summary || '(タイトルなし)',
      start: allDay ? item.start.date : item.start.dateTime,
      end: allDay ? item.end.date : item.end.dateTime,
      allDay,
      memo: item.description || '',
      googleEventId: item.id
    };
  });
}

export async function createGoogleEvent(accessToken: string, event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  
  const startField = event.allDay 
    ? { date: event.start.substring(0, 10) }
    : { dateTime: event.start };
    
  const endField = event.allDay
    ? { date: event.end.substring(0, 10) }
    : { dateTime: event.end };

  const body = {
    summary: event.title,
    description: event.memo || '',
    start: startField,
    end: endField
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error('Failed to create event on Google Calendar.');
  }

  const item = await res.json();
  return {
    id: item.id,
    title: item.summary || '',
    start: event.allDay ? item.start.date : item.start.dateTime,
    end: event.allDay ? item.end.date : item.end.dateTime,
    allDay: event.allDay,
    memo: item.description || '',
    googleEventId: item.id
  };
}

export async function updateGoogleEvent(accessToken: string, eventId: string, event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;

  const startField = event.allDay 
    ? { date: event.start.substring(0, 10) }
    : { dateTime: event.start };
    
  const endField = event.allDay
    ? { date: event.end.substring(0, 10) }
    : { dateTime: event.end };

  const body = {
    summary: event.title,
    description: event.memo || '',
    start: startField,
    end: endField
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error('Failed to update event on Google Calendar.');
  }

  const item = await res.json();
  return {
    id: item.id,
    title: item.summary || '',
    start: event.allDay ? item.start.date : item.start.dateTime,
    end: event.allDay ? item.end.date : item.end.dateTime,
    allDay: event.allDay,
    memo: item.description || '',
    googleEventId: item.id
  };
}

export async function deleteGoogleEvent(accessToken: string, eventId: string): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    throw new Error('Failed to delete event from Google Calendar.');
  }
}
