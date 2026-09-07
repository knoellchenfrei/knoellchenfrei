/**
 * Der Riegel ist die einzige Stelle, an der ein „geht schon" niemandem
 * auffällt: Wer hineinkommt, sieht die App; wer fälschlich hineinkommt, sieht
 * sie auch. Ein kaputter Riegel meldet sich nicht — deshalb steht hier jede
 * Zusicherung einzeln, statt sich auf den glücklichen Fall zu verlassen.
 */
import { describe, expect, it } from 'vitest'

import {
  BETA_COOKIE,
  BETA_TOKEN_TTL_MS,
  constantTimeEqual,
  readCookie,
  signBetaToken,
  verifyBetaToken,
} from '../src/beta-gate.js'

const SECRET = 'ein-zufaelliges-beta-passwort-2026'
const NOW = Date.UTC(2026, 8, 7, 12, 0, 0)

function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state
  }
}

describe('signBetaToken', () => {
  it('baut ein Token aus Ablaufzeit und Signatur', async () => {
    const token = await signBetaToken(SECRET, NOW + BETA_TOKEN_TTL_MS)
    expect(token).toMatch(/^\d+\.[0-9a-f]{64}$/)
    expect(token.split('.')[0]).toBe(String(NOW + BETA_TOKEN_TTL_MS))
  })

  it('liefert für dasselbe Geheimnis dieselbe Signatur', async () => {
    const a = await signBetaToken(SECRET, NOW + 1000)
    const b = await signBetaToken(SECRET, NOW + 1000)
    expect(a).toBe(b)
  })

  it('liefert für ein anderes Geheimnis eine andere Signatur', async () => {
    const a = await signBetaToken(SECRET, NOW + 1000)
    const b = await signBetaToken(`${SECRET}x`, NOW + 1000)
    expect(a).not.toBe(b)
  })

  it('weist einen unbrauchbaren Ablaufzeitpunkt ab, statt ihn zu signieren', async () => {
    await expect(signBetaToken(SECRET, Number.NaN)).rejects.toThrow(/Ablaufzeitpunkt/)
    await expect(signBetaToken(SECRET, 0)).rejects.toThrow(/Ablaufzeitpunkt/)
    await expect(signBetaToken(SECRET, -1)).rejects.toThrow(/Ablaufzeitpunkt/)
    await expect(signBetaToken(SECRET, 1.5)).rejects.toThrow(/Ablaufzeitpunkt/)
  })
})

