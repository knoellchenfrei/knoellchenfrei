/**
 * Der Riegel vor der geschlossenen Beta.
 *
 * Warum es ihn gibt, ist **rechtlich**, nicht technisch: Die App liegt unter
 * einer öffentlichen Adresse, ohne Impressum und ohne Datenschutzerklärung —
 * beides geht heute nur mit der Privatanschrift des Betreibers, und genau das
 * soll der Beta-Riegel verhindern. `noindex` hält Suchmaschinen ab, keine
 * Menschen. Erst ein echter Zugangsriegel macht aus einem öffentlichen Angebot
 * einen geschlossenen Test.
 *
 * Warum die Logik **hier** steht und nicht in der Pages-Funktion: Sie zerlegt
 * fremde Eingaben — einen `Cookie`-Header und ein Token, beides vom Client
 * geschrieben und beides beliebig manipulierbar. Solcher Code gehört nach
 * `core`, wo ihn `beta-gate.test.ts` mit Unfug beschießen kann. Die
 * Pages-Funktion darüber trifft nur noch Entscheidungen.
 *
 * Was dieser Riegel **nicht** ist: ein Nutzerverzeichnis. Ein Passwort für
 * alle, kein Konto, kein Name, kein Protokoll darüber, wer wann eingetreten
 * ist — für eine Handvoll Testleser ist das die ehrliche Größe, und es
 * entsteht dabei kein einziges personenbezogenes Datum, das die
 * Datenschutzerklärung erklären müsste.
 *
 * Warum ein signiertes Token und nicht das Passwort im Cookie: Ein Cookie ist
 * eine Datei auf einem fremden Rechner. Läge das Passwort darin, wanderte es
 * bei jedem Bild, jeder Kachel und jedem Datensatz erneut über die Leitung und
 * stünde in jedem Browser-Profil im Klartext. Das Token beweist stattdessen
 * nur, dass der Server es einmal ausgestellt hat — und es verfällt.
 */

/**
 * Name des Cookies.
 *
 * Ohne Punkt und ohne Doppelpunkt, anders als die `localStorage`-Schlüssel der
 * App (`knoellchenfrei:city`): Cookie-Namen sind ein `token` nach RFC 6265, und
 * `:` ist dort ein Trennzeichen. Ein Name mit Doppelpunkt wird von manchen
 * Zwischenstationen still verworfen — der Riegel fiele dann zu, obwohl das
 * Passwort stimmte.
 */
export const BETA_COOKIE = 'knoellchenfrei_beta'

/**
 * Wie lange ein Zutritt gilt: 30 Tage.
 *
 * Lang genug, dass ein Testleser das Passwort einmal eingibt und danach in
 * Ruhe gelassen wird; kurz genug, dass ein vergessenes Gerät nicht für immer
 * hineinkommt. Das Ablaufdatum steht **im signierten Teil** des Tokens, nicht
 * nur in der `Max-Age`-Angabe des Cookies: Die kann der Client ändern, das
 * Token nicht.
 */
export const BETA_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Obergrenze für alles, was von außen kommt.
 *
 * Dieselbe Haltung wie in den Feed-Parsern: Fremde Eingabe wird zuerst
 * begrenzt, dann gelesen. Ein `Cookie`-Header darf laut RFC beliebig lang
 * sein; 8 KB ist mehr, als jeder Browser sendet, und wenig genug, dass das
 * Zerlegen nie messbar Zeit kostet.
 */
const MAX_COOKIE_HEADER = 8192

/** Ein Token ist `<Ablauf in ms>.<64 Hex-Zeichen>` — alles darüber ist keins. */
const MAX_TOKEN_LENGTH = 128

const encoder = new TextEncoder()

function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return hex
}

/**
 * HMAC-SHA256 über `message`, mit `secret` als Schlüssel.
 *
 * `crypto.subtle` ist in Workers, in Browsern und seit Node 18 global — das
 * ist der Grund, warum diese Datei ohne Abhängigkeit auskommt und `core`
 * abhängigkeitsfrei bleibt.
 */
