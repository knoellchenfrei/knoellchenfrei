import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { alterInTagen, geprueftAm } from '../src/abruf-zeit.js'

/**
 * Der Zeitpunkt des letzten erfolgreichen Abrufs, aus den Rohdateien gelesen.
 * Der Git-Zeitstempel misst „zuletzt geändert"; dieser hier „zuletzt geholt".
 */
describe('geprueftAm', () => {
  const ordner: string[] = []
  const neu = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'abruf-'))
    ordner.push(dir)
    return dir
  }
  afterEach(() => {
    for (const dir of ordner.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('nennt den ältesten Zeitpunkt, nicht den jüngsten — eine gescheiterte Ebene bleibt alt', () => {
    const dir = neu()
    const alt = new Date('2026-09-01T04:17:00Z')
    const frisch = new Date('2026-09-09T04:17:00Z')
    writeFileSync(join(dir, 'zones.json'), '{}')
    writeFileSync(join(dir, 'districts.json'), '{}')
    utimesSync(join(dir, 'zones.json'), frisch, frisch)
    utimesSync(join(dir, 'districts.json'), alt, alt)
    expect(geprueftAm(dir)).toBe('2026-09-01T04:17:00.000Z')
  })

  it('rundet auf die Minute', () => {
    const dir = neu()
    writeFileSync(join(dir, 'zones.json'), '{}')
    const at = new Date('2026-09-09T04:17:42.500Z')
    utimesSync(join(dir, 'zones.json'), at, at)
    expect(geprueftAm(dir)).toBe('2026-09-09T04:17:00.000Z')
  })

  it('erfindet ohne Rohdaten kein Datum', () => {
    expect(geprueftAm(join(neu(), 'gibt-es-nicht'))).toBeNull()
    expect(geprueftAm(neu())).toBeNull()
  })
})

describe('alterInTagen', () => {
  const jetzt = Date.parse('2026-09-09T12:00:00Z')
  it('zählt volle Tage', () => {
    expect(alterInTagen('2026-09-09T04:17:00Z', jetzt)).toBe(0)
    expect(alterInTagen('2026-09-01T04:17:00Z', jetzt)).toBe(8)
  })
  it('gibt für Fehlendes oder Unlesbares null zurück', () => {
    expect(alterInTagen(null, jetzt)).toBeNull()
    expect(alterInTagen(undefined, jetzt)).toBeNull()
    expect(alterInTagen('gestern', jetzt)).toBeNull()
  })
})
