const CACHE_NAME = 'pn-cache-v1'

// Development registers the worker with ?cache=off: cached dev chunks would make code changes look
// like they did not apply, so there it only shows push notifications.
const CACHING = new URL(self.location.href).searchParams.get('cache') !== 'off'

// Only assets that are byte-identical for every visitor. Navigations are
// deliberately absent: the root layout renders the signed-in user's name and
// profile image into the HTML, so caching a page would serve one account's
// shell to whoever opens the app next.
const PRECACHE_URLS = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
    if (CACHING) {
        event.waitUntil(
            caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
        )
    }
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => !CACHING || key !== CACHE_NAME).map(key => caches.delete(key))
        ))
    )
    self.clients.claim()
})

// Decides what may be cached at all. Everything this rejects - navigations, RSC
// payloads, /api/, /store/, cross-origin - falls through to the network
// untouched, because those responses depend on who is asking for them.
function isCacheableAsset(request) {
    if (request.method !== 'GET' || request.mode === 'navigate') {
        return false
    }

    const url = new URL(request.url)
    if (url.origin !== self.location.origin) {
        return false
    }

    // Next appends ?_rsc=... to server-component payloads, which carry the same
    // rendered user content the HTML does.
    if (url.searchParams.has('_rsc')) {
        return false
    }

    return url.pathname.startsWith('/_next/static/') || PRECACHE_URLS.includes(url.pathname)
}

// Stale-while-revalidate over static assets: serve the cached copy immediately
// when there is one, and refresh it in the background for the next visit.
self.addEventListener('fetch', (event) => {
    if (!CACHING || !isCacheableAsset(event.request)) {
        return
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cached = await cache.match(event.request)

            const revalidate = fetch(event.request).then(async (response) => {
                if (response.ok) {
                    // Awaited: the write must not be cut short by the worker being
                    // terminated once respondWith has already settled.
                    await cache.put(event.request, response.clone())
                }
                return response
            })

            if (cached) {
                // respondWith settles right now, so the refresh needs its own
                // keepalive or the worker can die before the put lands.
                event.waitUntil(revalidate.catch(() => {}))
                return cached
            }

            // Nothing cached, so the network is the only option. A failure has to
            // resolve to a real Response - returning undefined here would throw.
            return revalidate.catch(() => Response.error())
        })
    )
})

// The notification worker pushes { title, body, url, tag } as JSON. Pushing the same tag again
// replaces the notification instead of showing it twice.
self.addEventListener('push', (event) => {
    const payload = readPushPayload(event)
    event.waitUntil(
        self.registration.showNotification(payload.title ?? 'Sct. Omega', {
            body: payload.body,
            tag: payload.tag,
            icon: '/icon-192.png',
            data: { url: payload.url },
        })
    )
})

function readPushPayload(event) {
    if (!event.data) {
        return {}
    }
    try {
        return event.data.json()
    } catch {
        return { body: event.data.text() }
    }
}

// Focuses a window already showing the notification's page, or opens one. Only our own pages are
// opened, whatever the push says.
self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const target = new URL(event.notification.data?.url ?? '/', self.location.origin)
    const url = target.origin === self.location.origin ? target.href : `${self.location.origin}/`

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
            const open = windows.find(client => client.url === url)
            return open ? open.focus() : self.clients.openWindow(url)
        })
    )
})
