import { describe, expect, it } from 'vitest'

import {
  BERLIN,
  ROSTOCK,
  COUNTRY_NAMES,
  cityCountry,
  CITIES,
  COTTBUS,
  ZUERICH,
  cityAt,
  cityByKey,
  FRANKFURT,
  GRAZ,
  HAMBURG,
  KASSEL,
  MUENCHEN,
  suggestCity,
  withinCity,
  withinCitySession,
} from '../src/city.js'

describe('cityByKey', () => {
  it('findet eine Stadt an ihrem Schlüssel', () => {
    expect(cityByKey('berlin')).toBe(BERLIN)
    expect(cityByKey('hamburg')).toBe(HAMBURG)
    expect(cityByKey('frankfurt')).toBe(FRANKFURT)
    expect(cityByKey('muenchen')).toBe(MUENCHEN)
    expect(cityByKey('cottbus')).toBe(COTTBUS)
    expect(cityByKey('zuerich')).toBe(ZUERICH)
  })

  // Der Rückfall auf Berlin ist genau der Fehler, den diese Funktion nicht
  // machen darf: Eine Hamburger Instanz mit einem Tippfehler in der
  // Konfiguration würde dann jede Hamburger Meldung mit "position outside"
  // abweisen, und im Log stünde nichts, was danach aussieht.
  it('wirft bei einem unbekannten Schlüssel, statt zurückzufallen', () => {
    expect(() => cityByKey('münchen')).toThrow(/münchen/)
    expect(() => cityByKey('')).toThrow()
  })

  it('nennt die Schlüssel, die es kennt, damit der Fehler weiterhilft', () => {
    expect(() => cityByKey('kiel')).toThrow(/berlin, hamburg/)
  })
})

describe('Stadtschlüssel', () => {
  it('hält die Schlüssel eindeutig — ein doppelter verdeckte eine Stadt lautlos', () => {
    expect(new Set(CITIES.map((city) => city.key)).size).toBe(CITIES.length)
  })

  it('nimmt Schlüssel, die eine Adresse und einen Dateinamen überleben', () => {
    for (const city of CITIES) expect(city.key).toMatch(/^[a-z][a-z0-9-]*$/)
  })
})

