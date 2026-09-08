import { describe, expect, it } from 'vitest'

import { ZONE_KEYS } from '@knoellchenfrei/core'

import worker, { type Env } from '../src/worker.js'

/**
 * Tests für den Worker — vorher hatte er **keinen einzigen**.
 *
 * `packages/core` steht bei 99,9 % Zeilenabdeckung, und hier lagen
 * Rate-Limits, die CORS-Allowlist, der Telegram-Pfad und jede Schreibstelle
 * ohne eine einzige Zusicherung. Vier der Fehler, die das Audit im September
 * gefunden hat, wären hier aufgefallen: der ungesalzene Hash (M-014), die
 * unbegrenzte Besuchstabelle (M-016), die fehlende Statusprüfung beim Stimmen
 * (M-046) und der leere Eintrag in der Allowlist (M-097).
 *
 * Was hier **nicht** getestet wird und warum: alles, was echtes SQL braucht.
 * Dafür wäre `@cloudflare/vitest-pool-workers` mit einer D1 in Miniflare
 * nötig, samt eingespielten Migrationen. Das ist die richtige Ergänzung und
 * eine eigene Runde; diese Datei deckt die Wege ab, die eine Anfrage nimmt,
 * **bevor** sie die Datenbank erreicht — und das ist die Ebene, auf der die
 * genannten vier Fehler lagen.
 */

/** Eine D1, die jede Anweisung mitschreibt, statt sie auszuführen. */
function datenbankAttrappe(): { db: D1Database; anweisungen: { sql: string; werte: unknown[] }[] } {
  const anweisungen: { sql: string; werte: unknown[] }[] = []
  const db = {
    prepare(sql: string) {
      const eintrag = { sql, werte: [] as unknown[] }
      const statement = {
        bind(...werte: unknown[]) {
          eintrag.werte = werte
          anweisungen.push(eintrag)
          return statement
        },
        run: async () => ({ success: true }),
        first: async () => null,
        all: async () => ({ results: [] }),
      }
      return statement
    },
  }
  return { db: db as unknown as D1Database, anweisungen }
}

function umgebung(patch: Partial<Env> = {}): Env {
  const { db } = datenbankAttrappe()
  return {
    DB: db,
    CACHE: { get: async () => null, put: async () => undefined } as unknown as KVNamespace,
    CLIENT_SALT: 'salz',
    ALLOWED_ORIGINS: 'https://knoellchenfrei.de',
    ...patch,
  }
}

