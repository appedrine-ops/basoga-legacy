// Basoga's Legacy: opens instantly from the phone's saved copy, refreshes quietly in the background,
// and keeps working with no internet. Change the CACHE name when a new release must replace the old files.
const CACHE = "basoga-v9";
const SHELL = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png"];
const FIREBASE = [
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })));
    await Promise.all(FIREBASE.map(u => c.add(new Request(u, { mode: "cors" })).catch(() => {})));
  }).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Firebase code files never change at a given version: serve from the saved copy first.
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Our own files: show the saved copy at once, and fetch the newest copy for next time.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
      const fresh = fetch(new Request(req.url, { cache: "no-cache" })).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit || caches.match("index.html"));
      return hit || fresh;
    }));
  }
});

// Tapping an alert brings the app to the front.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
