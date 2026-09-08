/**
 * Der Riegel vor der geschlossenen Beta — als Cloudflare-Pages-Funktion.
 *
 * Eine Datei namens `_middleware` im Wurzelverzeichnis von `functions/` läuft
 * bei **jeder** Anfrage an das Pages-Projekt, bevor `next()` die statische
 * Datei aus `dist` holt. Genau darauf beruht der Riegel: Wer nicht angemeldet
 * ist, bekommt nie das Bündel, nie die Zonendaten, nie das Manifest — er
 * bekommt eine Seite mit einem Formular.
 *
 * Warum das die richtige Ebene ist und ein Login in der App die falsche wäre:
 * Die App ist statisch. Ein React-Dialog könnte höchstens die Anzeige
 * verhindern; `assets/index-*.js` und `data/berlin/zones.geojson` lägen
 * weiterhin offen, und rechtlich wäre das Angebot weiter öffentlich. Der
 * Riegel muss also **vor** die Auslieferung, nicht dahinter.
 *
 * Die Prüf- und Zerlegelogik steht in `@knoellchenfrei/core` (`beta-gate.ts`)
 * und wird dort mit Unfug beschossen. Hier stehen nur die Entscheidungen.
 *
 * Zwei Wege hinein, beide enden im selben Cookie:
 *
 *  1. **Formular.** Der Hauptweg. Passwort einmal eingeben, 30 Tage Ruhe.
 *  2. **Einladungslink** `?invite=<passwort>`. Für Telegram: ein Klick statt
 *     einer Anleitung. Die Adresse wird sofort danach bereinigt, damit das
 *     Passwort nicht in jeder weiteren Anfrage steht — im Verlauf des Browsers
 *     bleibt es trotzdem, deshalb ist das die Bequemlichkeit und nicht der
 *     Hauptweg.
 *
 * Was der Riegel **nicht** schützt, damit niemand mehr hineinliest, als
 * dasteht: den API-Worker unter seiner eigenen Adresse und das Kachelarchiv.
 * Beide tragen keine personenbezogenen Daten und haben eigene Grenzen
 * (Rate-Limits, `ALLOWED_ORIGINS`) — aber sie liegen nicht hinter diesem
 * Formular.
 */

import {
  BETA_COOKIE,
  BETA_TOKEN_TTL_MS,
  constantTimeEqual,
  readCookie,
  sameOriginPath,
  signBetaToken,
  verifyBetaToken,
} from '@knoellchenfrei/core'

import { loginPage, unconfiguredPage, type LoginNotice } from './login-page'

interface Env {
  /** Das gemeinsame Passwort. Fehlt es, bleibt der Riegel zu. */
  BETA_PASSWORD?: string
}

/**
 * Der Ausschnitt der Pages-Laufzeit, den diese Datei benutzt.
 *
 * Von Hand geschrieben statt `@cloudflare/workers-types` zu installieren: Es
 * sind drei Felder, das Web-Paket bekäme sonst eine Abhängigkeit für eine
 * einzige Datei, und `Request`/`Response` stehen ohnehin schon in `lib.DOM`.
 */
interface MiddlewareContext {
  request: Request
  env: Env
  next: () => Promise<Response>
}

/** Der Name des Formularfelds — und derselbe Name im Einladungslink. */
const FIELD = 'password'
const INVITE_PARAM = 'invite'

/**
 * Obergrenze für das, was als Passwort ankommt.
 *
 * Der Vergleich selbst wäre auch mit einem Megabyte harmlos — er bricht bei
 * ungleicher Länge sofort ab. Die Grenze steht davor, damit gar nicht erst
 * ein Megabyte gelesen wird.
 */
const MAX_PASSWORD_LENGTH = 200

/** Und für den ganzen Formularkörper. Ein Passwortformular ist winzig. */
const MAX_BODY_BYTES = 4096

/**
 * Sicherheits-Kopfzeilen für die Antworten **dieser Funktion**.
 *
 * `_headers` im Ausgabeverzeichnis deckt nur die statische Auslieferung ab —
 * was Pages aus `dist` holt. Die Anmeldeseite kommt von hier und ging damit
 * ohne jede Kopfzeile hinaus: ausgerechnet die einzige Seite, die
 * Unangemeldete zu sehen bekommen. Aufgefallen beim Nachmessen an der
 * ausgelieferten Adresse, nicht beim Lesen.
 *
 * Die Richtlinie ist strenger als die der App, weil diese Seite weniger
 * braucht: **kein Skript, keine Verbindung nach außen.** `default-src 'none'`
 * verbietet damit alles, was nicht ausdrücklich dasteht — das Stylesheet steht
 * inline in der Seite, das Symbol kommt von der eigenen Herkunft, und
 * abgeschickt wird nur hierher.
 */
