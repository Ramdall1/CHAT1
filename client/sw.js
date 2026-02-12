// Service Worker para notificaciones push y cache
const CACHE_NAME = 'whatsapp-bot-v1';
const urlsToCache = [
  '/',
  '/client/css/main.css',
  '/client/css/components.css',
  '/client/css/bootstrap-fallback.css',
  '/client/js/common.js',
  '/client/js/main.js',
  '/client/js/notifications.js',
  '/client/js/cdn-fallback.js'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('📱 Service Worker instalándose...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('❌ Error cacheando recursos:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('✅ Service Worker activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptar requests
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devolver desde cache si está disponible
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Manejar notificaciones push
self.addEventListener('push', event => {
  console.log('🔔 Notificación push recibida');
  
  const options = {
    body: 'Nueva actualización disponible',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver',
        icon: '/favicon.ico'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/favicon.ico'
      }
    ]
  };

  let title = 'WhatsApp Bot';
  let body = 'Nueva actualización disponible';

  if (event.data) {
    const data = event.data.json();
    title = data.title || title;
    body = data.body || body;
    if (data.icon) options.icon = data.icon;
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      ...options,
      body
    })
  );
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', event => {
  console.log('👆 Click en notificación:', event.notification.tag);
  
  event.notification.close();

  if (event.action === 'explore') {
    // Abrir la aplicación
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Solo cerrar la notificación
    return;
  } else {
    // Click en el cuerpo de la notificación
    event.waitUntil(
      clients.matchAll().then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Manejar cierre de notificaciones
self.addEventListener('notificationclose', event => {
  console.log('❌ Notificación cerrada:', event.notification.tag);
});

// Sincronización en segundo plano
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Sincronización en segundo plano');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Verificar estado de APIs
    const response = await fetch('/api/360dialog/status');
    if (response.ok) {
      const data = await response.json();
      
      // Enviar mensaje a la aplicación principal
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'BACKGROUND_SYNC',
          data: data
        });
      });
    }
  } catch (error) {
    console.error('❌ Error en sincronización:', error);
  }
}