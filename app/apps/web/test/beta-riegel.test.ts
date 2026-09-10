import { BETA_COOKIE, signBetaToken } from '@knoellchenfrei/core'
import { describe, expect, it, vi } from 'vitest'

import { onRequest } from '../functions/_middleware.js'

/**
 * Tests für den Riegel vor der geschlossenen Beta.
 *
 * Die Prüf- und Zerlegelogik liegt in `core/beta-gate.ts` und wird dort mit
 * Unfug beschossen. **Hier fehlte bisher alles**: die Entscheidungen der
 * Pages-Funktion selbst — wer durchgelassen wird, was ohne Passwort passiert,
 * ob das Cookie die richtigen Merkmale trägt.
 *
 * Warum das mehr als Fleissarbeit ist: Diese Funktion ist die einzige
 * Zugangskontrolle des ganzen Angebots. Fällt sie in die falsche Richtung auf,
 * liegt die App offen, und man sieht es der Seite nicht an — sie funktioniert
 * ja. Die E2E-Suite kann das nicht prüfen: Sie misst gegen `vite preview`, und
 * dort gibt es keine Pages-Funktionen.
 */

/** Der Ausschnitt der Pages-Laufzeit, den die Funktion benutzt. */
// Ein Kennwort, das in keiner Anmeldeseite vorkommen kann. `'App'` als Marke
// war zu naiv: Das Wort steht im Text der Anmeldeseite selbst, und der Test
// schlug an, ohne dass etwas durchgelassen wurde.
const DAHINTER = 'NUR-FUER-ANGEMELDETE-4711'

function kontext(request: Request, passwort: string | undefined, weiter = DAHINTER) {
  return {
    request,
    env: passwort === undefined ? {} : { BETA_PASSWORD: passwort },
    next: async () => new Response(weiter, { status: 200 }),
  }
}

const GET = (pfad = 'https://knoellchenfrei.de/', init: RequestInit = {}) =>
  new Request(pfad, init)

const formular = (passwort: string) =>
  new Request('https://knoellchenfrei.de/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: passwort }).toString(),
  })

describe('ohne gesetztes Passwort', () => {
  // Die bequeme Richtung wäre durchzulassen — und genau der Fehler, den dieses
  // Projekt dreimal gemacht hat: etwas meldet Erfolg und tut nichts.
  it('fällt der Riegel zu, nicht auf', async () => {
    const response = await onRequest(kontext(GET(), undefined))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain(DAHINTER)
  })

  it('gilt das auch für ein leeres Passwort', async () => {
    const response = await onRequest(kontext(GET(), '   '))
    expect(response.status).toBe(503)
  })
})

