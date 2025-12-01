// Service Worker para notificações push
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let data = {};
  
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('Error parsing push data:', error);
  }
  
  const title = data.title || 'Nova Notificação';
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo-conexaovirtual.png',
    badge: data.badge || '/logo-conexaovirtual.png',
    data: data.data || {},
    tag: data.tag || 'default',
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' }
    ]
  };
  
  console.log('Showing notification:', title, options);
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const data = event.notification.data;
  let url = '/';
  
  if (data?.type === 'new_ticket') {
    url = `/tickets/${data.ticketId}`;
  } else if (data?.type === 'service_order_reminder') {
    url = `/service-orders`;
  }
  
  console.log('Opening URL:', url);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Procurar janela já aberta
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus().then(() => client.navigate(url));
        }
      }
      
      // Abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});