const post = (pfad: string, init: RequestInit = {}): Request =>
  new Request(`https://api.example/${pfad.replace(/^\//, '')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    ...init,
  })

describe('/health', () => {
  it('antwortet ohne jede Einrichtung', async () => {
    const response = await worker.fetch(new Request('https://api.example/health'), umgebung())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('duldet einen Schrägstrich am Ende', async () => {
    const response = await worker.fetch(new Request('https://api.example/health/'), umgebung())
    expect(response.status).toBe(200)
  })
})

describe('die CORS-Kopfzeilen', () => {
  it('nennt eine eingetragene Herkunft', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/health', {
        headers: { Origin: 'https://knoellchenfrei.de' },
      }),
      umgebung()
    )
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://knoellchenfrei.de')
    expect(response.headers.get('Vary')).toBe('Origin')
  })

  it('schweigt bei einer fremden Herkunft, statt sie zu erlauben', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/health', { headers: { Origin: 'https://boese.de' } }),
      umgebung()
    )
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  // Regression M-097: `''.split(',')` ist `['']`, nicht `[]` — ohne Allowlist
  // stand damit ein leerer Eintrag darin, und `includes('')` war wahr.
  it('erlaubt ohne Allowlist gar nichts, auch nicht die leere Herkunft', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/health', { headers: { Origin: '' } }),
      umgebung({ ALLOWED_ORIGINS: '' })
    )
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('beantwortet den Vorabruf mit 204', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/sightings', {
        method: 'OPTIONS',
        headers: { Origin: 'https://knoellchenfrei.de' },
      }),
      umgebung()
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})

describe('ohne CLIENT_SALT', () => {
  // Regression M-014: `clientHash` fiel auf einen ungesalzenen SHA-256 über die
  // IP zurück — 64 Bit über den IPv4-Raum sind offline in Minuten zurückgerechnet.
  it('wird nicht geschrieben, und der Grund steht in der Antwort', async () => {
    for (const pfad of ['/visits', '/sightings', '/feedback']) {
      const response = await worker.fetch(post(pfad), umgebung({ CLIENT_SALT: '' }))
      expect(response.status, pfad).toBe(503)
      expect(await response.text()).toContain('CLIENT_SALT')
    }
  })

  it('lässt Lesen weiterhin zu — es hängt an keinem Hash', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/health'),
      umgebung({ CLIENT_SALT: '' })
    )
    expect(response.status).toBe(200)
  })
})

describe('Schreibzugriffe von fremden Seiten', () => {
  // Ein POST ohne JSON-Kopfzeile ist eine "simple request": Der Browser
  // schickt sie ohne Vorabruf, also käme jede fremde Seite an der Allowlist
  // vorbei. Die Pflicht zu `application/json` erzwingt den Vorabruf.
  it('weist einen POST ohne JSON-Kopfzeile mit 415 ab', async () => {
    const response = await worker.fetch(
      post('/sightings', { headers: { 'Content-Type': 'text/plain' } }),
      umgebung()
    )
    expect(response.status).toBe(415)
  })

  it('weist einen POST von fremder Herkunft mit 403 ab', async () => {
    const response = await worker.fetch(
      post('/sightings', {
        headers: { 'Content-Type': 'application/json', Origin: 'https://boese.de' },
      }),
      umgebung()
    )
    expect(response.status).toBe(403)
  })
})

describe('der Telegram-Webhook', () => {
  it('gibt es nicht, solange kein Token eingerichtet ist', async () => {
    const response = await worker.fetch(post('/telegram'), umgebung())
    expect(response.status).toBe(404)
  })

  // Die Adresse ist sonst nur durch Unkenntnis geschützt, und "niemand kennt
  // sie" ist keine Zugangskontrolle. 403 und nicht 401: Es fehlt keine
  // Anmeldung, die nachgereicht werden könnte — der Aufrufer ist einfach
  // nicht Telegram.
  it('weist eine Zustellung ohne das vereinbarte Geheimnis ab', async () => {
    const response = await worker.fetch(
      post('/telegram'),
      umgebung({ TELEGRAM_TOKEN: 'tok', TELEGRAM_SECRET: 'geheim' })
    )
    expect(response.status).toBe(403)
  })

  it('weist ein falsches Geheimnis ab', async () => {
    const response = await worker.fetch(
      post('/telegram', {
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'falsch',
        },
      }),
      umgebung({ TELEGRAM_TOKEN: 'tok', TELEGRAM_SECRET: 'geheim' })
    )
    expect(response.status).toBe(403)
  })
})

describe('/events', () => {
  const bündel = (body: unknown) =>
    post('/events', { body: JSON.stringify(body) })

  it('weist eine unbekannte Stadt ab, statt auf Berlin zu fallen', async () => {
    const response = await worker.fetch(bündel({ city: 'paris', events: [] }), umgebung())
    expect(response.status).toBe(400)
  })

  it('nimmt ein leeres Bündel an, ohne die Datenbank anzufassen', async () => {
    const response = await worker.fetch(bündel({ city: 'berlin', events: [] }), umgebung())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ written: 0 })
  })

  it('weist ein zu großes Bündel ab', async () => {
    const events = Array.from({ length: 30 }, () => ({ name: 'app.open', value: '', n: 1 }))
    const response = await worker.fetch(bündel({ city: 'berlin', events }), umgebung())
    expect(response.status).toBe(413)
  })

  // Die Liste im Client ist eine Bequemlichkeit, keine Grenze: Hier kommt an,
  // was jemand schickt, und nicht, was die App vorgesehen hat.
  it('verwirft unbekannte Namen und Ausprägungen stillschweigend', async () => {
    const response = await worker.fetch(
      bündel({
        city: 'berlin',
        events: [
          { name: 'ausgedacht', value: '', n: 1 },
          { name: 'zone.open', value: 'Fantasiestraße', n: 1 },
          { name: 'zone.answer', value: 'karte', n: 1 },
        ],
      }),
      umgebung()
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ written: 0 })
  })

  it('braucht dieselbe Herkunftsprüfung wie jede andere Schreibstelle', async () => {
    const response = await worker.fetch(
      post('/events', {
        headers: { 'Content-Type': 'application/json', Origin: 'https://boese.de' },
        body: JSON.stringify({ city: 'berlin', events: [] }),
      }),
      umgebung()
    )
    expect(response.status).toBe(403)
  })

  it('schreibt ohne CLIENT_SALT gar nicht — wie jede POST-Route', async () => {
    const response = await worker.fetch(
      bündel({ city: 'berlin', events: [] }),
      umgebung({ CLIENT_SALT: '' })
    )
    expect(response.status).toBe(503)
  })
})

describe('die Leseendpunkte', () => {
  /**
   * Der Rückfall auf Berlin gilt für eine **fehlende** Angabe, nicht für eine
   * falsche. Wer `?city=hambrug` schickt und schweigend Berliner Meldungen
   * bekommt, sucht den Fehler dort, wo er nicht ist.
   */
  it('weisen einen unbekannten Stadtschlüssel ab und nennen die bekannten', async () => {
    for (const pfad of ['/sightings', '/marks']) {
      const response = await worker.fetch(
        new Request(`https://api.example${pfad}?city=hambrug`),
        umgebung()
      )
      expect(response.status, pfad).toBe(400)
      const text = await response.text()
      expect(text, pfad).toContain('berlin')
      expect(text, pfad).toContain('muenchen')
    }
  })

  it('fallen ohne Angabe auf Berlin zurück, weil das die ausgelieferte Stadt ist', async () => {
    for (const pfad of ['/sightings', '/marks']) {
      const response = await worker.fetch(new Request(`https://api.example${pfad}`), umgebung())
      expect(response.status, pfad).toBe(200)
    }
  })

  it('behandeln einen leeren Parameter wie einen fehlenden', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/sightings?city='),
      umgebung()
    )
    expect(response.status).toBe(200)
  })

  // Lesen hängt an keinem Hash — ohne Salz darf es trotzdem gehen, sonst
  // stünde die halbe App still, weil ein Schreibweg nicht eingerichtet ist.
  it('gehen auch ohne CLIENT_SALT', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/marks'),
      umgebung({ CLIENT_SALT: '' })
    )
    expect(response.status).toBe(200)
  })

  it('nehmen keine Schreibmethode an', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
      umgebung()
    )
    expect(response.status).toBe(404)
  })
})

