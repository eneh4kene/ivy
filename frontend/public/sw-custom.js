// Custom service worker logic — runs alongside next-pwa's generated sw.js
// next-pwa (workbox InjectManifest) requires this assignment to inject the precache manifest
const WB_MANIFEST = self.__WB_MANIFEST || [];

self.addEventListener('push', function (event) {
  if (!event.data) return;

  const data = event.data.json();
  const { title, body, icon, badge, tag, url, actions } = data;

  event.waitUntil(
    self.registration.showNotification(title || 'Ivy', {
      body: body || '',
      icon: icon || '/icons/icon-192x192.png',
      badge: badge || '/icons/icon-96x96.png',
      tag: tag || 'ivy-notification',
      data: { url: url || '/dashboard' },
      actions: actions || [],
      vibrate: [100, 50, 100],
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
