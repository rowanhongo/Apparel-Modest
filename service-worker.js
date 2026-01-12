// Service Worker for Apparel Modest PWA
// Update this timestamp on each deployment to trigger cache invalidation
// Format: YYYYMMDD-HHMMSS (update when deploying)
const CACHE_VERSION = '20260112-110000';
const CACHE_NAME = `apparel-modest-${CACHE_VERSION}`;
const RUNTIME_CACHE = `apparel-modest-runtime-${CACHE_VERSION}`;

// Log version for debugging
console.log('[Service Worker] Version:', CACHE_VERSION);

// Assets to cache on install (HTML files excluded - always fetch fresh)
const STATIC_ASSETS = [
  '/manifest.json',
  '/config/supabase.js',
  '/config/env-loader.js',
  '/config/cloudinary.js',
  // Add other critical assets here (but NOT HTML files)
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
          .catch((error) => {
            console.warn('[Service Worker] Failed to cache some assets:', error);
            // Continue even if some assets fail to cache
            return Promise.resolve();
          });
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches and remove HTML from any cache
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete ALL old caches (including old runtime caches)
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        // Also delete any old runtime caches that might have the old version
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('apparel-modest-runtime-') && name !== RUNTIME_CACHE)
            .map(name => {
              console.log('[Service Worker] Deleting old runtime cache:', name);
              return caches.delete(name);
            })
        );
      }).then(() => {
        // Remove HTML and JavaScript files from runtime cache (if any exist)
        return caches.open(RUNTIME_CACHE).then(cache => {
          return cache.keys().then(keys => {
            const filesToRemove = keys.filter(key => {
              const url = key.url || key;
              // Remove HTML files
              const isHTML = url.includes('.html') || url.endsWith('/') || url === location.origin + '/' || url === location.origin + '/index.html';
              // Remove JavaScript files
              const isJS = url.endsWith('.js') || url.includes('/employee services/') || url.includes('/admin services/') || url.includes('/form services/');
              return isHTML || isJS;
            });
            return Promise.all(filesToRemove.map(key => {
              const url = key.url || key;
              console.log('[Service Worker] Removing from cache:', url);
              return cache.delete(key);
            }));
          });
        }).catch(() => {
          // Cache doesn't exist yet, that's fine
          return Promise.resolve();
        });
      });
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // HYBRID APPROACH: Network-first for HTML/JS, Cache-first for static assets
  
  // HTML pages - NEVER cache, always fetch fresh from network
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      // Always fetch fresh HTML, bypass all caches
      fetch(request, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
        .then((response) => {
          // DO NOT cache HTML - always serve fresh
          // This ensures users always get the latest version
          return response;
        })
        .catch(() => {
          // Network failed - return offline message (don't use cache)
          return new Response('Offline - Please check your connection', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/html',
            }),
          });
        })
    );
    return;
  }

  // JavaScript files - NEVER cache, always fetch fresh from network
  if (request.url.endsWith('.js') || request.headers.get('accept').includes('application/javascript')) {
    event.respondWith(
      // Always fetch fresh JavaScript, bypass all caches
      fetch(request, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
        .then((response) => {
          // DO NOT cache JavaScript - always serve fresh
          // This ensures users always get the latest code
          return response;
        })
        .catch(() => {
          // Network failed - return error (don't use cache)
          return new Response('JavaScript file not available offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'application/javascript',
            }),
          });
        })
    );
    return;
  }

  // Cache-first strategy for static assets (CSS, images, fonts, etc.)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version immediately, but fetch in background to update cache
          fetch(request)
            .then((response) => {
              if (response && response.status === 200 && response.type === 'basic') {
                const responseToCache = response.clone();
                caches.open(RUNTIME_CACHE).then((cache) => {
                  cache.put(request, responseToCache);
                });
              }
            })
            .catch(() => {
              // Ignore fetch errors in background update
            });
          return cachedResponse;
        }
        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Clone the response
            const responseToCache = response.clone();
            // Cache the response
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
            return response;
          })
          .catch(() => {
            // Return a fallback for images
            if (request.headers.get('accept').includes('image')) {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">Image not available offline</text></svg>',
                {
                  headers: { 'Content-Type': 'image/svg+xml' },
                }
              );
            }
            return new Response('Resource not available offline', {
              status: 503,
              statusText: 'Service Unavailable',
            });
          });
      })
  );
});

// Handle background sync (if needed in future)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  // Implement background sync logic here if needed
});

// Handle push notifications (if needed in future)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  // Implement push notification logic here if needed
});