describe('die Stimmabgabe', () => {
  const stimme = (id: string, art: string) =>
    post(`/sightings/${id}/${art}`)

  /**
   * Beide Fälle enden in 404, und das ist kein Fehler im Test, sondern die
   * Grenze der Attrappe: Eine Stimme auf eine Meldung, die es nicht gibt, ist
   * genauso „nicht gefunden" wie ein Weg, den es nicht gibt. Was sich prüfen
   * lässt, ist der **Weg dorthin** — die gültige Art erreicht den Handler und
   * schlägt an der Datenbank fehl, die ungültige erreicht ihn nie.
   */
  it('nimmt nur die zwei vorgesehenen Arten an', async () => {
    for (const art of ['confirm', 'dispute']) {
      const response = await worker.fetch(stimme('abc', art), umgebung())
      // 404, weil die Attrappe keine Meldung kennt — aber der Weg stimmt.
      expect(response.status, art).toBe(404)
      expect(await response.text(), art).toContain('not found')
    }
    for (const art of ['vielleicht', 'CONFIRM', 'confirm2', '']) {
      const response = await worker.fetch(stimme('abc', art), umgebung())
      expect(response.status, art).toBe(404)
    }
  })

  // Die Kennung kommt aus einer Adresse, also von aussen. Ein Muster, das zu
  // viel durchlässt, landet ungeprüft in einer Abfrage.
  it('weist eine Kennung ab, die nicht ins Muster passt', async () => {
    for (const id of ['../etc', 'a b', "a'or'1", 'a'.repeat(65), '']) {
      const response = await worker.fetch(stimme(encodeURIComponent(id), 'confirm'), umgebung())
      expect(response.status, JSON.stringify(id)).toBe(404)
    }
  })
})

