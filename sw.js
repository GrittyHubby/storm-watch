/* Storm Watch service worker.
   - The page itself is fetched network-first, so every push reaches installed phones on their next open.
   - If the phone is offline, the last saved copy of the page opens instead of a browser error.
   - Live data (radar, NWS, roads, Duke) is never cached here: it always comes straight from its source. */
const SHELL = "sw-shell-v2";
const SHELL_FILES = ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const LIBS = /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet\/1\.9\.4\//;

const LIB_FILES = ["https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js", "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(async c => {
    await c.addAll(SHELL_FILES);
    // the map library, so the app still opens with no signal (best effort)
    await Promise.all(LIB_FILES.map(u => fetch(u, {mode: "cors"}).then(r => r.ok && c.put(u, r)).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  // the app page: newest from the network, saved copy when offline
  if(req.mode === "navigate"){
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(SHELL).then(c => c.put("./", copy)); return res;
    }).catch(() => caches.match("./")));
    return;
  }
  // our own icons/manifest, and the pinned map library: cache first
  if(url.origin === self.location.origin || LIBS.test(req.url)){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if(res.ok || res.type === "opaque"){ const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      return res;
    })));
  }
  // everything else (weather, radar tiles, Duke, roads) goes straight to the network
});
