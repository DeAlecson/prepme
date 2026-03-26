/* PrepMe Service Worker — makes the app installable */
const CACHE = 'prepme-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      '/prepme/',
      '/prepme/index.html',
      '/prepme/css/styles.css',
      '/prepme/css/themes.css',
      '/prepme/manifest.json',
      '/prepme/icons/icon.svg',
    ]))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Network-first: always try network, fall back to cache */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Don't intercept Supabase or Anthropic API calls
  const url = e.request.url;
  if (url.includes('supabase.co') || url.includes('anthropic') || url.includes('workers.dev')) return;

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