function sicherheitsKopfzeilen(): Record<string, string> {
  return {
    'Content-Security-Policy': [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "img-src 'self' data:",
      "form-action 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
  }
}

function htmlResponse(body: string, status: number, cookie?: string): Response {
  const headers = new Headers({
    ...sicherheitsKopfzeilen(),
    'Content-Type': 'text/html; charset=utf-8',
    // Ohne `no-store` legte der Browser — oder schlimmer: der Service Worker
    // eines eingeloggten Geräts — die Anmeldeseite als App-Rumpf ab. Der
    // Tester sähe danach das Formular, obwohl sein Cookie längst gilt.
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  })
  if (cookie !== undefined) headers.append('Set-Cookie', cookie)
  return new Response(body, { status, headers })
}

/** Nach erfolgreicher Anmeldung: einmal umleiten, damit kein `POST` im Verlauf bleibt. */
function redirect(to: string, cookie: string): Response {
  return new Response(null, {
    // 303 und nicht 302: Der Browser soll die Zieladresse mit `GET` holen,
    // auch wenn er gerade ein Formular geschickt hat. Sonst wiederholt ein
    // Neuladen die Anmeldung.
    status: 303,
    headers: new Headers({
      ...sicherheitsKopfzeilen(),
      Location: to,
      'Cache-Control': 'no-store',
      'Set-Cookie': cookie,
    }),
  })
}

async function issueCookie(secret: string, now: number): Promise<string> {
  const token = await signBetaToken(secret, now + BETA_TOKEN_TTL_MS)
  const maxAge = Math.floor(BETA_TOKEN_TTL_MS / 1000)
  // `HttpOnly`, damit kein Skript im Dokument das Token lesen kann; `Secure`,
  // weil Pages ohnehin nur über TLS ausliefert; `SameSite=Lax`, damit ein
  // Klick von aussen (Telegram, Mail) noch mitzählt, eine fremde Seite aber
  // keine Anfragen in unserem Namen stellen kann.
  return `${BETA_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
}

/** Das Passwort aus einem abgeschickten Formular — oder `null`. */
async function passwordFromForm(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null
  try {
    const form = await request.formData()
    const value = form.get(FIELD)
    // `formData` liefert bei einem hochgeladenen Feld ein `File`. Das ist kein
    // Passwort, und `String(file)` daraus zu machen wäre geraten.
    return typeof value === 'string' ? value : null
  } catch {
    // Kaputter oder falsch ausgezeichneter Körper. Das ist kein Programmfehler,
    // sondern eine Anfrage, die niemand so gestellt hat wie das Formular.
    return null
  }
}

function accepts(secret: string, candidate: string | null): boolean {
  if (candidate === null || candidate.length > MAX_PASSWORD_LENGTH) return false
  return constantTimeEqual(candidate, secret)
}

export const onRequest = async (context: MiddlewareContext): Promise<Response> => {
  const { request, env } = context
  const secret = (env.BETA_PASSWORD ?? '').trim()
  const url = new URL(request.url)

  // Fehlt das Passwort, fällt der Riegel zu statt auf. Die Alternative wäre
  // bequemer und genau der Fehler, den dieses Projekt schon zweimal gemacht
  // hat: etwas meldet Erfolg und tut nichts.
  if (secret === '') {
    return htmlResponse(unconfiguredPage(), 503)
  }

  const now = Date.now()
  const cookie = readCookie(request.headers.get('Cookie'), BETA_COOKIE)
  if (await verifyBetaToken(secret, cookie, now)) {
    return context.next()
  }

  // Ein Cookie war da, taugte aber nicht: fast immer abgelaufen. Das gehört
  // gesagt — sonst tippt jemand dasselbe richtige Passwort dreimal ein und
  // hält den Riegel für kaputt.
  const notice: LoginNotice = cookie === null ? 'none' : 'expired'

  if (request.method === 'POST') {
    if (accepts(secret, await passwordFromForm(request))) {
      // Nur der Pfad, nie etwas aus der Anfrage: Eine Umleitung, die ein Ziel
      // aus fremder Eingabe übernimmt, ist eine offene Weiterleitung. Und
      // „nur der Pfad" reichte nicht — `//evil.com/` ist ein gültiger Pfad und
      // als `Location` eine protokollrelative Adresse. `sameOriginPath` in
      // core schneidet das ab und wird dort beschossen.
      return redirect(sameOriginPath(url.pathname), await issueCookie(secret, now))
    }
    return htmlResponse(loginPage('wrong-password'), 401)
  }

  const invite = url.searchParams.get(INVITE_PARAM)
  if (invite !== null) {
    if (accepts(secret, invite)) {
      const clean = new URL(url)
      // Das Passwort raus aus der Adresse, der Rest bleibt: `?start=melden`
      // soll einen Einladungslink überleben.
      clean.searchParams.delete(INVITE_PARAM)
      return redirect(
        sameOriginPath(clean.pathname, clean.search, clean.hash),
        await issueCookie(secret, now)
      )
    }
    return htmlResponse(loginPage('wrong-password'), 401)
  }

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 401,
      headers: new Headers({
        ...sicherheitsKopfzeilen(),
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      }),
    })
  }

  return htmlResponse(loginPage(notice), 401)
}
