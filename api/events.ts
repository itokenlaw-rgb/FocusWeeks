import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export const config = {
  api: {
    bodyParser: true,
  },
};

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function parseCookie(cookieHeader: string, key: string): string | null {
  const found = cookieHeader
    .split(';')
    .map(c => {
      const eqIdx = c.trim().indexOf('=');
      if (eqIdx === -1) return [c.trim(), ''];
      return [c.trim().substring(0, eqIdx), c.trim().substring(eqIdx + 1)];
    })
    .find(([k]) => k === key);
  return found ? decodeURIComponent(found[1]) : null;
}

// [修正] SameSite=None; Secure に統一
const COOKIE_OPTIONS = "HttpOnly; Path=/; SameSite=None; Secure";

async function refreshAccessToken(
  res: VercelResponse,
  refreshToken: string
): Promise<string | null> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenRes.ok) {
    console.error('Failed to refresh token:', await tokenRes.text());
    return null;
  }

  const tokens = await tokenRes.json();
  const { access_token, expires_in } = tokens;
  const expiresInSec = parseInt(String(expires_in), 10) || 3600;
  const expiresAt = Date.now() + expiresInSec * 1000;

  res.setHeader('Set-Cookie', [
    `google_access_token=${access_token}; ${COOKIE_OPTIONS}; Max-Age=${expiresInSec}`,
    `google_token_expires_at=${expiresAt}; ${COOKIE_OPTIONS}; Max-Age=${expiresInSec}`,
  ]);

  return access_token;
}

async function getValidAccessToken(
  req: VercelRequest,
  res: VercelResponse
): Promise<string | null> {
  const cookieHeader = req.headers.cookie || '';

  const sessionId = parseCookie(cookieHeader, 'session_id');
  if (!sessionId) return null;

  const accessToken = parseCookie(cookieHeader, 'google_access_token');
  const expiresAtStr = parseCookie(cookieHeader, 'google_token_expires_at');

  const isValid =
    accessToken &&
    expiresAtStr &&
    Date.now() < parseInt(expiresAtStr, 10) - 5 * 60 * 1000;

  if (isValid) return accessToken!;

  const refreshToken = await kv.get<string>(`refresh_token:${sessionId}`);
  if (!refreshToken) return null;

  return await refreshAccessToken(res, refreshToken);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ログアウト処理
  if (req.method === 'DELETE' && req.query.action === 'logout') {
    const sessionId = parseCookie(req.headers.cookie || '', 'session_id');
    if (sessionId) {
      await kv.del(`refresh_token:${sessionId}`);
    }
    res.setHeader('Set-Cookie', [
      `session_id=; ${COOKIE_OPTIONS}; Max-Age=0`,
      `google_access_token=; ${COOKIE_OPTIONS}; Max-Age=0`,
      `google_token_expires_at=; ${COOKIE_OPTIONS}; Max-Age=0`,
    ]);
    return res.json({ ok: true });
  }

  // ログイン状態確認
  if (req.method === 'GET' && req.query.action === 'status') {
    const token = await getValidAccessToken(req, res);
    return res.json({ loggedIn: !!token });
  }

  const accessToken = await getValidAccessToken(req, res);

  if (!accessToken) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const method = req.method || 'GET';

  // ---- イベント一覧取得 ----
  if (method === 'GET') {
    const { timeMin, timeMax } = req.query;
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(String(timeMin))}&timeMax=${encodeURIComponent(String(timeMax))}&singleEvents=true&orderBy=startTime&maxResults=250`;

    const gcRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!gcRes.ok) return res.status(gcRes.status).json({ error: 'Google API error' });
    return res.json(await gcRes.json());
  }

  // ---- イベント作成 ----
  if (method === 'POST') {
    const gcRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      }
    );
    if (!gcRes.ok) {
      const errText = await gcRes.text();
      console.error('Google API POST error:', errText);
      return res.status(gcRes.status).json({ error: 'Google API error', detail: errText });
    }
    return res.json(await gcRes.json());
  }

  // ---- イベント更新 ----
  if (method === 'PUT') {
    const { eventId } = req.query;
    const gcRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      }
    );
    if (!gcRes.ok) return res.status(gcRes.status).json({ error: 'Google API error' });
    return res.json(await gcRes.json());
  }

  // ---- イベント削除 ----
  if (method === 'DELETE') {
    const { eventId } = req.query;
    const gcRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!gcRes.ok) return res.status(gcRes.status).json({ error: 'Google API error' });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
