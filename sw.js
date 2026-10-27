// Minimaler Service Worker: macht die Seite installierbar, speichert bewusst nichts zwischen,
// damit immer die aktuelle Version und aktuelle Daten geladen werden.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => { e.respondWith(fetch(e.request)); });
