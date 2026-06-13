const CACHE_NAME = "bookmark-mobile-pwa-v3";
const ASSETS = [
  "/",
  "/index.html",
  "/share.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/app.js",
  "/db.js",
  "/security.js",
  "/share.js",
  "/styles.css"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request);
    })
  );
});
