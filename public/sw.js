// sw.js
// 目的：アプリ本体（HTML/JS/CSS）を「電波探索中」でも即座にキャッシュから返し、
// 白画面の待機時間をなくす。裏側では常に最新版を取りに行って次回起動時に反映する
// （stale-while-revalidate）。
//
// /api/ 配下（ログイン確認・イベント取得など）は一切キャッシュしない。
// オンライン/オフラインの判定やキャッシュ予定の表示は googleCalendar.ts /
// App.tsx 側のロジックに完全に委ねる。

const CACHE_NAME = 'focusweeks-shell-v1'; // 中身を大きく変えたらバージョンを上げる

self.addEventListener('install', (event) => {
  // 待たずにすぐ新しいSWをactivateさせたい場合は以下を有効化
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 同一オリジンのGETリクエストのみ対象
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // /api/ はSWでキャッシュしない（ログイン状態・予定データは常に生の結果を使う）
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // アプリ本体（HTMLナビゲーション・JS・CSS・フォント等）は
  // cache-first + バックグラウンド更新（stale-while-revalidate）
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);

      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null); // 電波探索中で長時間ハングしてもここは無視してよい

      // キャッシュがあれば即座にそれを返す（電波状況に関係なく一瞬で表示される）
      if (cached) {
        // 裏で更新だけしておく（結果は待たない）
        networkFetch;
        return cached;
      }

      // 初回アクセス等でキャッシュがなければネットワークを待つしかない
      const networkRes = await networkFetch;
      if (networkRes) return networkRes;

      // ネットワークも失敗し、ナビゲーションリクエストなら最低限 index.html を試す
      if (req.mode === 'navigate') {
        const fallback = await cache.match('/');
        if (fallback) return fallback;
      }

      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
