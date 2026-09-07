import { describe, expect, it } from 'vitest'

import {
  BERLIN,
  CITIES,
  cityAt,
  cityByKey,
  FRANKFURT,
  HAMBURG,
  MUENCHEN,
  suggestCity,
  withinCity,
  withinCitySession,
} from '../src/city.js'

describe('cityByKey', () => {
  it('finds a city by its key', () => {
    expect(cityByKey('berlin')).toBe(BERLIN)
    expect(cityByKey('hamburg')).toBe(HAMBURG)
    expect(cityByKey('frankfurt')).toBe(FRANKFURT)
    expect(cityByKey('muenchen')).toBe(MUENCHEN)
  })

  // Der Rückfall auf Berlin ist genau der Fehler, den diese Funktion nicht
  // machen darf: Eine Hamburger Instanz mit einem Tippfehler in der
  // Konfiguration würde dann jede Hamburger Meldung mit "position outside"
  // abweisen, und im Log stünde nichts, was danach aussieht.
  it('throws on an unknown key instead of falling back', () => {
    expect(() => cityByKey('münchen')).toThrow(/münchen/)
    expect(() => cityByKey('')).toThrow()
  })

  it('names the keys it does know, so the error is actionable', () => {
    expect(() => cityByKey('kiel')).toThrow(/berlin, hamburg/)
  })
})

describe('city keys', () => {
  it('keeps keys unique — a duplicate would shadow a city silently', () => {
    expect(new Set(CITIES.map((city) => city.key)).size).toBe(CITIES.length)
  })

  it('uses keys that survive a URL and a file name', () => {
    for (const city of CITIES) expect(city.key).toMatch(/^[a-z][a-z0-9-]*$/)
  })
})

describe('withinCity', () => {
  it('accepts the Brandenburger Tor for Berlin and refuses it for Hamburg', () => {
    expect(withinCity(BERLIN, 13.3777, 52.5163)).toBe(true)
    expect(withinCity(HAMBURG, 13.3777, 52.5163)).toBe(false)
  })

  it('accepts the Hamburger Rathausmarkt for Hamburg and refuses it for Berlin', () => {
    expect(withinCity(HAMBURG, 9.9924, 53.5503)).toBe(true)
    expect(withinCity(BERLIN, 9.9924, 53.5503)).toBe(false)
  })

  // Der Roemer. Frankfurt liegt westlich von Hamburg und suedlich davon --
  // beide Achsen trennen, aber nur eine muss es tun.
  it('accepts the Frankfurter Roemer for Frankfurt and refuses it for the other two', () => {
    expect(withinCity(FRANKFURT, 8.6821, 50.1109)).toBe(true)
    expect(withinCity(BERLIN, 8.6821, 50.1109)).toBe(false)
    expect(withinCity(HAMBURG, 8.6821, 50.1109)).toBe(false)
  })

  // Der Grund, warum die Box aus dem Stadtteil-Umriss kommt und nicht aus der
  // amtlichen Ausdehnung um den Roemer: Die haette 8,52 als Westrand ergeben,
  // und Hoechst laege draussen. Wer dort meldet, bekaeme "ausserhalb".
  it('reaches Hoechst in the west and Nieder-Erlenbach in the north', () => {
    expect(withinCity(FRANKFURT, 8.5432, 50.0975)).toBe(true) // Hoechst, Bolongaropalast
    expect(withinCity(FRANKFURT, 8.7053, 50.2189)).toBe(true) // Nieder-Erlenbach
  })

  // Die Boxen dürfen sich nicht berühren. Täten sie es, gäbe es Punkte,
  // die zwei Städten gehören, und die Frage "welche Zonendaten gelten hier"
  // hätte zwei Antworten.
  it('accepts the Marienplatz for München and refuses it for the other three', () => {
    expect(withinCity(MUENCHEN, 11.5755, 48.1372)).toBe(true)
    expect(withinCity(BERLIN, 11.5755, 48.1372)).toBe(false)
    expect(withinCity(HAMBURG, 11.5755, 48.1372)).toBe(false)
    expect(withinCity(FRANKFURT, 11.5755, 48.1372)).toBe(false)
  })

  // Die Box kommt aus dem Umriss der 25 Stadtbezirke, nicht aus der
  // Parkebene: Im Westen und Norden wird nicht bewirtschaftet, und wer die
  // Grenze von dort nähme, wiese eine Meldung aus Lochhausen als „außerhalb"
  // ab, obwohl sie mitten in München liegt.
  it('reaches Lochhausen in the west and Feldmoching in the north', () => {
    expect(withinCity(MUENCHEN, 11.375, 48.185)).toBe(true) // Aubing-Lochhausen
    expect(withinCity(MUENCHEN, 11.545, 48.235)).toBe(true) // Feldmoching
  })

  /**
   * Keine zwei Boxen dürfen sich überlappen.
   *
   * `cityAt` nimmt die erste passende Stadt — das ist nur eindeutig, solange
   * die Boxen disjunkt sind. Paarweise geprüft statt in einer Kette: Mit vier
   * Städten sind es sechs Paare, und eine Kette aus drei Vergleichen ließe drei
   * davon ungeprüft.
   */
  it('keeps the boxes apart', () => {
    const overlaps = (a: typeof BERLIN, b: typeof BERLIN): boolean =>
      a.reportBounds.minLon <= b.reportBounds.maxLon &&
      b.reportBounds.minLon <= a.reportBounds.maxLon &&
      a.reportBounds.minLat <= b.reportBounds.maxLat &&
      b.reportBounds.minLat <= a.reportBounds.maxLat
    for (const a of CITIES) {
      for (const b of CITIES) {
        if (a === b) continue
        expect(overlaps(a, b), `${a.key} / ${b.key}`).toBe(false)
      }
    }
  })

  it('refuses NaN and Infinity rather than letting them through a comparison', () => {
    // `NaN > x` ist false, `NaN < x` auch — eine Prüfung aus zwei negierten
    // Vergleichen liesse NaN durch. Diese hier nicht.
    expect(withinCity(BERLIN, Number.NaN, 52.5)).toBe(false)
    expect(withinCity(BERLIN, 13.4, Number.NaN)).toBe(false)
    expect(withinCity(BERLIN, Infinity, 52.5)).toBe(false)
    expect(withinCity(BERLIN, 13.4, -Infinity)).toBe(false)
  })

  it('treats the edges as inside', () => {
    const { minLon, minLat, maxLon, maxLat } = BERLIN.reportBounds
    expect(withinCity(BERLIN, minLon, minLat)).toBe(true)
    expect(withinCity(BERLIN, maxLon, maxLat)).toBe(true)
  })
})