describe('was aus dem Netz ankommt', () => {
  /**
   * Diese Adressen sind offen. Was hier hereinkommt, hat niemand geschrieben,
   * der es gut meint — und der Worker ist die einzige Stelle, die es prüft.
   * `packages/core` wird für so etwas mit Unfug beschossen (`fuzz.test.ts`);
   * hier geht es um die Wege davor: JSON, das keines ist, Felder, die fehlen,
   * Zahlen, die keine sind.
   */
  const unfug = [
    'nicht mal JSON',
    '',
    '[]',
    'null',
    '"eine Zeichenkette"',
    '42',
    '{"lon": "13,4", "lat": "52,5"}',
    '{"lon": null, "lat": null}',
    '{"lon": {}, "lat": []}',
    '{"lon": "Infinity", "lat": "NaN"}',
    '{"__proto__": {"x": 1}}',
    `{"lon": ${'9'.repeat(400)}, "lat": 52}`,
  ]

  it('beantwortet jede Sorte Unfug mit einem Fehler, nie mit 500', async () => {
    for (const body of unfug) {
      const response = await worker.fetch(post('/sightings', { body }), umgebung())
      expect(response.status, body.slice(0, 40)).toBeGreaterThanOrEqual(400)
      expect(response.status, body.slice(0, 40)).toBeLessThan(500)
    }
  })

  it('nimmt keine Meldung ausserhalb aller Städte an', async () => {
    // Mitten im Atlantik. Eine Position, die in keine Stadt fällt, legt keine
    // Zeile an — sonst stünde eine Meldung ohne Stadt in der Datenbank.
    const response = await worker.fetch(
      post('/sightings', { body: '{"lon": -30, "lat": 0}' }),
      umgebung()
    )
    expect(response.status).toBe(422)
    expect(await response.text()).toContain('outside')
  })

  it('weist eine Besuchskennung ab, die nicht ins Muster passt', async () => {
    for (const id of ['', 'abc', '2026-09-07', '../../etc', '2026-09-07-' + 'x'.repeat(40)]) {
      const response = await worker.fetch(
        post('/visits', { body: JSON.stringify({ id }) }),
        umgebung()
      )
      expect(response.status, id).toBe(400)
    }
  })

  it('weist eine rückdatierte Besuchskennung ab', async () => {
    const response = await worker.fetch(
      post('/visits', { body: '{"id": "2020-01-01-abc"}' }),
      umgebung()
    )
    // 422, nicht 400: Die Form stimmt, der Tag nicht. Eine rückdatierte Zeile
    // blähte die Zahl eines vergangenen Tages auf, solange er aufbewahrt wird.
    expect(response.status).toBe(422)
  })

  it('beantwortet Unfug an /events genauso', async () => {
    for (const body of ['nicht mal JSON', '[]', 'null', '{"city": 42}', '{"city": "berlin", "events": "viele"}']) {
      const response = await worker.fetch(post('/events', { body }), umgebung())
      expect(response.status, body).toBeGreaterThanOrEqual(200)
      expect(response.status, body).toBeLessThan(500)
    }
  })

  it('beantwortet Unfug an /feedback genauso', async () => {
    for (const body of unfug) {
      const response = await worker.fetch(post('/feedback', { body }), umgebung())
      expect(response.status, body.slice(0, 40)).toBeLessThan(500)
    }
  })
})

