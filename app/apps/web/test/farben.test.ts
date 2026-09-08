import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Die Farben, die eine Aussage tragen — geprüft statt behauptet.
 *
 * Anlass ist eine Behauptung, die nicht stimmte: Der Werkbericht der ersten
 * Sitzung nennt „axe über 9 Zustände, WCAG AA". **In diesem Repository gibt es
 * kein axe** — es ist beim Umzug nicht mitgekommen, und die 154 E2E-Tests
 * prüfen ARIA-Auszeichnungen, aber keinen einzigen Kontrast. Als am
 * 8. September die Zonenfarbe gewechselt wurde, stand also nichts zwischen
 * einer Farbwahl und einem unlesbaren Etikett.
 *
 * Zwei Zusicherungen, beide aus dem Quelltext gelesen und nicht abgeschrieben:
 * die Etiketten erreichen AA, und **Panel und Karte sagen dasselbe**.
 */

const CSS = readFileSync(join(import.meta.dirname, '../src/styles.css'), 'utf8')
const APP = readFileSync(join(import.meta.dirname, '../src/App.tsx'), 'utf8')

type Rgb = readonly [number, number, number]

const ausHex = (hex: string): Rgb => {
  const roh = hex.replace('#', '')
  const voll = roh.length === 3 ? [...roh].map((z) => z + z).join('') : roh
  return [0, 2, 4].map((i) => parseInt(voll.slice(i, i + 2), 16)) as unknown as Rgb
}

/** sRGB → lineares Licht, wie WCAG 2 es vorschreibt. */
const linear = (kanal: number): number => {
  const s = kanal / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

const leuchtdichte = (farbe: Rgb): number =>
  0.2126 * linear(farbe[0]) + 0.7152 * linear(farbe[1]) + 0.0722 * linear(farbe[2])

const verhaeltnis = (a: Rgb, b: Rgb): number => {
  const [hell, dunkel] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x)
  return ((hell as number) + 0.05) / ((dunkel as number) + 0.05)
}

/** `rgba(farbe, alpha)` über einem deckenden Untergrund. */
const mischen = (vorne: Rgb, alpha: number, hinten: Rgb): Rgb =>
  vorne.map((k, i) => k * alpha + (hinten[i] as number) * (1 - alpha)) as unknown as Rgb

