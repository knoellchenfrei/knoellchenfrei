import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.js'
import { ErrorBoundary } from './components/ErrorBoundary.js'
import { registerServiceWorker, startInstallWatch } from './pwa.js'
import { CITY } from './city.js'
import { setTrackCity, track } from './track.js'
import { installVectorBasemap, TILES_BASE } from './map-style.js'
// MapLibre's stylesheet must come first: it sets `.maplibregl-map { position:
// relative }`, which has the same specificity as our `.map` rule and would
// otherwise win on order and collapse the map container to zero height.
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'

// **Der Grund, warum die Vektorkarte nie gezeichnet hat.** MapLibre 6 liegt
// nicht mehr in einer Datei: `maplibre-gl.mjs` startet zur Laufzeit einen
// Worker, dessen Adresse es sich selbst zusammensetzt —
// `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Der Dateiname steht
// dabei in einer Variablen, also kann kein Bundler die Datei statisch
// erkennen; rolldown legt sie nicht ab. Die Anfrage nach
// `/assets/maplibre-gl-worker.mjs` lief damit in die SPA-Rückfalladresse und
// bekam **`index.html` mit `200 OK` und `text/html`** zurück. Kein 404, keine
// Konsolenmeldung, kein `error`-Ereignis auf der Karte: Der Worker startete
// nur nicht, der Stil wurde nie fertig geladen, und nach dem Kopf des Archivs
// (`bytes=0-16383`) forderte niemand mehr eine Kachel an. Genau dieses Bild —
// eine Bereichsanfrage, null Fehler, leere Karte — hat tagelang wie ein
// Problem mit PMTiles, dem Archiv, dem Stil oder CORS ausgesehen.
//
// `?worker&url` lässt Vite den Worker samt seines Imports von
// `maplibre-gl-shared.mjs` selbst bündeln und gibt uns die Adresse der
// abgelegten Datei; `setWorkerUrl` ist der dafür vorgesehene öffentliche Weg.
// Ein blosses `?url` würde nur die eine Datei kopieren — ihr Import des
// gemeinsamen Teils zeigte dann wieder ins Leere.
//
// Im Artifact gibt es keine zweite Datei: Dort legt `build-artifact.ts` den
// gebündelten Worker als Zeichenkette daneben, und daraus wird hier ein Blob.
// Ohne das zeichnete auch das Artifact nichts — es hat nie etwas gezeichnet.
const eingebetteterWorker = (window as { __MAPLIBRE_WORKER__?: string }).__MAPLIBRE_WORKER__
maplibregl.setWorkerUrl(
  eingebetteterWorker === undefined
    ? maplibreWorkerUrl
    : URL.createObjectURL(new Blob([eingebetteterWorker], { type: 'text/javascript' }))
)

// Vor dem Rendern: Chrome verwirft sein Installationsangebot, wenn beim
// Eintreffen niemand zuhört, und das ist eine Frage von Millisekunden.
startInstallWatch()

// Die Statistik braucht die geladene Stadt, bekommt sie aber hereingereicht
// statt sie zu importieren — sonst entstünde ein Kreis mit `city.ts`, das
// beim Städtewechsel seinerseits zählt.
setTrackCity(CITY.key)
track('app.open')

// Ebenfalls vor dem Rendern, und nur wenn eigene Kacheln eingerichtet sind:
// MapLibre kennt `pmtiles://` nicht von sich aus. Wird der Leser erst nach der
// ersten Karte angemeldet, scheitert deren Stil bereits am unbekannten Schema.
// Nachgeladen statt fest eingebunden, damit der Leser nicht im Bündel liegt,
// wo er nie gebraucht wird.
if (TILES_BASE !== undefined) {
  // Abgewartet, nicht nebenher: Entstünde die Karte vor der Anmeldung,
  // scheiterte ihr Stil am unbekannten Schema `pmtiles://` — und zwar
  // sporadisch, je nachdem wer schneller ist.
  const [{ Protocol }, { layers, namedFlavor }] = await Promise.all([
    import('pmtiles'),
    import('@protomaps/basemaps'),
  ])
  maplibregl.addProtocol('pmtiles', new Protocol().tile)
  // `dark` passt zur restlichen Oberfläche, `de` beschriftet auf Deutsch.
  //
  // Seit dem 7. September aus `@protomaps/basemaps` statt aus
  // `protomaps-themes-base`: Das alte Paket ist abgekündigt („migrated to
  // @protomaps/basemaps with a new major version", Audit-Punkt M-049), und die
  // Signatur hat sich geändert — aus `default(quelle, thema, sprache)` wurde
  // `layers(quelle, namedFlavor(thema), { lang })`. Die Kachelversionen laufen
  // getrennt weiter: Unsere Archive sind Tiles 4.15.2, das Stilpaket ist
  // Styles 5.7.2, und die beiden gehören zusammen — neu gebaut werden muss
  // nichts.
  installVectorBasemap(layers('protomaps', namedFlavor('dark'), { lang: 'de' }))
}

const container = document.getElementById('root')
if (container === null) throw new Error('#root missing')
createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

registerServiceWorker()
