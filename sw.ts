/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  matchPrecache,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const LESSON_API_CACHE = 'mirvo-lesson-api-v1';
const PRIMITIVES_3D_CACHE = 'mirvo-3d-primitives-v1';
const LESSON_ASSETS_CACHE = 'mirvo-lesson-assets-v1';
const FONTS_CACHE = 'mirvo-fonts-v1';

// Precache all Vite build chunks (Three.js, KaTeX fonts, built-in lessons, 3D primitive catalog, icons)
const precacheManifest = self.__WB_MANIFEST || [];
precacheAndRoute(precacheManifest);
cleanupOutdatedCaches();

// Pre-warm offline 3D primitives catalog on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      try {
        const cache = await caches.open(PRIMITIVES_3D_CACHE);
        const existing = await cache.match('/offline-3d-primitives.json');
        if (!existing) {
          const res = await fetch('/offline-3d-primitives.json');
          if (res.ok) {
            await cache.put('/offline-3d-primitives.json', res.clone());
          }
        }
      } catch {
        // Ignore warm-up failure if offline during initial activation
      }
    })()
  );
});

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | null;
  if (data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

// 1. SPA Navigation fallback (works in both production precache & Vite dev mode)
const navigationHandler = new NetworkFirst({
  cacheName: 'mirvo-pages-v1',
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({
      statuses: [0, 200],
    }),
  ],
});

registerRoute(
  new NavigationRoute(
    async (options) => {
      try {
        const response = await navigationHandler.handle(options);
        if (response) return response;
      } catch {
        // Fall through to precached shell when offline
      }
      const precached =
        (await matchPrecache('/index.html')) ||
        (await matchPrecache('index.html')) ||
        (await caches.match('/')) ||
        (await caches.match('/index.html'));
      if (precached) return precached;
      return Response.error();
    },
    {
      denylist: [/^\/api\//, /^\/__aistudio/],
    }
  )
);

// 2. Google Fonts (Inter + IBM Plex Mono)
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: FONTS_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

// 3. Critical 3D Primitives, Models & Molecular Structures (.glb/.gltf, offline-3d-primitives.json, /api/chem/*)
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    (url.pathname === '/offline-3d-primitives.json' ||
      url.pathname.startsWith('/api/chem/') ||
      /\.(glb|gltf|bin|wasm)$/i.test(url.pathname)),
  new CacheFirst({
    cacheName: PRIMITIVES_3D_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 150,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

// 4. Cached Lesson Assets & GET lesson endpoints (/api/generate-lesson, /topic-cache.json, /object-cache.json, images/SVGs/fonts)
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    (url.pathname === '/api/generate-lesson' ||
      url.pathname === '/topic-cache.json' ||
      url.pathname === '/object-cache.json' ||
      /\.(png|jpg|jpeg|svg|webp|woff|woff2|ttf|ico)$/i.test(url.pathname)),
  new StaleWhileRevalidate({
    cacheName: LESSON_ASSETS_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

// 5. Runtime POST Caching for /api/tutor/resolve and /api/objects/resolve (caches resolved lessons & 3D primitives for offline replay)
function normalizeOfflinePostKey(pathname: string, bodyText: string): string | null {
  try {
    const parsed = JSON.parse(bodyText) as {
      query?: string;
      mode?: string;
      stepCount?: number;
      imageBase64?: string;
    };
    if (parsed.imageBase64) return null;
    const cleanQuery = String(parsed.query || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanQuery) return null;
    const mode = parsed.mode ? String(parsed.mode).toLowerCase().trim() : '';
    const params = new URLSearchParams({ q: cleanQuery });
    if (mode) params.set('mode', mode);
    if (typeof parsed.stepCount === 'number' && Number.isFinite(parsed.stepCount)) {
      params.set('steps', String(Math.round(parsed.stepCount)));
    }
    return `https://mirvo-offline-cache.local${pathname}?${params.toString()}`;
  } catch {
    return null;
  }
}

registerRoute(
  ({ request, url }) =>
    request.method === 'POST' &&
    (url.pathname === '/api/tutor/resolve' || url.pathname === '/api/objects/resolve'),
  async ({ request, url }) => {
    const cacheName =
      url.pathname === '/api/objects/resolve' ? PRIMITIVES_3D_CACHE : LESSON_API_CACHE;
    let bodyText = '';
    try {
      bodyText = await request.clone().text();
    } catch {
      bodyText = '';
    }
    const cacheKeyUrl = normalizeOfflinePostKey(url.pathname, bodyText);

    try {
      const networkResponse = await fetch(request.clone());
      const contentType = (networkResponse.headers.get('content-type') || '').toLowerCase();
      const isJson = contentType.includes('application/json');

      if (!isJson) {
        if (cacheKeyUrl) {
          const cache = await caches.open(cacheName);
          const cached = await cache.match(new Request(cacheKeyUrl));
          if (cached) {
            return cached;
          }
        }
        return new Response(
          JSON.stringify({
            error:
              "Server kutilgan ma’lumot o‘rniga HTML sahifa qaytardi. Qayta urinib ko‘ring.",
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (networkResponse.ok && cacheKeyUrl) {
        const cache = await caches.open(cacheName);
        await cache.put(new Request(cacheKeyUrl), networkResponse.clone());
      }
      return networkResponse;
    } catch {
      if (cacheKeyUrl) {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(new Request(cacheKeyUrl));
        if (cached) {
          return cached;
        }
      }
      return new Response(
        JSON.stringify({
          offline: true,
          error:
            "Internet aloqasi yo‘q. Keshlangan darslar va 3D modellar oflayn doskada ochiq.",
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },
  'POST'
);
