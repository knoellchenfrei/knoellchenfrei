import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// MapLibre 6 hat den Default-Export abgeschafft und exportiert nur noch
// benannt. Ein Namensraum-Import laesst `maplibregl.Marker` als Typ *und* als
// Konstruktor stehen, also bleibt der Rest der Datei unberuehrt.
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import {
  activeSightings,
  berlinWallClock,
  buildHeatmap,
  heatActivity,
  isChargeable,
  quietDayNote,
  markFor,
  withinCitySession,
  MIN_MARKS_FOR_PATTERN,
  type HeatMark,
  type Position,
  type Sighting,
} from '@parkingzone/core'

import { CITY } from './city.js'
import { baseStyle } from './map-style.js'
import { tidyPoiDetail } from './format.js'
import { isEmbedded, loadData } from './data-source.js'
import { openFeedback } from './feedback.js'
import { openLiveStats, type LiveStats as Stats } from './presence.js'
import { openSightingBackend, type SightingBackend } from './sighting-backend.js'
import { ParkingTimer } from './components/ParkingTimer.js'
import { SearchBox } from './components/SearchBox.js'
import { UpdateBar } from './components/UpdateBar.js'
import { BetaBadge } from './components/BetaBadge.js'
import { HeatPanel } from './components/HeatPanel.js'
import { InstallBanner, useInstallState } from './components/InstallHint.js'
import { LiveStats } from './components/LiveStats.js'
import { LocationPrompt } from './components/LocationPrompt.js'
import { QuietDayNote } from './components/QuietDayNote.js'
import { FeedbackSheet } from './components/FeedbackSheet.js'
import { ReportSheet } from './components/ReportSheet.js'
import { SettingsSheet } from './components/SettingsSheet.js'
import { SightingPanel } from './components/SightingPanel.js'
import { TowInfo } from './components/TowInfo.js'
import { ZonePanel } from './components/ZonePanel.js'
import { seedMarks, seedSightings } from './seed.js'
import {
  countVisit,
  hideInstall,
  installHidden,
  loadSession,
  loadMarks,
  loadSightings,
  locationAsked,
  saveSession,
  rememberLocationAsked,
  saveMarks,
  saveSightings,
  type ParkingSession,
} from './storage.js'
import { loadZones, representativePoint, zoneAt, type LoadedZone } from './zones.js'
import { toParkingZone, useZoneStatus } from './useZoneStatus.js'
import type { Meta, PoiKind, ZoneProperties } from './types.js'

/**
 * Popup content is built as HTML, and the labels come from a third-party feed,
 * so every interpolated value is escaped rather than trusted.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Only used for the device-local fallback; shared backends mint their own. */
function newLocalId(): string {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** One sentence for the live region when a zone becomes the selection. */
function describeZone(properties: ZoneProperties, now: number): string {
  const paid = isChargeable(toParkingZone(properties), now)
  return `Zone ${properties.zone}, ${properties.district}: ${
    paid ? 'gebührenpflichtig' : 'gerade keine Gebühr'
  }. Details im Seitenbereich.`
}

const POI_LABELS: Record<PoiKind, string> = {
  charging: 'Ladepunkte',
  carsharing: 'Carsharing',
  park_and_ride: 'P+R',
  accessible: 'Behindertenparkplätze',
}

const POI_COLOURS: Record<PoiKind, string> = {
  charging: '#22c55e',
  carsharing: '#a855f7',
  park_and_ride: '#38bdf8',
  // Gedämpft, nicht entfernt. 923 der 1.499 Orte sind Behindertenparkplätze —
  // in Signalgelb war das die lauteste Ebene der Karte, obwohl sie die ist, die
  // die wenigsten einschalten. Sand statt Warnfarbe, und die Punkte bleiben
  // kleiner: Wer sie braucht, findet sie; wer nicht, wird nicht angeschrien.
  accessible: '#b09a6a',
}

/** Nur diese Ebene wird kleiner gezeichnet — siehe Kommentar oben. */
const POI_QUIET: ReadonlySet<PoiKind> = new Set<PoiKind>(['accessible'])

function trimmedEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined
}

