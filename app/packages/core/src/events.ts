/**
 * Der Katalog der Ereignisse, die die Nutzungsstatistik zählt.
 *
 * Warum das hier steht und nicht im Worker oder in der Web-App: Es zerlegt
 * fremde Eingaben. Der Worker bekommt Ereignisse über eine offene Adresse und
 * darf der Liste im Client nicht glauben — die ist eine Bequemlichkeit, keine
 * Grenze. Und der Client soll dieselbe Liste kennen, damit ein Tippfehler beim
 * Aufrufen sofort auffällt statt eine Dimension zu erzeugen, die 90 Tage
 * bleibt.
 *
 * ## Die eine Regel, auf der alles beruht: Ort **oder** Zeit, nie beides
 *
 * Ein Zählwerk ist nicht durch seine Bauart anonym, sondern durch seine
 * Zahlen. Eine Zeile `(Tag, Stunde, Stadt, zone.open, Volkartstraße, 1)` ist
 * bei zweistelliger Leserzahl ein Einzelereignis mit Ort und Zeit — und sie
 * stünde neben `sightings` und `marks` in derselben Datenbank, wo sie sich
 * über Stadt und Stunde verketten liesse.
 *
 * Deshalb trägt jedes Ereignis eine **Auflösung**:
 *
 * - `'ort'`  — die Ausprägung sagt etwas über den Ort. Die Stunde entfällt
 *   (`hour = -1`), es zählt nur der Tag.
 * - `'zeit'` — die Ausprägung sagt nichts über den Ort. Dann ist die Stunde
 *   erlaubt, und der Tagesgang ist die interessante Zahl.
 *
 * Nachgemessen, warum das keine Vorsicht auf Vorrat ist: Münchens kleinste
 * Zone hat **58 Stellplätze** und heisst `Volkartstraße` — ein Ort auf
 * 200 Meter, keine Fläche mit tausend Autos.
 *
 * Die Auflösung leitet **der Server** aus dem Namen ab. Käme sie vom Client,
 * wäre sie eine Behauptung.
 */

/** Woher die Stunde kommt — oder ob sie entfällt. */
export type EventResolution = 'ort' | 'zeit'

/**
 * Was als Ausprägung erlaubt ist.
 *
 * `'zone'` und `'city'` sind Verweise: Die eine Liste steht in
 * `zone-keys.generated.ts` und wird aus den ausgelieferten Daten erzeugt, die
 * andere in `city.ts`. Sie hier abzuschreiben hiesse, sie zweimal zu pflegen.
 */
export type EventValues = readonly string[] | 'zone' | 'city'

export interface EventSpec {
  readonly hour: EventResolution
  readonly values: EventValues
}

/**
 * Was gezählt wird — und was ausdrücklich nicht.
 *
 * Nicht dabei, jeweils mit Grund:
 *
 * - **Bildschirmgröße, `standalone`** — das ist das Auslesen einer Eigenschaft
 *   des Endgeräts (§ 25 TDDDG) und Fingerprinting-Gelände. Wer „kein
 *   Gerätemerkmal" verspricht, darf keins erheben.
 * - **Meldungen und Stimmen** — die stehen schon in `marks` und `votes`. Ein
 *   zweites Zählwerk daneben wäre eine zweite Wahrheit.
 * - **Fehler, Offline-Fälle** — Betriebsüberwachung, nicht Nutzung. Und ein
 *   Offline-Ereignis zählt sich selbst weg: Es entsteht genau dann, wenn
 *   nichts gesendet werden kann, und es zu puffern hiesse, einen
 *   Sitzungsverlauf auf dem Gerät abzulegen.
 * - **Abgelehnte Standortfreigaben, Installationsangebote** — die Verweigerung
 *   einer Einwilligung zu zählen ist der falsche Ton, und ein Browser-Ereignis
 *   ist keine Handlung.
 */