describe('verifyBetaToken', () => {
  it('nimmt ein frisches Token an', async () => {
    const token = await signBetaToken(SECRET, NOW + BETA_TOKEN_TTL_MS)
    expect(await verifyBetaToken(SECRET, token, NOW)).toBe(true)
  })

  it('weist ein abgelaufenes Token ab', async () => {
    const token = await signBetaToken(SECRET, NOW - 1)
    expect(await verifyBetaToken(SECRET, token, NOW)).toBe(false)
  })

  // Der Grenzfall gehört festgehalten: Genau auf der Sekunde ist der Zutritt
  // vorbei, nicht eine Millisekunde später.
  it('weist ein Token ab, das genau jetzt ablaeuft', async () => {
    const token = await signBetaToken(SECRET, NOW)
    expect(await verifyBetaToken(SECRET, token, NOW)).toBe(false)
    expect(await verifyBetaToken(SECRET, token, NOW - 1)).toBe(true)
  })

  it('weist ein Token mit einem anderen Geheimnis ab', async () => {
    const token = await signBetaToken('altes-passwort', NOW + BETA_TOKEN_TTL_MS)
    expect(await verifyBetaToken(SECRET, token, NOW)).toBe(false)
  })

  /**
   * Der Angriff, gegen den die Signatur überhaupt existiert: Das Ablaufdatum
   * steht im Klartext. Wer es hochsetzt, ändert die signierte Nachricht.
   */
  it('weist ein Token ab, dessen Ablaufdatum hochgesetzt wurde', async () => {
    const token = await signBetaToken(SECRET, NOW + 1000)
    const signature = token.split('.')[1] as string
    const verlaengert = `${NOW + 10 * BETA_TOKEN_TTL_MS}.${signature}`
    expect(await verifyBetaToken(SECRET, verlaengert, NOW)).toBe(false)
  })

  it('weist ein Token mit veraenderter Signatur ab', async () => {
    const token = await signBetaToken(SECRET, NOW + BETA_TOKEN_TTL_MS)
    const [expiry, signature] = token.split('.') as [string, string]
    const gedreht = signature[0] === 'a' ? `b${signature.slice(1)}` : `a${signature.slice(1)}`
    expect(await verifyBetaToken(SECRET, `${expiry}.${gedreht}`, NOW)).toBe(false)
  })

  /**
   * Beide Seiten fallen zu, wenn kein Passwort gesetzt ist — und das ist ein
   * gefundener Fehler, kein ausgedachter Fall: `crypto.subtle.importKey`
   * nimmt einen Schlüssel der Länge 0 nicht an und warf einen blanken
   * `OperationError`, der nichts über die Ursache sagte. Ausgerechnet der
   * wahrscheinlichste Betriebsfehler — Secret im Deployment vergessen — sah
   * damit aus wie ein Fehler in der Kryptografie.
   *
   * Signieren wirft jetzt mit Begründung; Prüfen sagt `false`, ohne die
   * Kryptografie überhaupt anzufassen. Ohne das Zweite käme jeder hinein, der
   * sich selbst ein gegen den leeren Schlüssel signiertes Token ausstellt.
   */
  it('kann ohne Passwort weder signieren noch etwas annehmen', async () => {
    await expect(signBetaToken('', NOW + BETA_TOKEN_TTL_MS)).rejects.toThrow(/Kein Beta-Passwort/)
    const fremd = await signBetaToken('irgendetwas', NOW + BETA_TOKEN_TTL_MS)
    expect(await verifyBetaToken('', fremd, NOW)).toBe(false)
    expect(await verifyBetaToken('', `${NOW + 1000}.${'a'.repeat(64)}`, NOW)).toBe(false)
  })

  it('weist Unfug ab, statt zu werfen', async () => {
    const unfug = [
      null,
      undefined,
      '',
      '.',
      '..',
      'abc',
      `${NOW + 1000}`,
      `${NOW + 1000}.`,
      `.${'a'.repeat(64)}`,
      `-1.${'a'.repeat(64)}`,
      `1e9.${'a'.repeat(64)}`,
      ` ${NOW + 1000}.${'a'.repeat(64)}`,
      `${NOW + 1000}.${'a'.repeat(64)}.${'b'.repeat(64)}`,
      `${'9'.repeat(30)}.${'a'.repeat(64)}`,
      'x'.repeat(5000),
    ]
    for (const token of unfug) {
      expect(await verifyBetaToken(SECRET, token, NOW), JSON.stringify(token)).toBe(false)
    }
  })

  it('weist ein Token ab, wenn die Uhr unbrauchbar ist', async () => {
    const token = await signBetaToken(SECRET, NOW + BETA_TOKEN_TTL_MS)
    expect(await verifyBetaToken(SECRET, token, Number.NaN)).toBe(false)
    expect(await verifyBetaToken(SECRET, token, Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('haelt beliebigem Beschuss stand und wirft nie', async () => {
    const next = lcg(20260907)
    const alphabet = '0123456789abcdef.-=; \t\n%$"\'\\äöü€'
    for (let round = 0; round < 400; round += 1) {
      let token = ''
      const length = next() % 90
      for (let i = 0; i < length; i += 1) {
        token += alphabet[next() % alphabet.length] as string
      }
      expect(await verifyBetaToken(SECRET, token, NOW), JSON.stringify(token)).toBe(false)
    }
  })
})

describe('readCookie', () => {
  it('findet den Wert zwischen anderen Cookies', () => {
    const header = `theme=dark; ${BETA_COOKIE}=abc123; other=1`
    expect(readCookie(header, BETA_COOKIE)).toBe('abc123')
  })

  it('kommt ohne Leerzeichen nach dem Semikolon aus', () => {
    expect(readCookie(`a=1;${BETA_COOKIE}=abc;b=2`, BETA_COOKIE)).toBe('abc')
  })

  it('nimmt den ersten Eintrag, wenn der Name doppelt vorkommt', () => {
    expect(readCookie(`${BETA_COOKIE}=erst; ${BETA_COOKIE}=zweit`, BETA_COOKIE)).toBe('erst')
  })

  /**
   * Der Fehler, den ein `includes` oder `endsWith` gemacht hätte: Ein
   * Nachbarcookie, dessen Name auf unseren endet, darf nicht durchgehen —
   * sonst setzt sich jeder sein eigenes `xknoellchenfrei_beta` und ist drin.
   */
  it('vergleicht den Namen genau, nicht als Endung', () => {
    expect(readCookie(`x${BETA_COOKIE}=abc`, BETA_COOKIE)).toBe(null)
    expect(readCookie(`${BETA_COOKIE}x=abc`, BETA_COOKIE)).toBe(null)
    expect(readCookie(`${BETA_COOKIE}_alt=abc`, BETA_COOKIE)).toBe(null)
  })

  it('behaelt Gleichheitszeichen im Wert', () => {
    expect(readCookie(`${BETA_COOKIE}=a=b=c`, BETA_COOKIE)).toBe('a=b=c')
  })

  it('liest ein leeres Cookie als nicht vorhanden', () => {
    expect(readCookie(`${BETA_COOKIE}=`, BETA_COOKIE)).toBe(null)
    expect(readCookie(`${BETA_COOKIE}=   `, BETA_COOKIE)).toBe(null)
  })

  it('gibt null zurueck, wenn es keinen Header gibt', () => {
    expect(readCookie(null, BETA_COOKIE)).toBe(null)
    expect(readCookie(undefined, BETA_COOKIE)).toBe(null)
    expect(readCookie('', BETA_COOKIE)).toBe(null)
    expect(readCookie('kaputt', BETA_COOKIE)).toBe(null)
    expect(readCookie(';;;', BETA_COOKIE)).toBe(null)
  })

  it('bricht einen ueberlangen Header ab, statt ihn zu durchsuchen', () => {
    const header = `${'a=1; '.repeat(3000)}${BETA_COOKIE}=abc`
    expect(header.length).toBeGreaterThan(8192)
    expect(readCookie(header, BETA_COOKIE)).toBe(null)
  })

  it('haelt beliebigem Beschuss stand und wirft nie', () => {
    const next = lcg(7092026)
    const alphabet = `=;, \t"'\\%${BETA_COOKIE}äöü`
    for (let round = 0; round < 400; round += 1) {
      let header = ''
      const length = next() % 120
      for (let i = 0; i < length; i += 1) header += alphabet[next() % alphabet.length] as string
      const value = readCookie(header, BETA_COOKIE)
      expect(value === null || typeof value === 'string', JSON.stringify(header)).toBe(true)
    }
  })
})

describe('constantTimeEqual', () => {
  it('erkennt Gleichheit und Ungleichheit', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
    expect(constantTimeEqual('', '')).toBe(true)
    expect(constantTimeEqual('abc', '')).toBe(false)
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
  })

  // Umlaute sind mehrere Bytes: Ein Vergleich über `length` statt über die
  // Kodierung ginge hier schief.
  it('vergleicht Bytes, nicht Zeichen', () => {
    expect(constantTimeEqual('äöü', 'äöü')).toBe(true)
    expect(constantTimeEqual('äöü', 'äöu')).toBe(false)
  })
})

describe('das Zusammenspiel', () => {
  it('traegt einen Zutritt vom Cookie bis zur Pruefung', async () => {
    const token = await signBetaToken(SECRET, NOW + BETA_TOKEN_TTL_MS)
    const header = `theme=dark; ${BETA_COOKIE}=${token}; sonst=1`
    const gelesen = readCookie(header, BETA_COOKIE)
    expect(await verifyBetaToken(SECRET, gelesen, NOW)).toBe(true)
    // …und einen Tag nach Ablauf nicht mehr.
    expect(await verifyBetaToken(SECRET, gelesen, NOW + BETA_TOKEN_TTL_MS + 1)).toBe(false)
  })
})
