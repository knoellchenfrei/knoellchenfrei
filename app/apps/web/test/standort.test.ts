import { describe, expect, it } from 'vitest'

import {
  GENAU,
  GROB,
  KEINE_POSITION,
  VERWEIGERT,
  ZEIT_ABGELAUFEN,
  holeStandort,
  standortFehlerText,
  type StandortQuelle,
} from '../src/standort.js'

/**
 * Der zweistufige Standort. Anlass: „Standort konnte nicht ermittelt werden"
 * bei eingeschaltetem GPS — der erste genaue Fix brauchte länger als die
 * Frist, und eine grobe Position hätte die Zone längst getroffen.
 */
const position = (lat: number): GeolocationPosition =>
  ({ coords: { latitude: lat, longitude: 13.4 }, timestamp: 0 }) as unknown as GeolocationPosition

const fehler = (code: number): GeolocationPositionError => ({ code, message: '' }) as GeolocationPositionError

/** Eine Quelle, die je Aufruf nach Skript antwortet und die Optionen mitschreibt. */
function quelle(skript: Array<{ ok?: number; code?: number }>): StandortQuelle & { optionen: PositionOptions[] } {
  const optionen: PositionOptions[] = []
  return {
    optionen,
    getCurrentPosition(ok, weh, opt) {
      optionen.push(opt ?? {})
      const schritt = skript[optionen.length - 1]
      if (schritt === undefined) throw new Error('kein Skript')
      if (schritt.ok !== undefined) ok(position(schritt.ok))
      else weh(fehler(schritt.code ?? 0))
    },
  }
}

describe('holeStandort', () => {
  it('nimmt den genauen Fix, wenn er kommt — ohne zweiten Aufruf', async () => {
    const q = quelle([{ ok: 52.5 }])
    const p = await holeStandort(q)
    expect(p.coords.latitude).toBe(52.5)
    expect(q.optionen).toEqual([GENAU])
  })

  it('versucht es nach einer Zeitüberschreitung grob und mit längerer Frist', async () => {
    const q = quelle([{ code: ZEIT_ABGELAUFEN }, { ok: 48.1 }])
    const p = await holeStandort(q)
    expect(p.coords.latitude).toBe(48.1)
    expect(q.optionen).toEqual([GENAU, GROB])
    expect(GROB.enableHighAccuracy).toBe(false)
    expect(GROB.timeout).toBeGreaterThan(GENAU.timeout ?? 0)
  })

  it('versucht es auch nach „nicht verfügbar" noch einmal', async () => {
    const q = quelle([{ code: KEINE_POSITION }, { ok: 48.1 }])
    await expect(holeStandort(q)).resolves.toBeTruthy()
    expect(q.optionen).toHaveLength(2)
  })

  it('bricht bei verweigerter Berechtigung sofort ab — ein zweiter Dialog käme nicht', async () => {
    const q = quelle([{ code: VERWEIGERT }, { ok: 48.1 }])
    await expect(holeStandort(q)).rejects.toMatchObject({ code: VERWEIGERT })
    expect(q.optionen).toHaveLength(1)
  })

  it('gibt nach der letzten Stufe deren Fehler zurück', async () => {
    const q = quelle([{ code: ZEIT_ABGELAUFEN }, { code: ZEIT_ABGELAUFEN }])
    await expect(holeStandort(q)).rejects.toMatchObject({ code: ZEIT_ABGELAUFEN })
    expect(q.optionen).toHaveLength(2)
  })

  it('nennt je Ursache eine andere Abhilfe', () => {
    expect(standortFehlerText({ code: VERWEIGERT })).toMatch(/eingebetteten/)
    expect(standortFehlerText({ code: ZEIT_ABGELAUFEN })).toMatch(/25 Sekunden/)
    expect(standortFehlerText({ code: KEINE_POSITION })).toMatch(/keine Position/)
    for (const code of [VERWEIGERT, ZEIT_ABGELAUFEN, KEINE_POSITION]) {
      expect(standortFehlerText({ code })).toMatch(/Karte/)
    }
  })
})