describe('unbekannte Wege', () => {
  it('enden in 404, nicht in einem Fehler', async () => {
    const response = await worker.fetch(new Request('https://api.example/gibtsnicht'), umgebung())
    expect(response.status).toBe(404)
  })

  // Festgehalten, wie es ist, nicht wie es sein sollte: `/health` prüft die
  // Methode nicht und antwortet auf jede. Das ist folgenlos — die einzige
  // Schranke, die an der Methode hängt, ist die Schreibsperre ohne
  // `CLIENT_SALT`, und die greift für POST. Sollte sich das ändern, sagt
  // dieser Test, dass es eine Entscheidung war und kein Versehen.
  it('lassen /health jede Methode beantworten, ohne dass etwas geschrieben wird', async () => {
    const response = await worker.fetch(
      new Request('https://api.example/health', { method: 'DELETE' }),
      umgebung()
    )
    expect(response.status).toBe(200)
  })
})

/**
 * Der Aufräumlauf — der Teil des Workers, der bisher **keinen einzigen** Test
 * hatte.
 *
 * Er ist nicht Beiwerk: In `docs/datenschutz.md` stehen Aufbewahrungsfristen,
 * und dieser Cron ist die einzige Stelle, die sie einhält. Läuft er halb, ist
 * das Versprechen halb — und von aussen sieht nichts danach aus.
 */
function aufraeumAttrappe(patch: { batchWirft?: boolean; runWirftBei?: RegExp } = {}): {
  db: D1Database
  gesehen: string[]
} {
  const gesehen: string[] = []
  const statement = (sql: string) => {
    gesehen.push(sql)
    const self = {
      bind: () => self,
      run: async () => {
        if (patch.runWirftBei?.test(sql) === true) throw new Error(`D1 kaputt: ${sql}`)
        return { success: true }
      },
      first: async () => null,
      all: async () => ({ results: [] }),
    }
    return self
  }
  const db = {
    prepare: statement,
    batch: async () => {
      if (patch.batchWirft === true) throw new Error('D1 batch kaputt')
      return [{ results: [] }]
    },
  }
  return { db: db as unknown as D1Database, gesehen }
}

/** Was jeder Lauf angefasst haben muss, egal was sonst schiefgeht. */
const PFLICHT = [
  /UPDATE sightings SET client_hash = NULL/,
  /DELETE FROM sightings/,
  /DELETE FROM votes/,
  /DELETE FROM marks/,
  /DELETE FROM visits/,
  /UPDATE feedback SET client_hash = NULL/,
  /DELETE FROM events/,
  /DELETE FROM event_budget/,
  /DELETE FROM feedback/,
]

const cron = {} as ScheduledController

