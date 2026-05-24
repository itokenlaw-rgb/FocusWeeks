const CACHE_NAME = 'focusweeks-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/calendar-month.js',
  '/calendar-week.js',
  '/storage.js',
  '/ical-parser.js',
  '/google-auth.js',
  '/manifest.json'
];

// インストール時にファイルをキャッシュ
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 古いキャッシュを削除
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// リクエスト発生時にキャッシュを返す（オフライン対応）
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // OAuth コールバック・認証系リクエストはキャッシュせず素通りさせる
  if (
    url.searchParams.has('code') ||
    url.searchParams.has('state') ||
    url.searchParams.has('error') ||
    url.hostname === 'accounts.google.com' ||
    url.hostname === 'oauth2.googleapis.com' ||
    url.hostname === 'www.googleapis.com'
  ) {
    return; // SWを介さずブラウザがそのまま処理する
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});