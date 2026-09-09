import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// MapLibre 6 hat den Default-Export abgeschafft und exportiert nur noch
// benannt. Ein Namensraum-Import lässt `maplibregl.Marker` als Typ *und* als
// Konstruktor stehen, also bleibt der Rest der Datei unberührt.
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import {
  activeSightings,
  berlinWallClock,
  buildHeatmap,
  heatActivity,
  isChargeable,
  isUncertainAt,
  quietDayNote,
  markFor,
  withinCitySession,
  type City,
  type EventLayerValue,
  type HeatMark,
  type Position,
  type Sighting,
} from '@knoellchenfrei/core'

import { CITY, switchCity } from './city.js'
import { rememberSuggestionDismissed, suggestionAt } from './city-suggestion.js'
import { baseStyle } from './map-style.js'
import { costLabel, statusLabel, tidyPoiDetail } from './format.js'
import { isEmbedded, loadData } from './data-source.js'
import { openFeedback } from './feedback.js'
import { forgetStaleLayer, layerOf, syncLayer } from './layer-history.js'
import { openLiveStats, type LiveStats as Stats } from './presence.js'
import { WorkerFehler, openSightingBackend, type SightingBackend } from './sighting-backend.js'
import { ParkingTimer } from './components/ParkingTimer.js'
import { SearchBox } from './components/SearchBox.js'
import { UpdateBar } from './components/UpdateBar.js'
import { CitySuggestion } from './components/CitySuggestion.js'
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
import { track, trackNow } from './track.js'
import { zoneImDativ, zoneKurz, zoneTitel } from './zone-label.js'
import {
  countVisit,
  hideInstall,
  installHidden,
  loadSession,
  loadMarks,
  loadOwn,
  loadSightings,
  locationAsked,
  saveSession,
  rememberLocationAsked,
  saveMarks,
  saveOwn,
  saveSightings,
  type ParkingSession,
  type OwnState,
  type VoteKind,
} from './storage.js'
import { loadZones, representativePoint, zoneAt, zoneNear, type LoadedZone } from './zones.js'
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
  return `${zoneKurz(properties)}, ${properties.district}: ${
    paid ? 'gebührenpflichtig' : 'gerade keine Gebühr'
  }. Details im Seitenbereich.`
}

/**
 * Was die App über eine Zone gesagt hat — als eine von vier Antworten.
 *
 * Für die Statistik, und deshalb bewusst grob: Es zählt, **ob** die App etwas
 * zu sagen hatte, nicht was genau. Die Rechnung steht in `core` und wird hier
 * nicht nachgebaut.
 */
function zoneAnswer(properties: ZoneProperties, now: number): 'frei' | 'pflichtig' | 'unsicher' | 'quelldefekt' {
  const zone = toParkingZone(properties)
  if (properties.sourceDefect !== null) return 'quelldefekt'
  if (isUncertainAt(zone, now)) return 'unsicher'
  return isChargeable(zone, now) ? 'pflichtig' : 'frei'
}

/**
 * Die Fläche zu einem Punkt — strikt, und in Städten mit `zoneSnapMetres` mit
 * dem zweiten Versuch „nächste Fläche in Reichweite". Karlsruhes Zonen sind
 * die Stellplatzreihen selbst, 4,8 m breit; eine Ortung trifft sie fast nie,
 * obwohl das Auto darin steht. `metres` ist null bei einem echten Treffer,
 * sonst der Abstand, den die Oberfläche dazusagt.
 */