describe('der Aufräumlauf', () => {
  it('löscht jede Tabelle mit Frist und rechnet danach die Auswertung', async () => {
    const { db, gesehen } = aufraeumAttrappe()
    const kv: string[] = []
    await worker.scheduled(
      cron,
      umgebung({
        DB: db,
        CACHE: {
          get: async () => null,
          put: async (_k: string, v: string) => {
            kv.push(v)
          },
        } as unknown as KVNamespace,
      })
    )
    for (const muster of PFLICHT) {
      expect(gesehen.some((sql) => muster.test(sql)), String(muster)).toBe(true)
    }
    expect(kv).toHaveLength(1)
  })

  /**
   * Der Befund, der diese Tests ausgelöst hat.
   *
   * Vorher stand `await rollupStats(env)` mitten in einer Kette aus zehn
   * `await`, und **nach** ihm kamen die Löschungen für `events`,
   * `event_budget` und `feedback`. Eine Auswertung, die nicht gerechnet werden
   * konnte — ein D1-Fehler, ein volles KV, ein Tippfehler im SQL —, hielt
   * damit die Löschung von Daten an. Die Statistik ist Beiwerk, die Löschung
   * ist ein Versprechen; die Reihenfolge hatte es umgedreht.
   */
  it('löscht auch dann, wenn die Auswertung scheitert', async () => {
    const { db, gesehen } = aufraeumAttrappe({ batchWirft: true })
    await expect(worker.scheduled(cron, umgebung({ DB: db }))).rejects.toThrow(
      /Aufräumlauf unvollständig/
    )
    for (const muster of PFLICHT) {
      expect(gesehen.some((sql) => muster.test(sql)), String(muster)).toBe(true)
    }
  })

  it('hält nach einem gescheiterten Schritt nicht an, sondern macht die übrigen', async () => {
    const { db, gesehen } = aufraeumAttrappe({ runWirftBei: /DELETE FROM sightings/ })
    await expect(worker.scheduled(cron, umgebung({ DB: db }))).rejects.toThrow(
      /sichtungen: abgelaufene löschen/
    )
    // Der Schritt danach ist der wichtigste Beleg: Er stand in der alten
    // Fassung hinter dem gescheiterten und lief deshalb nie.
    expect(gesehen.some((sql) => /DELETE FROM votes/.test(sql))).toBe(true)
    expect(gesehen.some((sql) => /DELETE FROM feedback/.test(sql))).toBe(true)
  })

  /**
   * Ein stiller `catch` wäre die schlechtere Hälfte der Korrektur gewesen: Der
   * Lauf bliebe grün, und niemand erführe, dass eine Frist nicht eingehalten
   * wurde. Genau diese Sorte Fehler — etwas meldet Erfolg und tut nichts —
   * steht in CLAUDE.md dreimal.
   */
  it('bleibt rot, wenn etwas gescheitert ist', async () => {
    const { db } = aufraeumAttrappe({ runWirftBei: /DELETE FROM (events|feedback)/ })
    await expect(worker.scheduled(cron, umgebung({ DB: db }))).rejects.toThrow(
      /ereignisse: nach 90 tagen löschen.*rückmeldungen: nach 90 tagen löschen/
    )
  })
})

/**
 * Die Zonenkennung wird gegen die Liste **dieser** Stadt geprüft, nicht gegen
 * alle.
 *
 * Vorher stand im Worker `ALL_ZONE_KEYS` — die vier Listen flachgeklopft, 275
 * Kennungen. Das ist keine Kleinigkeit: Berlin und Frankfurt nummerieren beide
 * schlicht durch und teilen sich dadurch 20 Kennungen (`10`, `12`, `13`, …).
 * Eine Frankfurter Zahl landete als Berliner Zone in der Auswertung, und in
 * München wären 193 der 275 angenommenen Kennungen solche gewesen, die es dort
 * gar nicht gibt. Auf der Statistikseite hätte das ausgesehen wie eine Zone,
 * die jemand angesehen hat — sie existiert nur nicht.
 */