describe('withinCitySession', () => {
  it('is wider than the report box in every direction', () => {
    for (const city of CITIES) {
      expect(city.sessionBounds.minLon).toBeLessThan(city.reportBounds.minLon)
      expect(city.sessionBounds.minLat).toBeLessThan(city.reportBounds.minLat)
      expect(city.sessionBounds.maxLon).toBeGreaterThan(city.reportBounds.maxLon)
      expect(city.sessionBounds.maxLat).toBeGreaterThan(city.reportBounds.maxLat)
    }
  })

  // Wer am Stadtrand parkt und über die Grenze läuft, soll seine Uhr behalten.
  it('accepts a spot just outside the report box', () => {
    const justOutside = BERLIN.reportBounds.maxLon + 0.05
    expect(withinCity(BERLIN, justOutside, 52.5)).toBe(false)
    expect(withinCitySession(BERLIN, justOutside, 52.5)).toBe(true)
  })

  it('still refuses a spot in another city', () => {
    expect(withinCitySession(BERLIN, 9.9924, 53.5503)).toBe(false)
  })
})

describe('Kartenmittelpunkt', () => {
  it('lies inside the city it belongs to', () => {
    for (const city of CITIES) {
      expect(withinCity(city, city.center[0], city.center[1])).toBe(true)
    }
  })
})

