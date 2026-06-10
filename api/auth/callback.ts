import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query;

  if (error) {
    return res.status(302).setHeader('Location', `/?auth_error=${encodeURIComponent(String(error))}`).end();
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error('Token exchange failed:', errBody);
    return res.status(302).setHeader('Location', '/?auth_error=token_exchange_failed').end();
  }

  const tokens = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokens;

  if (!refresh_token) {
    console.error('No refresh_token returned from Google');
    return res.status(302).setHeader('Location', '/?auth_error=no_refresh_token').end();
  }

  // ユーザーごとにセッションIDを発行し、KVに紐付けて保存
  const sessionId = randomUUID();
  await kv.set(`refresh_token:${sessionId}`, refresh_token, {
    ex: 60 * 60 * 24 * 30, // 30日
  });

  const expiresAt = Date.now() + (parseInt(expires_in, 10) || 3600) * 1000;

  res
    .status(302)
    .setHeader('Set-Cookie', [
      `session_id=${sessionId}; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=${60 * 60 * 24 * 30}`,
      `google_access_token=${access_token}; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=${expires_in || 3600}`,
      `google_token_expires_at=${expiresAt}; HttpOnly; Path=/; SameSite=None; Secure; Max-Age=${expires_in || 3600}`,
    ])
    .setHeader('Location', '/?auth_success=1')
    .end();
}