describe('die Zonenkennung in /events', () => {
  function zaehlAttrappe(): { db: D1Database; geschrieben: number } {
    const zustand = { geschrieben: 0 }
    const db = {
      prepare: (sql: string) => {
        const self = {
          bind: () => self,
          run: async () => ({ success: true }),
          first: async () => (sql.includes('event_budget') ? { n: 0 } : null),
          all: async () => ({ results: [] }),
        }
        return self
      },
      batch: async (anweisungen: unknown[]) => {
        zustand.geschrieben += anweisungen.length
        return anweisungen.map(() => ({ results: [] }))
      },
    }
    return { db: db as unknown as D1Database, get geschrieben() { return zustand.geschrieben } }
  }

  const sende = async (city: string, value: string): Promise<number> => {
    const { db } = zaehlAttrappe()
    const response = await worker.fetch(
      post('/events', { body: JSON.stringify({ city, events: [{ name: 'zone.open', value, n: 1 }] }) }),
      umgebung({ DB: db })
    )
    return ((await response.json()) as { written: number }).written
  }

  // Nicht abgeschrieben, sondern aus der erzeugten Liste geholt: Ändern sich
  // die Daten, ändert sich der Test mit — und wenn die Überschneidung
  // verschwindet, sagt die Zusicherung das laut, statt still zu bestehen.
  const nurBerlin = ZONE_KEYS.berlin?.find((k) => ZONE_KEYS.frankfurt?.includes(k) !== true)
  const gemeinsam = ZONE_KEYS.berlin?.find((k) => ZONE_KEYS.frankfurt?.includes(k) === true)

  it('nimmt eine Zone, die es in der gemeldeten Stadt gibt', async () => {
    expect(nurBerlin).toBeDefined()
    expect(await sende('berlin', nurBerlin as string)).toBe(1)
  })

  it('verwirft eine Berliner Zone, die als Frankfurter gemeldet wird', async () => {
    expect(await sende('frankfurt', nurBerlin as string)).toBe(0)
  })

  it('lässt eine Kennung durch, die es in beiden Städten wirklich gibt', async () => {
    expect(gemeinsam).toBeDefined()
    expect(await sende('frankfurt', gemeinsam as string)).toBe(1)
    expect(await sende('berlin', gemeinsam as string)).toBe(1)
  })

  it('verwirft in München jede Kennung, die dort nicht in der Liste steht', async () => {
    const fremd = ZONE_KEYS.hamburg?.find((k) => ZONE_KEYS.muenchen?.includes(k) !== true)
    expect(fremd).toBeDefined()
    expect(await sende('muenchen', fremd as string)).toBe(0)
  })
})

/**
 * Der Deckel je Bündel — die Grenze, die verhindert, dass vier Aufrufe die
 * Statistik für einen ganzen Tag abschalten.
 *
 * Ohne sie darf eine Anfrage 25 Einträge à 50 behaupten: 1.250 von 5.000, also
 * ein Viertel des Tages. Vollständig lösen lässt sich das nicht — dazu bräuchte
 * es eine Kennung je Aufrufer, und genau die soll diese Tabelle nicht kennen.
 * Es verschiebt das Verhältnis, mehr nicht, und das steht so in `SECURITY.md`.
 */
describe('der Deckel je Bündel', () => {
  const sende = async (events: unknown[]): Promise<Response> =>
    worker.fetch(
      post('/events', { body: JSON.stringify({ city: 'berlin', events }) }),
      umgebung({
        DB: {
          prepare: (sql: string) => {
            const self = {
              bind: () => self,
              run: async () => ({ success: true }),
              first: async () => (sql.includes('event_budget') ? { n: 0 } : null),
              all: async () => ({ results: [] }),
            }
            return self
          },
          batch: async (a: unknown[]) => a.map(() => ({ results: [] })),
        } as unknown as D1Database,
      })
    )

  it('weist ein Bündel ab, das mehr als 200 Zählungen behauptet', async () => {
    // 5 × 50 = 250, mit fünf verschiedenen Ausprägungen, damit nichts
    // zusammenfällt.
    const events = ['karte', 'standort', 'suche'].map((value) => ({
      name: 'zone.source',
      value,
      n: 50,
    }))
    events.push({ name: 'zone.answer', value: 'frei', n: 50 })
    events.push({ name: 'zone.answer', value: 'pflichtig', n: 50 })
    const response = await sende(events)
    expect(response.status).toBe(413)
  })

  it('lässt ein Bündel durch, wie es im Betrieb entsteht', async () => {
    const response = await sende([
      { name: 'app.open', value: '', n: 2 },
      { name: 'zone.source', value: 'karte', n: 4 },
      { name: 'layer.on', value: 'heat', n: 1 },
    ])
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ written: 3 })
  })
})