describe('Quellenangabe', () => {
  // Der Unterschied ist Lizenzbedingung, keine Kosmetik: Berlin gibt unter
  // DL-DE/Zero heraus, Hamburg unter DL-DE/Namensnennung. Eine Oberfläche,
  // die die Hamburger Quelle verschweigt, verletzt die Lizenz.
  it('marks Hamburg and Frankfurt as requiring attribution and Berlin as not', () => {
    expect(BERLIN.attribution.attributionRequired).toBe(false)
    expect(HAMBURG.attribution.attributionRequired).toBe(true)
    expect(FRANKFURT.attribution.attributionRequired).toBe(true)
  })

  // Woertlich der Quellenvermerk des ISO-Metadatensatzes. Bei
  // DL-DE/Namensnennung ist er Lizenzbedingung -- eine Umformulierung erfuellt
  // sie nicht mehr sicher, und genau deshalb steht der Wortlaut in einem Test.
  it('keeps the Frankfurt source note verbatim', () => {
    expect(FRANKFURT.attribution.source).toBe('Stadt Frankfurt am Main, www.frankfurt.de')
    expect(FRANKFURT.attribution.licenceUrl).toBe('https://www.govdata.de/dl-de/by-2-0')
  })

  it('keeps the München source note verbatim', () => {
    // Woertlich aus den ISO-Metadatensaetzen beider Parkebenen, samt
    // fuehrendem "Datenquelle:" und Halbgeviertstrich. Die Stadt schreibt den
    // Vermerk so vor; ihn zu kuerzen waere schoener und nicht mehr derselbe.
    expect(MUENCHEN.attribution.source).toBe(
      'Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de'
    )
    expect(MUENCHEN.attribution.attributionRequired).toBe(true)
    expect(MUENCHEN.attribution.licenceUrl).toBe('https://www.govdata.de/dl-de/by-2-0')
  })

  it('names a licence and a link for every city', () => {
    for (const city of CITIES) {
      expect(city.attribution.licence.length).toBeGreaterThan(0)
      expect(city.attribution.licenceUrl).toMatch(/^https:\/\//)
      expect(city.attribution.source.length).toBeGreaterThan(0)
    }
  })
})

/**
 * Stadtspezifische Feiertage.
 *
 * Der Ausnahmefall, für den `City.holidays` überhaupt existiert: In Bayern
 * gilt Mariä Himmelfahrt gemeindeweise. Drei der vier Städte brauchen das
 * Feld nicht, und es fehlt bei ihnen auch — ein leeres Array wäre eine
 * Behauptung, die niemand geprüft hat.
 */
describe('Feiertage der Stadt', () => {
  it('gives München Mariä Himmelfahrt and the other three nothing', () => {
    expect(MUENCHEN.holidays).toEqual(['08-15'])
    expect(BERLIN.holidays).toBeUndefined()
    expect(HAMBURG.holidays).toBeUndefined()
    expect(FRANKFURT.holidays).toBeUndefined()
  })

  it('writes every city holiday as MM-TT, the form holidaysFor accepts', () => {
    for (const city of CITIES) {
      for (const date of city.holidays ?? []) expect(date, city.key).toMatch(/^\d{2}-\d{2}$/)
    }
  })
})

describe('cityAt', () => {
  // Der Fehler, den diese Funktion behebt: Der Worker war auf **eine** Stadt
  // konfiguriert und beantwortete genau diesen Punkt — den Hamburger
  // Rathausmarkt — mit `422 position outside Berlin`.
  it('resolves the Marienplatz to München', () => {
    expect(cityAt(11.5755, 48.1372)).toBe(MUENCHEN)
  })

  it('resolves a Hamburg position to Hamburg instead of refusing it', () => {
    expect(cityAt(9.9924, 53.5503)).toBe(HAMBURG)
    expect(cityAt(13.3777, 52.5163)).toBe(BERLIN)
  })

  // Der Telegram-Parser und der Worker leiten die Stadt allein aus dem Punkt
  // ab. Ohne diesen Treffer bekaeme eine Frankfurter Meldung
  // `422 position outside` -- in der App sieht das aus, als sei das Melden
  // kaputt, und im Log steht nichts, was nach einem Fehler aussieht.
  it('resolves a Frankfurt position to Frankfurt', () => {
    expect(cityAt(8.6821, 50.1109)).toBe(FRANKFURT) // Roemer
    expect(cityAt(8.6638, 50.1188)).toBe(FRANKFURT) // Hauptwache
  })

  // Mainz und Offenbach liegen gleich nebenan und gehoeren nicht dazu. Ein
  // Rueckfall wuerde eine Mainzer Meldung als Frankfurter Zeile speichern.
  it('does not swallow the neighbouring cities', () => {
    expect(cityAt(8.2473, 49.9929)).toBeUndefined() // Mainz
    expect(cityAt(8.9167, 50.0956)).toBeUndefined() // Offenbach, Rathaus
  })

  // Kein Rückfall auf Berlin: Zwischen den beiden Städten liegt keine, und
  // genau das muss die Antwort sein. Eine Meldung von hier als Berliner Zeile
  // zu speichern wäre falsch und nirgends zu sehen.
  it('returns undefined between the cities', () => {
    // Lüneburger Heide, ungefähr auf halbem Weg.
    expect(cityAt(10.4, 53.0)).toBeUndefined()
    // Nürnberg — eine echte Stadt, nur keine, die wir kennen. Und die
    // gleiche Prüfung wie vorher mit München, das inzwischen dazugehört: Ein
    // Punkt in Bayern ist noch kein Punkt in München.
    expect(cityAt(11.0775, 49.4539)).toBeUndefined()
    // Kassel, ebenfalls Hessen: Das Bundesland macht noch keine Stadt.
    expect(cityAt(9.4797, 51.3127)).toBeUndefined()
    // Und dasselbe für Bayern: Augsburg ist nicht München.
    expect(cityAt(10.8978, 48.3705)).toBeUndefined()
  })

  it('accepts a point just inside each city and refuses one just outside', () => {
    for (const city of CITIES) {
      const { minLon, minLat, maxLon, maxLat } = city.reportBounds
      expect(cityAt(minLon + 0.001, minLat + 0.001)).toBe(city)
      expect(cityAt(maxLon - 0.001, maxLat - 0.001)).toBe(city)
      expect(cityAt(maxLon + 0.001, maxLat + 0.001)).toBeUndefined()
      expect(cityAt(minLon - 0.001, minLat - 0.001)).toBeUndefined()
    }
  })

  it('treats the edges as inside, like withinCity does', () => {
    const { minLon, minLat } = HAMBURG.reportBounds
    expect(cityAt(minLon, minLat)).toBe(HAMBURG)
  })

  it('refuses NaN and Infinity rather than picking whichever city compares first', () => {
    expect(cityAt(Number.NaN, 52.5)).toBeUndefined()
    expect(cityAt(13.4, Number.NaN)).toBeUndefined()
    expect(cityAt(Infinity, Infinity)).toBeUndefined()
  })

  it('finds every city by its own centre', () => {
    for (const city of CITIES) expect(cityAt(city.center[0], city.center[1])).toBe(city)
  })

  // "Die erste passende Stadt gewinnt" ist nur dann eine Antwort und keine
  // Auslosung, wenn kein Punkt in zwei Boxen liegt. Der Test hält das für
  // jedes künftige Paar fest, nicht nur für Berlin und Hamburg.
  it('has no point that belongs to two cities', () => {
    for (const a of CITIES) {
      for (const b of CITIES) {
        if (a === b) continue
        const disjoint =
          a.reportBounds.maxLon < b.reportBounds.minLon ||
          b.reportBounds.maxLon < a.reportBounds.minLon ||
          a.reportBounds.maxLat < b.reportBounds.minLat ||
          b.reportBounds.maxLat < a.reportBounds.minLat
        expect(disjoint).toBe(true)
      }
    }
  })

  // Eine Instanz darf die Auswahl einschränken; dann ist derselbe Punkt keine
  // Meldung mehr, statt der falschen Stadt zugeschlagen zu werden.
  it('honours a restricted list of cities', () => {
    expect(cityAt(9.9924, 53.5503, [BERLIN])).toBeUndefined()
    expect(cityAt(9.9924, 53.5503, [HAMBURG])).toBe(HAMBURG)
    expect(cityAt(8.6821, 50.1109, [BERLIN, HAMBURG])).toBeUndefined()
    expect(cityAt(13.3777, 52.5163, [])).toBeUndefined()
  })
})

/**
 * Der Standort-Vorschlag.
 *
 * Er darf in genau einem Fall erscheinen — die Position liegt in einer anderen
 * anzeigbaren Stadt als der geladenen, und niemand hat ihn dort schon
 * weggeklickt. Jeder andere Fall ist eine Störung oder eine Fehlfunktion, und
 * jeder hat unten einen eigenen Test.
 */
describe('suggestCity', () => {
  const MARIENPLATZ: [number, number] = [11.5755, 48.1372]
  const BRANDENBURGER_TOR: [number, number] = [13.3777, 52.5163]

  it('suggests the city the position is in', () => {
    expect(suggestCity(BERLIN, ...MARIENPLATZ)).toBe(MUENCHEN)
    expect(suggestCity(MUENCHEN, ...BRANDENBURGER_TOR)).toBe(BERLIN)
  })

  // Der häufigste Fall überhaupt: Wer in der Stadt steht, die die App zeigt,
  // soll nichts davon merken, dass es diesen Hinweis gibt.
  it('stays silent in the city that is already loaded', () => {
    expect(suggestCity(BERLIN, ...BRANDENBURGER_TOR)).toBeNull()
    expect(suggestCity(MUENCHEN, ...MARIENPLATZ)).toBeNull()
  })

  // Kiel kennt die App nicht. Die nächstgelegene Stadt anzubieten wäre
  // geraten; hier bleibt es bei der bestehenden Antwort "ausserhalb der
  // Parkraumbewirtschaftung".
  it('stays silent outside every city', () => {
    expect(suggestCity(BERLIN, 10.1228, 54.3233)).toBeNull()
    expect(suggestCity(MUENCHEN, 0, 0)).toBeNull()
  })

  it('stays silent for a suggestion that was already declined', () => {
    expect(suggestCity(BERLIN, ...MARIENPLATZ, ['muenchen'])).toBeNull()
  })

  // Die Ablehnung gilt der abgelehnten Stadt, nicht dem Hinweis als solchem:
  // Wer in München "hier bleiben" gesagt hat, soll in Hamburg trotzdem gefragt
  // werden.
  it('declines only the city that was declined', () => {
    expect(suggestCity(BERLIN, ...MARIENPLATZ, ['hamburg', 'frankfurt'])).toBe(MUENCHEN)
    expect(suggestCity(BERLIN, 9.9924, 53.5503, ['muenchen'])).toBe(HAMBURG)
  })

  // Müll im Speicher darf nicht wirken wie eine Ablehnung — und auch nicht wie
  // ihr Gegenteil. Ein Schlüssel, den es nicht gibt, ist schlicht folgenlos.
  it('ignores keys in the dismissed list that name no city', () => {
    expect(suggestCity(BERLIN, ...MARIENPLATZ, ['', 'köln', 'muenchen '])).toBe(MUENCHEN)
  })

  // Im Artifact ist umschaltbar nur, was eingebettet ist. Ein Vorschlag, dessen
  // Annahme in "Diese Fassung enthält muenchen nicht" endet, wäre schlimmer
  // als keiner.
  it('suggests only cities this deployment can switch to', () => {
    expect(suggestCity(BERLIN, ...MARIENPLATZ, [], [BERLIN, HAMBURG])).toBeNull()
    expect(suggestCity(BERLIN, ...MARIENPLATZ, [], [BERLIN, MUENCHEN])).toBe(MUENCHEN)
  })

  // Verglichen wird über den Schlüssel. Eine eingeschränkte Liste kann Kopien
  // enthalten; ein Identitätsvergleich schlüge dort die laufende Stadt sich
  // selbst vor — der Hinweis stünde dann dauerhaft und ohne Ausweg da.
  it('compares by key, not by object identity', () => {
    const copy = { ...BERLIN }
    expect(suggestCity(copy, ...BRANDENBURGER_TOR)).toBeNull()
  })

  it('rejects coordinates that are not numbers', () => {
    expect(suggestCity(BERLIN, Number.NaN, 48.1372)).toBeNull()
    expect(suggestCity(BERLIN, 11.5755, Number.POSITIVE_INFINITY)).toBeNull()
  })

  // Über alle Städte statt über ein Paar: Käme eine fünfte dazu, deren Box eine
  // bestehende schneidet, fiele es hier auf und nicht erst im Betrieb.
  it('suggests each city at its own centre, and only to the others', () => {
    for (const from of CITIES) {
      for (const to of CITIES) {
        const suggestion = suggestCity(from, to.center[0], to.center[1])
        expect(suggestion).toBe(from.key === to.key ? null : to)
      }
    }
  })
})

/**
 * Die Lizenzangaben sind kein Beiwerk, sondern bei drei der vier Städte eine
 * Auflage. Eine Stadt, die ohne Quellenvermerk oder ohne Datensatz-Adresse
 * dazukommt, verletzt sie — und das fiele niemandem auf, weil die Oberfläche
 * dann einfach ein leeres Feld zeigt (Audit-Punkt M-016).
 */
describe('die Lizenzangaben jeder Stadt', () => {
  for (const city of CITIES) {
    it(`${city.name} nennt Quelle, Lizenz und Datensatz`, () => {
      expect(city.attribution.source.trim().length).toBeGreaterThan(0)
      expect(city.attribution.licence.trim().length).toBeGreaterThan(0)
      expect(city.attribution.licenceUrl).toMatch(/^https:\/\//)
      expect(city.attribution.datasetUrl).toMatch(/^https:\/\//)
    })
  }

  // Die Unterscheidung trägt bis in die Oberfläche: Unter Zero ist die Nennung
  // freiwillig, unter Namensnennung Bedingung. Wer beide gleich behandelt,
  // verletzt entweder eine Auflage oder behauptet eine, die es nicht gibt.
  it('setzt attributionRequired passend zur Lizenz', () => {
    for (const city of CITIES) {
      const istZero = /Zero/i.test(city.attribution.licence)
      expect(city.attribution.attributionRequired, city.name).toBe(!istZero)
    }
  })
})
