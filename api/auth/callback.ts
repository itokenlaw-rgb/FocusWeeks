import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ★デバッグ: どの環境変数が入っているか確認（値は出さない）
  console.log('[callback] env check:', {
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log('[callback] query keys:', Object.keys(req.query));

  const { code, error } = req.query;

  if (error) {
    console.log('[callback] error param:', error);
    return res.status(302).setHeader('Location', `/?auth_error=${encodeURIComponent(String(error))}`).end();
  }

  if (!code || typeof code !== 'string') {
    console.log('[callback] missing code');
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  // ★デバッグ: トークン交換前
  console.log('[callback] starting token exchange...');

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
    console.error('[callback] fetch to Google token endpoint failed:', fetchErr);
    return res.status(302).setHeader('Location', '/?auth_error=token_fetch_failed').end();
  }

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error('[callback] token exchange failed. status:', tokenRes.status, 'body:', errBody);
    return res.status(302).setHeader('Location', '/?auth_error=token_exchange_failed').end();
  }

  const tokens = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokens;

  // ★デバッグ: トークン取得結果（値は出さない）
  console.log('[callback] token exchange ok. hasAccessToken:', !!access_token, 'hasRefreshToken:', !!refresh_token, 'expires_in:', expires_in);

  if (!refresh_token) {
    console.error('[callback] no refresh_token returned');
    return res.status(302).setHeader('Location', '/?auth_error=no_refresh_token').end();
  }

  // ★デバッグ: Redis書き込み前
  console.log('[callback] writing to Redis...');

  const sessionId = randomUUID();
  try {
    await kv.set(`refresh_token:${sessionId}`, refresh_token, {
      ex: 60 * 60 * 24 * 30,
    });
  } catch (redisErr) {
    console.error('[callback] Redis write failed:', redisErr);
    return res.status(302).setHeader('Location', '/?auth_error=redis_failed').end();
  }

  console.log('[callback] Redis write ok. Redirecting to /?auth_success=1');

  const expiresInSec = parseInt(String(expires_in), 10) || 3600;
  const expiresAt = Date.now() + expiresInSec * 1000;
  const cookieOptions = "HttpOnly; Path=/; SameSite=Lax; Secure";

  return res
    .status(302)
.setHeader('Set-Cookie', [
      `gcal_session_id=${sessionId}; ${cookieOptions}; Max-Age=${60 * 60 * 24 * 30}`,
      `google_access_token=${access_token}; ${cookieOptions}; Max-Age=${expiresInSec}`,
      `google_token_expires_at=${expiresAt}; ${cookieOptions}; Max-Age=${expiresInSec}`,
    ])
    .setHeader('Location', '/?auth_success=1')
    .end();
}
