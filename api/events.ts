import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// Cookie文字列から指定キーの値を取り出すユーティリティ
function parseCookie(cookieHeader: string, key: string): string | null {
  const found = cookieHeader
    .split(';')
    .map(c => c.trim().split('='))
    .find(([k]) => k === key);
  return found ? decodeURIComponent(found[1]) : null;
}

// refresh_token を使って新しい access_token を取得し、Cookieをセットして返す
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
  const expiresAt = Date.now() + (parseInt(expires_in, 10) || 3600) * 1000;

  // 更新したトークンを Cookie に再セット
  res.setHeader('Set-Cookie', [
    `google_access_token=${access_token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${expires_in || 3600}`,
    `google_token_expires_at=${expiresAt}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${expires_in || 3600}`,
  ]);

  return access_token;
}

// 有効な access_token を取得する（必要に応じて自動リフレッシュ）
async function getValidAccessToken(
  req: VercelRequest,
  res: VercelResponse
): Promise<string | null> {
  const cookieHeader = req.headers.cookie || '';
  const accessToken = parseCookie(cookieHeader, 'google_access_token');
  const expiresAtStr = parseCookie(cookieHeader, 'google_token_expires_at');

  // トークンが有効（有効期限の5分前まで使用）
  const isValid =
    accessToken &&
    expiresAtStr &&
    Date.now() < parseInt(expiresAtStr, 10) - 5 * 60 * 1000;

  if (isValid) return accessToken!;

  // 期限切れ → KVからrefresh_tokenを取得してリフレッシュ
  const refreshToken = await kv.get<string>('google_refresh_token');
  if (!refreshToken) return null;

  return await refreshAccessToken(res, refreshToken);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ログアウト処理
  if (req.method === 'DELETE' && req.url?.includes('/logout')) {
    await kv.del('google_refresh_token');
    res.setHeader('Set-Cookie', [
      'google_access_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
      'google_token_expires_at=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
    ]);
    return res.json({ ok: true });
  }

  // ログイン状態確認
  if (req.method === 'GET' && req.url?.includes('/status')) {
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
    if (!gcRes.ok) return res.status(gcRes.status).json({ error: 'Google API error' });
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
