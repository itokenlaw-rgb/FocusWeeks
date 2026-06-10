import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ← この行を追加
  console.log('callback query:', JSON.stringify(req.query));
  console.log('callback env check:', {
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const { code, error } = req.query;

  // Google認証画面でキャンセルなどが発生した場合のエラーハンドリング
  if (error) {
    return res.status(302).setHeader('Location', `/?auth_error=${encodeURIComponent(String(error))}`).end();
  }

  // 認可コードがない場合はエラー
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  // 認可コードをGoogleのアクセストークン／リフレッシュトークンと交換
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

  // セキュリティ対策：refresh_tokenが取得できない場合はエラーにして不正な状態を防ぐ
  if (!refresh_token) {
    console.error('No refresh_token returned from Google');
    return res.status(302).setHeader('Location', '/?auth_error=no_refresh_token').end();
  }

  // ユーザーごとに独立した一意のセッションIDを発行し、KV（Redis）にrefresh_tokenを紐付けて保存
  const sessionId = randomUUID();
  await kv.set(`refresh_token:${sessionId}`, refresh_token, {
    ex: 60 * 60 * 24 * 30, // 30日間有効
  });

  // [修正] expires_in を数値として正規化（文字列・undefined 両方に対応）
  const expiresInSec = parseInt(String(expires_in), 10) || 3600;

  // アクセストークンの有効期限（ミリ秒）を算出
  const expiresAt = Date.now() + expiresInSec * 1000;

  // SafariのITP保護や他ブラウザでのCookie拒否を回避するための安全な属性セット
  const cookieOptions = "HttpOnly; Path=/; SameSite=Lax; Secure";

  // 302リダイレクトでブラウザにCookieを焼きつつ、確実にトップページ（/）へ戻す
  return res
    .status(302)
    .setHeader('Set-Cookie', [
      `session_id=${sessionId}; ${cookieOptions}; Max-Age=${60 * 60 * 24 * 30}`,
      // [修正] Max-Age に正規化済みの数値を使用
      `google_access_token=${access_token}; ${cookieOptions}; Max-Age=${expiresInSec}`,
      `google_token_expires_at=${expiresAt}; ${cookieOptions}; Max-Age=${expiresInSec}`,
    ])
    .setHeader('Location', '/?auth_success=1')
    .end();
}
