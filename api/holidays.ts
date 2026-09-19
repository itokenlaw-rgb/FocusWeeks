// api/holidays.ts  (Vercel Serverless Function)
// GET /api/holidays?region=japanese&from=2026-01-01&to=2028-12-31
// → { holidays: [{ date: 'YYYY-MM-DD', name: '元日' }, ...] }
//
// Google の公開祝日カレンダーを Calendar API（APIキー）で読み取る。
// 必要な環境変数: GOOGLE_API_KEY（Vercel の Environment Variables に設定）
import type { VercelRequest, VercelResponse } from '@vercel/node';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const region = String(req.query.region ?? '');
  const from = String(req.query.from ?? '');
  const to = String(req.query.to ?? '');

  if (!/^[a-z_]+$/.test(region) || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return res.status(400).json({ error: 'invalid parameters' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY is not set' });
  }

  // 日本語名 → 英語名の順に試す。.official を外した形もフォールバックに入れる
  const calendarIds = [
    `ja.${region}.official#holiday@group.v.calendar.google.com`,
    `en.${region}.official#holiday@group.v.calendar.google.com`,
    `ja.${region}#holiday@group.v.calendar.google.com`,
    `en.${region}#holiday@group.v.calendar.google.com`,
  ];

  const errors: string[] = [];

  for (const calId of calendarIds) {
    const qs = new URLSearchParams({
      key: apiKey,
      timeMin: `${from}T00:00:00Z`,
      timeMax: `${to}T23:59:59Z`,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
    });

    try {
      const r = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${qs}`
      );
      if (!r.ok) {
        errors.push(`${calId}: ${r.status}`);
        continue;
      }
      const json = (await r.json()) as { items?: { summary?: string; start?: { date?: string } }[] };
      const holidays = (json.items ?? [])
        .filter((e) => e.start?.date && e.summary)
        .map((e) => ({ date: e.start!.date as string, name: e.summary as string }));

      if (holidays.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).json({ holidays });
      }
      errors.push(`${calId}: empty`);
    } catch (e) {
      errors.push(`${calId}: ${(e as Error).message}`);
    }
  }

  // 空配列を 200 で返さない（クライアントにキャッシュされるのを防ぐ）
  console.error('holidays: all calendar ids failed', errors);
  return res.status(502).json({ error: 'no holidays found', tried: errors });
}
