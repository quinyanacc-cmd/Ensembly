const CACHE = "ensembly-v6-5-1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./logo.png",
  "./morning-header.jpg",
  "./evening-header.jpg",
  "./mascot-ich.jpeg",
  "./mascot-vitalist.jpeg",
  "./mascot-absolvent.jpeg",
  "./mascot-unternehmer.jpeg",
  "./mascot-muslim.jpeg",
  "./mascot-wirt.jpeg",
  "./mascot-familie.jpeg",
  "./mascot-absolvent-dark.webp",
  "./mascot-familie-dark.webp",
  "./mascot-ich-dark.webp",
  "./mascot-muslim-dark.webp",
  "./mascot-unternehmer-dark.webp",
  "./mascot-vitalist-dark.webp",
  "./mascot-wirt-dark.webp"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
