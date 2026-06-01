// Sprint Functional Modul D · Phase 9 — Service Worker
//
// Minimal-SW nur für Web-Push (kein Caching, kein PWA-Offline-Mode).
// Wird in Sprint E5 (Wallet) ggf. erweitert.

self.addEventListener('install', (event) => {
  // Sofort aktiv werden — keine alte SW-Version blockiert.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Alle Clients sofort übernehmen (statt erst beim nächsten Reload).
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'retaha', body: 'Neue Nachricht', url: '/' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (_) {
      try { payload.body = event.data.text(); } catch (_) {}
    }
  }
  const options = {
    body: payload.body,
    icon: '/favicon-192.png',
    badge: '/favicon-96.png',
    data: { url: payload.url || '/' },
    tag: payload.tag || undefined,
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Wenn schon ein Tab dieser Origin offen ist, dorthin fokussieren + navigieren
    for (const client of allClients) {
      if ('focus' in client) {
        try { await client.focus(); } catch (_) {}
        if (client.url.indexOf(self.location.origin) === 0 && 'navigate' in client) {
          try { await client.navigate(targetUrl); } catch (_) {}
          return;
        }
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});
