/**
 * Pulse Tasks service worker.
 *
 * Small on purpose. Vite fingerprints the built assets, so there is no list of
 * filenames to precache — instead:
 *   - navigations are network-first with a cached shell fallback, so a new
 *     deploy is picked up immediately but the app still opens offline
 *   - same-origin GETs are stale-while-revalidate: instant from cache, then
 *     quietly refreshed
 * Bump CACHE_VERSION to evict everything from older releases.
 */

const CACHE_VERSION = 'pulse-tasks-v1'
const SHELL = ['/', '/index.html', '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', response.clone()))
          return response
        })
        .catch(() => caches.match('/index.html').then((cached) => cached ?? caches.match('/'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
        .catch(() => cached)

      return cached ?? network
    }),
  )
})