function resolveZone(
  zones: readonly LoadedZone[],
  point: Position,
): { zone: LoadedZone; metres: number | null } | null {
  const strict = zoneAt(zones, point)
  if (strict !== null) return { zone: strict, metres: null }
  const reach = CITY.zoneSnapMetres
  if (reach === undefined) return null
  const near = zoneNear(zones, point, reach)
  return near === null ? null : { zone: near.zone, metres: near.metres }
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
  /** Der scrollende Teil des Blatts; der Griff darüber steht fest. */
  const sidebarBodyRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLElement>(null)
  /** Set when a POI popup opened, so the zone handler ignores the same tap. */
  const suppressZoneClick = useRef(0)
  /** Set by a search pick: focus moves into the zone panel once it renders. */
  const focusPanelRef = useRef(false)
  const mapRef = useRef<MapLibreMap | null>(null)
  const carMarkerRef = useRef<maplibregl.Marker | null>(null)
  const meMarkerRef = useRef<maplibregl.Marker | null>(null)
  /**
   * Ob der Anker vom Standort kommt (dann wandert er beim Gehen mit) oder
   * von einem Tipp auf die Karte (dann bleibt er, wo der Finger war).
   */
  const anchorFromGps = useRef(false)
  /** Laufende `watchPosition`-Kennung, solange der Punkt dem Gerät folgt. */
  const watchIdRef = useRef<number | null>(null)
  /** Ob gefolgt werden soll — überlebt das Anhalten bei verdecktem Tab. */
  const trackingRef = useRef(false)
  const zonesRef = useRef<LoadedZone[]>([])

  const [ready, setReady] = useState(false)
  const [zones, setZones] = useState<LoadedZone[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [selected, setSelected] = useState<ZoneProperties | null>(null)
  /** Wie weit die Ortung neben der gewählten Fläche lag; null bei einem Treffer darin. */
  const [nearbyMetres, setNearbyMetres] = useState<number | null>(null)
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
  /**
   * Die Kontrolldichte ist **eingeschaltet**, die übrigen Ebenen nicht.
   *
   * Sie ist der Grund, warum es diese App gibt, und die einzige Ebene, die
   * etwas zeigt, das man nirgends sonst bekommt — Ladepunkte und
   * Behindertenparkplätze stehen in jeder Karte. Wer sie erst suchen muss,
   * findet sie nicht: Der Ebenen-Streifen ist auf dem Handy zugeklappt.
   *
   * Ohne Daten kostet das nichts. `heat.hasPattern` bleibt falsch, solange zu
   * wenige Meldungen da sind, und dann zeichnet die Ebene ohnehin nichts —
   * der Schalter steht dann auf „an" über einer Fläche, die leer bleibt, und
   * die Tafel daneben sagt, warum.
   */
  /**
   * Welche Ebenen die geladene Stadt überhaupt hat.
   *
   * Die Chips standen bisher für alle vier POI-Arten und die Umweltzone da,
   * gleich ob dahinter Daten lagen. Nachgemessen am 7. September: **Hamburg
   * hat keinen einzigen POI**, Frankfurt nur die Behindertenparkplätze, und
   * Umweltzonen führen nur Berlin (1 Fläche) und München (12). In Hamburg
   * waren damit fünf von sechs Schaltern Attrappen — und ein Schalter, der
   * nichts tut, sieht aus wie eine Aussage über die Stadt („hier gibt es keine
   * Ladepunkte") statt wie eine über die Daten.
   *
   * `null`, solange die Daten nicht da sind: Dann steht noch kein Chip, statt
   * dass sechs erscheinen und drei wieder verschwinden.
   */
  const [ebenenMitDaten, setEbenenMitDaten] = useState<{
    poi: ReadonlySet<PoiKind>
    umweltzone: boolean
  } | null>(null)
  /** Ob es Ebenen zu wählen gibt — sonst gibt es weder Chip-Zeile noch Ebenen-Knopf. */
  const legendAvailable =
    ebenenMitDaten?.umweltzone === true || (ebenenMitDaten?.poi.size ?? 0) > 0
  const [stats, setStats] = useState<Stats>({ online: null, today: null })
  const [reporting, setReporting] = useState(false)
  /** Vom Kartenknopf geöffnet: Das Blatt stellt den Standort vor die angetippte Stelle. */
  const [reportViaFab, setReportViaFab] = useState(false)
  // Der eigene Vordialog vor dem des Browsers. Erscheint einmal; die
  // Antwort selbst liegt beim Browser, hier steht nur, dass gefragt wurde.
  const [askLocation, setAskLocation] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Die Stadt, in der der letzte Standortabruf gelandet ist, falls es eine
  // andere als die geladene war. Kein eigener Berechtigungsdialog hängt daran:
  // Der Wert entsteht in `locate()` aus einer Position, die die App ohnehin
  // schon hat.
  const [citySuggestion, setCitySuggestion] = useState<City | null>(null)
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
  /**
   * Die dritte Raststufe des Blatts auf dem Handy: ganz hoch, bis unter die
   * Kopfzeile. Nur über eine Wischgeste am Griff erreichbar; ein Tipp wechselt
   * weiter zwischen zu und halb, wie es Tests und Gewohnheit erwarten. Auf
   * dem Desktop hat die Stufe keine Wirkung, das Blatt steht dort seitlich.
   */
  const [sheetFull, setSheetFull] = useState(false)
  /** Wo die Wischgeste am Griff begann; null, solange keine läuft. */
  const sheetDrag = useRef<{ y: number; moved: boolean } | null>(null)
  /** Zeitstempel des letzten Fingers am Griff; das `click` gleich danach ist derselbe Tipp. */
  const lastGripTouch = useRef(0)
  const [legendOpen, setLegendOpen] = useState(false)
  /**
   * Ob rechts von der Chip-Zeile noch Chips liegen. Auf dem Handy scrollt die
   * Zeile seitlich, und ob der letzte Chip angeschnitten ist, hängt von der
   * Chip-Zahl und der Schirmbreite ab — bei sieben Chips auf 320 Pixel ja,
   * bei drei nicht. Ein Verlauf am rechten Rand zeigt es; reines CSS reicht
   * dafür nicht, weil `scrollWidth > clientWidth` kein Selektor ist.
   */
  const [legendMore, setLegendMore] = useState(false)
  // Read by a polite live region: the map and the panel change visually, and a
  // screen reader would otherwise hear nothing when a zone is picked or a
  // session starts.
  const [announcement, setAnnouncement] = useState('')
  // Non-null once a shared backend answers; sightings are then visible to
  // everyone who opens the link rather than only on this device.
  const backendRef = useRef<SightingBackend | null>(null)
  /**
   * Eigene Meldungen und eigene Stimmen dieses Geräts. Der Worker weist eine
   * Stimme auf die eigene Meldung mit 403 ab (Audit-Punkt M-047) und zählt
   * eine zweite Stimme desselben Clients nicht; die Knöpfe dafür anzubieten
   * hiesse, einen Fehler einzuladen. Bis zum 9. September stand das nur in
   * einem Ref: Nach dem Neuladen war „deine Meldung" weg, und der Betreiber
   * konnte nicht mehr sehen, welche Zeilen er noch bewerten kann. Jetzt im
   * `localStorage`, siehe `loadOwn`.
   */
  const [own, setOwn] = useState<OwnState>(() => loadOwn())
  useEffect(() => saveOwn(own), [own])
  const markOwnReport = useCallback((id: string) => {
    setOwn((current) => ({ ...current, reports: { ...current.reports, [id]: Date.now() } }))
  }, [])
  const markVote = useCallback((id: string, kind: VoteKind | null) => {
    setOwn((current) => {
      const votes = { ...current.votes }
      if (kind === null) delete votes[id]
      else votes[id] = { kind, at: Date.now() }
      return { ...current, votes }
    })
  }, [])
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
  //
  // `box: 'border-box'`, und das ist kein Detail: Ein ResizeObserver meldet
  // in der Vorgabe nur die **Content-Box**. Die Safe-Area des iPhones kommt
  // als Padding (`env(safe-area-inset-top)`) — und in der abgelegten App
  // erst nach dem ersten Layout. Die Kopfzeile wuchs damit von 64 auf
  // 113 Pixel, ohne dass der Beobachter feuerte; die Chip-Zeile blieb bei
  // 72 und lag im Suchfeld. Vom Betreiber am 9. September fotografiert,
  // per CDP (`Emulation.setSafeAreaInsetsOverride`) nachgestellt.
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
    observer.observe(element, { box: 'border-box' })
    return () => observer.disconnect()
  }, [])

  // Dasselbe für das Blatt unten: Der Standort-Knopf schwebt darüber und
  // muss mitwandern, wenn es auf- oder zuklappt. Zugeklappt ist es nur der
  // Griff, halb offen gut die Hälfte des Schirms.
  useEffect(() => {
    const element = sidebarRef.current
    if (element === null) return
    const apply = (): void => {
      document.documentElement.style.setProperty(
        '--sheet-height',
        `${Math.ceil(element.getBoundingClientRect().height)}px`
      )
    }
    apply()
    const observer = new ResizeObserver(apply)
    // Border-Box aus demselben Grund wie bei der Kopfzeile: Das Blatt trägt
    // die untere Safe-Area als Padding, und ohne sie sass der Meldeknopf
    // auf dem Griff.
    observer.observe(element, { box: 'border-box' })
    return () => observer.disconnect()
  }, [])

  // Der Kantenverlauf der Chip-Zeile: gemessen, nicht geraten. Die Breite
  // ändert sich mit dem Schirm (ResizeObserver auf der Zeile) und mit jedem
  // ein- oder ausgeblendeten Chip (ResizeObserver auf dem Chip-Streifen, der
  // die Zeile selbst nicht breiter macht — die scrollt). Ganz nach rechts
  // gescrollt gibt es nichts mehr anzudeuten, also fällt der Verlauf weg.
  useEffect(() => {
    const element = legendRef.current
    if (element === null) return
    const layers = element.querySelector('.legend__layers')
    if (layers === null) return
    const apply = (): void => {
      const overflow = element.scrollWidth - element.clientWidth
      // Ein Pixel Toleranz: Subpixel-Breiten runden `scrollLeft` auf beiden
      // Seiten, und der Verlauf flackerte sonst am Ende der Zeile.
      setLegendMore(overflow > 1 && element.scrollLeft < overflow - 1)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(element)
    observer.observe(layers)
    element.addEventListener('scroll', apply, { passive: true })
    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', apply)
    }
    // Nicht `[]`: Die Chip-Zeile wird seit dem 9. September nur gerendert,
    // wenn es Ebenen zu wählen gibt — und das weiss die App erst nach dem
    // Laden. Ein Effekt ohne Abhängigkeit lief einmal vor dem Laden ins Leere,
    // und der Verlauf am rechten Rand blieb für immer aus. Gefunden hat es
    // der E2E-Test, der ihn auf 320 Pixeln verlangt.
  }, [legendAvailable])

  // Ein Verlaufseintrag, solange ein Blatt offen ist — damit „Zurück" das
  // Blatt schließt und nicht die App. Warum ein Eintrag für alle drei und
  // nicht einer je Blatt, steht in `layer-history.ts`.
  const activeLayer = settingsOpen
    ? 'einstellungen'
    : feedbackOpen
      ? 'feedback'
      : reporting
        ? 'melden'
        : null
  const previousLayer = useRef<string | null>(null)
  useEffect(() => {
    syncLayer(window.history, previousLayer.current, activeLayer)
    previousLayer.current = activeLayer
  }, [activeLayer])
  useEffect(() => {
    forgetStaleLayer(window.history)
    const onPop = (event: PopStateEvent): void => {
      if (layerOf(event.state) !== null) return
      setSettingsOpen(false)
      setFeedbackOpen(false)
      setReporting(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    // Permission state survives reloads even though React state does not, so
    // the "only while this page is open" caveat has to be re-derived.
    if ('Notification' in window) setNotificationsBlocked(Notification.permission !== 'granted')
    setSession(loadSession())
    setSessionRestored(true)
    // Keine Demodaten mehr, seit dem 9. September auf Wunsch des Betreibers:
    // Bis dahin füllte `seed.ts` eine leere Liste mit sechs erzeugten
    // Sichtungen und die Kontrolldichte mit einem erzeugten Muster. Was jetzt
    // hier steht, ist gemeldet — oder die Liste ist leer und sagt das.
    setSightings(loadSightings())
    setMarks(loadMarks())
    if (!locationAsked() && 'geolocation' in navigator) setAskLocation(true)
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
      // Der gemeinsame Speicher ist die Wahrheit, auch wenn er leer ist: Bis
      // zum 9. September hielt ein `if (rows.length === 0) return` hier die
      // Demodaten fest; ohne Demodaten hielte es nur noch Reste aus dem
      // lokalen Speicher eines früheren Betriebs ohne Server.
      unsubscribe = backend.subscribe((rows) => {
        setSightings(rows)
      })
      unsubscribeMarks = backend.subscribeMarks?.((rows) => {
        setMarks(rows)
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

    // Nicht weiter hinaus als die Stadt, und nicht daneben.
    //
    // Ohne diese Grenzen liess sich die Karte beliebig weit herauszoomen und
    // wegschieben: Ab einem gewissen Punkt sass man vor einer schwarzen Fläche
    // mit einem kleinen bunten Fleck darin. Das eigene Kachelarchiv deckt nur
    // den Ausschnitt der geladenen Stadt ab (dieselben `reportBounds`, aus
    // denen `build-tiles.sh` den Ausschnitt schneidet) — draussen gibt es
    // schlicht keine Kacheln, und die Karte sieht dabei kaputt aus statt
    // begrenzt.
    //
    // Der Rahmen ist `reportBounds` und nicht die weitere `sessionBounds`,
    // und das ist keine Geschmacksfrage: `build-tiles.sh` schneidet den
    // PMTiles-Ausschnitt aus **genau diesen** Zahlen (über `city-bbox.ts`).
    // Hinter `reportBounds` gibt es also keine Kachel mehr. Mit der weiteren
    // Box liesse sich bis Brandenburg schieben — und genau dort fängt das
    // Schwarz wieder an, das diese Grenze verhindern soll.
    const rahmen = new maplibregl.LngLatBounds(
      [CITY.reportBounds.minLon, CITY.reportBounds.minLat],
      [CITY.reportBounds.maxLon, CITY.reportBounds.maxLat]
    )
    map.setMaxBounds(rahmen)

    // Die kleinste Zoomstufe wird **gerechnet, nicht gesetzt**: Sie hängt an
    // der Grösse des Behälters und ist auf einem Handy eine andere als auf
    // einem Monitor. Eine feste Zahl wäre auf einem von beiden falsch — zu
    // klein, dann bleibt der schwarze Rand, oder zu gross, dann sieht man die
    // Stadt nicht mehr ganz.
    const kleinsteStufe = (): void => {
      const kamera = map.cameraForBounds(rahmen, { padding: 0 })
      if (kamera?.zoom === undefined) return
      // Nie über die aktuelle Stufe hinaus: Wäre der Behälter kurzzeitig
      // winzig (ein Panel klappt auf, das Fenster wird schmal), spränge die
      // Karte sonst mitten in einer Geste weiter hinein.
      map.setMinZoom(Math.min(kamera.zoom, map.getZoom()))
    }
    kleinsteStufe()
    map.on('resize', kleinsteStufe)

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
          // Aus den Daten gelesen, nicht aus `meta.absent` geschlossen: Die
          // Liste dort sagt, was die Stadt nicht liefert, und ist gepflegt —
          // die Punkte sind gezählt. Bei einem Widerspruch gewinnt das
          // Gezählte, denn genau die gepflegte Liste läuft irgendwann weg.
          setEbenenMitDaten({
            poi: new Set(
              (poiData as { features: { properties?: { kind?: PoiKind } }[] }).features
                .map((feature) => feature.properties?.kind)
                .filter((kind): kind is PoiKind => kind !== undefined)
            ),
            umweltzone: (umweltzone as { features: unknown[] }).features.length > 0,
          })

          const loaded = loadZones(zoneData)
          setZones(loaded)

          await new Promise<void>((resolve) => withMapReady(resolve))

          // MapLibre shows the compact attribution expanded until the first
          // touch on the map. On a phone that put a 190px strip over the
          // topbar's button; collapsed, it is the usual "i" one tap away.
          // Auch im Querformat: 844 Pixel breit, aber 390 hoch, und der
          // ausgeklappte Streifen lag über dem Seitenpanel.
          //
          // Und auf dem Tablet: Bei 768 Pixeln Breite steht die Seitenleiste
          // mit 380 Pixeln daneben, der Karte bleiben 372. Dort teilen sich
          // Chip-Zeile, Standort-Knopf und der ausgeklappte Streifen (201
          // Pixel) die untere Kante — gemessen am 9. September lag der
          // Streifen über dem untersten Chip (Mobile-Audit, „Verbleibende
          // Probleme"). Unter 960 Pixeln Breite ist neben der Leiste nie
          // Platz für alle drei; das „i" bleibt einen Tipp entfernt.
          // Seit dem 9. September überall, auch auf dem Desktop: Der Betreiber
          // will das „i" immer zugeklappt; wer die Quellen lesen will, tippt.
          //
          // Und nicht nur einmal: MapLibre klappt die Pille **wieder auf**,
          // sobald sich der Quellentext ändert — und das tut er, wenn die
          // Vektorkacheln ihre Quelle melden, also kurz nach dem Aufbau. Ein
          // einmaliges Entfernen der Klasse hielt deshalb nur mit den
          // Rasterkacheln; mit dem eigenen Archiv war das „i" beim Betreiber
          // „initial ausgefahren". Ein MutationObserver hält es zu, ausser der
          // Tipp kam vom Menschen: Dessen Klick auf das „i" darf öffnen.
          const attrib = map.getContainer().querySelector('.maplibregl-ctrl-attrib')
          if (attrib !== null) {
            // Nach der ersten Berührung durch den Menschen greift nichts mehr
            // ein: Ab da gehört die Pille ihm. Capture-Phase, damit der
            // Merker steht, bevor MapLibre auf denselben Tipp reagiert.
            let vomMenschen = false
            for (const ereignis of ['pointerdown', 'keydown', 'click']) {
              attrib.addEventListener(ereignis, () => { vomMenschen = true }, { capture: true })
            }
            new MutationObserver(() => {
              // Nur entfernen, wenn sie da ist — sonst löst das Setzen des
              // Attributs die nächste Beobachtung aus, ohne Ende.
              if (!vomMenschen && attrib.classList.contains('maplibregl-compact-show')) {
                attrib.classList.remove('maplibregl-compact-show')
              }
            }).observe(attrib, { attributes: true, attributeFilter: ['class'] })
            attrib.classList.remove('maplibregl-compact-show')
          }

          // Drawn first so it sits beneath the zones.
          map.addSource('districts', { type: 'geojson', data: districts })
          map.addLayer({
            id: 'districts-line',
            type: 'line',
            source: 'districts',
            paint: { 'line-color': '#2b3440', 'line-width': 1 },
          })

          // **Kein `promoteId: 'zone'` mehr.** `loadZones` hat jeder Fläche
          // oben eine laufende `id` aufgestempelt, und MapLibre nimmt die am
          // Feature vorrangig. Der Zonenschlüssel taugt nicht als Kennung: In
          // Hamburg tragen 44 von 145 Flächen den Schlüssel `-`, und vier
          // Zonen kommen in mehreren Stücken mit verschiedenen Zeiten. Alle
          // teilten sich damit einen Zustandsplatz — die Begründung steht bei
          // `LoadedZone.id`.
          map.addSource('zones', { type: 'geojson', data: zoneData })
          map.addLayer({
            id: 'zones-fill',
            type: 'fill',
            source: 'zones',
            paint: {
              // **Messing statt Orange, seit dem 8. September.** Der Grund ist
              // nicht Geschmack, sondern eine Messung: An einem Dienstag um
              // 10:30 kassieren **100 % der Zonenfläche** in allen vier
              // Städten, und an 45 bis 84 der 168 Wochenstunden liegt der
              // Anteil über 90 %. Eine Alarmfarbe markierte damit den
              // Normalfall — die Karte war werktags flächig orange, und das
              // Farbgewicht lag auf dem Häufigen statt auf dem Bemerkenswerten.
              //
              // Dazu zwei gemessene Kollisionen, die Orange nicht auflösen
              // konnte (ΔE2000, Minimum über Normalsicht und die drei
              // Dichromasien): gegen die Heatmap-Stufe 0,70 nur **0,9** bei
              // Tritanopie — dieselbe Farbe für „viel kontrolliert" und
              // „kostet gerade" —, und die Kontur gegen Ladepunkt und
              // Umweltzone 7,3.
              //
              // `#cd8700` hebt die schlechteste Kollision auf 8,4, den Abstand
              // zur Heatmap in Normalsicht auf 19,2 und lässt die Trennung
              // kassierend/frei bei Farbfehlsichtigkeit unangetastet (45,7
              // gegen vorher 45,3). Der Preis steht in
              // `docs/farben-parkzonen.md`: Auf dem Rasterrückfall sinkt der
              // Abstand zum Untergrund von 17,6 auf 10,8.
              'fill-color': [
                'case',
                ['boolean', ['feature-state', 'chargeable'], false],
                '#cd8700',
                '#22d3ee',
              ],
              // Drei Stufen statt zwei. Die gebührenfreie Fläche steht seit
              // dem 8. September bei 0,14 statt 0,07: Sie war auf dem
              // Rasterrückfall mit ΔE 5,3 praktisch unsichtbar — und sie ist
              // die **seltene** Aussage, also die interessante. Sie überstimmt
              // die kassierende trotzdem nicht.
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                0.58,
                ['boolean', ['feature-state', 'chargeable'], false],
                0.26,
                0.14,
              ],
            },
          })
          map.addLayer({
            id: 'zones-line',
            type: 'line',
            source: 'zones',
            paint: {
              // Cremefarben und nicht goldfarben, und das ist kein Geschmack:
              // Die Kontur ist das Bauteil mit dem geringsten Spielraum. Eine
              // goldene Linie `#f2c94c` liegt bei Deuteranopie **ΔE 1,1** von
              // der gestrichelten Umweltzone entfernt, `#edb45f` **0,4** vom
              // Ladepunkt — beides derselbe Strich für jemanden mit
              // Rot-Grün-Schwäche. `#f5cfa0` hebt die schlechteste
              // Konturkollision von 7,3 auf 10,4.
              'line-color': [
                'case',
                ['boolean', ['feature-state', 'chargeable'], false],
                '#f5cfa0',
                '#a5f3fc',
              ],
              // Die Kontur trägt jetzt die Grenze, nicht mehr die Füllung. Sie
              // bleibt deshalb überall vorhanden — nur unterschiedlich laut.
              'line-opacity': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                1,
                ['boolean', ['feature-state', 'chargeable'], false],
                0.9,
                0.55,
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                2.5,
                ['boolean', ['feature-state', 'chargeable'], false],
                1.2,
                0.9,
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
            // it throws. The parsed zone is already in memory — look it up
            // instead of trusting what the map hands back.
            //
            // **Nachgeschlagen wird über die Flächenkennung, nicht über
            // `properties.zone`.** Bis zum 8. September stand hier
            // `loaded.find(z => z.properties.zone === id)`, und das nimmt die
            // **erste** Fläche mit diesem Schlüssel. In Hamburg tragen 44 von
            // 145 Flächen den Schlüssel `-`: Ein Klick auf irgendeine von
            // ihnen zeigte die Zeiten der ersten. Bei A103 waren das 9–20 statt
            // 9–23 Uhr, bei E315 3,50 statt 3,00 €.
            //
            // Ich hatte beim Kartenfehler eine Stunde vorher geschrieben, das
            // Panel sei nicht betroffen, weil `zoneAt` geometrisch sucht. Das
            // gilt für Standort und Tipp ins Leere — **nicht** für den Klick
            // auf eine Zonenfläche, der genau hier landet.
            //
            // Der Rückfall auf den Schlüssel bleibt, falls MapLibre einmal
            // keine `id` mitliefert: Er ist überall dort richtig, wo die
            // Schlüssel eindeutig sind — also in Berlin, Frankfurt und München
            // immer. Ein Klick, der gar nichts tut, wäre die schlechtere
            // Antwort als einer, der in Hamburg gelegentlich die
            // Nachbarfläche trifft.
            const feature = event.features?.[0]
            const schluessel = feature?.properties?.['zone']
            const hit =
              typeof feature?.id === 'number'
                ? loaded.find((zone) => zone.id === feature.id)
                : typeof schluessel === 'string'
                  ? loaded.find((zone) => zone.properties.zone === schluessel)
                  : undefined
            if (hit !== undefined) {
              setSelected(hit.properties)
              setNearbyMetres(null)
              track('zone.open', hit.properties.zone)
              track('zone.answer', zoneAnswer(hit.properties, Date.now()))
              track('zone.source', 'karte')
              setAnnouncement(describeZone(hit.properties, Date.now()))
              anchorFromGps.current = false
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
            anchorFromGps.current = false
            setAnchor([event.lngLat.lng, event.lngLat.lat])
            // A tap that hits no zone also ends the previous selection. The
            // panel otherwise kept describing the last zone while "Hier
            // geparkt" recorded the car outside it — the panel said "Zone 34",
            // the timer "außerhalb einer Parkzone".
            if (map.queryRenderedFeatures(event.point, { layers: ['zones-fill'] }).length === 0) {
              // In Karlsruhe der zweite Versuch: die Reihe daneben, wenn sie
              // in Reichweite liegt. Sonst endet die Auswahl wie bisher.
              const near =
                CITY.zoneSnapMetres === undefined
                  ? null
                  : zoneNear(loaded, [event.lngLat.lng, event.lngLat.lat], CITY.zoneSnapMetres)
              if (near === null) {
                setSelected(null)
                setNearbyMetres(null)
              } else {
                setSelected(near.zone.properties)
                setNearbyMetres(near.metres)
                track('zone.open', near.zone.properties.zone)
                track('zone.answer', zoneAnswer(near.zone.properties, Date.now()))
                track('zone.source', 'karte')
                setAnnouncement(describeZone(near.zone.properties, Date.now()))
                setPanelOpen(true)
              }
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
      map.setFeatureState({ source: 'zones', id: zone.id }, { chargeable })
    }
  }, [ready, zones, now])

  useEffect(() => {
    const map = mapRef.current
    if (map === null || !ready) return
    for (const zone of zones) {
      map.setFeatureState(
        { source: 'zones', id: zone.id },
        { selected: zone.properties.zone === selected?.zone }
      )
    }
  }, [ready, zones, selected])

  // Recomputed on the render clock rather than on every tick of `now`: the
  // window moves by the day, and folding four weeks of marks 240 times an hour
  // is the kind of thing that cost 1.5 s a tick once already.
  const heatDay = useMemo(() => Math.floor(now / 3_600_000), [now])
  const heat = useMemo(
    () => buildHeatmap(marks, { now: heatDay * 3_600_000, grid: CITY.heatGrid }),
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
      const label = zone === null ? 'Außerhalb der Zonen' : zoneKurz(zone.properties)
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
      heat.hasPattern ? 'visible' : 'none',
    )
  }, [ready, heat.hasPattern])

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
      const hit = resolveZone(zones, [lng, lat])?.zone ?? null
      setSession((current) =>
        current === null ? current : { ...current, lon: lng, lat, zone: hit?.properties.zone ?? null }
      )
    })
    carMarkerRef.current = marker
  }, [session?.startedAt, zones])

  useEffect(() => {
    const map = mapRef.current
    if (map === null || position === null) return
    // Beim Gehen kommt alle paar Sekunden ein Punkt; der Marker wandert,
    // statt jedes Mal neu in den Baum zu kommen.
    if (meMarkerRef.current !== null) {
      meMarkerRef.current.setLngLat(position)
      return
    }
    const element = document.createElement('div')
    element.className = 'marker marker--me'
    meMarkerRef.current = new maplibregl.Marker({ element }).setLngLat(position).addTo(map)
  }, [position])

  useEffect(() => {
    zonesRef.current = zones
  }, [zones])

  /**
   * Der blaue Punkt folgt dem Gerät, sobald es einmal einen Standort gab.
   *
   * Bis zum 9. September stand er, wo „Wo bin ich?" ihn hingesetzt hatte;
   * wer lief, drückte den Knopf wieder und wieder. Ein `watchPosition` läuft
   * jetzt, solange die Seite sichtbar ist (verdeckt kostet es nur Akku),
   * und rückt den Punkt nach. Der Anker — und damit das Zonenblatt — geht
   * nur mit, wenn er vom Standort kam; wer auf die Karte getippt hat, hat
   * etwas gemeint, das nicht mitlaufen soll.
   */
  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator) || watchIdRef.current !== null) return
    trackingRef.current = true
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const point: [number, number] = [coords.longitude, coords.latitude]
        setPosition(point)
        if (!anchorFromGps.current) return
        setAnchor(point)
        const found = resolveZone(zonesRef.current, point)
        setSelected(found?.zone?.properties ?? null)
        setNearbyMetres(found?.metres ?? null)
      },
      (cause) => {
        // Entzogene Berechtigung: nicht weiter versuchen. Ein Aussetzer
        // (Timeout, kein Signal) heilt sich von selbst, der Watch bleibt.
        if (cause.code === cause.PERMISSION_DENIED) stopTracking(true)
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )
  }, [])

  function stopTracking(forGood: boolean): void {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = null
    if (forGood) trackingRef.current = false
  }

  useEffect(() => {
    const onVisibility = (): void => {
      if (document.hidden) stopTracking(false)
      else if (trackingRef.current) startTracking()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stopTracking(true)
    }
  }, [startTracking])

  /**
   * Der Standort für „Kontrolle melden": geholt, sobald der Knopf gedrückt
   * ist, und im Blatt als erste Wahl gezeigt — bestätigen statt suchen.
   * Nur, wenn die Frage nach dem Standort schon einmal gestellt war: Der
   * native Dialog kommt in dieser App nie ohne den eigenen Vordialog.
   * Der Anker bleibt unberührt; das Blatt bevorzugt den Standort selbst.
   */
  const positionForReport = useCallback(() => {
    if (!('geolocation' in navigator) || !locationAsked()) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        setPosition([coords.longitude, coords.latitude])
        startTracking()
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    )
  }, [startTracking])

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
        anchorFromGps.current = true
        setAnchor(point)
        setLocating(false)
        startTracking()
        const found = resolveZone(zones, point)
        const hit = found?.zone ?? null
        setSelected(hit?.properties ?? null)
        setNearbyMetres(found?.metres ?? null)
        track('locate', 'use')
        if (hit === null) track('zone.outside')
        else {
          track('zone.open', hit.properties.zone)
          track('zone.answer', zoneAnswer(hit.properties, Date.now()))
          track('zone.source', 'standort')
        }
        if (hit !== null) setAnnouncement(describeZone(hit.properties, Date.now()))
        // Die einzige Stelle, an der der Stadtvorschlag entsteht. Sie hat die
        // Position schon; ein zweiter `getCurrentPosition`-Aufruf nur für den
        // Hinweis wäre eine Berechtigungsfrage ohne Gegenwert.
        const suggestion = suggestionAt(point[0], point[1])
        setCitySuggestion(suggestion)
        // „Keine Zone getroffen" ist eine nützliche Antwort — aber sie sagt
        // etwas über die geladene Ebene, nicht über den Ort.
        //
        // Erstens: Liegt die Position in einer anderen Stadt, die diese App
        // kennt, träfe ein Satz über Gebühren gar keine Aussage. In München
        // stünde sonst „hier ist Parken gebührenfrei" über 82 bewirtschafteten
        // Gebieten — falsch, teuer, und die Meldung überdeckte ausgerechnet
        // den Hinweis, der sie erklärt.
        //
        // Zweitens, und deshalb steht hier seit dem 7. September nicht mehr
        // „gebührenfrei": **Es stimmt auch in der geladenen Stadt nicht.**
        // Nachgemessen an Berlins eigenen Daten liegen 421 Straßenabschnitte
        // mit 2.363 Stellplätzen in keinem Zonenpolygon und tragen trotzdem
        // eine Gebühr und Bewirtschaftungszeiten — bis zu 3,00 Euro je Stunde,
        // Schwerpunkte in Reinickendorf, Steglitz-Zehlendorf und
        // Tempelhof-Schöneberg. Wer dort nach diesem Satz ohne Ticket stehen
        // bleibt, zahlt. Die Zonenebene ist die Auskunft, die wir haben, und
        // nicht die Wahrheit über die Straße.
        if (hit === null && suggestion === null) {
          setError('Für diesen Ort führt die Quelle keine Parkzone — ob hier etwas kostet, sagt sie nicht.')
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
  }, [zones, startTracking])


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
    // `kontrollen`: nichts zu schalten — die Kontrolldichte liegt immer, sobald
    // sie ein Muster hat; die Verknüpfung öffnet nur das Blatt.
    if (start === 'melden' || start === 'kontrollen') track('app.open', start)
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
    // der Leser aber verwarf, speicherte eine Sitzung, die beim nächsten
    // Laden verschwand — das Auto war weg, ohne Meldung.
    if (!withinCitySession(CITY, point[0], point[1])) {
      setError(`Dieser Ort liegt außerhalb von ${CITY.name} — hier kann kein Parkplatz gemerkt werden.`)
      return
    }
    const hit = resolveZone(zones, point)?.zone ?? null
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
        : `Parkplatz gemerkt in ${zoneImDativ(hit.properties)}.`
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

  // `park.start` hängt an der Sitzung, nicht am Knopf: Der Knopf wird auch
  // gedrückt, wenn die Position fehlt und gar nichts entsteht.
  const parkGezaehlt = useRef(false)
  useEffect(() => {
    if (session === null) {
      parkGezaehlt.current = false
      return
    }
    if (parkGezaehlt.current) return
    parkGezaehlt.current = true
    track('park.start')
  }, [session])

  useEffect(() => {
    // Only the local fallback persists here; the shared store is authoritative
    // when present and writing back would fight its snapshots.
    if (!shared && sightings.length > 0) saveSightings(sightings)
  }, [shared, sightings])

  useEffect(() => {
    if (!shared && marks.length > 0) saveMarks(marks)
  }, [shared, marks])

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
    setSightings((current) => [...current, entry])
    setMarks((current) => [...current, markFor(point, entry.reportedAt, CITY.heatGrid)])

    markOwnReport(entry.id)
    const backend = backendRef.current
    if (backend === null) return
    void backend
      .report(point[0], point[1])
      .then((serverId) => {
        // Die Kennung des Servers ersetzt die lokale, sobald sie da ist. Bis
        // zur nächsten Abfrage (45 s) stand hier sonst eine Kennung, die der
        // Server nie vergeben hatte — jede Stimme darauf lief in ein 404.
        if (serverId === null || serverId === entry.id) return
        markOwnReport(serverId)
        setSightings((current) =>
          current.map((item) => (item.id === entry.id ? { ...item, id: serverId } : item)),
        )
      })
      .catch((cause: unknown) => {
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
  }, [position, anchor, markOwnReport])

  const vote = useCallback(
    (id: string, key: 'confirmations' | 'disputes') => {
      // Optimistic for the same reason as reportSighting: a shared vote that
      // waited for the snapshot looked like a dead button, and a refused one
      // looked like nothing at all.
      setSightings((list) =>
        list.map((item) => (item.id === id ? { ...item, [key]: item[key] + 1 } : item))
      )
      const kind: VoteKind = key === 'confirmations' ? 'confirm' : 'dispute'
      // Sofort gemerkt, nicht erst nach der Antwort: Die Zeile zeigt ab jetzt
      // „du: gesehen" statt zweier Knöpfe, und das bleibt über ein Neuladen.
      markVote(id, kind)
      const backend = backendRef.current
      if (backend === null) return
      const current = sightings.find((item) => item.id === id)
      if (current === undefined) return
      void backend
        .vote(current, kind)
        .then((counted) => {
          // Nicht gezählt heisst: derselbe Client hatte schon abgestimmt —
          // etwa vor einem Neuladen, bevor dieses Gerät sich Stimmen merkte.
          // Der optimistische Zähler geht zurück, die Markierung bleibt: Der
          // Server hat eine Stimme von hier, welche auch immer.
          if (counted) return
          setSightings((list) =>
            list.map((item) => (item.id === id ? { ...item, [key]: item[key] - 1 } : item))
          )
        })
        .catch((cause: unknown) => {
          setSightings((list) =>
            list.map((item) => (item.id === id ? { ...item, [key]: item[key] - 1 } : item))
          )
          markVote(id, null)
          // 403 heisst: die eigene Meldung, nur wusste dieses Gerät das nicht
          // mehr (Speicher geleert, anderer Browser auf derselben Adresse).
          // Ab jetzt weiss es das wieder, und die Knöpfe verschwinden.
          if (cause instanceof WorkerFehler && cause.status === 403) markOwnReport(id)
          setError(
            `Bewertung konnte nicht gespeichert werden: ${
              cause instanceof Error ? cause.message : 'unbekannter Fehler'
            }`,
          )
        })
    },
    [sightings, markVote, markOwnReport]
  )

  const focusZone = useCallback((zone: LoadedZone) => {
    setSelected(zone.properties)
    setNearbyMetres(null)
    track('zone.open', zone.properties.zone)
    track('zone.answer', zoneAnswer(zone.properties, Date.now()))
    track('zone.source', 'suche')
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
    anchorFromGps.current = false
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

  /**
   * Gezählt wird nur das **Einschalten**, nicht jedes Umlegen.
   *
   * Die Frage, die der Katalog beantworten soll, lautet „welche Ebenen
   * benutzt jemand" — und wer eine Ebene an- und wieder ausschaltet, hat sie
   * einmal benutzt, nicht zweimal. Ausserdem: Der Zähler steht **vor** dem
   * `setState` und nicht in dessen Aktualisierungsfunktion. Unter StrictMode
   * läuft die zweimal, und jede Zählung wäre doppelt — derselbe Grund, aus
   * dem der Persist-Effekt hier schon einmal falsch lag.
   */
  const schalteEbene = useCallback((wert: EventLayerValue, war: boolean) => {
    if (!war) track('layer.on', wert)
  }, [])

  const togglePoi = useCallback(
    (kind: PoiKind) => {
      schalteEbene(kind, visiblePoi.has(kind))
      setVisiblePoi((current) => {
        const next = new Set(current)
        if (next.has(kind)) next.delete(kind)
        else next.add(kind)
        return next
      })
    },
    [schalteEbene, visiblePoi]
  )

  /**
   * Das Blatt am Griff ziehen: nach oben eine Stufe höher, nach unten eine
   * tiefer. Drei Stufen — zu, halb, ganz — wie bei jedem Karten-Sheet auf
   * dem Handy. Nur der Griff nimmt die Geste an, nicht der Inhalt: Der
   * scrollt, und eine Geste, die mal scrollt und mal zieht, ist die
   * schlechteste von beiden.
   *
   * Ein Klick bleibt ein Klick. Erst ab 24 Pixel Weg zählt die Bewegung als
   * Wischen; darunter kommt nach `pointerup` das gewohnte `click`, und der
   * Griff schaltet wie bisher zwischen zu und halb um.
   */
  const SWIPE = 24
  const onGripPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') return
    sheetDrag.current = { y: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
    // Während der Finger zieht, folgt das Blatt sofort; der Übergang gilt
    // erst wieder beim Rasten, sonst hinkt es 220 ms hinterher.
    if (sidebarRef.current !== null) sidebarRef.current.style.transition = 'none'
  }, [])
  const onGripPointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = sheetDrag.current
      if (drag === null) return
      const dy = event.clientY - drag.y
      if (Math.abs(dy) > SWIPE) drag.moved = true
      // Das offene Blatt folgt dem Finger nach unten; nach oben gibt es
      // nichts zu zeigen, solange die nächste Stufe nicht gerastet ist.
      if (panelOpen && dy > 0 && sidebarRef.current !== null) {
        sidebarRef.current.style.transform = `translateY(${Math.round(dy)}px)`
      }
    },
    [panelOpen]
  )
  const onGripPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = sheetDrag.current
      if (drag === null) return
      sheetDrag.current = null
      if (sidebarRef.current !== null) {
        sidebarRef.current.style.transform = ''
        sidebarRef.current.style.transition = ''
      }
      const dy = event.clientY - drag.y
      // Der Tipp wird hier entschieden, nicht im `click`: Nach einem echten
      // Wischen schickt der Browser gar kein `click`, und ein Merker, der auf
      // eines wartet, hätte den nächsten Tipp verschluckt — genau das ist im
      // E2E-Test passiert. Also: Tipp hier ausführen und das `click`, das der
      // Browser unmittelbar nach einem Tipp nachschickt, am Zeitstempel
      // erkennen und verwerfen. Ein zweiter Tipp Sekunden später ist neu.
      lastGripTouch.current = event.timeStamp
      if (!drag.moved) {
        setSheetFull(false)
        setPanelOpen((value) => !value)
        return
      }
      if (dy > 0) {
        if (sheetFull) setSheetFull(false)
        else setPanelOpen(false)
      } else if (!panelOpen) {
        setPanelOpen(true)
      } else {
        setSheetFull(true)
      }
    },
    [panelOpen, sheetFull]
  )
  const onGripClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.timeStamp - lastGripTouch.current < 150) return
    setSheetFull(false)
    setPanelOpen((value) => !value)
  }, [])

  // Zugeklappt ist auch nicht mehr ganz hoch — sonst spränge das Blatt beim
  // nächsten Öffnen gleich auf die volle Höhe.
  useEffect(() => {
    if (!panelOpen) setSheetFull(false)
  }, [panelOpen])

  const activeLayerCount = visiblePoi.size + (showLowEmission ? 1 : 0)
  // Selecting another zone, or starting a session, replaces what the panel is
  // about. Keeping the old scroll position showed the sightings list while the
  // user was looking for the zone they just picked — or hid the timer they had
  // just created above it.
  useEffect(() => {
    sidebarBodyRef.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
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

  // Solange Einstellungen oder Feedback offen sind, ist der Rest der Seite
  // `inert`: kein Tab in die Karte dahinter, kein Vorlesen der Seitenleiste.
  // `aria-modal` allein sagt das nur Screenreadern, nicht der Tastatur. Das
  // Melde-Blatt bleibt ausgenommen — auf dem Desktop darf die Karte hinter
  // ihm den Anker setzen.
  const modal = settingsOpen || feedbackOpen

  return (
    <div className="app">
      <main ref={containerRef} className="map" aria-label="Karte" inert={modal || undefined} />

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

      <header className="topbar" ref={topbarRef} inert={modal || undefined}>
        {/*
          Bleibt im Dokument, verschwindet von der Karte: Eine Seite ohne
          Überschrift ist für Screenreader ein Rückschritt, und den Namen tragen
          Tab-Titel und Manifest ohnehin.
        */}
        <h1 className="visually-hidden">knoellchenfrei — {CITY.name}</h1>
        {/*
          Eine Zeile, nicht zwei. Bis zum 9. September stand unter der Suche
          eine zweite Zeile mit Beta-Marke, Zahnrad, Statuszahl und
          Standort-Knopf — 112 Pixel Kopfzeile auf einem 568 Pixel hohen
          Schirm, und der wichtigste Knopf der App sass oben rechts, wo der
          Daumen am schlechtesten hinkommt. Der Standort-Knopf schwebt jetzt
          unten rechts über dem Blatt, die Zahlen stehen bei den anderen
          Zahlen unter der Kopfzeile, und hier bleibt, was hierher gehört:
          Suche und Einstellungen.
        */}
        <div className="topbar__row">
          <SearchBox zones={zones} onPick={focusZone} />
          <button
            type="button"
            className="topbar__icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Einstellungen"
            title="Einstellungen"
          >
            <span aria-hidden="true">⚙</span>
          </button>
        </div>
        {/*
          Der Meldeknopf: oben rechts unter den Einstellungen, rot, seit dem
          9. September abends auf Wunsch des Betreibers. Er stand einen Tag
          lang unten neben dem Standort-Knopf, wo er sich die Kante mit dem
          Griff und der Quellenangabe teilte. In der Kopfzeile wächst deren
          gemessene Höhe mit, und die Chip-Zeile rückt von selbst darunter.
          Ohne angetippten Punkt bietet das Blatt Standort, Kartenmitte und
          die nächsten Zonen zur Auswahl.
        */}
        <div className="topbar__row topbar__row--actions">
          <button
            type="button"
            className="report-fab"
            onClick={() => {
              setPanelOpen(false)
              setReportViaFab(true)
              positionForReport()
              setReporting(true)
            }}
          >
            Kontrolle melden
          </button>
        </div>
        <UpdateBar />
      </header>

      {/*
        One positioned column for both map overlays. They used to be positioned
        separately and landed on top of each other on a phone, where the legend
        also sits under the topbar.
      */}
      <div className="overlay" inert={modal || undefined}>
      <LiveStats
        stats={stats}
        active={activeSightings(sightings, { now }).length}
        shared={shared}
        charging={zones.length > 0 ? { now: chargingNow, total: zones.length } : null}
      />

      {/*
        Nur, wenn es etwas zu wählen gibt: Ohne Umweltzone und ohne POI-Ebenen
        (Hamburg) stünde hier ein Knopf, der eine leere Liste aufklappt.
      */}
      {legendAvailable && (
      <section
        ref={legendRef}
        className={`legend${legendMore ? ' legend--more' : ''}`}
        aria-label="Kartenebenen"
      >
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
        {/*
          Kein Chip für die Kontrolldichte, seit dem 9. September: Sie liegt,
          sobald sie ein Muster hat, und ist nichts, was jemand abschaltet
          (Betreiber). Die Ebenen hier sind die, die man wählt.
        */}
        {ebenenMitDaten?.umweltzone === true && (
        <button
          type="button"
          className={`chip${showLowEmission ? ' chip--on' : ''}`}
          onClick={() => {
            schalteEbene('umweltzone', showLowEmission)
            setShowLowEmission((value) => !value)
          }}
          aria-pressed={showLowEmission}
        >
          <span className="chip__dot" style={{ background: '#a3e635' }} aria-hidden="true" />
          Umweltzone
        </button>
        )}
        {(Object.keys(POI_LABELS) as PoiKind[])
          .filter((kind) => ebenenMitDaten?.poi.has(kind) === true)
          .map((kind) => (
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
      )}
      </div>

      {/*
        Ein Schleier hinter den beiden Dialogen, die nichts von der Karte
        brauchen. Auf dem Handy liegt er unsichtbar hinter dem bildfüllenden
        Blatt; auf Tablet und Desktop sagt er, dass die Karte gerade nicht
        dran ist, und ein Klick darauf schließt — wie bei jedem Dialog.
      */}
      {modal && (
        <div
          className="scrim"
          onClick={() => {
            setSettingsOpen(false)
            setFeedbackOpen(false)
          }}
        />
      )}

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
          geprueftAm={meta.geprueftAm}
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

      {/*
        Erst nach dem Vordialog möglich und deshalb nie zugleich mit ihm: Der
        Vorschlag entsteht aus dem Standort, den `locate()` liefert, und
        `locate()` läuft erst, wenn der Vordialog beantwortet ist. Dieselbe
        Zurückhaltung gegenüber den Sheets wie dort — auf dem Desktop liegt das
        Melde-Sheet als Panel in der Mitte, und ein anklickbarer Hinweis neben
        einem `aria-modal`-Dialog gehört nicht dorthin.
      */}
      {citySuggestion !== null && !reporting && !settingsOpen && !feedbackOpen && (
        <CitySuggestion
          city={citySuggestion}
          current={CITY}
          onSwitch={() => {
            // `trackNow` und nicht `track`: `switchCity` lädt gleich neu, ein
            // gepuffertes Ereignis wäre damit weg.
            trackNow('city.suggest', 'accept')
            switchCity(citySuggestion)
          }}
          onStay={() => {
            track('city.suggest', 'decline')
            // Je Stadt gemerkt, nicht als „nie wieder": Wer in München bleibt,
            // soll in Hamburg trotzdem gefragt werden.
            rememberSuggestionDismissed(citySuggestion.key)
            setCitySuggestion(null)
          }}
        />
      )}

      {feedbackOpen && feedback !== null && (
        <FeedbackSheet
          onSend={async (kind, text) => {
            await feedback.send(kind, text)
            // Erst nach dem Senden: Ein Entwurf, der nie ankommt, ist keine
            // Rückmeldung.
            track('feedback', 'send')
          }}
          onClose={() => setFeedbackOpen(false)}
        />
      )}

      {reporting && (
        <ReportSheet
          zones={zones}
          anchor={anchor}
          position={position}
          locating={locating}
          preferGps={reportViaFab}
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
        className={`sidebar${panelOpen ? '' : ' sidebar--collapsed'}${
          panelOpen && sheetFull ? ' sidebar--full' : ''
        }`}
        inert={modal || undefined}
      >
        <button
          type="button"
          className={`panel-toggle${
            session?.remindAt != null && now >= session.remindAt ? ' panel-toggle--alert' : ''
          }`}
          onClick={onGripClick}
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerEnd}
          onPointerCancel={onGripPointerEnd}
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
                : selected === null || status === null
                  ? 'Details einblenden'
                  : // Die Antwort selbst, nicht der Weg dorthin: Zone, Status
                    // und Betrag stehen im Griff, damit sie ohne Aufklappen
                    // lesbar sind. Dieselben Wörter wie im Panel, aus
                    // `zone-label.ts` und `format.ts`; der Betrag nur, wenn
                    // die Quelle einen nennt — „0,00 €" wäre bei Parkscheibe
                    // die falsche Auskunft.
                    [
                      zoneKurz(selected),
                      statusLabel(status),
                      ...(status.chargeable && status.hourly.priced
                        ? [`${costLabel(status.hourly)}/Std.`]
                        : []),
                    ].join(' · ')}
          </span>
        </button>

        <div id="sidebar-body" ref={sidebarBodyRef} className="sidebar__body" hidden={!panelOpen}>
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
            nearbyMetres={nearbyMetres}
            now={now}
            onPark={park}
            parked={session !== null}
          />
        ) : anchor !== null ? (
          // Nur noch der Fall „angetippt, aber ausserhalb". Der Abschnitt „Wo
          // stehst du?" mit der Farberklärung ist am 9. September auf Wunsch
          // des Betreibers entfallen: Ohne Tipp steht im Blatt jetzt gleich
          // das, was jemand tun kann — melden, Sichtungen, Kontrolldichte.
          <section className="panel">
            <h2 className="panel__title">Außerhalb der Parkzonen</h2>
            <p className="hours">
              Für diesen Ort führt die Quelle keine Parkzone. Das heißt nicht sicher, dass Parken frei
              ist: Es gibt Straßen mit Gebühr, die in keiner Zone liegen. Was gilt, steht am Automaten
              oder am Schild.
            </p>
            {/* Parking outside a zone is the common case in most of Berlin, so
                the button belongs here too, not only in the zone panel. */}
            <button type="button" className="button button--primary button--block" onClick={park}>
              {session === null ? 'Hier geparkt' : 'Parkplatz hierher verschieben'}
            </button>
          </section>
        ) : null}

        <SightingPanel
          sightings={sightings}
          now={now}
          onReport={() => {
            // Auf dem Handy deckt das Panel die untere Kartenhälfte ab. Wer
            // im Sheet auf "Karte" ausweichen will, braucht sie frei.
            setPanelOpen(false)
            setReportViaFab(false)
            setReporting(true)
          }}
          onConfirm={(id) => vote(id, 'confirmations')}
          onDispute={(id) => vote(id, 'disputes')}
          own={(id) => id in own.reports}
          voted={(id) => own.votes[id]?.kind ?? null}
          canReport={position !== null || anchor !== null}
          shared={shared}
        />

        <HeatPanel
          top={heatTop}
          heat={heat}
          activity={activity}
          weekday={berlinNow.weekday}
          hour={Math.floor(berlinNow.minuteOfDay / 60)}
          shared={shared}
        />

        {/*
          Hinter den Sichtungen und der Kontrolldichte, seit dem 9. September:
          „Auto weg?" ist der seltene Fall und stand zugeklappt vor dem
          Abschnitt, um den es im Alltag geht.
        */}
        <TowInfo />

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

      {/*
        Unten rechts, über dem Blatt: Dort ist der Daumen, und dort hat jede
        Karten-App ihren Standort-Knopf. Nach dem Blatt im Baum, damit er in
        der Tab-Reihenfolge hinter dessen Inhalt kommt und das volle Blatt
        ihn per CSS verdecken kann — dann gibt es keine Karte, auf die er
        zeigen könnte.
      */}
      <button
        type="button"
        className="locate"
        onClick={locate}
        disabled={locating}
        aria-label="Wo bin ich?"
        title="Wo bin ich?"
        inert={modal || undefined}
      >
        <span aria-hidden="true">{locating ? '…' : '◎'}</span>
      </button>
    </div>
  )
}
