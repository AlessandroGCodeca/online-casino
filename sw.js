const CACHE_NAME = 'royal-flush-v11';
const FONT_CACHE = 'royal-flush-fonts-v1';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/slots.js',
    './js/slot-themes.js',
    './js/slot-premium.js',
    './js/slot-cascade.js',
    './js/blackjack.js',
    './js/roulette.js',
    './js/poker.js',
    './js/crash.js',
    './js/mines.js',
    './js/dice.js',
    './js/baccarat.js',
    './js/wheel.js',
    './js/keno.js',
    './js/plinko.js',
    './manifest.json'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME && k !== FONT_CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = e.request.url;

    // Google Fonts — stale-while-revalidate so offline keeps the typeface.
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        e.respondWith(
            caches.open(FONT_CACHE).then(cache =>
                cache.match(e.request).then(cached => {
                    const network = fetch(e.request).then(res => {
                        if (res && res.status === 200) cache.put(e.request, res.clone());
                        return res;
                    }).catch(() => cached);
                    return cached || network;
                })
            )
        );
        return;
    }

    // Network-first for HTML navigations, cache-first for everything else.
    if (e.request.mode === 'navigate') {
        e.respondWith(
            fetch(e.request).catch(() => caches.match('./index.html'))
        );
    } else {
        e.respondWith(
            caches.match(e.request).then(r => r || fetch(e.request).catch(() => r))
        );
    }
});
