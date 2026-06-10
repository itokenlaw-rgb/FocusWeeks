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

  let tokenRes: Response;
  try {
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
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
  } catch (fetchErr) {
    console.error('[callback] fetch failed:', fetchErr);
    return res.status(302).setHeader('Location', '/?auth_error=token_fetch_failed').end();
  }

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error('[callback] token exchange failed:', errBody);
    return res.status(302).setHeader('Location', '/?auth_error=token_exchange_failed').end();
  }

  const tokens = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokens;

  if (!refresh_token) {
    console.error('[callback] no refresh_token');
    return res.status(302).setHeader('Location', '/?auth_error=no_refresh_token').end();
  }

  const sessionId = randomUUID();
  try {
    await kv.set(`refresh_token:${sessionId}`, refresh_token, {
      ex: 60 * 60 * 24 * 30,
    });
  } catch (redisErr) {
    console.error('[callback] Redis write failed:', redisErr);
    return res.status(302).setHeader('Location', '/?auth_error=redis_failed').end();
  }

  const expiresInSec = parseInt(String(expires_in), 10) || 3600;
  const expiresAt = Date.now() + expiresInSec * 1000;

  // [修正1] SameSite=None; Secure → Safari ITP によるCookie破棄を回避
  // [修正2] Cookie名を session_id に統一（events.ts の parseCookie と一致させる）
  const cookieOptions = "HttpOnly; Path=/; SameSite=None; Secure";

  return res
    .status(302)
    .setHeader('Set-Cookie', [
      `session_id=${sessionId}; ${cookieOptions}; Max-Age=${60 * 60 * 24 * 30}`,
      `google_access_token=${access_token}; ${cookieOptions}; Max-Age=${expiresInSec}`,
      `google_token_expires_at=${expiresAt}; ${cookieOptions}; Max-Age=${expiresInSec}`,
    ])
    .setHeader('Location', '/?auth_success=1')
    .end();
}
