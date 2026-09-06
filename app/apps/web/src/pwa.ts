/**
 * Alles, was aus der Seite eine Anwendung auf dem Homescreen macht.
 *
 * Zwei getrennte Dinge stecken hier drin, weil beide vom selben frühen Moment
 * abhängen:
 *
 * 1. **Installieren.** Chrome und Edge feuern `beforeinstallprompt` genau
 *    einmal, kurz nach dem Laden, und verwerfen das Ereignis, wenn niemand es
 *    abfängt. Wer erst beim Öffnen der Einstellungen zuhört, hat es verpasst —
 *    darum lauscht dieses Modul beim Import, nicht beim Rendern.
 * 2. **Aktualisieren.** Ein Service Worker, der sich selbst sofort aktiviert,
 *    zieht der laufenden Seite die Dateien unter den Füßen weg: Ein
 *    nachgeladenes Bündel, das es in der neuen Version nicht mehr gibt, führt zu
 *    einer weißen Seite. Der neue Worker wartet deshalb, bis jemand zustimmt.
 */

export type InstallState =
  /** Läuft bereits als abgelegte App — dann gibt es nichts anzubieten. */
  | { kind: 'installed' }
  /** Der Browser hat ein Angebot hinterlegt; ein Klick öffnet den Dialog. */
  | { kind: 'prompt' }
  /** iOS kennt keinen Dialog. Bleibt die Anleitung über das Teilen-Menü. */
  | { kind: 'ios' }
  /** Kein Weg bekannt: anderer Browser, oder das Angebot kam nie. */
  | { kind: 'none' }

/**
 * `beforeinstallprompt` steht in keiner Lib-Definition, weil es nicht in der
 * Standardreihe ist. Nur das, was hier wirklich benutzt wird.
 */
type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallEvent | null = null
let state: InstallState = { kind: 'none' }
const listeners = new Set<(state: InstallState) => void>()

function announce(next: InstallState): void {
  state = next
  for (const listener of listeners) listener(next)
}

/** Läuft die Seite als abgelegte App und nicht im Browser-Tab? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const media = window.matchMedia('(display-mode: standalone)').matches
  // Safari kennt `display-mode` auf dem iPhone nicht und setzt stattdessen
  // dieses seit Jahren nicht standardisierte Merkmal.
  const legacy = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return media || legacy
}

/**
 * Apples Geräte melden sich seit iPadOS 13 als Macintosh. Der Zusatz mit den
 * Berührungspunkten fängt genau diesen Fall — ein echter Mac meldet null.
 */
function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
}

export function installState(): InstallState {
  return state
}

export function watchInstall(listener: (state: InstallState) => void): () => void {
  listeners.add(listener)
  listener(state)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Öffnet den Installationsdialog des Browsers. Das Angebot gilt nur einmal:
 * Nach einer Absage muss der Browser ein neues schicken, und das tut er
 * frühestens beim nächsten Besuch.
 */
export async function install(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
  const event = deferred
  if (event === null) return 'unsupported'
  deferred = null
  await event.prompt()
  const { outcome } = await event.userChoice
  announce(outcome === 'accepted' ? { kind: 'installed' } : { kind: 'none' })
  return outcome
}

/** Beim Import ausgeführt, nicht beim Rendern — siehe Kopfkommentar. */
export function startInstallWatch(): void {
  if (typeof window === 'undefined') return
  if (isStandalone()) {
    announce({ kind: 'installed' })
    return
  }
  if (isIos()) announce({ kind: 'ios' })

  window.addEventListener('beforeinstallprompt', (event) => {
    // Ohne das zeigt Chrome seinen eigenen Balken und verbraucht das Angebot.
    event.preventDefault()
    deferred = event as InstallEvent
    announce({ kind: 'prompt' })
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    announce({ kind: 'installed' })
  })
}

/* ------------------------------------------------------------- Aktualisieren */

let waiting: ServiceWorker | null = null
const updateListeners = new Set<(ready: boolean) => void>()

export function watchUpdate(listener: (ready: boolean) => void): () => void {
  updateListeners.add(listener)
  listener(waiting !== null)
  return () => {
    updateListeners.delete(listener)
  }
}

function announceUpdate(worker: ServiceWorker | null): void {
  waiting = worker
  for (const listener of updateListeners) listener(worker !== null)
}

/** Übernimmt die wartende Version und lädt neu, sobald sie das Ruder hat. */
export function applyUpdate(): void {
  const worker = waiting
  if (worker === null) return
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      window.location.reload()
    },
    { once: true },
  )
  worker.postMessage({ type: 'skip-waiting' })
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        if (registration.waiting !== null) announceUpdate(registration.waiting)
        registration.addEventListener('updatefound', () => {
          const next = registration.installing
          if (next === null) return
          next.addEventListener('statechange', () => {
            // `controller` ist null, wenn dieser Worker der erste überhaupt ist —
            // dann ist das keine Aktualisierung, sondern die Erstinstallation.
            if (next.state === 'installed' && navigator.serviceWorker.controller !== null) {
              announceUpdate(next)
            }
          })
        })
      })
      .catch(() => {
        /* Offline-Betrieb ist eine Zugabe, keine Bedingung. */
      })
  })
}
