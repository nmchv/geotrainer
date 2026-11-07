/* GeoTrainer service worker: офлайн-кэш + push-уведомления */

const CACHE = 'geotrainer-shell-v5';
const CLASS_CACHE_PREFIX = 'geotrainer-class-v5-';
const PRECACHE = [
  '/',
  '/index.html',
  '/config.js',
  '/theme.js',
  '/pwa.js',
  '/cabinet.js',
  '/maps.js',
  '/tests.json',
  '/manifest.webmanifest',
  '/icons/apple-touch-icon.PNG',
  '/icons/icon-192.PNG',
  '/icons/icon-512.PNG'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) =>
        key === 'geotrainer-v1' ||
        (key.startsWith('geotrainer-shell-') && key !== CACHE) ||
        (key.startsWith('geotrainer-class-') && !key.startsWith(CLASS_CACHE_PREFIX))
      ).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // внешние ресурсы (карты, шрифты) не трогаем

  // Страницы: сначала сеть, при отсутствии интернета берём из кэша
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(req);
          await caches.open(CACHE).then((cache) => cache.put(req, response.clone()));
          return response;
        } catch (error) {
          const cached = await caches.match(req) || await caches.match('/index.html');
          if (cached) return cached;
          throw error;
        }
      })()
    );
    return;
  }

  if (url.pathname === '/tests.json') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(req);
          if (response.ok) await caches.open(CACHE).then((cache) => cache.put(req, response.clone()));
          return response;
        } catch (error) {
          const cached = await caches.match(req);
          if (cached) return cached;
          throw error;
        }
      })()
    );
    return;
  }

  // Refresh current assets while retaining cached responses for offline use.
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(req);
        if (response.ok) await caches.open(CACHE).then((cache) => cache.put(req, response.clone()));
        return response;
      } catch (error) {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw error;
      }
    })()
  );
});

const MAP_BUNDLES = {
  europe: '/maps.js', world: '/maps.js',
  russia: '/maps2.js', asia: '/maps2.js', africa: '/maps2.js',
  namerica: '/maps3.js', samerica: '/maps3.js', oceania: '/maps3.js', fo: '/maps3.js', cfo: '/maps3.js',
  szfo: '/maps4.js', yufo: '/maps4.js', skfo: '/maps4.js', pfo: '/maps4.js', urfo: '/maps4.js', sfo: '/maps4.js',
  dfo: '/maps5.js', szyu: '/maps5.js', skpu: '/maps5.js',
  sibdv: '/maps6.js'
};
const CLASS_ASSETS = [
  '/index.html', '/config.js', '/theme.js', '/pwa.js', '/cabinet.js', '/tests.json',
  '/globe.html', '/globe-data.js', '/maplibre-gl.js', '/maplibre-gl.css',
  '/rivers.js', '/satellite.js', '/manifest.webmanifest',
  '/icons/apple-touch-icon.PNG', '/icons/icon-192.PNG', '/icons/icon-512.PNG'
];

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'CACHE_CLASS') return;
  const port = event.ports[0];
  if (!port) return;
  event.waitUntil(cacheClass(event.data, port).catch((error) => {
    port.postMessage({ type: 'error', message: error.message });
  }));
});

async function cacheClass(data, port) {
  const grade = typeof data.grade === 'string' ? data.grade.trim() : '';
  const maps = Array.isArray(data.maps) ? data.maps : [];
  const version = typeof data.version === 'string' ? data.version.replace(/[^a-z0-9_-]/gi, '') : '';
  if (!grade || !version || !maps.length) throw new Error('Не указаны класс, карты или версия тестов.');

  const bundles = [...new Set(maps.map((map) => {
    const bundle = MAP_BUNDLES[map];
    if (!bundle) throw new Error(`Неизвестная карта: ${map}`);
    return bundle;
  }))];
  const assets = [...new Set([...CLASS_ASSETS, ...bundles])];
  const cacheName = CLASS_CACHE_PREFIX + encodeURIComponent(grade) + '-' + version;
  const existing = await caches.open(cacheName);
  if (await existing.match('/__offline_class_manifest__')) {
    port.postMessage({ type: 'done', total: assets.length });
    return;
  }
  await caches.delete(cacheName);
  const cache = await caches.open(cacheName);

  try {
    for (let index = 0; index < assets.length; index += 1) {
      const url = assets[index];
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (!response.ok) throw new Error(`Не удалось скачать ${url} (${response.status}).`);
      await cache.put(url, response.clone());
      port.postMessage({ type: 'progress', completed: index + 1, total: assets.length, file: url.split('/').pop() });
    }

    await cache.put('/__offline_class_manifest__', new Response(JSON.stringify({
      grade, version, maps, assets, downloadedAt: Date.now()
    }), { headers: { 'Content-Type': 'application/json' } }));
  } catch (error) {
    await caches.delete(cacheName);
    throw error;
  }

  const gradePrefix = CLASS_CACHE_PREFIX + encodeURIComponent(grade) + '-';
  const oldCaches = (await caches.keys()).filter((name) => name.startsWith(gradePrefix) && name !== cacheName);
  await Promise.all(oldCaches.map((name) => caches.delete(name)));
  port.postMessage({ type: 'done', total: assets.length });
}

/* ---------- Push-уведомления ---------- */

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'GeoTrainer';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.PNG',
    badge: '/icons/icon-192.PNG',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) { w.navigate(target); return w.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
