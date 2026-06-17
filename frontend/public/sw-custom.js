// Ivy Service Worker — VAPID Push + offline shell
// Workbox InjectManifest injects precache entries here at build time.
// In development next-pwa disables the SW (process.env.NODE_ENV === 'development').
const WB_MANIFEST = self.__WB_MANIFEST || [];

/* ── Constants ────────────────────────────────────────────────────────────── */
const CACHE_NAME = 'ivy-shell-v1';
const OFFLINE_URL = '/offline';

// Routes the app always wants cached for instant load
const SHELL_URLS = [
  '/',
  '/daily',
  '/dashboard',
  '/offline',
];

/* ── Install ──────────────────────────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  // Activate immediately — don't wait for old SW to idle
  self.skipWaiting();
});

/* ── Activate ─────────────────────────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch (network-first, shell fallback) ───────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle GET navigations for offline fallback
  if (request.method !== 'GET') return;
  if (!request.headers.get('accept')?.includes('text/html')) return;

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL).then((r) => r || new Response('Offline', { status: 503 }))
    )
  );
});

/* ── Push Notifications ───────────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Ivy', body: event.data.text() };
  }

  const {
    title   = 'Ivy',
    body    = '',
    icon    = '/icons/icon-192x192.png',
    badge   = '/icons/icon-96x96.png',
    tag     = 'ivy-notification',
    url     = '/daily',
    actions = [],
    // Ivy-specific fields
    type,       // 'morning-vn' | 'stake-warning' | 'circle-baton' | 'evening-review'
    stakeAmount,
    circleName,
  } = payload;

  // Compose contextual copy based on notification type
  const notifBody = (() => {
    if (type === 'morning-vn')     return body || `Drop your voice note — your stake is on the line.`;
    if (type === 'stake-warning')  return body || `Last chance. ${stakeAmount ? `£${stakeAmount}` : 'Your stake'} forfeits in 30 min.`;
    if (type === 'circle-baton')   return body || `${circleName || 'Your circle'} passed the baton to you.`;
    if (type === 'evening-review') return body || `Time to review your day with Ivy.`;
    return body;
  })();

  // Vibration pattern varies by urgency
  const vibrate = type === 'stake-warning'
    ? [200, 100, 200, 100, 300]
    : [100, 50, 100];

  event.waitUntil(
    self.registration.showNotification(title, {
      body:               notifBody,
      icon,
      badge,
      tag,
      data:               { url, type },
      actions,
      vibrate,
      requireInteraction: type === 'stake-warning', // stake warnings stay until dismissed
      silent:             false,
    })
  );
});

/* ── Notification Click ───────────────────────────────────────────────────── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { url = '/daily', type } = event.notification.data || {};

  // Route by action button id if present
  const actionUrl = event.action === 'record-vn'     ? '/daily?action=record'
                  : event.action === 'snooze'         ? null  // just close
                  : event.action === 'view-circle'    ? '/circles'
                  : url;

  if (!actionUrl) return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window on the target path
      for (const client of clientList) {
        if (client.url.endsWith(actionUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise navigate the first available client or open a new window
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          client.navigate(actionUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(actionUrl);
    })
  );
});

/* ── Push Subscription Change ─────────────────────────────────────────────── */
// Fires when browser auto-rotates push subscription keys
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      // Re-use the same VAPID application server key
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    }).then((newSub) => {
      // Notify the backend — fire-and-forget; backend URL is injected at build
      return fetch('/api/push/resubscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          endpoint:    newSub.endpoint,
          keys:        newSub.toJSON().keys,
          oldEndpoint: event.oldSubscription?.endpoint,
        }),
      });
    })
  );
});
