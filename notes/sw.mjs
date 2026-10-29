const cacheName = `pocketroute-notes:${self.registration.scope}:${__BUILD_VERSION__}`;
const cachePrefix = `pocketroute-notes:${self.registration.scope}:`;
const assets = __OFFLINE_ASSETS__;
const appUrl = new URL("./", self.registration.scope).href;
const permitted = new Set(assets.map(path => new URL(path, self.registration.scope).href));

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    try { const cache = await caches.open(cacheName); await cache.addAll(assets.map(path => new Request(new URL(path, self.registration.scope), { cache: "reload" }))); }
    catch (error) { await caches.delete(cacheName); throw error; }
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(cachePrefix) && key !== cacheName) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.kind === "ACTIVATE_UPDATE") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const canonical = `${url.origin}${url.pathname}`;
  if (permitted.has(canonical) || canonical === appUrl) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      return await cache.match(canonical === appUrl ? new URL("./index.html", appUrl).href : canonical) || fetch(event.request);
    })());
  }
});