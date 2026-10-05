// Service worker: it keeps running in the background and wakes up
// when a push message arrives, even if the app is closed or the phone is locked.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {
    title: 'Test Alert',
    body: 'This is a visual alert for our accessibility project.',
  };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {
    // keep the default text
  }

  // iOS requires that every push shows a visible notification.
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length > 0) return list[0].focus();
      return self.clients.openWindow('/');
    })
  );
});
