// Minimaler Service Worker: macht die Seite installierbar, speichert bewusst nichts zwischen,
// damit immer die aktuelle Version und aktuelle Daten geladen werden.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
// Seite und JSON-Daten immer beim Server nachprüfen (kein Warten auf den 10-Minuten-Cache von GitHub Pages)
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  const fresh = r.method === "GET" && u.origin === self.location.origin && (r.mode === "navigate" || /\.(html|json|webmanifest)$|\/$/.test(u.pathname));
  e.respondWith(fresh ? fetch(r, {cache: "no-cache"}).catch(() => fetch(r)) : fetch(r));
});
