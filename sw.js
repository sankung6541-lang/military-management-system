/**
 * Service Worker for PWA
 * Enables offline functionality
 */

const CACHE_NAME = 'military-ms-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/styles.css',
    './js/storage.js',
    './js/api.js',
    './js/auth.js',
    './js/soldiers.js',
    './js/attendance.js',
    './js/training.js',
    './js/leave.js',
    './js/equipment.js',
    './js/personnel-movement.js',
    './js/patrol.js',
    './js/calendar.js',
    './js/dashboard.js',
    './js/reports.js',
    './js/settings.js',
    './js/app.js',
    './manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip external requests
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached version or fetch from network
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((response) => {
                        // Don't cache if not a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        // Add to cache
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Offline fallback for HTML pages
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});

// Handle background sync (for future use)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        console.log('Service Worker: Syncing data...');
        // Sync logic will be implemented here
    }
});
