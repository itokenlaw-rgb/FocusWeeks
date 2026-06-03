// googleCalendar.ts
// Google Calendar APIとの通信は、すべて自前のバックエンド（/api/events）経由で行う。
// access_token の管理・リフレッシュはバックエンドが担うため、
// このファイルはGoogleトークンを一切扱わない。

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO DateTime string or YYYY-MM-DD
  end: string;   // ISO DateTime string or YYYY-MM-DD
  allDay: boolean;
  memo?: string;
  colorId?: string; // ★ 追加
  googleEventId?: string;
}

// ---- 認証 ----

/** Googleログイン画面へのURLを取得してリダイレクト */
export async function redirectToGoogleLogin(): Promise<void> {
  const res = await fetch('/api/auth/url');
  const { url } = await res.json();
  window.location.href = url;
}

/** ログイン状態を確認する */
export async function checkLoginStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/events?action=status', { credentials: 'include' });
    if (!res.ok) return false;
    const { loggedIn } = await res.json();
    return !!loggedIn;
  } catch {
    return false;
  }
}

/** ログアウト（KVのrefresh_tokenとCookieを削除） */
export async function logout(): Promise<void> {
  await fetch('/api/events?action=logout', { method: 'DELETE', credentials: 'include' });
}

// ---- カレンダーAPI ----

function mapItem(item: any): CalendarEvent {
  const allDay = !item.start.dateTime;
  return {
    id: item.id,
    title: item.summary || '(タイトルなし)',
    start: allDay ? item.start.date : item.start.dateTime,
    end: allDay ? item.end.date : item.end.dateTime,
    allDay,
    memo: item.description || '',
    googleEventId: item.id,
    colorId: item.colorId || undefined, // ★ 追加
  };
}

function buildEventBody(event: Omit<CalendarEvent, 'id'>) {
  return {
    summary: event.title,
    description: event.memo || '',
    start: event.allDay
      ? { date: event.start.substring(0, 10) }
      : { dateTime: event.start },
    end: event.allDay
      ? { date: event.end.substring(0, 10) }
      : { dateTime: event.end },
  };
}

/** イベント一覧取得 */
export async function fetchGoogleEvents(
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const res = await fetch(
    `/api/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
  );

  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('Failed to fetch events');

  const data = await res.json();
  return (data.items || []).map(mapItem);
}

/** イベント作成 */
export async function createGoogleEvent(
  event: Omit<CalendarEvent, 'id'>
): Promise<CalendarEvent> {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildEventBody(event)),
  });

  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('Failed to create event');

  const item = await res.json();
  return mapItem(item);
}

/** イベント更新 */
export async function updateGoogleEvent(
  eventId: string,
  event: Omit<CalendarEvent, 'id'>
): Promise<CalendarEvent> {
  const res = await fetch(`/api/events?eventId=${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildEventBody(event)),
  });

  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('Failed to update event');

  const item = await res.json();
  return mapItem(item);
}

/** イベント削除 */
export async function deleteGoogleEvent(eventId: string): Promise<void> {
  const res = await fetch(`/api/events?eventId=${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });

  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('Failed to delete event');
}