/** Eine CSS-Variable aus `:root`. */
function variable(name: string): string {
  const treffer = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`).exec(CSS)
  expect(treffer, `--${name} steht nicht in styles.css`).not.toBeNull()
  return (treffer as RegExpExecArray)[1] as string
}

/** Grundfarbe und Deckkraft einer Badge-Regel. */
function badgeGrund(klasse: string): { farbe: Rgb; alpha: number } {
  const treffer = new RegExp(
    `\\.badge--${klasse}\\s*\\{[^}]*background:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)`
  ).exec(CSS)
  expect(treffer, `.badge--${klasse} hat keinen rgba-Grund`).not.toBeNull()
  const t = treffer as RegExpExecArray
  return {
    farbe: [Number(t[1]), Number(t[2]), Number(t[3])] as unknown as Rgb,
    alpha: Number(t[4]),
  }
}

describe('die Etiketten im Panel', () => {
  const panel = ausHex(variable('panel'))

  /**
   * 4,5:1 ist AA für kleinen Text, und das Etikett ist mit 11 px genau das.
   * Der Untergrund ist `.panel` — `rgba(23, 28, 34, 0.96)`, also praktisch
   * `--panel`; die vier Prozent Karte darunter verschieben die Leuchtdichte
   * um weniger als ein Hundertstel.
   */
  for (const [klasse, token] of [
    ['paid', 'paid'],
    ['free', 'free'],
  ] as const) {
    it(`.badge--${klasse} erreicht WCAG AA für kleinen Text`, () => {
      const { farbe, alpha } = badgeGrund(klasse)
      const grund = mischen(farbe, alpha, panel)
      const text = ausHex(variable(token))
      expect(verhaeltnis(text, grund)).toBeGreaterThanOrEqual(4.5)
    })
  }

  /**
   * Der Grund eines Etiketts ist dieselbe Farbe wie seine Schrift, nur
   * durchscheinend. Läuft das auseinander, sieht es aus wie ein Tippfehler und
   * ist einer — und beim Wechsel auf Messing wäre genau das passiert, wenn nur
   * das Token angefasst worden wäre.
   */
  for (const [klasse, token] of [
    ['paid', 'paid'],
    ['free', 'free'],
  ] as const) {
    it(`.badge--${klasse} nimmt den Grund aus derselben Farbe wie die Schrift`, () => {
      expect(badgeGrund(klasse).farbe).toEqual(ausHex(variable(token)))
    })
  }
})

describe('Panel und Karte', () => {
  /**
   * Die beiden Zweige eines Farbausdrucks des Zonenlayers, kassierend zuerst.
   *
   * Ab dem Schlüsselwort die nächsten beiden Hex-Werte nehmen, statt den Block
   * zu klammern: Der `case`-Ausdruck enthält verschachtelte Arrays, und ein
   * nicht-gieriges `[\s\S]*?\],` endet schon am `],` des `boolean`-Zweigs.
   * Der erste Anlauf tat genau das und fand null Farben — gemeldet vom eigenen
   * Test, bevor er etwas Falsches zugesichert hat.
   */
  function zonenFarben(layer: string, eigenschaft: string): { kassierend: string; frei: string } {
    // Erst den Layer suchen, dann die Eigenschaft darin. Ohne den ersten
    // Schritt findet `line-color` die **Bezirksgrenzen** (`#2b3440`), die
    // weiter oben stehen — der zweite Anlauf dieses Tests ist genau darauf
    // hereingefallen und hat es selbst gemeldet.
    const layerAb = APP.indexOf(`id: '${layer}'`)
    expect(layerAb, `der Layer ${layer} steht nicht mehr in App.tsx`).toBeGreaterThan(-1)
    const ab = APP.indexOf(`'${eigenschaft}'`, layerAb)
    expect(ab, `${eigenschaft} steht nicht mehr in ${layer}`).toBeGreaterThan(-1)
    const hexe = [...APP.slice(ab, ab + 2000).matchAll(/'(#[0-9a-fA-F]{6})'/g)]
      .map((t) => t[1] as string)
      .slice(0, 2)
    expect(hexe, `zwei Farben in ${layer}/${eigenschaft} erwartet`).toHaveLength(2)
    return { kassierend: hexe[0] as string, frei: hexe[1] as string }
  }

  /**
   * **Panel und Karte dürfen nicht zweierlei sagen** — verglichen wird mit der
   * **Kontur**, nicht mit der Füllung.
   *
   * Ein Zustand hat auf der Karte zwei Werte: eine Füllung, die bei 26 %
   * Deckkraft über dem dunklen Grund liegt, und eine Kontur, die bei voller
   * Deckung die Grenze zieht. Das Etikett ist 11 px grosser Text und braucht
   * Kontrast — es kann nur die helle der beiden nehmen. Die Füllung als
   * Schriftfarbe käme auf 2,4:1 und wäre unlesbar.
   *
   * Diese Unterscheidung ist beim Schreiben des Tests aufgefallen: Die erste
   * Fassung verglich mit der Füllung und schlug fehl. Sie hatte unrecht, nicht
   * der Code.
   */
  it('nimmt für „kostenpflichtig" die Konturfarbe der Karte', () => {
    expect(zonenFarben('zones-line', 'line-color').kassierend.toLowerCase()).toBe(variable('paid').toLowerCase())
  })

  it('nimmt für „gebührenfrei" die Konturfarbe der Karte', () => {
    expect(zonenFarben('zones-line', 'line-color').frei.toLowerCase()).toBe(variable('free').toLowerCase())
  })

  /**
   * Und die Füllung bleibt die dunklere von beiden. Wären sie vertauscht, läge
   * die helle Fläche über der Karte und die dunkle Linie darauf — die Zonen
   * würden die Karte überstimmen statt sie zu ergänzen.
   */
  it('hält die Füllung dunkler als die Kontur', () => {
    const fuellung = zonenFarben('zones-fill', 'fill-color')
    const kontur = zonenFarben('zones-line', 'line-color')
    for (const zustand of ['kassierend', 'frei'] as const) {
      expect(
        verhaeltnis(ausHex(kontur[zustand]), ausHex('#0f1216')),
        zustand
      ).toBeGreaterThan(verhaeltnis(ausHex(fuellung[zustand]), ausHex('#0f1216')))
    }
  })
})
