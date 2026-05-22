const CACHE_NAME = 'focusweeks-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/calendar-month.js',
  '/calendar-week.js',
  '/storage.js',
  '/ical-parser.js',
  '/image_07a716.png',
  '/manifest.json'
];

// インストール時にファイルをキャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// リクエスト発生時にキャッシュを返す（オフライン対応）
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});