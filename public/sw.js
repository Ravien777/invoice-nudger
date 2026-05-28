const CACHE = "maroni-v1";
const STATIC_ASSETS = [
  "/manifest.json",
  "/icon-192.svg",
  "/icon-512.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.url.startsWith(self.location.origin) &&
    event.request.method === "GET"
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached
          ? cached
          : fetch(event.request).then((response) => {
              return caches.open(CACHE).then((cache) => {
                cache.put(event.request, response.clone());
                return response;
              });
            });
      }),
    );
  }
});
