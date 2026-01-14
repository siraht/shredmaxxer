/* App-shell cache with explicit versioning */
const CACHE_PREFIX = "shredmaxx-app-shell";
const CACHE_VERSION = "v4-0.7";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const RUNTIME_CACHE = "shredmaxx-runtime-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app/boot.js",
  "./app.js",
  "./app/store.js",
  "./app/reducer.js",
  "./ui/elements.js",
  "./ui/legacy.js",
  "./domain/schema.js",
  "./domain/time.js",
  "./domain/selectors.js",
  "./domain/roster.js",
  "./domain/roster_defaults.js",
  "./domain/roster_edit.js",
  "./domain/revisions.js",
  "./domain/flags.js",
  "./domain/heuristics.js",
  "./domain/insights.js",
  "./domain/search.js",
  "./domain/rotation.js",
  "./domain/coverage.js",
  "./domain/correlations.js",
  "./domain/recents.js",
  "./domain/weekly.js",
  "./storage/adapter.js",
  "./storage/idb.js",
  "./storage/local.js",
  "./storage/localStorage.js",
  "./storage/persist.js",
  "./storage/meta.js",
  "./storage/export.js",
  "./storage/csv_export.js",
  "./storage/encrypted_export.js",
  "./storage/import.js",
  "./storage/merge.js",
  "./storage/validate.js",
  "./storage/snapshots.js",
  "./storage/migrate.js",
  "./assets/fonts/SpaceGrotesk.woff2",
  "./assets/fonts/Fraunces.woff2",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

const ASSET_URLS = ASSETS.map((path) => new URL(path, self.registration.scope).href);
const ASSET_SET = new Set(ASSET_URLS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if(key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME){
          return caches.delete(key);
        }
        return null;
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if(event.request.method !== "GET") return;

  const url = event.request.url;
  if(event.request.mode === "navigate"){
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  if(ASSET_SET.has(url)){
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  if(event.request.destination === "image"){
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if(cached) return cached;
        const fresh = await fetch(event.request);
        if(fresh && fresh.ok) cache.put(event.request, fresh.clone());
        return fresh;
      })
    );
  }
});

self.addEventListener("message", (event) => {
  if(event.data && event.data.type === "SKIP_WAITING"){
    self.skipWaiting();
  }
});
