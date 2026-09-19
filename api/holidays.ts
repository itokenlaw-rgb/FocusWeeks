// api/holidays.ts
// Google Calendar API の「祝日カレンダー」(公開カレンダー) を APIキーで取得して返す。
// ログイン不要（OAuthトークン不要）。Vercel の環境変数 GOOGLE_CALENDAR_API_KEY が必要。
//
// GET /api/holidays?region=japanese&from=2026-01-01&to=2028-12-31
//   → { region, holidays: [{ date: '2026-01-01', name: '元日' }, ...] }

import type { VercelRequest, VercelResponse } from '@vercel/node';

// 例: japanese / usa / south_korea / th など。英小文字とアンダースコアのみ許可。
// ホストは googleapis.com 固定、IDの末尾は #holiday@group.v.calendar.google.com 固定なので、
// このAPIから読めるのは「Googleの祝日カレンダー」だけになる。
const REGION_RE = /^[a-z_]{2,30}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 日本語名 → 無ければ英語名 の順に試す
const LANGS = ['ja', 'en'] as const;

interface GoogleEvent {
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

// 終日イベントの [start, end) を 1日ずつに展開（複数日にまたがる祝日対策）
function expandDates(start: string, end?: string): string[] {
  const out: string[] = [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = end ? new Date(`${end}T00:00:00Z`) : new Date(s.getTime() + 86400000);
  for (let d = s; d < e && out.length < 31; d = new Date(d.getTime() + 86400000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function fetchCalendar(
  lang: string,
  region: string,
  from: string,
  to: string,
  apiKey: string
): Promise<{ date: string; name: string }[] | null> {
  // ".official" 付き = 公式の祝日のみ（外すと節分や母の日などの記念日も含まれる）
  const calendarId = `${lang}.${region}.official#holiday@group.v.calendar.google.com`;
  const params = new URLSearchParams({
    key: apiKey,
    timeMin: `${from}T00:00:00Z`,
    timeMax: `${to}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const res = await fetch(url);
  if (res.status === 404) return null; // このカレンダーIDは存在しない → 次の言語へ
  if (!res.ok) throw new Error(`Google Calendar API ${res.status}`);

  const json = (await res.json()) as { items?: GoogleEvent[] };
  const result: { date: string; name: string }[] = [];
  for (const item of json.items ?? []) {
    const start = item.start?.date; // 祝日は終日イベント（date形式）
    if (!start || !item.summary) continue;
    for (const date of expandDates(start, item.end?.date)) {
      result.push({ date, name: item.summary });
    }
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const region = String(req.query.region ?? '');
  const from = String(req.query.from ?? '');
  const to = String(req.query.to ?? '');

  if (!REGION_RE.test(region) || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return res.status(400).json({ error: 'invalid parameters' });
  }

  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_CALENDAR_API_KEY is not set' });
  }

  try {
    for (const lang of LANGS) {
      const holidays = await fetchCalendar(lang, region, from, to, apiKey);
      if (holidays) {
        // 祝日は頻繁に変わらないので、CDN で1日キャッシュ
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).json({ region, holidays });
      }
    }
    return res.status(404).json({ error: 'holiday calendar not found' });
  } catch (e) {
    console.error('holidays api error:', e);
    return res.status(502).json({ error: 'failed to fetch holidays' });
  }
}