export const EVENTS = {
  /** Öffnung der App. `''` normal, sonst der Kurzbefehl aus `?start=`. */
  'app.open': { hour: 'zeit', values: ['', 'melden', 'kontrollen'] },
  /** **Die Kernfrage: wo.** Ausprägung ist die Zonenkennung, deshalb ohne Stunde. */
  'zone.open': { hour: 'ort', values: 'zone' },
  /** Was die App gesagt hat, als sie gefragt wurde. Ohne Ort, also mit Stunde. */
  'zone.answer': { hour: 'zeit', values: ['frei', 'pflichtig', 'unsicher', 'quelldefekt'] },
  /** Wie jemand zu einer Zone kam. */
  'zone.source': { hour: 'zeit', values: ['karte', 'standort', 'suche'] },
  /** Ein Tipp ausserhalb jeder Zone — in Berlin die Mehrheit der Fläche. */
  'zone.outside': { hour: 'zeit', values: [''] },
  /** Die Parkuhr wurde gestartet. */
  'park.start': { hour: 'zeit', values: [''] },
  /** Eine Ebene wurde eingeschaltet. */
  'layer.on': { hour: 'zeit', values: ['heat', 'umweltzone', 'charging', 'carsharing', 'park_and_ride', 'accessible'] },
  /** Wechsel in eine andere Stadt. Die Zielstadt ist ein Ort, also ohne Stunde. */
  'city.switch': { hour: 'ort', values: 'city' },
  /** Der Vorschlag „du bist in München" — angenommen oder abgelehnt. */
  'city.suggest': { hour: 'zeit', values: ['accept', 'decline'] },
  /** Der Standort wurde freigegeben. Nur das, nicht die Ablehnung. */
  locate: { hour: 'zeit', values: ['use'] },
  /** Eine Rückmeldung wurde wirklich abgeschickt. */
  feedback: { hour: 'zeit', values: ['send'] },
  /** „Auto weg?" wurde aufgeklappt. */
  'tow.open': { hour: 'zeit', values: [''] },
} as const satisfies Record<string, EventSpec>

export type EventName = keyof typeof EVENTS

export const EVENT_NAMES = Object.keys(EVENTS) as readonly EventName[]

/** Obergrenze je Ereignis in einer Anfrage. */
export const EVENT_MAX_COUNT = 50
/** Obergrenze für die Zahl der Ereignisse in einer Anfrage. */
export const EVENTS_PER_REQUEST = 25

export function isEventName(value: unknown): value is EventName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EVENTS, value)
}

/**
 * Die Stunde, die ein Ereignis bekommt — oder `-1`.
 *
 * `-1` heisst „über den ganzen Tag" und ist kein Fehlwert: Er steht im
 * Primärschlüssel und wird beim Lesen ausdrücklich gefiltert. Eine Abfrage
 * `GROUP BY hour` ohne `hour >= 0` bekäme sonst einen 25. Balken.
 */
export function hourFor(name: EventName, berlinHour: number): number {
  return EVENTS[name].hour === 'ort' ? -1 : berlinHour
}

/**
 * Klammert die Anzahl eines Ereignisses.
 *
 * Ohne das ist eine einzelne Anfrage eine Million Öffnungen. `NaN`,
 * `Infinity` und alles Nicht-Numerische werden zu 1 — ein Ereignis, das
 * ankommt, ist mindestens eines.
 */
export function clampEventCount(value: unknown): number {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number) || number < 1) return 1
  return Math.min(EVENT_MAX_COUNT, number)
}

/**
 * Prüft eine Ausprägung gegen den Katalog.
 *
 * Die beiden Verweise bekommt der Aufrufer herein, statt dass diese Datei sie
 * importiert: `zone-keys.generated.ts` ist erzeugt und soll nicht in jedem
 * Bündel liegen, das nur den Katalog braucht.
 */
export function isEventValue(
  name: EventName,
  value: unknown,
  lists: { zones: readonly string[]; cities: readonly string[] },
): boolean {
  if (typeof value !== 'string') return false
  const allowed = EVENTS[name].values
  if (allowed === 'zone') return lists.zones.includes(value)
  if (allowed === 'city') return lists.cities.includes(value)
  return (allowed as readonly string[]).includes(value)
}