async function hmac(secret: string, message: string): Promise<string> {
  // Ohne diese Zeile stirbt `importKey` an einem Schlüssel der Länge 0 — mit
  // einem blanken `OperationError`, der nichts über die Ursache sagt. Genau
  // dieser Fall ist aber der wahrscheinlichste Betriebsfehler: Das Secret ist
  // im Deployment nicht gesetzt. Er gehört benannt, nicht kryptisch.
  if (secret === '') throw new Error('Kein Beta-Passwort gesetzt — der Riegel kann nicht signieren')
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return toHex(new Uint8Array(signature))
}

/**
 * Vergleicht zwei Zeichenketten ohne früh abzubrechen.
 *
 * Ein `===` auf Zeichenketten hört beim ersten Unterschied auf. Wer viele
 * Versuche schickt und die Antwortzeit misst, kann daraus Zeichen für Zeichen
 * ein Geheimnis erraten. Diese Schleife läuft immer über die ganze Länge.
 *
 * **Was sie nicht verbirgt: die Länge.** Bei ungleicher Länge steht das
 * Ergebnis sofort fest. Das ist hier vertretbar — das Passwort ist zufällig
 * erzeugt, und aus seiner Länge folgt nichts über seinen Inhalt. Es zu
 * verbergen hieße, über die längere der beiden Eingaben zu laufen, und damit
 * dürfte ein Angreifer mit einer sehr langen Eingabe Rechenzeit bestellen.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= (left[index] as number) ^ (right[index] as number)
  }
  return diff === 0
}

/**
 * Stellt ein Token aus, das bis `expiresAt` gilt.
 *
 * Das Ablaufdatum steht im Klartext **und** unter der Signatur. Wer es
 * hochsetzt, ändert die Nachricht und damit den HMAC — `verifyBetaToken`
 * rechnet neu und weist es ab.
 */
export async function signBetaToken(secret: string, expiresAt: number): Promise<string> {
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    throw new Error(`Kein gültiger Ablaufzeitpunkt: ${expiresAt}`)
  }
  return `${expiresAt}.${await hmac(secret, String(expiresAt))}`
}

/**
 * Prüft ein Token gegen das Geheimnis und die Uhr.
 *
 * Gibt `false` zurück, statt zu werfen: Ein kaputtes Token ist der Normalfall
 * — abgelaufen, von Hand editiert, aus einer Zeit vor einem Passwortwechsel —
 * und keiner davon ist ein Programmfehler. Ein leeres Geheimnis gilt
 * ausdrücklich als „nie gültig"; ohne diese Zeile würde ein Deployment ohne
 * gesetztes Passwort jedes Token akzeptieren, das gegen den leeren Schlüssel
 * signiert wurde.
 */
export async function verifyBetaToken(
  secret: string,
  token: string | null | undefined,
  now: number
): Promise<boolean> {
  if (secret === '' || token === null || token === undefined) return false
  if (token.length > MAX_TOKEN_LENGTH) return false

  const separator = token.indexOf('.')
  if (separator <= 0) return false

  const expiryPart = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  // Nur Ziffern: `Number('12e9')` und `Number(' 12')` ergäben sonst eine Zahl,
  // die nie signiert wurde — und der HMAC liefe über eine andere Schreibweise
  // desselben Werts.
  if (!/^\d{1,15}$/.test(expiryPart)) return false

  const expiresAt = Number(expiryPart)
  if (!Number.isFinite(now) || expiresAt <= now) return false

  return constantTimeEqual(signature, await hmac(secret, expiryPart))
}

/**
 * Liest einen Wert aus einem `Cookie`-Header.
 *
 * Vollständig defensiv, weil der Header aus fremder Hand kommt: Der Name wird
 * exakt verglichen (ein `xknoellchenfrei_beta` darf nicht passen), der Wert
 * darf `=` enthalten (Base64 und unser Token tun das nicht, aber ein
 * Nachbarcookie schon), und bei mehreren gleichnamigen Einträgen gewinnt der
 * erste — genau wie im Browser.
 *
 * `null` heißt „nicht da", nicht „leer": Ein Cookie mit leerem Wert ist ein
 * gelöschtes Cookie, und das ist dasselbe wie keins.
 */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (header === null || header === undefined) return null
  if (header.length > MAX_COOKIE_HEADER) return null

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator).trim() !== name) continue
    const value = part.slice(separator + 1).trim()
    return value === '' ? null : value
  }
  return null
}
