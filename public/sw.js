// readr service worker: serves the app shell offline. Books live in IndexedDB
// and never pass through here.
//
// The version comes from the registration URL (/sw.js?v=<build>), so every
// build installs a new worker. It waits until every readr window is closed
// before activating (no skipWaiting), so a reading session is never reloaded
// or mixed between versions.

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `readr-${VERSION}`;
const DOCUMENTS = ["/", "/read"];
const STATIC_ASSET = /\/_next\/static\/[^"'\s)\\]+/g;

function collectAssets(text, into) {
  for (const match of text.matchAll(STATIC_ASSET)) into.add(match[0]);
}

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set();

  for (const path of DOCUMENTS) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`precache ${path}: ${response.status}`);
    await cache.put(path, response.clone());
    collectAssets(await response.text(), assets);
  }

  // Fonts are referenced from stylesheets rather than from the HTML.
  for (const css of [...assets].filter((url) => url.endsWith(".css"))) {
    try {
      collectAssets(await (await fetch(css)).text(), assets);
    } catch {
      // The stylesheet itself is retried below.
    }
  }

  const extras = ["/manifest.webmanifest"];
  try {
    const manifest = await (await fetch("/manifest.webmanifest")).json();
    for (const icon of manifest.icons ?? []) extras.push(icon.src);
  } catch {
    // Icons are optional for offline use.
  }

  // One missing asset must not fail the whole install.
  await Promise.all([...assets, ...extras].map((url) => cache.add(url).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("readr-") && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function fromCache(key) {
  const cache = await caches.open(CACHE);
  return cache.match(key, { ignoreSearch: true });
}

async function networkFirst(request, cacheKey) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = (await fromCache(cacheKey)) ?? (await fromCache("/"));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // /read?book=… is one document for every book.
    const key = DOCUMENTS.includes(url.pathname) ? url.pathname : "/";
    event.respondWith(networkFirst(request, key));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icon")) {
    event.respondWith(networkFirst(request, url.pathname));
  }
});
