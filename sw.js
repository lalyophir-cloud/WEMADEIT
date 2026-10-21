// שומר עותק של האפליקציה, כדי שתיפתח גם בלי אינטרנט.
// קודם מנסים להביא גרסה חדשה מהרשת (בלי זיכרון מטמון של הדפדפן), ורק אם אין רשת משתמשים בעותק.
const CACHE = 'wemadeit-v2';
const FILES = ['./', './index.html', './styles.css', './app.js', './questions.js', './manifest.webmanifest', './icons/icon-192.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const own = url.origin === self.location.origin;
  const req = !own ? e.request : new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' });
  e.respondWith(
    fetch(req)
      .then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
