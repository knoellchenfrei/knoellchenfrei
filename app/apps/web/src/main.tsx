import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.js'
import { ErrorBoundary } from './components/ErrorBoundary.js'
import { registerServiceWorker, startInstallWatch } from './pwa.js'
import { installVectorBasemap, TILES_BASE } from './map-style.js'
// MapLibre's stylesheet must come first: it sets `.maplibregl-map { position:
// relative }`, which has the same specificity as our `.map` rule and would
// otherwise win on order and collapse the map container to zero height.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'

// Vor dem Rendern: Chrome verwirft sein Installationsangebot, wenn beim
// Eintreffen niemand zuhört, und das ist eine Frage von Millisekunden.
startInstallWatch()

// Ebenfalls vor dem Rendern, und nur wenn eigene Kacheln eingerichtet sind:
// MapLibre kennt `pmtiles://` nicht von sich aus. Wird der Leser erst nach der
// ersten Karte angemeldet, scheitert deren Stil bereits am unbekannten Schema.
// Nachgeladen statt fest eingebunden, damit der Leser nicht im Bündel liegt,
// wo er nie gebraucht wird.
if (TILES_BASE !== undefined) {
  // Abgewartet, nicht nebenher: Entstünde die Karte vor der Anmeldung,
  // scheiterte ihr Stil am unbekannten Schema `pmtiles://` — und zwar
  // sporadisch, je nachdem wer schneller ist.
  const [{ Protocol }, { default: layers }] = await Promise.all([
    import('pmtiles'),
    import('protomaps-themes-base'),
  ])
  maplibregl.addProtocol('pmtiles', new Protocol().tile)
  // `dark` passt zur restlichen Oberfläche, `de` beschriftet auf Deutsch.
  installVectorBasemap(layers('protomaps', 'dark', 'de'))
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
