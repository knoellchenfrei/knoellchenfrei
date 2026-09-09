import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `pwa.ts` — was aus der Seite eine App auf dem Homescreen macht. 0 %
 * Abdeckung bis zum 9. September; die Nachrichten-Zusicherung zwischen Seite
 * und Service Worker steht seit heute in `aktualisieren.test.ts`, der Rest
 * hier.
 *
 * Zwei Erkennungen entscheiden, was jemand überhaupt zu sehen bekommt, und
 * beide sind Sonderfälle, die man nicht errät:
 *
 * 1. **Apple meldet iPads seit iPadOS 13 als `Macintosh`.** Ohne den Zusatz
 *    mit den Berührungspunkten fällt jedes iPad in „kein Weg bekannt" — es
 *    bekommt weder den Dialog (den gibt es dort nicht) noch die Anleitung über
 *    das Teilen-Menü, also gar nichts.
 * 2. **Safari kennt `display-mode: standalone` auf dem iPhone nicht** und
 *    setzt stattdessen ein seit Jahren nicht standardisiertes Merkmal. Wer nur
 *    auf die Medienabfrage sieht, bietet einer bereits abgelegten App an, sie
 *    abzulegen.
 */

interface Umgebung {
  ua?: string
  touchPoints?: number
  standalone?: boolean
  medienTreffer?: boolean
}

function stelle({ ua = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140', touchPoints = 0, standalone, medienTreffer = false }: Umgebung = {}): void {
  const navigator: Record<string, unknown> = { userAgent: ua, maxTouchPoints: touchPoints }
  if (standalone !== undefined) navigator['standalone'] = standalone
  vi.stubGlobal('navigator', navigator)
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: medienTreffer }),
    navigator,
    addEventListener: () => undefined,
  })
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('läuft die Seite schon als abgelegte App?', () => {
  it('ja, wenn die Medienabfrage das sagt', async () => {
    stelle({ medienTreffer: true })
    const { isStandalone } = await import('../src/pwa.js')
    expect(isStandalone()).toBe(true)
  })

  it('ja auch auf dem iPhone, wo es die Medienabfrage nicht gibt', async () => {
    stelle({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', standalone: true })
    const { isStandalone } = await import('../src/pwa.js')
    expect(isStandalone()).toBe(true)
  })

  it('nein im gewöhnlichen Tab', async () => {
    stelle()
    const { isStandalone } = await import('../src/pwa.js')
    expect(isStandalone()).toBe(false)
  })

  it('nein ohne Fenster — dann gibt es gar keine Seite', async () => {
    vi.stubGlobal('window', undefined)
    const { isStandalone } = await import('../src/pwa.js')
    expect(isStandalone()).toBe(false)
  })
})

describe('was angeboten wird, und wem', () => {
  const zustand = async (u: Umgebung) => {
    stelle(u)
    const { startInstallWatch, installState } = await import('../src/pwa.js')
    startInstallWatch()
    return installState().kind
  }

  it('einer bereits abgelegten App wird nichts angeboten', async () => {
    expect(await zustand({ medienTreffer: true })).toBe('installed')
  })

  it('das iPhone bekommt die Anleitung', async () => {
    expect(await zustand({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' })).toBe('ios')
  })

  it('das iPad meldet sich als Macintosh — und wird trotzdem erkannt', async () => {
    // Der Zusatz, ohne den jedes iPad in „kein Weg bekannt" fiele.
    expect(await zustand({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touchPoints: 5 })).toBe('ios')
  })

  it('ein echter Mac meldet null Berührungspunkte und bekommt keine iOS-Anleitung', async () => {
    expect(await zustand({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touchPoints: 0 })).toBe('none')
  })

  it('ein Browser ohne Angebot bekommt nichts vorgegaukelt', async () => {
    expect(await zustand({})).toBe('none')
  })
})

describe('der Beobachter meldet den Stand sofort', () => {
  it('wer sich anmeldet, bekommt den aktuellen Zustand ohne zu warten', async () => {
    stelle({ medienTreffer: true })
    const { startInstallWatch, watchInstall } = await import('../src/pwa.js')
    startInstallWatch()
    const gesehen: string[] = []
    const ab = watchInstall((zustand) => gesehen.push(zustand.kind))
    expect(gesehen).toEqual(['installed'])
    ab()
  })

  it('nach dem Abmelden kommt nichts mehr', async () => {
    stelle()
    const { watchInstall, install } = await import('../src/pwa.js')
    const gesehen: string[] = []
    const ab = watchInstall((zustand) => gesehen.push(zustand.kind))
    ab()
    // Ohne hinterlegtes Angebot meldet `install` „unsupported" und ruft
    // niemanden — der Zähler darf sich trotzdem nicht bewegen.
    await expect(install()).resolves.toBe('unsupported')
    expect(gesehen).toHaveLength(1)
  })
})
