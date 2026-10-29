// TCC TV — service worker des notifications (rien d'autre : aucun cache, l'app reste toujours en ligne).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// notification envoyée par Firebase Cloud Messaging : { data: { title, body, url, tag } }
self.addEventListener("push", e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) { p = { data: { title: "TCC TV", body: e.data ? e.data.text() : "" } }; }
  const d = p.data || p.notification || p;
  const opt = { body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", data: { url: d.url || "#/" } };
  if (d.tag) { opt.tag = d.tag; opt.renotify = true; }
  e.waitUntil(self.registration.showNotification(d.title || "TCC TV", opt));
});

// appui sur la notification : ouvre la bonne page de l'app (ou l'article)
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const raw = (e.notification.data && e.notification.data.url) || "#/";
  if (/^https?:\/\//.test(raw) && raw.indexOf(self.registration.scope) !== 0) { e.waitUntil(self.clients.openWindow(raw)); return; }
  const url = new URL(raw, self.registration.scope).href, hash = url.indexOf("#") >= 0 ? url.slice(url.indexOf("#")) : "#/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const c = list.find(w => w.url.indexOf(self.registration.scope) === 0);
    if (c) { c.postMessage({ go: hash }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
