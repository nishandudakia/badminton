const CACHE_NAME = "badminton-championship-v2";
const scopeUrl = new URL(self.registration.scope);
const APP_SHELL = ["manifest.json", "icon.svg"].map((path) => new URL(path, scopeUrl).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isScopedRequest = url.origin === self.location.origin && url.href.startsWith(scopeUrl.href);
  if (!isScopedRequest || url.pathname.endsWith("/sw.js")) return;

  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(networkFirst(event.request, new URL("", scopeUrl).toString()));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    await cacheResponse(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? caches.match(fallbackUrl);
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networked = fetch(request)
    .then(async (response) => {
      await cacheResponse(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  return cached ?? networked.then((response) => response ?? Response.error());
}

async function cacheResponse(request, response) {
  if (!response || !response.ok || response.type === "opaque") return;

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}