describe('withinCity', () => {
  it('nimmt das Brandenburger Tor für Berlin an und weist es für Hamburg ab', () => {
    expect(withinCity(BERLIN, 13.3777, 52.5163)).toBe(true)
    expect(withinCity(HAMBURG, 13.3777, 52.5163)).toBe(false)
  })

  it('nimmt den Hamburger Rathausmarkt für Hamburg an und weist ihn für Berlin ab', () => {
    expect(withinCity(HAMBURG, 9.9924, 53.5503)).toBe(true)
    expect(withinCity(BERLIN, 9.9924, 53.5503)).toBe(false)
  })

  // Der Roemer. Frankfurt liegt westlich von Hamburg und südlich davon --
  // beide Achsen trennen, aber nur eine muss es tun.
  it('nimmt den Frankfurter Römer für Frankfurt an und weist ihn für die anderen beiden ab', () => {
    expect(withinCity(FRANKFURT, 8.6821, 50.1109)).toBe(true)
    expect(withinCity(BERLIN, 8.6821, 50.1109)).toBe(false)
    expect(withinCity(HAMBURG, 8.6821, 50.1109)).toBe(false)
  })

  // Der Grund, warum die Box aus dem Stadtteil-Umriss kommt und nicht aus der
  // amtlichen Ausdehnung um den Roemer: Die hätte 8,52 als Westrand ergeben,
  // und Hoechst läge draussen. Wer dort meldet, bekäme "ausserhalb".
  it('reicht bis Höchst im Westen und Nieder-Erlenbach im Norden', () => {
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
  it('reicht bis Lochhausen im Westen und Feldmoching im Norden', () => {
    expect(withinCity(MUENCHEN, 11.375, 48.185)).toBe(true) // Aubing-Lochhausen
    expect(withinCity(MUENCHEN, 11.545, 48.235)).toBe(true) // Feldmoching
  })

  // Schwerin: der Marktplatz am Dom liegt in Schwerin und in keiner der
  // sieben anderen — und die Box kommt aus dem Gemeindeumriss, nicht aus den
  // 15 Zonen, die alle in 2,5 km um die Altstadt liegen.
  it('nimmt den Schweriner Marktplatz an und reicht bis Lankow und Mueß', () => {
    const schwerin = cityByKey('schwerin')
    expect(withinCity(schwerin, 11.4156, 53.6291)).toBe(true)
    expect(withinCity(schwerin, 11.365, 53.655)).toBe(true) // Lankow
    expect(withinCity(schwerin, 11.47, 53.58)).toBe(true) // Mueß
    expect(withinCity(HAMBURG, 11.4156, 53.6291)).toBe(false)
    expect(withinCity(BERLIN, 11.4156, 53.6291)).toBe(false)
    expect(cityAt(11.4156, 53.6291)?.key).toBe('schwerin')
    // Wismar liegt nördlich davon und gehört zu keiner Stadt.
    expect(cityAt(11.465, 53.89)).toBeUndefined()
  })

  /**
   * Keine zwei Boxen dürfen sich überlappen.
   *
   * `cityAt` nimmt die erste passende Stadt — das ist nur eindeutig, solange
   * die Boxen disjunkt sind. Paarweise geprüft statt in einer Kette: Mit vier
   * Städten sind es sechs Paare, und eine Kette aus drei Vergleichen ließe drei
   * davon ungeprüft.
   */
  it('hält die Rahmen auseinander', () => {
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

  // Cottbus ist die erste Stadt in Berlins Nachbarschaft: 100 km Luftlinie,
  // und Berlins Sitzungsrahmen reicht bis 52,0 herunter. Der Altmarkt gehört
  // Cottbus, das Brandenburger Tor bleibt Berlin — und der Rahmen kommt aus
  // der Stadtgrenze, nicht aus den fünf Innenstadtzonen: Der Bahnhof und
  // Sachsendorf liegen außerhalb jeder Bewohnerparkzone und mitten in der
  // Stadt.
  it('nimmt den Cottbuser Altmarkt für Cottbus an und für Berlin nicht', () => {
    expect(withinCity(COTTBUS, 14.3341, 51.7607)).toBe(true)
    expect(withinCity(BERLIN, 14.3341, 51.7607)).toBe(false)
    expect(withinCity(COTTBUS, 13.3777, 52.5163)).toBe(false)
    expect(cityAt(14.3341, 51.7607)?.key).toBe('cottbus')
  })

  it('reicht in Cottbus bis zum Bahnhof und nach Sachsendorf', () => {
    expect(withinCity(COTTBUS, 14.3271, 51.7504)).toBe(true) // Kurzzeitparkplatz Bahnhof
    expect(withinCity(COTTBUS, 14.3053, 51.7355)).toBe(true) // Sachsendorf
    expect(withinCity(COTTBUS, 14.4123, 51.7448)).toBe(true) // Branitzer Park
  })

  it('weist NaN und Unendlich ab, statt sie durch einen Vergleich rutschen zu lassen', () => {
    // `NaN > x` ist false, `NaN < x` auch — eine Prüfung aus zwei negierten
    // Vergleichen liesse NaN durch. Diese hier nicht.
    expect(withinCity(BERLIN, Number.NaN, 52.5)).toBe(false)
    expect(withinCity(BERLIN, 13.4, Number.NaN)).toBe(false)
    expect(withinCity(BERLIN, Infinity, 52.5)).toBe(false)
    expect(withinCity(BERLIN, 13.4, -Infinity)).toBe(false)
  })

  it('zählt die Ränder als innen', () => {
    const { minLon, minLat, maxLon, maxLat } = BERLIN.reportBounds
    expect(withinCity(BERLIN, minLon, minLat)).toBe(true)
    expect(withinCity(BERLIN, maxLon, maxLat)).toBe(true)
  })
})

describe('withinCitySession', () => {
  it('ist in jede Richtung weiter als der Melderahmen', () => {
    for (const city of CITIES) {
      expect(city.sessionBounds.minLon).toBeLessThan(city.reportBounds.minLon)
      expect(city.sessionBounds.minLat).toBeLessThan(city.reportBounds.minLat)
      expect(city.sessionBounds.maxLon).toBeGreaterThan(city.reportBounds.maxLon)
      expect(city.sessionBounds.maxLat).toBeGreaterThan(city.reportBounds.maxLat)
    }
  })

  // Wer am Stadtrand parkt und über die Grenze läuft, soll seine Uhr behalten.
  it('nimmt einen Platz knapp außerhalb des Melderahmens an', () => {
    const justOutside = BERLIN.reportBounds.maxLon + 0.05
    expect(withinCity(BERLIN, justOutside, 52.5)).toBe(false)
    expect(withinCitySession(BERLIN, justOutside, 52.5)).toBe(true)
  })

  it('weist einen Platz in einer anderen Stadt weiterhin ab', () => {
    expect(withinCitySession(BERLIN, 9.9924, 53.5503)).toBe(false)
  })
})

describe('Kartenmittelpunkt', () => {
  it('liegt in der Stadt, zu der er gehört', () => {
    for (const city of CITIES) {
      expect(withinCity(city, city.center[0], city.center[1])).toBe(true)
    }
  })
})

describe('Quellenangabe', () => {
  // Der Unterschied ist Lizenzbedingung, keine Kosmetik: Berlin gibt unter
  // DL-DE/Zero heraus, Hamburg unter DL-DE/Namensnennung. Eine Oberfläche,
  // die die Hamburger Quelle verschweigt, verletzt die Lizenz.
  it('markiert Hamburg und Frankfurt als namensnennungspflichtig und Berlin als nicht', () => {
    expect(BERLIN.attribution.attributionRequired).toBe(false)
    expect(HAMBURG.attribution.attributionRequired).toBe(true)
    expect(FRANKFURT.attribution.attributionRequired).toBe(true)
  })

  // Wörtlich der Quellenvermerk des ISO-Metadatensatzes. Bei
  // DL-DE/Namensnennung ist er Lizenzbedingung -- eine Umformulierung erfüllt
  // sie nicht mehr sicher, und genau deshalb steht der Wortlaut in einem Test.
  it('gibt den Frankfurter Quellenvermerk wörtlich wieder', () => {
    expect(FRANKFURT.attribution.source).toBe('Stadt Frankfurt am Main, www.frankfurt.de')
    expect(FRANKFURT.attribution.licenceUrl).toBe('https://www.govdata.de/dl-de/by-2-0')
  })

  it('keeps the München source note verbatim', () => {
    // Wörtlich aus den ISO-Metadatensaetzen beider Parkebenen, samt
    // führendem "Datenquelle:" und Halbgeviertstrich. Die Stadt schreibt den
    // Vermerk so vor; ihn zu kürzen wäre schöner und nicht mehr derselbe.
    expect(MUENCHEN.attribution.source).toBe(
      'Datenquelle: dl-de/by-2-0: Landeshauptstadt München – opendata.muenchen.de'
    )
    expect(MUENCHEN.attribution.attributionRequired).toBe(true)
    expect(MUENCHEN.attribution.licenceUrl).toBe('https://www.govdata.de/dl-de/by-2-0')
  })

  it('nennt für jede Stadt eine Lizenz und einen Verweis', () => {
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

  it('schreibt jeden Stadtfeiertag als MM-TT, die Form, die holidaysFor annimmt', () => {
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

  it('löst eine Hamburger Position nach Hamburg auf, statt sie abzuweisen', () => {
    expect(cityAt(9.9924, 53.5503)).toBe(HAMBURG)
    expect(cityAt(13.3777, 52.5163)).toBe(BERLIN)
  })

  // Der Telegram-Parser und der Worker leiten die Stadt allein aus dem Punkt
  // ab. Ohne diesen Treffer bekäme eine Frankfurter Meldung
  // `422 position outside` -- in der App sieht das aus, als sei das Melden
  // kaputt, und im Log steht nichts, was nach einem Fehler aussieht.
  it('löst eine Frankfurter Position nach Frankfurt auf', () => {
    expect(cityAt(8.6821, 50.1109)).toBe(FRANKFURT) // Roemer
    expect(cityAt(8.6638, 50.1188)).toBe(FRANKFURT) // Hauptwache
  })

  // Mainz und Offenbach liegen gleich nebenan und gehören nicht dazu. Ein
  // Rückfall würde eine Mainzer Meldung als Frankfurter Zeile speichern.
  it('verschluckt die Nachbarstädte nicht', () => {
    expect(cityAt(8.2473, 49.9929)).toBeUndefined() // Mainz
    expect(cityAt(8.9167, 50.0956)).toBeUndefined() // Offenbach, Rathaus
  })

  // Die erste Stadt außerhalb Deutschlands. Der Rahmen kommt aus der
  // Stadtgrenze, nicht aus der Parkebene: Andritz im Norden und Puntigam im
  // Süden haben keine Parkzone und gehören trotzdem dazu.
  it('löst den Grazer Hauptplatz nach Graz auf und reicht bis Andritz und Puntigam', () => {
    expect(cityAt(15.4386, 47.0707)?.key).toBe('graz')
    expect(cityAt(15.4234, 47.1103)?.key).toBe('graz') // Andritz, Andritzer Hauptplatz
    expect(cityAt(15.4358, 47.0243)?.key).toBe('graz') // Puntigam
    expect(withinCity(GRAZ, 15.4386, 47.0707)).toBe(true)
    // Leibnitz und Gleisdorf liegen nebenan und gehören nicht dazu.
    expect(cityAt(15.5442, 46.7818)).toBeUndefined() // Leibnitz
    expect(cityAt(15.7094, 47.1069)).toBeUndefined() // Gleisdorf
    expect(cityCountry(GRAZ)).toBe('AT')
  })

  // Kein Rückfall auf Berlin: Zwischen den beiden Städten liegt keine, und
  // genau das muss die Antwort sein. Eine Meldung von hier als Berliner Zeile
  // zu speichern wäre falsch und nirgends zu sehen.
  it('liefert zwischen den Städten undefined', () => {
    // Lüneburger Heide, ungefähr auf halbem Weg.
    expect(cityAt(10.4, 53.0)).toBeUndefined()
    // Nürnberg — eine echte Stadt, nur keine, die wir kennen. Und die
    // gleiche Prüfung wie vorher mit München, das inzwischen dazugehört: Ein
    // Punkt in Bayern ist noch kein Punkt in München.
    expect(cityAt(11.0775, 49.4539)).toBeUndefined()
    // Kassel stand hier bis zum 17. September als Gegenbeispiel („das
    // Bundesland macht noch keine Stadt") — seitdem ist es die zweite Stadt
    // in Hessen. Göttingen, 40 km nördlich, bleibt draußen.
    expect(cityAt(9.4797, 51.3127)?.key).toBe('kassel')
    expect(cityAt(9.9356, 51.5328)).toBeUndefined()
    // Und dasselbe für Bayern: Augsburg ist nicht München.
    expect(cityAt(10.8978, 48.3705)).toBeUndefined()
    // Und für Tirol: Hall liegt zehn Kilometer östlich von Innsbruck und
    // draussen; Innsbruck selbst ist die erste Stadt südlich der Grenze.
    expect(cityAt(11.5086, 47.2814)).toBeUndefined()
    expect(cityAt(11.3934, 47.2685)?.key).toBe('innsbruck')
  })

  it('nimmt einen Punkt knapp innerhalb jeder Stadt an und weist einen knapp außerhalb ab', () => {
    for (const city of CITIES) {
      const { minLon, minLat, maxLon, maxLat } = city.reportBounds
      expect(cityAt(minLon + 0.001, minLat + 0.001)).toBe(city)
      expect(cityAt(maxLon - 0.001, maxLat - 0.001)).toBe(city)
      expect(cityAt(maxLon + 0.001, maxLat + 0.001)).toBeUndefined()
      expect(cityAt(minLon - 0.001, minLat - 0.001)).toBeUndefined()
    }
  })

  it('zählt die Ränder als innen, so wie withinCity', () => {
    const { minLon, minLat } = HAMBURG.reportBounds
    expect(cityAt(minLon, minLat)).toBe(HAMBURG)
  })

  it('weist NaN und Unendlich ab, statt die Stadt zu nehmen, die zuerst verglichen wird', () => {
    expect(cityAt(Number.NaN, 52.5)).toBeUndefined()
    expect(cityAt(13.4, Number.NaN)).toBeUndefined()
    expect(cityAt(Infinity, Infinity)).toBeUndefined()
  })

  it('findet jede Stadt an ihrem eigenen Mittelpunkt', () => {
    for (const city of CITIES) expect(cityAt(city.center[0], city.center[1])).toBe(city)
  })

  // "Die erste passende Stadt gewinnt" ist nur dann eine Antwort und keine
  // Auslosung, wenn kein Punkt in zwei Boxen liegt. Der Test hält das für
  // jedes künftige Paar fest, nicht nur für Berlin und Hamburg.
  it('hat keinen Punkt, der zu zwei Städten gehört', () => {
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
  it('achtet eine eingeschränkte Städteliste', () => {
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

  it('schlägt die Stadt vor, in der die Position liegt', () => {
    expect(suggestCity(BERLIN, ...MARIENPLATZ)).toBe(MUENCHEN)
    expect(suggestCity(MUENCHEN, ...BRANDENBURGER_TOR)).toBe(BERLIN)
  })

  // Der häufigste Fall überhaupt: Wer in der Stadt steht, die die App zeigt,
  // soll nichts davon merken, dass es diesen Hinweis gibt.
  it('schweigt in der Stadt, die schon geladen ist', () => {
    expect(suggestCity(BERLIN, ...BRANDENBURGER_TOR)).toBeNull()
    expect(suggestCity(MUENCHEN, ...MARIENPLATZ)).toBeNull()
  })

  // Kiel kennt die App nicht. Die nächstgelegene Stadt anzubieten wäre
  // geraten; hier bleibt es bei der bestehenden Antwort "ausserhalb der
  // Parkraumbewirtschaftung".
  it('schweigt außerhalb jeder Stadt', () => {
    expect(suggestCity(BERLIN, 10.1228, 54.3233)).toBeNull()
    expect(suggestCity(MUENCHEN, 0, 0)).toBeNull()
  })

  it('schweigt bei einem Vorschlag, der schon abgelehnt wurde', () => {
    expect(suggestCity(BERLIN, ...MARIENPLATZ, ['muenchen'])).toBeNull()
  })

  // Die Ablehnung gilt der abgelehnten Stadt, nicht dem Hinweis als solchem:
  // Wer in München "hier bleiben" gesagt hat, soll in Hamburg trotzdem gefragt
  // werden.
  it('lehnt nur die Stadt ab, die abgelehnt wurde', () => {
    expect(suggestCity(BERLIN, ...MARIENPLATZ, ['hamburg', 'frankfurt'])).toBe(MUENCHEN)
    expect(suggestCity(BERLIN, 9.9924, 53.5503, ['muenchen'])).toBe(HAMBURG)
  })

  // Müll im Speicher darf nicht wirken wie eine Ablehnung — und auch nicht wie
  // ihr Gegenteil. Ein Schlüssel, den es nicht gibt, ist schlicht folgenlos.
  it('übergeht Schlüssel in der Abgelehnt-Liste, die keine Stadt benennen', () => {
    expect(suggestCity(BERLIN, ...MARIENPLATZ, ['', 'köln', 'muenchen '])).toBe(MUENCHEN)
  })

  // Im Artifact ist umschaltbar nur, was eingebettet ist. Ein Vorschlag, dessen
  // Annahme in "Diese Fassung enthält muenchen nicht" endet, wäre schlimmer
  // als keiner.
  it('schlägt nur Städte vor, auf die diese Auslieferung umschalten kann', () => {
    expect(suggestCity(BERLIN, ...MARIENPLATZ, [], [BERLIN, HAMBURG])).toBeNull()
    expect(suggestCity(BERLIN, ...MARIENPLATZ, [], [BERLIN, MUENCHEN])).toBe(MUENCHEN)
  })

  // Verglichen wird über den Schlüssel. Eine eingeschränkte Liste kann Kopien
  // enthalten; ein Identitätsvergleich schlüge dort die laufende Stadt sich
  // selbst vor — der Hinweis stünde dann dauerhaft und ohne Ausweg da.
  it('vergleicht über den Schlüssel, nicht über die Objektidentität', () => {
    const copy = { ...BERLIN }
    expect(suggestCity(copy, ...BRANDENBURGER_TOR)).toBeNull()
  })

  it('weist Koordinaten ab, die keine Zahlen sind', () => {
    expect(suggestCity(BERLIN, Number.NaN, 48.1372)).toBeNull()
    expect(suggestCity(BERLIN, 11.5755, Number.POSITIVE_INFINITY)).toBeNull()
  })

  // Über alle Städte statt über ein Paar: Käme eine fünfte dazu, deren Box eine
  // bestehende schneidet, fiele es hier auf und nicht erst im Betrieb.
  it('schlägt jede Stadt an ihrem eigenen Mittelpunkt vor, und nur den anderen', () => {
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

  // Die Familie entscheidet über einen weiteren Satz: CC BY 4.0 § 3 a) 1) A) iv)
  // verlangt den Hinweis auf den Gewährleistungsausschluss, die Datenlizenz
  // Deutschland nicht. Sie muss zum Lizenztext passen — sonst zeigt die
  // Oberfläche eine Auflage, die es nicht gibt, oder verschweigt eine.
  it('setzt licenceFamily passend zu Lizenztext und Namensnennung', () => {
    for (const city of CITIES) {
      const { licence, licenceUrl, licenceFamily, attributionRequired } = city.attribution
      // Innsbruck nennt keine CC-Lizenz wörtlich, sondern eine eigene
      // Nutzungsbedingung „vergleichbar mit CC BY 4.0" — mit denselben zwei
      // Auflagen, an denen die Oberfläche hängt (Nennung in vorgeschriebener
      // Form, Hinweis auf fehlende Gewähr). Die Seite ist der Beleg, nicht
      // creativecommons.org; deshalb steht sie hier ausdrücklich.
      const erwartet =
        /creativecommons\.org\/licenses\/by\//.test(licenceUrl) ||
        licenceUrl === 'https://geohub-1-magibk.hub.arcgis.com/pages/nutzungsbed'
          ? 'cc-by'
        : /creativecommons\.org\/publicdomain\/zero/.test(licenceUrl)
          ? 'cc0'
          : /dl-de\/zero/.test(licenceUrl)
            ? 'dl-de-zero'
            : /dl-de\/by/.test(licenceUrl)
              ? 'dl-de-by'
              : city.licenceOpen !== undefined
                ? 'unklar'
                : 'unbekannt'
      expect(licenceFamily, `${city.name}: ${licence}`).toBe(erwartet)
      // Ohne Nennungspflicht nur, wo die Lizenz sie ausdrücklich erlässt.
      // „unklar" nennt die Quelle trotzdem: Wer nicht weiss, was gilt, hält
      // sich an die strengere Lesart.
      expect(attributionRequired, city.name).toBe(
        licenceFamily !== 'dl-de-zero' && licenceFamily !== 'cc0'
      )
    }
  })

  // Der Banner über der Karte hängt an `licenceOpen`, die Familie `unklar`
  // an der fehlenden Lizenz. Eines ohne das andere wäre entweder ein Banner
  // über einer geklärten Lizenz oder eine ungeklärte ohne Banner.
  it('trägt licenceOpen genau dann, wenn die Lizenz unklar ist', () => {
    for (const city of CITIES) {
      const offen = city.licenceOpen !== undefined
      expect(offen, city.name).toBe(city.attribution.licenceFamily === 'unklar')
      if (offen) expect(city.licenceOpen?.trim().length ?? 0, city.name).toBeGreaterThan(20)
    }
  })

  // Jede Stadt hat einen Staat, und der kommt aus dem Landeskürzel — die
  // Oberfläche gruppiert danach und der Standort-Vorschlag nennt ihn.
  it('ordnet jede Stadt einem Staat zu, den COUNTRY_NAMES kennt', () => {
    for (const city of CITIES) {
      expect(COUNTRY_NAMES[cityCountry(city)], city.name).toBeTruthy()
    }
    expect(cityCountry(BERLIN)).toBe('DE')
  })
})

describe('die Auskunftsstelle für umgesetzte Fahrzeuge', () => {
  // Regression: `TowInfo.tsx` nannte in allen vier Städten die Polizei Berlin
  // — Link, Nummer und Name fest verdrahtet. Wer in München sein Auto suchte,
  // bekam eine Berliner Telefonnummer, und das ist schlechter als gar keine
  // Angabe: Es sieht aus wie eine Auskunft.
  // Wo sich keine amtliche Seite mit Namen und Nummer belegen liess, fehlt
  // das Feld, und die App zeigt den Abschnitt nicht — eine Nummer aus zweiter
  // Hand wäre schlechter als keine. Die Liste ist ausdrücklich, damit ein
  // vergessenes Feld bei einer neuen Stadt weiter auffällt.
  const OHNE_BELEG = new Set(['koeln', 'karlsruhe', 'freiburg', 'cottbus', 'innsbruck', 'zuerich', 'kassel'])

  it('gehört zu jeder Stadt und nennt nirgends eine fremde', () => {
    for (const city of CITIES) {
      const info = city.towedVehicles
      if (OHNE_BELEG.has(city.key)) {
        expect(info, city.name).toBeUndefined()
        continue
      }
      expect(info, city.name).toBeDefined()
      expect(info?.authority.length ?? 0, city.name).toBeGreaterThan(3)
      expect(info?.url ?? '', city.name).toMatch(/^https:\/\//)
    }
    // Die Berliner Seite darf ausschließlich bei Berlin stehen.
    const berlinerSeiten = CITIES.filter((city) => city.towedVehicles?.url.includes('berlin.de'))
    expect(berlinerSeiten.map((city) => city.key)).toEqual(['berlin'])
  })

  it('trägt ein Prüfdatum, weil eine Nummer veraltet', () => {
    for (const city of CITIES) {
      if (OHNE_BELEG.has(city.key)) continue
      expect(city.towedVehicles?.checkedOn, city.name).toMatch(/^\d{4}-\d{2}$/)
    }
  })

  // Eine falsche Nummer kostet jemanden Zeit in einer Lage, in der er ohnehin
  // keine hat. Wo sie sich nicht belegen liess, steht sie deshalb nicht da —
  // Frankfurt ist der Fall.
  // Seit Salzburg auch mit Landesvorwahl: Eine österreichische Nummer ohne
  // `+43` wäre von Deutschland aus falsch gewählt.
  it('nennt eine Nummer nur da, wo es eine gibt, und dann eine wählbare', () => {
    for (const city of CITIES) {
      const phone = city.towedVehicles?.phone
      if (phone === undefined) continue
      expect(phone, city.name).toMatch(/^[+()\d][()\d\s-]{6,}$/)
      // Landesvorwahl genau dann, wenn die Stadt nicht in Deutschland liegt.
      expect(phone.startsWith('+'), city.name).toBe(cityCountry(city) !== 'DE')
    }
    expect(CITIES.find((city) => city.key === 'frankfurt')?.towedVehicles?.phone).toBeUndefined()
  })
})

/**
 * Rostock — die erste Stadt in Mecklenburg-Vorpommern und die erste unter
 * CC0. Der Rahmen kommt aus den 31 Ortsteilen, nicht aus den zehn
 * Bewohnerparkgebieten: Warnemünde und Hohe Düne liegen elf Kilometer nördlich
 * der Altstadt, und in beiden stehen Parkscheinautomaten.
 */
describe('Rostock', () => {
  const NEUER_MARKT: [number, number] = [12.1406, 54.0887]
  const LEUCHTTURM_WARNEMUENDE: [number, number] = [12.0838, 54.1811]
  const HOHE_DUENE: [number, number] = [12.1015, 54.1795]

  it('nimmt Altstadt, Warnemünde und Hohe Düne an und weist sie für Hamburg ab', () => {
    for (const point of [NEUER_MARKT, LEUCHTTURM_WARNEMUENDE, HOHE_DUENE]) {
      expect(withinCity(ROSTOCK, ...point)).toBe(true)
      expect(withinCity(HAMBURG, ...point)).toBe(false)
      expect(cityAt(...point)).toBe(ROSTOCK)
    }
  })

  // Bad Doberan (11,9034 / 54,1069) liegt westlich der Stadtgrenze; die Box
  // endet bei 11,99. Eine Meldung von dort ist keine Rostocker.
  it('verschluckt Bad Doberan nicht', () => {
    expect(withinCity(ROSTOCK, 11.9034, 54.1069)).toBe(false)
    expect(cityAt(11.9034, 54.1069)).toBeUndefined()
  })

  it('führt CC0 ohne Nennungspflicht, mit Quellenvermerk und Datensatz', () => {
    expect(ROSTOCK.attribution.licenceFamily).toBe('cc0')
    expect(ROSTOCK.attribution.attributionRequired).toBe(false)
    expect(ROSTOCK.attribution.licenceUrl).toBe('https://creativecommons.org/publicdomain/zero/1.0/deed.de')
    expect(ROSTOCK.attribution.datasetUrl).toMatch(/^https:\/\/geo\.sv\.rostock\.de\//)
    expect(ROSTOCK.attribution.source).toContain('Hanse- und Universitätsstadt Rostock')
  })

  it('hängt am Kalender von Mecklenburg-Vorpommern und braucht keinen Stadtfeiertag', () => {
    expect(ROSTOCK.land).toBe('MV')
    expect(ROSTOCK.holidays).toBeUndefined()
  })

  // Die Nummer steht wörtlich auf der Seite des Stadtamts; die Auskunft gibt
  // die Polizei, nicht das Amt, das abschleppt.
  it('nennt die Einsatzleitstelle der Polizei Waldeck mit der belegten Nummer', () => {
    expect(ROSTOCK.towedVehicles?.phone).toBe('038208 8880')
    expect(ROSTOCK.towedVehicles?.url).toContain('rathaus.rostock.de')
  })
})

/**
 * Zürich — die erste Stadt ausserhalb Deutschlands und Österreichs, die
 * erste in Franken. Der Rahmen kommt aus den 34 Statistischen Quartieren,
 * nicht aus den zwei Hochtarifflächen: Altstetten, Höngg und der Zoo liegen
 * ausserhalb beider Flächen, und dort stehen Parkuhren zum Niedertarif.
 */
describe('Zürich', () => {
  const PARADEPLATZ: [number, number] = [8.5391, 47.3699]
  const MARKTPLATZ_OERLIKON: [number, number] = [8.5464, 47.4098]
  const BAHNHOF_ALTSTETTEN: [number, number] = [8.4889, 47.3914]
  const ZOO: [number, number] = [8.5738, 47.3852]

  it('nimmt Paradeplatz, Oerlikon, Altstetten und den Zoo an', () => {
    for (const point of [PARADEPLATZ, MARKTPLATZ_OERLIKON, BAHNHOF_ALTSTETTEN, ZOO]) {
      expect(withinCity(ZUERICH, ...point)).toBe(true)
      expect(cityAt(...point)).toBe(ZUERICH)
    }
  })

  // Winterthur (8,7241 / 47,4997) und Baden (8,3064 / 47,4733) liegen
  // ausserhalb der Box; eine Meldung von dort ist keine Zürcher.
  it('verschluckt Winterthur und Baden nicht', () => {
    expect(withinCity(ZUERICH, 8.7241, 47.4997)).toBe(false)
    expect(withinCity(ZUERICH, 8.3064, 47.4733)).toBe(false)
    expect(cityAt(8.7241, 47.4997)).toBeUndefined()
  })

  it('führt CC0 ohne Nennungspflicht, mit dem empfohlenen Quellenvermerk und dem Datensatz', () => {
    expect(ZUERICH.attribution.licenceFamily).toBe('cc0')
    expect(ZUERICH.attribution.attributionRequired).toBe(false)
    expect(ZUERICH.attribution.licenceUrl).toBe('https://creativecommons.org/publicdomain/zero/1.0/deed.de')
    expect(ZUERICH.attribution.datasetUrl).toMatch(/^https:\/\/www\.ogd\.stadt-zuerich\.ch\//)
    // Wörtlich die von der Stadt empfohlene Form.
    expect(ZUERICH.attribution.source).toContain('Quelle: Stadt Zürich')
    expect(ZUERICH.licenceOpen).toBeUndefined()
  })

  it('hängt am Kalender des Kantons Zürich, liegt in der Schweiz und braucht keinen Stadtfeiertag', () => {
    expect(ZUERICH.land).toBe('CH-ZH')
    expect(cityCountry(ZUERICH)).toBe('CH')
    expect(ZUERICH.holidays).toBeUndefined()
  })

  it('hat ein eigenes Raster mit Ursprung an der Südwestecke des Rahmens', () => {
    expect(ZUERICH.heatGrid.id).toBe('zuerich')
    expect(ZUERICH.heatGrid.originLon).toBe(ZUERICH.reportBounds.minLon)
    expect(ZUERICH.heatGrid.originLat).toBe(ZUERICH.reportBounds.minLat)
  })
})

/**
 * Kassel — die zweite Stadt in Hessen und die erste der Klasse C: nur
 * Grenzen, keine Zeiten, kein Betrag. Der Rahmen kommt aus dem
 * Gemeindeumriss, nicht aus den 29 Bezirken: Harleshausen, Waldau und
 * Niederzwehren liegen außerhalb jedes Bezirks und gehören dazu.
 */
describe('Kassel', () => {
  const KOENIGSPLATZ: [number, number] = [9.4963, 51.3166]
  const BAHNHOF_WILHELMSHOEHE: [number, number] = [9.4472, 51.3128]
  const HARLESHAUSEN: [number, number] = [9.4109, 51.3345]
  const WALDAU: [number, number] = [9.5286, 51.2853]

  it('nimmt Königsplatz, Bahnhof Wilhelmshöhe, Harleshausen und Waldau an', () => {
    for (const point of [KOENIGSPLATZ, BAHNHOF_WILHELMSHOEHE, HARLESHAUSEN, WALDAU]) {
      expect(withinCity(KASSEL, ...point)).toBe(true)
      expect(cityAt(...point)).toBe(KASSEL)
    }
  })

  // Baunatal (9,4069 / 51,2564) und Kaufungen (9,6176 / 51,2816) sind
  // Nachbargemeinden; ihre Mitte liegt außerhalb der Box, und eine Meldung
  // von dort ist keine Kasseler. Vellmar dagegen liegt in einer Bucht der
  // Stadtgrenze und damit **innerhalb** des Rahmens — ein Rechteck kann das
  // nicht ausdrücken, und das gilt für jede Stadt hier. Frankfurt liegt
  // 150 km südlich.
  it('verschluckt Baunatal, Kaufungen und Frankfurt nicht', () => {
    expect(withinCity(KASSEL, 9.4069, 51.2564)).toBe(false)
    expect(withinCity(KASSEL, 9.6176, 51.2816)).toBe(false)
    expect(withinCity(KASSEL, 8.6821, 50.1109)).toBe(false)
    expect(cityAt(8.6821, 50.1109)).toBe(FRANKFURT)
  })

  it('führt die Lizenz als unklar, mit Nennung, Banner und der Stelle, die sie klären kann', () => {
    expect(KASSEL.attribution.licenceFamily).toBe('unklar')
    expect(KASSEL.attribution.attributionRequired).toBe(true)
    expect(KASSEL.attribution.licence).toBe('nicht ausgewiesen')
    expect(KASSEL.attribution.datasetUrl).toMatch(/^https:\/\/geoportal\.kassel\.de\//)
    expect(KASSEL.attribution.source).toContain('Stadt Kassel, Vermessung und Geoinformation')
    expect(KASSEL.licenceOpen).toContain('vermgeo@kassel.de')
    expect(KASSEL.licenceOpen).toMatch(/Stand \d+\. \w+ 20\d\d\./)
  })

  it('hängt am hessischen Kalender, liegt in Deutschland und braucht keinen Stadtfeiertag', () => {
    expect(KASSEL.land).toBe('HE')
    expect(cityCountry(KASSEL)).toBe('DE')
    expect(KASSEL.holidays).toBeUndefined()
  })

  it('hat ein eigenes Raster mit Ursprung an der Südwestecke des Rahmens', () => {
    expect(KASSEL.heatGrid.id).toBe('kassel')
    expect(KASSEL.heatGrid.originLon).toBe(KASSEL.reportBounds.minLon)
    expect(KASSEL.heatGrid.originLat).toBe(KASSEL.reportBounds.minLat)
  })
})
