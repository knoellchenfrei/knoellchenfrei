/**
 * Cache-first service worker for the app shell and the frozen data files.
 *
 * The data is a build-time snapshot, so serving it from cache is not a
 * staleness trade-off: the cached copy is the shipped copy.
 *
 * __BUILD_ID__ is replaced at build time. Without a per-build cache name the
 * shell is served from an old cache forever and a deployed fix never reaches an
 * installed app.
 */
const CACHE = 'knoellchenfrei-__BUILD_ID__'

/**
 * The list below is completed at build time with the hashed bundle paths.
 * Without them the first visit cached only the HTML, so going offline before a
 * second visit produced a blank page.
 *
 * Placeholders appear exactly once each, in code and never in prose: a
 * single-occurrence replace once hit a copy in a comment and left the real
 * constant untouched, shipping an identical worker on every build.
 */
const SHELL = [
  './',
  // Bewusst **ohne** './index.html'. Cloudflare Pages beantwortet den Pfad mit
  // einem 308 auf './' — und eine Weiterleitung im Vorrat ist toedlich, weil
  // `cache.addAll` atomar ist: Eine einzige 3xx-Antwort laesst den ganzen Aufruf
  // scheitern. Lokal faellt das nicht auf, `vite preview` liefert dort 200;
  // gemessen wurde es erst an der ausgelieferten Adresse. './' ist ohnehin
  // dasselbe Dokument.
  './manifest.webmanifest',
  './icon.svg',
  // Die abgelegte App startet aus dem Cache; ohne das Symbol zeigt der
  // Splash-Screen ein Loch.
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  __SHELL_ASSETS__,
].flat()

/**
 * Only these are cacheable. An earlier version cached every same-origin GET,
 * which would freeze an API response permanently if the backend were ever
 * hosted on the same origin — the Cache API ignores `Cache-Control: no-store`.
 */
function isCacheable(url) {
  const path = url.pathname
  return (
    path.endsWith('/') ||
    path.endsWith('/index.html') ||
    path.endsWith('/manifest.webmanifest') ||
    path.endsWith('.png') ||
    path.endsWith('/icon.svg') ||
    path.includes('/assets/') ||
    path.includes('/data/')
  )
}

/**
 * Vorrat anlegen — **einzeln**, nicht mit `cache.addAll`.
 *
 * `addAll` ist atomar: Eine 404 oder eine Weiterleitung, und nichts wird
 * abgelegt. Zweimal hat genau das hier zugeschlagen, beide Male unsichtbar,
 * weil der Fehler verschluckt wurde — einmal durch Pfade, die nach der zweiten
 * Stadt nicht mehr stimmten, einmal durch den 308, mit dem Cloudflare Pages
 * auf `/index.html` antwortet. Die App lud jedes Mal weiter und war nur nicht
 * mehr offlinefaehig.
 *
 * Einzeln heisst: Ein kaputter Eintrag kostet diesen einen Eintrag. Was
 * scheitert, steht in der Konsole des Workers, statt still zu verschwinden.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(SHELL.map((pfad) => cache.add(pfad))).then((ergebnisse) => {
        const gescheitert = SHELL.filter((_, i) => ergebnisse[i].status === 'rejected')
        if (gescheitert.length > 0) {
          console.warn('[sw] nicht vorgehalten:', gescheitert.join(', '))
        }
      })
    )
  )
})

/**
 * Bewusst kein `skipWaiting()` beim Installieren. Eine laufende Seite lädt
 * Teile ihres Codes erst bei Bedarf nach — die Karte etwa. Übernimmt der neue
 * Worker sofort, zeigt der alte Tab auf Bündel mit anderem Hash, die es nicht
 * mehr gibt: weiße Seite mitten in der Benutzung. Die neue Version wartet
 * deshalb, bis die Seite zustimmt und gleich darauf neu lädt.
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Map tiles and any API come from elsewhere and are not part of the snapshot.
  if (url.origin !== self.location.origin) return
  if (!isCacheable(url)) return

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit !== undefined) return hit
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
    })
  )
})
