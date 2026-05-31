import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query;

  // Googleがエラーを返した場合（ユーザーがキャンセルした等）
  if (error) {
    return res.redirect(`/?auth_error=${encodeURIComponent(String(error))}`);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  // code → access_token + refresh_token の交換
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
    return res.redirect('/?auth_error=token_exchange_failed');
  }

  const tokens = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokens;

  if (!refresh_token) {
    // prompt='consent' を指定しているので通常は必ず届くが、念のため
    console.error('No refresh_token returned from Google');
    return res.redirect('/?auth_error=no_refresh_token');
  }

  // Vercel KV に refresh_token を永続保存
  // キー: "google_refresh_token"（シングルユーザー用途なので固定キー）
  await kv.set('google_refresh_token', refresh_token);

  // access_token と有効期限をセッションCookieとして保存
  // HttpOnly + SameSite=Lax でXSS対策
  const expiresAt = Date.now() + (parseInt(expires_in, 10) || 3600) * 1000;

  res.setHeader('Set-Cookie', [
    `google_access_token=${access_token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${expires_in || 3600}`,
    `google_token_expires_at=${expiresAt}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${expires_in || 3600}`,
  ]);

  // ログイン完了後はアプリのトップへリダイレクト
  res.redirect('/?auth_success=1');
}
