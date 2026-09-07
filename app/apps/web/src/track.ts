import { EVENTS, type EventName } from '@knoellchenfrei/core'

/**
 * Die Nutzungsstatistik — ein Zählwerk, das nichts über einzelne Leute weiß.
 *
 * Was hier hinausgeht, ist eine Liste von Paaren aus Ereignisname und
 * Ausprägung, dazu die geladene Stadt. **Kein Zeitstempel** — den setzt der
 * Server, sonst wäre er rückdatierbar. **Keine Kennung, keine Sitzung, keine
 * Reihenfolge**: Die Ereignisse werden vor dem Senden zusammengezählt, aus
 * „geöffnet, Zone 34 angesehen, geöffnet" wird `app.open: 2` und
 * `zone.open/34: 1`. Was in welcher Reihenfolge passiert ist, verlässt das
 * Gerät nicht.
 *
 * ## Drei Gründe, aus denen gar nichts gesendet wird
 *
 * 1. **Kein `VITE_API_BASE`.** Lokal, in der Testsuite und im Artifact ist
 *    jeder Aufruf ein No-op, ohne dass ein Aufrufer das wissen muss.
 * 2. **Es wurde widersprochen.** Rechtsgrundlage ist das berechtigte
 *    Interesse, und dazu gehört Art. 21 DSGVO. Der Schalter steht in den
 *    Einstellungen.
 * 3. **`navigator.globalPrivacyControl`.** Wer sein Gerät auf „nicht
 *    verfolgen" gestellt hat, hat die Frage schon beantwortet.
 *
 * ## Der Puffer liegt im Speicher, nicht auf dem Gerät
 *
 * Ihn in `localStorage` zu halten wäre bequem — und wäre ein Sitzungsverlauf
 * auf fremdem Gerät, also genau das, was diese Statistik nicht sein soll. Wer
 * die Seite schließt, bevor der Puffer geleert ist, hinterlässt nichts. Der
 * Preis sind ein paar verlorene Zählungen; der Gegenwert ist, dass die
 * Nicht-Liste stimmt.
 */

/** Alle fünf Minuten, nicht alle dreißig Sekunden. */
const FLUSH_MS = 5 * 60_000

const API_BASE = ((): string | undefined => {
  const roh = import.meta.env.VITE_API_BASE as string | undefined
  return typeof roh === 'string' && roh.length > 0 ? roh.replace(/\/+$/, '') : undefined
})()

/**
 * Die geladene Stadt — hereingereicht, nicht importiert.
 *
 * `city.ts` ruft `trackNow` beim Städtewechsel auf. Würde diese Datei
 * umgekehrt `CITY` importieren, entstünde ein Kreis: Zwei Module, die einander
 * beim Laden brauchen, und der Wert, der zuerst gelesen wird, ist dann
 * `undefined` — je nach Reihenfolge, die der Bündler wählt. Ein Kreis, der
 * heute funktioniert, ist einer, der beim nächsten Bündler-Update kippt.
 */
let stadt = ''

export function setTrackCity(key: string): void {
  stadt = key
}

/** Der eine Schlüssel im Gerätespeicher, und er hält genau ein „nein". */
const OPT_OUT_KEY = 'knoellchenfrei.statistik.aus.v1'

/**
 * Jeder Zugriff ist gekapselt: `localStorage` wirft in eingebetteten
 * Zusammenhängen schon beim Lesen, und eine Statistik ist es nicht wert, die
 * Anzeige mitzunehmen.
 */
export function statistikAus(): boolean {
  try {
    if ((navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return true
    return localStorage.getItem(OPT_OUT_KEY) === '1'
  } catch {
    return false
  }
}

export function setStatistikAus(aus: boolean): void {
  try {
    if (aus) localStorage.setItem(OPT_OUT_KEY, '1')
    else localStorage.removeItem(OPT_OUT_KEY)
  } catch {
    // Kein Speicher, kein Widerspruch zu merken — dann bleibt es beim
    // Voreingestellten. Ein Fehler hier darf nichts anhalten.
  }
}

/** Name und Ausprägung zusammengezählt, nie als Folge. */
const puffer = new Map<string, { name: EventName; value: string; n: number }>()
let timer: number | undefined
let angemeldet = false

function flush(): void {
  if (puffer.size === 0 || API_BASE === undefined || stadt === '') return
  const events = [...puffer.values()]
  puffer.clear()
  // Der Puffer wird **vor** dem Senden geleert. Ein Fehlschlag darf nicht dazu
  // führen, dass dieselben Zählungen beim nächsten Versuch noch einmal
  // hinausgehen — eine doppelte Zahl ist schlechter als eine fehlende.
  //
  // `keepalive: true` und nicht `sendBeacon`: Ein Beacon mit JSON-Körper löst
  // einen Vorabruf aus, der beim Entladen unzuverlässig ist, und eines mit
  // `text/plain` bekäme vom Worker ein `415`. Mit `keepalive` überlebt die
  // Anfrage das Schliessen des Tabs **und** den Neuaufbau beim Städtewechsel.
  //
  // Und nicht `send()` aus `sighting-backend.ts`, obwohl das der Weg für jede
  // andere Schreibstelle ist: Dort wird bei `!ok` geworfen, damit die
  // Oberfläche eine optimistische Anzeige zurücknehmen kann. Hier gibt es
  // nichts zurückzunehmen — eine verlorene Zählung ist kein Ereignis für
  // jemanden, der gerade parkt.
  void fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city: stadt, events }),
    keepalive: true,
  }).catch(() => {
    // Absichtlich still. Eine Statistik, die sich in der Konsole beschwert,
    // verdeckt die Meldungen, auf die es ankommt.
  })
}

/**
 * Zählt und schickt sofort — für den einen Fall, in dem gleich neu geladen
 * wird.
 *
 * `switchCity` ruft `location.reload()`. Ein gepuffertes Ereignis wäre damit
 * weg, und ausgerechnet der Städtewechsel ist eine der Zahlen, um die es geht.
 */
export function trackNow(name: EventName, value = ''): void {
  track(name, value)
  flush()
}

function planen(): void {
  if (typeof window === 'undefined') return
  if (timer === undefined) timer = window.setInterval(flush, FLUSH_MS)
  if (angemeldet) return
  angemeldet = true
  // `visibilitychange` und nicht `beforeunload`: Auf einem Handy wird eine
  // Seite oft gar nicht entladen, sondern nur weggeschoben.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}

/**
 * Zählt ein Ereignis. Wirft nie.
 *
 * Ein unbekannter Name wird verworfen und gemeldet — ein Tippfehler erzeugte
 * sonst stillschweigend eine Dimension, die 90 Tage bleibt. Die eigentliche
 * Grenze zieht der Server; das hier ist die Bequemlichkeit, die den Fehler
 * beim Schreiben zeigt statt in der Auswertung.
 */
export function track(name: EventName, value = ''): void {
  try {
    if (API_BASE === undefined || statistikAus()) return
    if (!Object.prototype.hasOwnProperty.call(EVENTS, name)) {
      console.warn(`track: unbekanntes Ereignis "${String(name)}" — verworfen`)
      return
    }
    const key = `${name} ${value}`
    const vorhanden = puffer.get(key)
    if (vorhanden === undefined) puffer.set(key, { name, value, n: 1 })
    else vorhanden.n += 1
    planen()
  } catch {
    // Siehe oben: nichts hier ist es wert, eine Anzeige mitzunehmen.
  }
}