describe('ohne Cookie', () => {
  it('kommt niemand an die App', async () => {
    const response = await onRequest(kontext(GET(), 'offen-sesam'))
    // 200, nicht 401, seit dem 10. September: Die Bots von iMessage, Discord
    // und Telegram lesen die Vorschaukarte nur aus einer 2xx-Antwort. Der
    // Riegel ist der Inhalt, nicht der Status — das Formular, nie die App.
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).not.toContain(DAHINTER)
    expect(body).toContain('name="password"')
  })

  it('trägt die Vorschaukarte, die ein Messenger zum geteilten Link zeigt', async () => {
    const response = await onRequest(kontext(GET(), 'offen-sesam'))
    const body = await response.text()
    expect(body).toContain('<meta property="og:title"')
    expect(body).toContain('<meta property="og:image" content="https://knoellchenfrei.de/og.png"')
    expect(body).toContain('<meta name="twitter:card" content="summary_large_image"')
    // Die Herkunft kommt aus der Anfrage, nicht aus einer Konstante: Die
    // Pages-Adresse zeigt auf ihr eigenes Bild.
    const pages = await onRequest(kontext(GET('https://knoellchenfrei.pages.dev/'), 'offen-sesam'))
    expect(await pages.text()).toContain('content="https://knoellchenfrei.pages.dev/og.png"')
  })

  it('lässt genau das Vorschaubild ohne Cookie durch — und sonst kein Bild', async () => {
    const bild = await onRequest(kontext(GET('https://knoellchenfrei.de/og.png'), 'offen-sesam'))
    expect(bild.status).toBe(200)
    expect(await bild.text()).toBe(DAHINTER)
    for (const pfad of ['/icon-512.png', '/screenshots/handy.png', '/og.png.bak', '/data/og.png']) {
      const response = await onRequest(kontext(GET(`https://knoellchenfrei.de${pfad}`), 'offen-sesam'))
      expect(response.status, pfad).toBe(401)
    }
  })

  it('antwortet auf Seiten mit 200 und auf Dateien mit 401', async () => {
    for (const pfad of ['/', '/statistik/', '/statistik']) {
      const response = await onRequest(kontext(GET(`https://knoellchenfrei.de${pfad}`), 'offen-sesam'))
      expect(response.status, pfad).toBe(200)
    }
  })

  it('bekommt auch das Bündel und die Zonendatei nichts anderes', async () => {
    for (const pfad of ['/assets/index-abc.js', '/data/berlin/zones.geojson', '/manifest.json']) {
      const response = await onRequest(kontext(GET(`https://knoellchenfrei.de${pfad}`), 'offen-sesam'))
      expect(response.status, pfad).toBe(401)
    }
  })

  it('antwortet auf HEAD ohne Körper', async () => {
    const response = await onRequest(kontext(GET('https://knoellchenfrei.de/', { method: 'HEAD' }), 'offen-sesam'))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
    const datei = await onRequest(kontext(GET('https://knoellchenfrei.de/sw.js', { method: 'HEAD' }), 'offen-sesam'))
    expect(datei.status).toBe(401)
  })

  it('sagt Suchmaschinen, dass hier nichts zu holen ist', async () => {
    const response = await onRequest(kontext(GET(), 'offen-sesam'))
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  // `_headers` deckt nur die statische Auslieferung ab. Die Anmeldeseite kommt
  // aus der Funktion und ging deshalb einmal ohne jede Kopfzeile hinaus —
  // ausgerechnet die einzige Seite, die Unangemeldete zu sehen bekommen.
  it('trägt trotzdem eine strenge Sicherheitsrichtlinie', async () => {
    const response = await onRequest(kontext(GET(), 'offen-sesam'))
    const csp = response.headers.get('Content-Security-Policy') ?? ''
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})

describe('mit gültigem Cookie', () => {
  it('geht die Anfrage an die App durch', async () => {
    const token = await signBetaToken('offen-sesam', Date.now() + 60_000)
    const response = await onRequest(
      kontext(GET('https://knoellchenfrei.de/', { headers: { Cookie: `${BETA_COOKIE}=${token}` } }), 'offen-sesam')
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(DAHINTER)
  })

  it('nicht mit einem Token für ein anderes Passwort', async () => {
    const token = await signBetaToken('anderes', Date.now() + 60_000)
    const response = await onRequest(
      kontext(GET('https://knoellchenfrei.de/', { headers: { Cookie: `${BETA_COOKIE}=${token}` } }), 'offen-sesam')
    )
    // Eine Seite: 200 mit dem Formular, nie die App (siehe „ohne Cookie").
    expect(response.status).toBe(200)
    expect(await response.text()).not.toContain(DAHINTER)
    const datei = await onRequest(
      kontext(GET('https://knoellchenfrei.de/sw.js', { headers: { Cookie: `${BETA_COOKIE}=${token}` } }), 'offen-sesam')
    )
    expect(datei.status).toBe(401)
  })

  it('nicht mit einem abgelaufenen — und sagt, dass es daran lag', async () => {
    const token = await signBetaToken('offen-sesam', Date.now() - 1)
    const response = await onRequest(
      kontext(GET('https://knoellchenfrei.de/', { headers: { Cookie: `${BETA_COOKIE}=${token}` } }), 'offen-sesam')
    )
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).not.toContain(DAHINTER)
    // Sonst tippt jemand dasselbe richtige Passwort dreimal ein.
    expect(body).toContain('abgelaufen')
  })
})

describe('das Formular', () => {
  it('lässt mit dem richtigen Passwort ein Cookie setzen und leitet um', async () => {
    const response = await onRequest(kontext(formular('offen-sesam'), 'offen-sesam'))
    // 303, damit ein Neuladen die Anmeldung nicht wiederholt.
    expect(response.status).toBe(303)
    expect(response.headers.get('Location')).toBe('/')
    const cookie = response.headers.get('Set-Cookie') ?? ''
    expect(cookie).toContain(`${BETA_COOKIE}=`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('weist ein falsches Passwort ab, ohne ein Cookie zu setzen — und sagt es', async () => {
    const response = await onRequest(kontext(formular('daneben'), 'offen-sesam'))
    expect(response.status).toBe(401)
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(await response.text()).toContain('Das Passwort stimmt nicht.')
  })

  // Die Umleitung nach der Anmeldung darf nirgends liegen bleiben: Ein
  // Service Worker oder Browser-Cache mit dem 303 samt Cookie wäre die
  // Anmeldung für den nächsten, der das Gerät nimmt.
  it('lässt die Umleitung nicht zwischenspeichern', async () => {
    const response = await onRequest(kontext(formular('offen-sesam'), 'offen-sesam'))
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  // Der Deckel ist die einzige Sicherung VOR dem Vergleich: Ohne ihn liefe
  // `constantTimeEqual` über beliebig lange Eingaben. Gemessen mit dem Secret
  // in derselben Länge — sonst fiele der Test schon am falschen Passwort.
  it('weist ein Passwort über 200 Zeichen ab, ohne es zu vergleichen', async () => {
    const lang = 'x'.repeat(201)
    const response = await onRequest(kontext(formular(lang), lang))
    expect(response.status).toBe(401)
    expect(response.headers.get('Set-Cookie')).toBeNull()
  })

  it('liest einen aufgeblähten Formularkörper gar nicht erst', async () => {
    const request = new Request('https://knoellchenfrei.de/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': '5000' },
      body: new URLSearchParams({ password: 'offen-sesam' }).toString(),
    })
    const gelesen = vi.spyOn(request, 'formData')
    const response = await onRequest(kontext(request, 'offen-sesam'))
    expect(response.status).toBe(401)
    expect(gelesen).not.toHaveBeenCalled()
  })
})

describe('der Einladungslink', () => {
  it('öffnet und räumt das Passwort aus der Adresse', async () => {
    const response = await onRequest(
      kontext(GET('https://knoellchenfrei.de/?invite=offen-sesam&start=melden'), 'offen-sesam')
    )
    expect(response.status).toBe(303)
    // `?start=melden` soll den Einladungslink überleben, `invite` nicht.
    expect(response.headers.get('Location')).toBe('/?start=melden')
    expect(response.headers.get('Set-Cookie')).toContain(`${BETA_COOKIE}=`)
  })

  it('führt mit falschem Passwort nirgendwohin', async () => {
    const response = await onRequest(kontext(GET('https://knoellchenfrei.de/?invite=daneben'), 'offen-sesam'))
    expect(response.status).toBe(401)
    expect(response.headers.get('Set-Cookie')).toBeNull()
  })

  // Eine Umleitung, die ihr Ziel aus fremder Eingabe übernimmt, ist eine
  // offene Weiterleitung — hier kommt nur der eigene Pfad zurück.
  it('leitet nur auf den eigenen Pfad, nie auf ein fremdes Ziel', async () => {
    const response = await onRequest(
      kontext(GET('https://knoellchenfrei.de/melden?invite=offen-sesam'), 'offen-sesam')
    )
    expect(response.headers.get('Location')).toBe('/melden')
  })
})

/**
 * Die offene Weiterleitung — gefunden bei der Fehlerjagd in der Nacht zum
 * 8. September, gemessen statt gelesen.
 *
 * Beide Anmeldewege leiteten auf den angefragten Pfad um. Das galt als sicher,
 * weil ausser dem Pfad nichts aus der Anfrage übernommen wurde — nur ist
 * `new URL('https://knoellchenfrei.de//evil.com/').pathname` eben
 * `//evil.com/`, und als `Location` ist das eine protokollrelative Adresse.
 *
 * Der Angreifer braucht dafür das Beta-Passwort, ist also ein Tester. Der
 * Gewinn wäre ein Link, der von der echten Domain kommt und auf einer fremden
 * Seite endet — und genau solche Links werden in Telegram herumgereicht.
 */
describe('das Umleitungsziel nach der Anmeldung', () => {
  const zielVon = (response: Response): string => response.headers.get('Location') ?? ''
  const bleibtHier = (ziel: string): boolean =>
    new URL(ziel, 'https://knoellchenfrei.de').origin === 'https://knoellchenfrei.de'

  it('führt über das Formular nicht auf eine fremde Herkunft', async () => {
    const response = await onRequest(
      kontext(
        new Request('https://knoellchenfrei.de//evil.com/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ password: 'offen-sesam' }).toString(),
        }),
        'offen-sesam'
      )
    )
    expect(response.status).toBe(303)
    expect(zielVon(response)).toBe('/evil.com/')
    expect(bleibtHier(zielVon(response))).toBe(true)
  })

  it('führt über den Einladungslink nicht auf eine fremde Herkunft', async () => {
    const response = await onRequest(
      kontext(GET('https://knoellchenfrei.de//evil.com/?invite=offen-sesam'), 'offen-sesam')
    )
    expect(response.status).toBe(303)
    expect(bleibtHier(zielVon(response))).toBe(true)
    expect(zielVon(response).startsWith('//')).toBe(false)
  })

  it('behält dabei, was am Einladungslink hing — ohne das Passwort', async () => {
    const response = await onRequest(
      kontext(
        GET('https://knoellchenfrei.de/?invite=offen-sesam&start=melden#karte'),
        'offen-sesam'
      )
    )
    expect(zielVon(response)).toBe('/?start=melden#karte')
  })

  it('lässt den gewöhnlichen Weg unverändert', async () => {
    const response = await onRequest(
      kontext(
        new Request('https://knoellchenfrei.de/statistik/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ password: 'offen-sesam' }).toString(),
        }),
        'offen-sesam'
      )
    )
    expect(zielVon(response)).toBe('/statistik/')
  })
})