export function App() {
  const containerRef = useRef<HTMLElement>(null)
  const topbarRef = useRef<HTMLElement>(null)

  const installState = useInstallState()
  // Beim ersten Rendern gezählt, nicht in einem Effekt: React zählt im
  // Entwicklungsmodus sonst zweimal, und aus einem Besuch würden zwei.
  const [visits] = useState(countVisit)
  const [installDismissed, setInstallDismissed] = useState(installHidden)
  const showInstall = visits >= 2 && !installDismissed
  const sidebarRef = useRef<HTMLElement>(null)
  /** Set when a POI popup opened, so the zone handler ignores the same tap. */
  const suppressZoneClick = useRef(0)
  /** Set by a search pick: focus moves into the zone panel once it renders. */
  const focusPanelRef = useRef(false)
  const mapRef = useRef<MapLibreMap | null>(null)
  const carMarkerRef = useRef<maplibregl.Marker | null>(null)
  const meMarkerRef = useRef<maplibregl.Marker | null>(null)

  const [ready, setReady] = useState(false)
  const [zones, setZones] = useState<LoadedZone[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [selected, setSelected] = useState<ZoneProperties | null>(null)
  const [position, setPosition] = useState<[number, number] | null>(null)
  // Where the user last pointed on the map. Geolocation is unavailable in an
  // embedded frame without an explicit permission policy — no prompt appears and
  // the request simply fails — so tapping the map has to be a full substitute
  // for "I am here".
  const [anchor, setAnchor] = useState<[number, number] | null>(null)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<ParkingSession | null>(null)
  const [sightings, setSightings] = useState<Sighting[]>([])
  // The heatmap's own dataset: anonymous {day, cell} tallies over four weeks.
  // Kept apart from `sightings` on purpose — different shape, different
  // retention, and nothing links a mark back to the report that made it.
  const [marks, setMarks] = useState<HeatMark[]>([])
  const [showHeat, setShowHeat] = useState(false)
  // True while the heatmap is drawn from generated data rather than reports.
  const [seeded, setSeeded] = useState(false)
  // Same for the sighting list. Separate flags on purpose: sightings expire
  // after 90 minutes and marks after four weeks, so a shared store routinely
  // has real marks and no real sightings.
  const [sightingsSeeded, setSightingsSeeded] = useState(false)
  const [stats, setStats] = useState<Stats>({ online: null, today: null })
  const [reporting, setReporting] = useState(false)
  // Der eigene Vordialog vor dem des Browsers. Erscheint einmal; die
  // Antwort selbst liegt beim Browser, hier steht nur, dass gefragt wurde.
  const [askLocation, setAskLocation] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [quietDismissed, setQuietDismissed] = useState(false)
  // Null solange oder falls es keinen Weg gibt, die Rückmeldung abzuliefern —
  // dann erscheint der Knopf gar nicht erst.
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [visiblePoi, setVisiblePoi] = useState<Set<PoiKind>>(new Set())
  const [notificationsBlocked, setNotificationsBlocked] = useState(false)
  const [showLowEmission, setShowLowEmission] = useState(false)
  // The panel covers a lot of map on a phone; collapsing it is the difference
  // between "a map with a panel" and "a panel with some map behind it".
  const [panelOpen, setPanelOpen] = useState(() => {
    // On a phone the panel covered 72% of the screen at startup, which makes
    // the map — the thing you are here for — a strip at the top. Desktop has
    // room for both side by side.
    if (typeof window === 'undefined') return true
    return window.innerWidth > 720
  })
  const [legendOpen, setLegendOpen] = useState(false)
  // Read by a polite live region: the map and the panel change visually, and a
  // screen reader would otherwise hear nothing when a zone is picked or a
  // session starts.
  const [announcement, setAnnouncement] = useState('')
  // Non-null once a shared backend answers; sightings are then visible to
  // everyone who opens the link rather than only on this device.
  const backendRef = useRef<SightingBackend | null>(null)
  const [shared, setShared] = useState(false)
  // A single clock drives every time-dependent view, so the badge, the panel and
  // the map colouring can never disagree by a tick.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  // The layer chips sit below the topbar, whose height depends on how the
  // search field and button wrap. A hardcoded offset left them overlapping the
  // locate button by 43px on every phone size, which swallowed taps meant for
  // the chips. Measuring keeps it right through any later layout change.
  useEffect(() => {
    const element = topbarRef.current
    if (element === null) return
    const apply = (): void => {
      document.documentElement.style.setProperty(
        '--topbar-height',
        `${Math.ceil(element.getBoundingClientRect().height)}px`
      )
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // Permission state survives reloads even though React state does not, so
    // the "only while this page is open" caveat has to be re-derived.
    if ('Notification' in window) setNotificationsBlocked(Notification.permission !== 'granted')
    setSession(loadSession())
    setSessionRestored(true)
    const stored = loadSightings()
    // Seeded against the render clock, not Date.now(): the seed "8 minutes
    // ago" otherwise read "vor 7 Min." until the first tick.
    setSightings(stored.length > 0 ? stored : seedSightings(now))
    setSightingsSeeded(stored.length === 0)
    const storedMarks = loadMarks()
    setMarks(storedMarks.length > 0 ? storedMarks : seedMarks(now))
    if (!locationAsked() && 'geolocation' in navigator) setAskLocation(true)
    setSeeded(storedMarks.length === 0)
  }, [])

  // Attach to the shared store if this view has one. It can take seconds and may
  // never answer, so the page above already works from local state.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let unsubscribeMarks: (() => void) | undefined
    void openSightingBackend().then((backend) => {
      if (backend === null) return
      backendRef.current = backend
      setShared(true)
      // The backend sanitises rows before they get here; they are written by
      // other viewers and are never trusted.
      unsubscribe = backend.subscribe((rows) => {
        // An empty shared store does NOT clear the demo list. It used to: the
        // seeded sightings showed for the second or two the capability took to
        // answer and then vanished, which reads as the app losing them.
        if (rows.length === 0) return
        setSightings(rows)
        setSightingsSeeded(false)
      })
      unsubscribeMarks = backend.subscribeMarks?.((rows) => {
        setMarks(rows)
        setSeeded(false)
      })
    })
    return () => {
      unsubscribe?.()
      unsubscribeMarks?.()
    }
  }, [])

  // Independent of the sighting backend: presence is a different capability,
  // and the strip should show what it can even if the store never answers.
  useEffect(() => openLiveStats((patch) => setStats((current) => ({ ...current, ...patch }))), [])

  // Hängt allein an einer Build-Variablen, ist also sofort entschieden.
  const feedback = useMemo(() => openFeedback(), [])

  // ------------------------------------------------------------------ map
  useEffect(() => {
    if (containerRef.current === null || mapRef.current !== null) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(!isEmbedded()),
      // Kopie statt Verweis: `Position` ist readonly, MapLibres `LngLatLike`
      // nicht — und die Konfiguration soll niemand von aussen verbiegen können.
      center: [CITY.center[0], CITY.center[1]],
      zoom: CITY.zoom,
      attributionControl: { compact: true },
      // The page is German; MapLibre's defaults ("Map", "Zoom in") were the
      // only English a screen reader user heard.
      locale: {
        'Map.Title': 'Karte',
        'NavigationControl.ZoomIn': 'Karte vergrößern',
        'NavigationControl.ZoomOut': 'Karte verkleinern',
        'Marker.Title': 'Kartenmarkierung',
        'Popup.Close': 'Hinweis schließen',
        'AttributionControl.ToggleAttribution': 'Quellenangabe ein- oder ausblenden',
        'AttributionControl.MapFeedback': 'Kartenfeedback',
      },
    })
    mapRef.current = map
    // Top-left: top-right sat under the search field and the sidebar's toggle.
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')

    // Not inside map.on('load'): MapLibre waits for tiles before firing it, so a
    // slow or blackholed tile server left the app stuck on "loading" with no
    // data at all. The data fetch is independent of the basemap; the layers wait
    // for style readiness separately below.
    const withMapReady = (run: () => void): void => {
      if (map.isStyleLoaded()) {
        run()
        return
      }
      let done = false
      const finish = (): void => {
        if (done) return
        done = true
        run()
      }
      // `styledata` can already have fired by the time we subscribe — with the
      // tiles blocked it never comes again, and the layers were never added, so
      // the map stayed inert. Poll as a backstop and give up after 10s rather
      // than wait forever.
      map.once('styledata', finish)
      const poll = window.setInterval(() => {
        if (map.isStyleLoaded()) {
          window.clearInterval(poll)
          finish()
        }
      }, 200)
      window.setTimeout(() => {
        window.clearInterval(poll)
        finish()
      }, 10_000)
    }

    {
      void (async () => {
        try {
          const {
            zones: zoneData,
            poi: poiData,
            districts,
            umweltzone,
            meta: metaData,
          } = await loadData(CITY.key)
          setMeta(metaData)

          const loaded = loadZones(zoneData)
          setZones(loaded)

          await new Promise<void>((resolve) => withMapReady(resolve))

          // MapLibre shows the compact attribution expanded until the first
          // touch on the map. On a phone that put a 190px strip over the
          // topbar's button; collapsed, it is the usual "i" one tap away.
          if (window.innerWidth <= 720) {
            map
              .getContainer()
              .querySelector('.maplibregl-ctrl-attrib')
              ?.classList.remove('maplibregl-compact-show')
          }

          // Drawn first so it sits beneath the zones.
          map.addSource('districts', { type: 'geojson', data: districts })
          map.addLayer({
            id: 'districts-line',
            type: 'line',
            source: 'districts',
            paint: { 'line-color': '#2b3440', 'line-width': 1 },
          })

          map.addSource('zones', { type: 'geojson', data: zoneData, promoteId: 'zone' })
          map.addLayer({
            id: 'zones-fill',
            type: 'fill',
            source: 'zones',
            paint: {
              'fill-color': [
                'case',
                ['boolean', ['feature-state', 'chargeable'], false],
                '#f97316',
                '#22d3ee',
              ],
              // Drei Stufen statt zwei. Die gebührenfreie Fläche bleibt sichtbar,
              // aber so schwach, dass sie die kassierende nicht mehr überstimmt.
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                0.55,
                ['boolean', ['feature-state', 'chargeable'], false],
                0.3,
                0.07,
              ],
            },
          })
          map.addLayer({
            id: 'zones-line',
            type: 'line',
            source: 'zones',
            paint: {
              'line-color': [
                'case',
                ['boolean', ['feature-state', 'chargeable'], false],
                '#fb923c',
                '#67e8f9',
              ],
              // Die Kontur trägt jetzt die Grenze, nicht mehr die Füllung. Sie
              // bleibt deshalb überall vorhanden — nur unterschiedlich laut.
              'line-opacity': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                1,
                ['boolean', ['feature-state', 'chargeable'], false],
                0.9,
                0.45,
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                2.5,
                ['boolean', ['feature-state', 'chargeable'], false],
                1.2,
                0.8,
              ],
            },
          })

          map.addSource('umweltzone', { type: 'geojson', data: umweltzone })
          map.addLayer({
            id: 'umweltzone-line',
            type: 'line',
            source: 'umweltzone',
            layout: { visibility: 'none' },
            paint: { 'line-color': '#a3e635', 'line-width': 2, 'line-dasharray': [3, 2] },
          })

          map.addSource('poi', { type: 'geojson', data: poiData })
          for (const kind of Object.keys(POI_LABELS) as PoiKind[]) {
            map.addLayer({
              id: `poi-${kind}`,
              type: 'circle',
              source: 'poi',
              filter: ['==', ['get', 'kind'], kind],
              layout: { visibility: 'none' },
              paint: {
                'circle-radius': POI_QUIET.has(kind)
                  ? ['interpolate', ['linear'], ['zoom'], 11, 2.5, 14, 4.5, 17, 8]
                  : ['interpolate', ['linear'], ['zoom'], 11, 3.5, 14, 6, 17, 10],
                'circle-color': POI_COLOURS[kind],
                'circle-opacity': POI_QUIET.has(kind) ? 0.7 : 0.85,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#0f1216',
              },
            })
            // A transparent, finger-sized target on top. The visible dot is a
            // few pixels across; tapping 8px off it missed every time.
            map.addLayer({
              id: `poi-${kind}-hit`,
              type: 'circle',
              source: 'poi',
              filter: ['==', ['get', 'kind'], kind],
              layout: { visibility: 'none' },
              paint: { 'circle-radius': 16, 'circle-color': '#000', 'circle-opacity': 0 },
            })
          }

          map.addSource('heat', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })
          map.addLayer({
            id: 'heat-density',
            type: 'heatmap',
            source: 'heat',
            layout: { visibility: 'none' },
            paint: {
              'heatmap-weight': ['get', 'weight'],
              // Radius in screen pixels, not metres. A cell's true 250 m is
              // under three pixels at city zoom, which renders as nothing at
              // all — the first attempt drew an invisible layer. This is a
              // density surface, so it is sized to be read, and the panel
              // states the counts the colour cannot.
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 22, 12, 34, 14, 48, 17, 80],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 1.6, 14, 2.2, 17, 3],
              'heatmap-opacity': 0.75,
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(0,0,0,0)',
                0.2, 'rgba(59,130,246,0.35)',
                0.45, 'rgba(168,85,247,0.55)',
                0.7, 'rgba(244,114,58,0.7)',
                1, 'rgba(239,68,68,0.85)',
              ],
            },
          })

          map.addSource('sightings', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })
          map.addLayer({
            id: 'sightings-circle',
            type: 'circle',
            source: 'sightings',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 0, 6, 1, 14],
              'circle-color': '#ef4444',
              'circle-opacity': ['*', 0.55, ['get', 'score']],
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ef4444',
            },
          })

          // POI carry a label and a detail line; without this the dots are
          // decoration. Registered before the zone handler so a tap on a dot
          // does not also reselect the zone underneath it.
          for (const kind of Object.keys(POI_LABELS) as PoiKind[]) {
            map.on('click', `poi-${kind}-hit`, (event) => {
              const feature = event.features?.[0]
              if (feature === undefined) return
              const props = feature.properties as { label?: string; detail?: string }
              const geometry = feature.geometry as { coordinates: [number, number] }
              new maplibregl.Popup({ offset: 10, closeButton: true, maxWidth: '260px' })
                .setLngLat(geometry.coordinates)
                .setHTML(
                  `<strong>${escapeHtml(props.label ?? POI_LABELS[kind])}</strong>` +
                    `<span class="popup__kind">${escapeHtml(POI_LABELS[kind])}</span>` +
                    (props.detail ? `<span>${escapeHtml(tidyPoiDetail(props.detail))}</span>` : '')
                )
                .addTo(map)
              // stopPropagation does not stop MapLibre's other layer handlers,
              // so the zone handler still fired and opened the panel over the
              // popup. A short-lived flag is the reliable way to suppress it.
              suppressZoneClick.current = Date.now()
            })
            map.on('mouseenter', `poi-${kind}-hit`, () => {
              map.getCanvas().style.cursor = 'pointer'
            })
            map.on('mouseleave', `poi-${kind}-hit`, () => {
              map.getCanvas().style.cursor = ''
            })
          }

          map.on('click', 'zones-fill', (event) => {
            if (Date.now() - suppressZoneClick.current < 400) return
            // MapLibre flattens nested GeoJSON properties to JSON strings, so
            // feature.properties.windows arrives as text and any array method on
            // it throws. The parsed zone is already in memory — look it up by id
            // instead of trusting what the map hands back.
            const id = event.features?.[0]?.properties?.['zone']
            if (typeof id !== 'string') return
            const hit = loaded.find((zone) => zone.properties.zone === id)
            if (hit !== undefined) {
              setSelected(hit.properties)
              setAnnouncement(describeZone(hit.properties, Date.now()))
              setAnchor([event.lngLat.lng, event.lngLat.lat])
              setError(null)
              // Picking a zone is a request to see its details, so open the
              // sheet — otherwise a tap appears to do nothing on a phone.
              setPanelOpen(true)
              // ...and shift the map up, or the spot just tapped ends up behind
              // the sheet that opened over it.
              if (window.innerWidth <= 720) {
                window.setTimeout(() => {
                  const sheet = sidebarRef.current?.getBoundingClientRect().height ?? 0
                  map.easeTo({
                    center: [event.lngLat.lng, event.lngLat.lat],
                    offset: [0, -Math.round(sheet / 2)],
                    duration: 450,
                  })
                }, 60)
              }
            }
          })

          // A tap anywhere — including outside every zone — still sets the
          // anchor, so "park here" works on an unmetered street too.
          map.on('click', (event) => {
            if (Date.now() - suppressZoneClick.current < 400) return
            setAnchor([event.lngLat.lng, event.lngLat.lat])
            // A tap that hits no zone also ends the previous selection. The
            // panel otherwise kept describing the last zone while "Hier
            // geparkt" recorded the car outside it — the panel said "Zone 34",
            // the timer "außerhalb einer Parkzone".
            if (map.queryRenderedFeatures(event.point, { layers: ['zones-fill'] }).length === 0) {
              setSelected(null)
            }
          })
          map.on('mouseenter', 'zones-fill', () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', 'zones-fill', () => {
            map.getCanvas().style.cursor = ''
          })

          setReady(true)
        } catch (cause) {
          setError(`Daten konnten nicht geladen werden: ${(cause as Error).message}`)
        }
      })()
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Recolour every zone by whether it charges right now.
  useEffect(() => {
    const map = mapRef.current
    if (map === null || !ready) return
    // isChargeable, not chargeableAt: the latter scans forward minute by minute
    // for up to a week to find the next transition. Running that for all 103
    // zones every 15 seconds froze the main thread for over a second — on a
    // phone, that is the whole interaction budget.
    for (const zone of zones) {
      const chargeable = isChargeable(toParkingZone(zone.properties), now)
      map.setFeatureState({ source: 'zones', id: zone.properties.zone }, { chargeable })
    }
  }, [ready, zones, now])

  useEffect(() => {
    const map = mapRef.current
    if (map === null || !ready) return
    for (const zone of zones) {
      map.setFeatureState(
        { source: 'zones', id: zone.properties.zone },
        { selected: zone.properties.zone === selected?.zone }
      )
    }
  }, [ready, zones, selected])

  // Recomputed on the render clock rather than on every tick of `now`: the
  // window moves by the day, and folding four weeks of marks 240 times an hour
  // is the kind of thing that cost 1.5 s a tick once already.
  const heatDay = useMemo(() => Math.floor(now / 3_600_000), [now])
  const heat = useMemo(
    () => buildHeatmap(marks, { now: heatDay * 3_600_000 }),
    [marks, heatDay],
  )
  const activity = useMemo(
    () => heatActivity(marks, { now: heatDay * 3_600_000 }),
    [marks, heatDay],
  )
  const berlinNow = useMemo(() => berlinWallClock(heatDay * 3_600_000), [heatDay])

  // The busiest spots, named by the zone they fall in. A ranked list of
  // unnamed cells ("4 Meldungen an 4 Tagen") tells the reader nothing about
  // where, and the zone polygons are already loaded. Cells are folded per zone
  // because a hotspot spans several cells and would otherwise fill the list
  // with three views of the same corner.
  const heatTop = useMemo(() => {
    const perZone = new Map<string, { label: string; marks: number; days: number; weight: number }>()
    for (const cell of heat.cells) {
      const zone = zoneAt(zones, cell.centre)
      const key = zone?.properties.zone ?? '—'
      const label = zone === null ? 'Außerhalb der Zonen' : `Zone ${zone.properties.zone}`
      const entry = perZone.get(key) ?? { label, marks: 0, days: 0, weight: 0 }
      entry.marks += cell.marks
      entry.days = Math.max(entry.days, cell.days)
      entry.weight = Math.max(entry.weight, cell.weight)
      perZone.set(key, entry)
    }
    return [...perZone.values()].sort((a, b) => b.marks - a.marks).slice(0, 3)
  }, [heat.cells, zones])

  useEffect(() => {
    const map = mapRef.current
    if (map === null || !ready) return
    const source = map.getSource('heat') as GeoJSONSource | undefined
    if (source === undefined) return
    source.setData({
      type: 'FeatureCollection',
      features: heat.cells.map((cell) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [...cell.centre] },
        properties: { weight: cell.weight },
      })),
    })
  }, [ready, heat])

  useEffect(() => {
    const map = mapRef.current
    if (map === null || !ready) return
    // Nothing is drawn until there is enough to describe a pattern: a heatmap of
    // four reports looks like knowledge and is noise.
    map.setLayoutProperty(
      'heat-density',
      'visibility',
      showHeat && heat.hasPattern ? 'visible' : 'none',
    )
  }, [ready, showHeat, heat.hasPattern])

  useEffect(() => {
    const map = mapRef.current
    if (map === null || !ready) return
    const source = map.getSource('sightings') as GeoJSONSource | undefined
    if (source === undefined) return
    source.setData({
      type: 'FeatureCollection',
      features: activeSightings(sightings, { now }).map(({ sighting, confidence }) => ({
        type: 'Feature' as const,
        properties: { score: confidence.score },
        geometry: { type: 'Point' as const, coordinates: [sighting.lon, sighting.lat] },
      })),
    })
  }, [ready, sightings, now])

  useEffect(() => {
    const map = mapRef.current
    if (map === null || !ready) return
    for (const kind of Object.keys(POI_LABELS) as PoiKind[]) {
      const visibility = visiblePoi.has(kind) ? 'visible' : 'none'
      map.setLayoutProperty(`poi-${kind}`, 'visibility', visibility)
      map.setLayoutProperty(`poi-${kind}-hit`, 'visibility', visibility)
    }
  }, [ready, visiblePoi])

  useEffect(() => {
    const map = mapRef.current
    if (map === null || !ready) return
    map.setLayoutProperty('umweltzone-line', 'visibility', showLowEmission ? 'visible' : 'none')
  }, [ready, showLowEmission])

  // Car marker follows the stored session.
  useEffect(() => {
    const map = mapRef.current
    if (map === null) return
    carMarkerRef.current?.remove()
    carMarkerRef.current = null
    if (session === null) return
    const element = document.createElement('div')
    element.className = 'marker marker--car'
    element.title = 'Dein Auto — zum Verschieben ziehen'
    element.setAttribute('aria-label', 'Dein Auto — zum Verschieben ziehen')
    const marker = new maplibregl.Marker({ element, draggable: true })
      .setLngLat([session.lon, session.lat])
      .addTo(map)
    // Dragging is the reliable way to place the car when geolocation is
    // unavailable, which in an embedded frame it always is.
    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat()
      const hit = zoneAt(zones, [lng, lat])
      setSession((current) =>
        current === null ? current : { ...current, lon: lng, lat, zone: hit?.properties.zone ?? null }
      )
    })
    carMarkerRef.current = marker
  }, [session?.startedAt, zones])

  useEffect(() => {
    const map = mapRef.current
    if (map === null || position === null) return
    meMarkerRef.current?.remove()
    const element = document.createElement('div')
    element.className = 'marker marker--me'
    meMarkerRef.current = new maplibregl.Marker({ element }).setLngLat(position).addTo(map)
  }, [position])

  // ------------------------------------------------------------- actions
  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Dieses Gerät liefert keinen Standort. Tippe stattdessen auf die Karte.')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point: [number, number] = [coords.longitude, coords.latitude]
        setPosition(point)
        setAnchor(point)
        setLocating(false)
        const hit = zoneAt(zones, point)
        setSelected(hit?.properties ?? null)
        if (hit !== null) setAnnouncement(describeZone(hit.properties, Date.now()))
        // Outside the ring nothing is metered, so "no zone" is a useful answer,
        // not a failure.
        if (hit === null) {
          setError('Außerhalb der Parkraumbewirtschaftung — hier ist Parken gebührenfrei.')
        }
        mapRef.current?.easeTo({ center: point, zoom: Math.max(15, mapRef.current.getZoom()) })
      },
      (cause) => {
        setLocating(false)
        // In an embedded frame the browser refuses without ever asking, so
        // "denied" here usually means "not offered". Say what to do instead.
        setError(
          cause.code === cause.PERMISSION_DENIED
            ? 'Standort ist hier nicht verfügbar — in eingebetteten Ansichten fragt der Browser gar nicht erst. Tippe stattdessen auf die Karte.'
            : 'Standort konnte nicht ermittelt werden. Tippe stattdessen auf die Karte.'
        )
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    )
  }, [zones])


  /**
   * Die Verknüpfungen aus dem Manifest — auf Android das Menü beim langen
   * Drücken des Symbols, auf dem Desktop das Kontextmenü in der Taskleiste.
   * Ein Betriebssystem kann keinen Knopf drücken; es kann nur eine Adresse
   * öffnen. Also übersetzt diese Stelle die Adresse zurück in die Handlung.
   */
  const shortcutDone = useRef(false)
  useEffect(() => {
    // Ein Ref, keine Abhängigkeitsliste: Im Entwicklungsmodus läuft jeder
    // Effekt doppelt, und „melden" zweimal zu öffnen wäre sichtbar.
    if (shortcutDone.current) return
    shortcutDone.current = true

    const url = new URL(window.location.href)
    const start = url.searchParams.get('start')
    if (start === null) return
    // Sonst startet die App nach jedem Neuladen wieder im selben Dialog, und
    // die abgelegte Verknüpfung würde diese Adresse als Startseite merken.
    url.searchParams.delete('start')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)

    if (start === 'melden') setReporting(true)
    else if (start === 'standort') locate()
    else if (start === 'kontrollen') setShowHeat(true)
  }, [locate])

  const park = useCallback(() => {
    // The anchor wins over the GPS fix. `position ?? anchor` meant that once a
    // location had been obtained, every later tap on the map was ignored: the
    // panel showed the zone you picked while the car went to where you had been
    // standing. locate() sets both, so a fresh fix still works.
    const point =
      anchor ?? position ?? (mapRef.current?.getCenter().toArray() as [number, number] | undefined)
    if (point === undefined) return
    // Dieselbe Box, die der Leser in storage.ts benutzt. Vorher standen die
    // Zahlen hier ein zweites Mal: Ein Ort, den diese Prüfung durchliess, den
    // der Leser aber verwarf, speicherte eine Sitzung, die beim naechsten
    // Laden verschwand — das Auto war weg, ohne Meldung.
    if (!withinCitySession(CITY, point[0], point[1])) {
      setError(`Dieser Ort liegt außerhalb von ${CITY.name} — hier kann kein Parkplatz gemerkt werden.`)
      return
    }
    const hit = zoneAt(zones, point)
    setSession({
      lon: point[0],
      lat: point[1],
      zone: hit?.properties.zone ?? null,
      startedAt: Date.now(),
      remindAt: null,
    })
    setAnnouncement(
      hit === null
        ? 'Parkplatz gemerkt, außerhalb der Parkzonen.'
        : `Parkplatz gemerkt in Zone ${hit.properties.zone}.`
    )
  }, [position, anchor, zones])

  /**
   * Nothing is written until the stored session has been read back.
   *
   * The persist effect used to run on mount with `session` still null and
   * called removeItem; the loader only put the stored value back ~200ms later,
   * so a reload inside that window lost the parked car. A ref guard was not
   * enough: StrictMode runs effects twice, and the second pass wrote the null.
   */
  const [sessionRestored, setSessionRestored] = useState(false)
  useEffect(() => {
    if (!sessionRestored) return
    saveSession(session)
  }, [sessionRestored, session])

  useEffect(() => {
    // Only the local fallback persists here; the shared store is authoritative
    // when present and writing back would fight its snapshots.
    if (!shared && sightings.length > 0) saveSightings(sightings)
  }, [shared, sightings])

  useEffect(() => {
    if (!shared && !seeded && marks.length > 0) saveMarks(marks)
  }, [shared, seeded, marks])

  const setReminder = useCallback(
    (minutes: number | null) => {
      setSession((current) => {
        if (current === null) return current
        if (minutes === null) return { ...current, remindAt: null }
        return { ...current, remindAt: Date.now() + minutes * 60_000 }
      })
      setAnnouncement(
        minutes === null ? 'Erinnerung abgebrochen.' : `Erinnerung in ${minutes} Minuten gesetzt.`
      )
      if (minutes !== null && 'Notification' in window) {
        void Notification.requestPermission().then((permission) => {
          setNotificationsBlocked(permission !== 'granted')
        })
      }
    },
    []
  )

  // Fires the reminder. Without a server this only works while the page is
  // running; the UI says so rather than implying a background alarm.
  const firedRef = useRef<number | null>(null)
  useEffect(() => {
    if (session?.remindAt == null) return
    if (now < session.remindAt) return
    if (firedRef.current === session.remindAt) return
    firedRef.current = session.remindAt
    // More than a few minutes late means this is a reload, not the moment the
    // reminder came due. Firing then produced a fresh notification on every
    // page load, hours after the fact.
    if (now - session.remindAt > 5 * 60_000) return
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Parkzeit läuft ab', {
        body:
          session.zone === null
            ? 'Deine gesetzte Parkzeit ist erreicht.'
            : `Zone ${session.zone}: deine gesetzte Parkzeit ist erreicht.`,
        icon: './icon.svg',
      })
    }
  }, [now, session])

  const reportSighting = useCallback((at?: Position) => {
    // Anchor first, for the same reason as in park(): the last thing the user
    // pointed at is what they mean, not where they were when GPS last answered.
    // The sheet passes its own choice and wins over both.
    const point = at ?? anchor ?? position
    if (point === null) {
      setError('Wähle zuerst einen Ort — oder tippe die Stelle auf der Karte an.')
      return
    }
    const entry: Sighting = {
      id: newLocalId(),
      lon: point[0],
      lat: point[1],
      reportedAt: Date.now(),
      confirmations: 0,
      disputes: 0,
    }
    setError(null)
    // Shown immediately, whichever backend is in play. Previously a shared
    // report went straight to the store and the user saw nothing at all until
    // the snapshot came back — and nothing ever, if the write was refused.
    // The first real report clears the demo list rather than joining it.
    setSightings((current) => [...(sightingsSeeded ? [] : current), entry])
    setSightingsSeeded(false)
    setMarks((current) => [...(seeded ? [] : current), markFor(point, entry.reportedAt)])
    setSeeded(false)

    const backend = backendRef.current
    if (backend === null) return
    void backend.report(point[0], point[1]).catch((cause: unknown) => {
      // Take the optimistic entry back rather than leaving a report that only
      // exists on this screen: the panel says reports are shared, and a row
      // that never arrived would make that a lie.
      setSightings((current) => current.filter((item) => item.id !== entry.id))
      setError(
        `Meldung konnte nicht gespeichert werden: ${
          cause instanceof Error ? cause.message : 'unbekannter Fehler'
        }`,
      )
    })
  }, [position, anchor, seeded, sightingsSeeded])

  const vote = useCallback(
    (id: string, key: 'confirmations' | 'disputes') => {
      // Optimistic for the same reason as reportSighting: a shared vote that
      // waited for the snapshot looked like a dead button, and a refused one
      // looked like nothing at all.
      setSightings((list) =>
        list.map((item) => (item.id === id ? { ...item, [key]: item[key] + 1 } : item))
      )
      const backend = backendRef.current
      if (backend === null) return
      const current = sightings.find((item) => item.id === id)
      if (current === undefined) return
      void backend
        .vote(current, key === 'confirmations' ? 'confirm' : 'dispute')
        .catch((cause: unknown) => {
          setSightings((list) =>
            list.map((item) => (item.id === id ? { ...item, [key]: item[key] - 1 } : item))
          )
          setError(
            `Bewertung konnte nicht gespeichert werden: ${
              cause instanceof Error ? cause.message : 'unbekannter Fehler'
            }`,
          )
        })
    },
    [sightings]
  )

  const focusZone = useCallback((zone: LoadedZone) => {
    setSelected(zone.properties)
    setAnnouncement(describeZone(zone.properties, Date.now()))
    setPanelOpen(true)
    setError(null)
    // Picking a result empties the list, and with it the focused button; the
    // keyboard user then sat at the top of the document with no idea where the
    // zone went. The heading in the zone panel takes the focus instead.
    focusPanelRef.current = true
    // Move the anchor with the selection. Without this the panel showed the
    // searched zone while "Hier geparkt" still used the last point tapped on the
    // map — parking the car in a zone the user was no longer looking at.
    const { minLon, minLat, maxLon, maxLat } = zone.bounds
    // Not the bounding-box centre: for an L-shaped or ring-shaped zone that
    // point lies outside it, and the car was recorded in a neighbour.
    setAnchor([...representativePoint(zone)])
    // The sidebar sits to the right on a wide screen and below on a phone, so
    // the padding has to follow it. A fixed 420px right inset exceeded the whole
    // viewport in portrait and the zone ended up off-screen.
    const narrow = window.innerWidth <= 720
    mapRef.current?.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      {
        padding: narrow
          ? { top: 120, right: 24, bottom: Math.round(window.innerHeight * 0.45), left: 24 }
          : { top: 80, right: 420, bottom: 80, left: 40 },
        duration: 700,
      }
    )
  }, [])

  const togglePoi = useCallback((kind: PoiKind) => {
    setVisiblePoi((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }, [])

  const activeLayerCount = visiblePoi.size + (showLowEmission ? 1 : 0) + (showHeat ? 1 : 0)
  // Selecting another zone, or starting a session, replaces what the panel is
  // about. Keeping the old scroll position showed the sightings list while the
  // user was looking for the zone they just picked — or hid the timer they had
  // just created above it.
  useEffect(() => {
    sidebarRef.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [selected?.zone, session?.startedAt])

  useEffect(() => {
    if (!focusPanelRef.current) return
    focusPanelRef.current = false
    sidebarRef.current?.querySelector<HTMLElement>('#zone-panel-title')?.focus()
  }, [selected?.zone])

  // Nur gesetzt, wenn beim Bauen eine echte Adresse hinterlegt wurde.
  const imprintUrl = trimmedEnv(import.meta.env.VITE_IMPRINT_URL as string | undefined)
  const privacyUrl = trimmedEnv(import.meta.env.VITE_PRIVACY_URL as string | undefined)

  // Stündlich statt im Sekundentakt: Der Hinweis wechselt an Tages- und
  // Stundengrenzen, und ein Scan über alle Zonen gehört nicht in jeden Tick.
  const quiet = useMemo(
    () =>
      quietDayNote(
        zones.map((zone) => toParkingZone(zone.properties)),
        { now: heatDay * 3_600_000 },
      ),
    [zones, heatDay],
  )

  const status = useZoneStatus(selected, now)
  const chargingNow = useMemo(
    () => zones.filter((zone) => isChargeable(toParkingZone(zone.properties), now)).length,
    [zones, now]
  )

  return (
    <div className="app">
      <main ref={containerRef} className="map" aria-label="Karte" />

      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {!ready && error === null && (
        <p className="loading" role="status">
          Parkzonen werden geladen …
        </p>
      )}

      {/*
        Over the map, not inside the panel. The panel starts collapsed on a
        phone, so an error written into it was invisible: tapping "Wo bin ich?"
        appeared to do nothing at all.
      */}
      {error !== null && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Meldung schließen">
            ×
          </button>
        </div>
      )}

      <header className="topbar" ref={topbarRef}>
        {/*
          Bleibt im Dokument, verschwindet von der Karte: Eine Seite ohne
          Überschrift ist für Screenreader ein Rückschritt, und den Namen tragen
          Tab-Titel und Manifest ohnehin.
        */}
        <h1 className="visually-hidden">knoellchenfrei — {CITY.name}</h1>
        <SearchBox zones={zones} onPick={focusZone} />
        <div className="hud">
          <BetaBadge />
          <button
            type="button"
            className="topbar__icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Einstellungen"
            title="Einstellungen"
          >
            <span aria-hidden="true">⚙</span>
          </button>
          <p className="topbar__stat">
            {zones.length > 0 ? `${chargingNow} von ${zones.length} kassieren` : 'lädt …'}
          </p>
          <button
            type="button"
            className="topbar__icon topbar__icon--accent"
            onClick={locate}
            disabled={locating}
            aria-label="Wo bin ich?"
            title="Wo bin ich?"
          >
            <span aria-hidden="true">{locating ? '…' : '◎'}</span>
          </button>
        </div>
        <UpdateBar />
      </header>

      {/*
        One positioned column for both map overlays. They used to be positioned
        separately and landed on top of each other on a phone, where the legend
        also sits under the topbar.
      */}
      <div className="overlay">
      <LiveStats stats={stats} active={activeSightings(sightings, { now }).length} shared={shared} />

      <section className="legend" aria-label="Kartenebenen">
        <button
          type="button"
          className={`chip chip--toggle${legendOpen ? ' chip--on' : ''}`}
          onClick={() => setLegendOpen((value) => !value)}
          aria-expanded={legendOpen}
          aria-controls="legend-layers"
        >
          {/* The glyph is decoration; read aloud it was "trigram for heaven". */}
          <span aria-hidden="true">{legendOpen ? '×' : '☰'}</span> Ebenen
          {!legendOpen && activeLayerCount > 0 && (
            <span className="chip__count" aria-label={`${activeLayerCount} aktiv`}>
              {activeLayerCount}
            </span>
          )}
        </button>
        <div id="legend-layers" className="legend__layers">
        {legendOpen && (
        <>
        <button
          type="button"
          className={`chip${showHeat ? ' chip--on' : ''}`}
          onClick={() => setShowHeat((value) => !value)}
          aria-pressed={showHeat}
          title={
            heat.hasPattern
              ? `${heat.totalMarks} Meldungen aus ${heat.daysCovered} Tagen`
              : `Noch zu wenige Meldungen (${heat.totalMarks} von ${MIN_MARKS_FOR_PATTERN})`
          }
        >
          <span className="chip__dot chip__dot--heat" aria-hidden="true" />
          Kontrolldichte
        </button>
        <button
          type="button"
          className={`chip${showLowEmission ? ' chip--on' : ''}`}
          onClick={() => setShowLowEmission((value) => !value)}
          aria-pressed={showLowEmission}
        >
          <span className="chip__dot" style={{ background: '#a3e635' }} aria-hidden="true" />
          Umweltzone
        </button>
        {(Object.keys(POI_LABELS) as PoiKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            className={`chip${visiblePoi.has(kind) ? ' chip--on' : ''}`}
            onClick={() => togglePoi(kind)}
            aria-pressed={visiblePoi.has(kind)}
          >
            <span className="chip__dot" style={{ background: POI_COLOURS[kind] }} aria-hidden="true" />
            {POI_LABELS[kind]}
          </button>
        ))}
        </>
        )}
        </div>
      </section>
      </div>

      {settingsOpen && meta !== null && (
        <SettingsSheet
          onClose={() => setSettingsOpen(false)}
          onFeedback={
            feedback === null
              ? null
              : () => {
                  setSettingsOpen(false)
                  setFeedbackOpen(true)
                }
          }
          imprintUrl={imprintUrl}
          privacyUrl={privacyUrl}
          source={meta.source}
          licence={meta.licence}
          licenceUrl={meta.licenceUrl}
        />
      )}

      {/*
        Nicht neben einem Dialog: Über die Verknüpfung „Melden" landet man
        sofort im Melde-Dialog, und der Vordialog lag dann unerreichbar
        dahinter — angetippt werden konnte er nicht, weggehen ging auch nicht.
        Er kommt, sobald der Dialog zu ist.
      */}
      {askLocation && !reporting && !settingsOpen && !feedbackOpen && (
        <LocationPrompt
          onAllow={() => {
            rememberLocationAsked()
            setAskLocation(false)
            locate()
          }}
          onDismiss={() => {
            // Löst den nativen Dialog bewusst NICHT aus: Wer ihn ablehnt, hat
            // die Berechtigung dauerhaft verbrannt. So bleibt sie abrufbar.
            rememberLocationAsked()
            setAskLocation(false)
          }}
        />
      )}

      {feedbackOpen && feedback !== null && (
        <FeedbackSheet
          onSend={(kind, text) => feedback.send(kind, text)}
          onClose={() => setFeedbackOpen(false)}
        />
      )}

      {reporting && (
        <ReportSheet
          zones={zones}
          anchor={anchor}
          position={position}
          mapCentre={(mapRef.current?.getCenter().toArray() as Position | undefined) ?? null}
          onFeedback={
            feedback === null
              ? null
              : () => {
                  // Immer nur ein Sheet: gestapelt fing das untere die Klicks ab,
                  // und zwei aria-modal-Dialoge übereinander sind auch für einen
                  // Screenreader falsch.
                  setReporting(false)
                  setFeedbackOpen(true)
                }
          }
          onClose={() => setReporting(false)}
          onSubmit={(point) => {
            reportSighting(point)
            setReporting(false)
          }}
        />
      )}

      {/*
        The toggle lives inside the sidebar as its handle rather than beside it.
        As a separate absolutely-positioned element it ended up underneath the
        panel on a phone and could not be tapped at all.
      */}
      <aside
        id="sidebar"
        ref={sidebarRef}
        className={`sidebar${panelOpen ? '' : ' sidebar--collapsed'}`}
      >
        <button
          type="button"
          className={`panel-toggle${
            session?.remindAt != null && now >= session.remindAt ? ' panel-toggle--alert' : ''
          }`}
          onClick={() => setPanelOpen((value) => !value)}
          aria-expanded={panelOpen}
          aria-controls="sidebar-body"
        >
          <span className="panel-toggle__grip" aria-hidden="true" />
          <span className="panel-toggle__label">
            {panelOpen
              ? 'Ausblenden'
              : session !== null
                ? // A running session outranks the selected zone, and an expired
                  // reminder outranks everything: with the sheet closed and
                  // notifications denied, this line was the only place it could
                  // possibly show.
                  session.remindAt !== null && now >= session.remindAt
                  ? '⚠ Parkzeit abgelaufen'
                  : `Geparkt${session.zone === null ? '' : ` in Zone ${session.zone}`}${
                      session.remindAt === null ? '' : ' · Erinnerung läuft'
                    }`
                : selected === null
                  ? 'Details einblenden'
                  : `Zone ${selected.zone} · einblenden`}
          </span>
        </button>

        <div id="sidebar-body" className="sidebar__body" hidden={!panelOpen}>
        {session !== null && (
          <ParkingTimer
            session={session}
            now={now}
            onSetReminder={setReminder}
            onClear={() => {
              setSession(null)
              setAnnouncement('Parkvorgang beendet.')
            }}
            onLocate={() => {
              const map = mapRef.current
              if (map === null) return
              // Centring puts the marker behind the sheet on a phone. Offset it
              // upwards by half the sheet so the car is actually visible.
              const sheet = sidebarRef.current?.getBoundingClientRect().height ?? 0
              const narrow = window.innerWidth <= 720
              map.easeTo({
                center: [session.lon, session.lat],
                zoom: 16,
                offset: narrow ? [0, -Math.round(sheet / 2)] : [-160, 0],
              })
            }}
            notificationsBlocked={notificationsBlocked}
          />
        )}

        {showInstall && (
          <InstallBanner
            state={installState}
            onDismiss={() => {
              setInstallDismissed(true)
              hideInstall()
            }}
          />
        )}

        {quiet !== null && !quietDismissed && (
          <QuietDayNote note={quiet} onDismiss={() => setQuietDismissed(true)} />
        )}

        {selected !== null && status !== null ? (
          <ZonePanel
            properties={selected}
            status={status}
            now={now}
            onPark={park}
            parked={session !== null}
          />
        ) : (
          <section className="panel">
            <h2 className="panel__title">
              {anchor === null ? 'Wo stehst du?' : 'Außerhalb der Parkzonen'}
            </h2>
            <p className="hours">
              {anchor === null
                ? 'Tippe auf die Karte, wo du stehst. Orange bedeutet: diese Zone kassiert gerade, Türkis heißt gebührenfrei.'
                : 'Hier gilt keine Parkraumbewirtschaftung — Gebühren fallen nicht an. Halteverbote und Bewohnerplätze können trotzdem gelten.'}
            </p>
            {/* Parking outside a zone is the common case in most of Berlin, so
                the button belongs here too, not only in the zone panel. */}
            {anchor !== null && (
              <button type="button" className="button button--primary button--block" onClick={park}>
                {session === null ? 'Hier geparkt' : 'Parkplatz hierher verschieben'}
              </button>
            )}
          </section>
        )}

        <TowInfo />

        <SightingPanel
          sightings={sightings}
          now={now}
          onReport={() => {
            // Auf dem Handy deckt das Panel die untere Kartenhälfte ab. Wer
            // im Sheet auf "Karte" ausweichen will, braucht sie frei.
            setPanelOpen(false)
            setReporting(true)
          }}
          onConfirm={(id) => vote(id, 'confirmations')}
          onDispute={(id) => vote(id, 'disputes')}
          canReport={position !== null || anchor !== null}
          shared={shared}
          seeded={sightingsSeeded}
        />

        <HeatPanel
          seeded={seeded}
          top={heatTop}
          heat={heat}
          activity={activity}
          weekday={berlinNow.weekday}
          hour={Math.floor(berlinNow.minuteOfDay / 60)}
          visible={showHeat}
          onToggle={() => setShowHeat((value) => !value)}
          shared={shared}
        />

        {meta !== null && (
          <footer className="provenance">
            <p>
              Daten: {meta.source} · {meta.zones} Zonen, {meta.managedSpaces.toLocaleString('de-DE')}{' '}
              bewirtschaftete Stellplätze
            </p>
            <p>
              Lizenz:{' '}
              <a href={meta.licenceUrl} target="_blank" rel="noreferrer">
                {meta.licence}
              </a>{' '}
              · Stand des Abzugs, nicht live
            </p>
            <p className="provenance__warn">
              Verbindlich ist immer die Beschilderung vor Ort. Gebühren und Zeiten können
              abschnittsweise abweichen.
            </p>
            {/*
              Erscheinen erst, wenn die Seiten wirklich existieren. Ein Impressum
              muss in Deutschland leicht erkennbar und unmittelbar erreichbar
              sein — ein Link auf eine Platzhalterseite wäre schlechter als
              keiner, deshalb hängt beides an einer Build-Variablen.
            */}
            {feedback !== null && (
              <p>
                <button
                  type="button"
                  className="provenance__link"
                  onClick={() => setFeedbackOpen(true)}
                >
                  Feedback senden
                </button>
              </p>
            )}
            {(imprintUrl !== undefined || privacyUrl !== undefined) && (
              <p>
                {imprintUrl !== undefined && (
                  <a href={imprintUrl} target="_blank" rel="noreferrer">
                    Impressum
                  </a>
                )}
                {imprintUrl !== undefined && privacyUrl !== undefined ? ' · ' : null}
                {privacyUrl !== undefined && (
                  <a href={privacyUrl} target="_blank" rel="noreferrer">
                    Datenschutz
                  </a>
                )}
              </p>
            )}
          </footer>
        )}
        </div>
      </aside>
    </div>
  )
}
