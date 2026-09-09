import { useEffect, useRef, useState } from 'react'

import { HISTORY_DAYS } from '@knoellchenfrei/core'

import { CITY, selectableCities, switchCity } from '../city.js'
import { IconWarnung } from '../icons.js'
import { setStatistikAus, statistikAus } from '../track.js'
import { InstallRow, useInstallState } from './InstallHint.js'

interface Props {
  onClose: () => void
  /** Null, wenn Rückmeldungen nirgends ankämen. */
  onFeedback: (() => void) | null
  imprintUrl: string | undefined
  privacyUrl: string | undefined
  /** Woher die Daten stammen, aus meta.json. */
  source: string
  licence: string
  licenceUrl: string
  /** Wann die Quelle zuletzt erfolgreich abgerufen wurde, ISO 8601 — oder nichts. */
  geprueftAm: string | null | undefined
}

/** Sieben Tage: Der Abruf läuft täglich; eine Woche ohne ist ein Ausfall, kein Zufall. */
const DATENSTAND_ALT_MS = 7 * 86_400_000

/**
 * „geprüft am 9. Sept. 2026, 04:17" — oder null, wenn das Datum nicht lesbar
 * ist. Ein unlesbares Datum wird nicht angezeigt, statt als „Invalid Date".
 */
function datenstand(iso: string | null | undefined, now: number): { text: string; alt: boolean } | null {
  if (typeof iso !== 'string') return null
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return null
  const text = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(at)
  return { text, alt: now - at > DATENSTAND_ALT_MS }
}

const REPO = 'https://github.com/knoellchenfrei/knoellchenfrei'
const FREIFAHREN = 'https://freifahren.org'

/**
 * Fragen, die diese App selbst aufwirft.
 *
 * Keine allgemeine Hilfe, sondern genau die Stellen, an denen die Anzeige
 * überrascht und deshalb erklärt gehört — jede einzelne ist beim Bauen als
 * echte Verwirrung aufgetreten. Eine FAQ, die stattdessen „Wie benutze ich die
 * Karte?" beantwortet, liest niemand.
 *
 * `cities` schränkt einen Eintrag auf Stadtschlüssel ein; ohne Angabe gilt er
 * überall. Bis zur vierten Stadt war die ganze Liste Berlin: „Warum kassiert
 * sonntags nur eine einzige Zone?" und „Von 45.917 Abschnitten tragen 747
 * einen Wert" stimmen beide — und beide nur hier. In Hamburg gelesen war die
 * erste Frage schlicht falsch, und das ist die schlechteste Sorte Hilfe: eine,
 * die zuversichtlich klingt.
 *
 * Wo eine Zahl an der Stadt hängt, steht sie deshalb in einem Eintrag je Stadt
 * — nicht in einem gemeinsamen, der sie verschweigt. Eine Antwort ohne Zahl
 * beantwortet die Frage meistens nicht.
 */
const FAQ: readonly { q: string; a: React.ReactNode; cities?: readonly string[] }[] = [
  {
    q: 'Warum kassiert sonntags nur eine einzige Zone?',
    cities: ['berlin'],
    a: (
      <>
        Weil das stimmt. Die Berliner Parkraumbewirtschaftung läuft Montag bis Samstag; sonntags
        ist sie gebührenfrei. Genau <strong>eine</strong> von 103 Zonen ist im amtlichen Feed als{' '}
        <code>Mo-So 9-24 Uhr</code> hinterlegt: Zone 29 in Mitte. Feiertage werden wie Sonntage
        behandelt.
      </>
    ),
  },
  {
    q: 'Warum steht kein Preis da?',
    cities: ['muenchen'],
    a: (
      <>
        Weil die Quelle keinen nennt. In keinem der 291 Regeltexte, aus denen Münchens 82 Gebiete
        entstehen, steht ein Betrag; der Tarif steht allein in der Gebührenordnung, und die ist
        eine PDF-Auskunft, keine Datenquelle. Die App sagt deshalb „Tarif nicht angegeben" statt
        einen Betrag zu erfinden — und <strong>nicht</strong> „0,00 €": Zahlen musst du trotzdem.
      </>
    ),
  },
  {
    q: 'Was heißt „an Schultagen"?',
    cities: ['muenchen'],
    a: (
      <>
        So steht es an 15 Abschnitten in 10 Gebieten. Ein Schulkalender ist keine
        Feiertagstabelle — er ist je Land und Jahr anders und steht nirgends in dieser Quelle. Die
        App löst die Regel deshalb nicht auf, sondern zeigt sie wörtlich als Zusatz an. Ob heute
        Schultag ist, weißt du besser als sie.
      </>
    ),
  },
  {
    q: 'Was heißt „Parkscheibe" statt eines Preises?',
    cities: ['hamburg'],
    a: (
      <>
        Sieben der 145 Gebiete tragen als Gebührenzone <code>Parkscheibe</code>, drei gar nichts.
        Das ist <strong>kein Preis von null</strong>: Stehen darfst du dort nur mit eingestellter
        Scheibe und nur bis zur Höchstparkdauer — wer ohne Scheibe steht, zahlt. Die App zeigt
        deshalb die Auflage und keinen Betrag.
      </>
    ),
  },
  {
    q: 'Warum steht die Höchstparkdauer mit einem Anteil dabei?',
    cities: ['frankfurt'],
    a: (
      <>
        Weil sie in Frankfurt am <strong>Automaten</strong> steht und nicht am Bereich: In 19 der
        27 gezeigten Bereiche stehen mehrere Werte nebeneinander, oft <code>1 h</code> neben{' '}
        <code>-</code>, also neben „keine". Die App nennt den Wert samt Anteil, statt ihn zur
        Regel des ganzen Bereichs zu erklären.
      </>
    ),
  },
  {
    q: 'Warum steht bei der Höchstparkdauer eine Abdeckung dabei?',
    cities: ['berlin'],
    a: (
      <>
        Weil sie fast nie für die ganze Zone gilt: Von 45.917 Abschnitten tragen 747 einen Wert.
        Die App nennt ihn samt Anteil, statt ihn zur Zonenregel zu erklären.
      </>
    ),
  },
  {
    q: 'Was bedeutet „unsicher"?',
    a: (
      <>
        Dass die Quelle für diesen Tag eine Regel nennt, die sich nicht in ein Zeitfenster
        übersetzen lässt. Die App zeigt dann „unsicher" und die Regel im Wortlaut, statt zu raten
        — hier hilft nur der Automat oder das Schild vor Ort.
      </>
    ),
  },
  {
    q: 'Was ist „Advents-Sa"?',
    cities: ['berlin'],
    a: (
      <>
        Vier Zonen führen <code>Advents-Sa</code> in ihren Zeiten, ohne zu sagen, welche Samstage
        gemeint sind. An diesen Tagen zeigt die App „unsicher": Ein „gebührenfrei" wäre an genau
        den Tagen falsch, für die die Zusatzregel da ist, und die Regel unbesehen anzuwenden
        verlangte an den anderen rund 48 Samstagen Geld, das nicht anfällt.
      </>
    ),
  },
  {
    q: 'Warum steht bei manchen Zonen eine Preisspanne?',
    cities: ['berlin'],
    a: (
      <>
        Weil sie so im Feed steht, etwa <code>2,00-3,00 Euro</code>. Auf einen Wert zu reduzieren
        würde dich um bis zu 50&nbsp;% verschätzen, deshalb bleibt die Spanne stehen.
      </>
    ),
  },
  {
    q: 'Warum steht bei manchen Bereichen eine Preisspanne?',
    cities: ['frankfurt'],
    a: (
      <>
        Weil der Tarif am Automaten steht und nicht am Bereich: In zwei Bereichen stehen{' '}
        <code>2 €/h</code> und <code>4 €/h</code> nebeneinander. Auf einen Wert zu reduzieren
        würde dich dort um 100&nbsp;% verschätzen, deshalb bleibt die Spanne stehen.
      </>
    ),
  },
  {
    q: 'Kann ich hier bezahlen?',
    a: (
      <>
        Nein. Handyparken läuft über geschlossene Plattformen; ohne Vertrag bei einem der Anbieter
        ist kein Parkticket lösbar. Diese App sagt dir, was es kostet — bezahlen musst du am
        Automaten oder in einer der Anbieter-Apps.
      </>
    ),
  },
  {
    q: 'Was passiert mit meiner Sichtungsmeldung?',
    a: (
      <>
        Position auf ~10&nbsp;Meter gerundet, Zeit auf 5&nbsp;Minuten, nach 90&nbsp;Minuten
        gelöscht. Zusätzlich entsteht eine anonyme Strichliste aus Tag, Stunde und einem
        250-Meter-Feld für die Kontrolldichte — ohne Bezug zur Meldung, gelöscht nach{' '}
        {HISTORY_DAYS} Tagen.
      </>
    ),
  },
  {
    q: 'Wie aktuell sind die Daten?',
    a: (
      <>
        Zonen, Tarife und Zeiten werden zur Buildzeit eingefroren, nicht live geladen. Sie ändern
        sich über Monate — ein nächtlicher Abzug ist frischer, als die Quelle sich bewegt. Nur die
        Sichtungen sind echt live.
      </>
    ),
  },
]

/** Die Einträge, die für die geladene Stadt gelten — ohne Angabe gilt einer überall. */
function faqFor(cityKey: string): readonly { q: string; a: React.ReactNode }[] {
  return FAQ.filter((entry) => entry.cities === undefined || entry.cities.includes(cityKey))
}

/**
 * Einstellungen und alles Beiläufige an einem Ort, nach dem Vorbild von
 * FreiFahrens Settings-Sheet: oben ein Hinweis, der nie verschwindet, darunter
 * Kontakt und Mitmachen, unten die rechtlichen Links.
 *
 * Der Hinweis oben ist bei ihnen „ersetzt kein Ticket". Unserer ist das
 * Gegenstück und steht aus demselben Grund an derselben Stelle: Was die App
 * anzeigt, ist ein Datensatz — verbindlich ist das Schild.
 */
export function SettingsSheet({
  onClose,
  onFeedback,
  imprintUrl,
  privacyUrl,
  source,
  licence,
  licenceUrl,
  geprueftAm,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const stand = datenstand(geprueftAm, Date.now())

  const install = useInstallState()

  // Einmal beim Öffnen gelesen, danach im Zustand: `localStorage` bei jedem
  // Rendern anzufassen wäre teuer und in eingebetteten Zusammenhängen ein
  // Wurf.
  const [statistik, setStatistik] = useState(() => !statistikAus())

  useEffect(() => closeRef.current?.focus(), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Einstellungen">
      <header className="sheet__head">
        <button
          ref={closeRef}
          type="button"
          className="sheet__back"
          onClick={onClose}
          aria-label="Schließen"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <h2 className="sheet__title">Einstellungen</h2>
      </header>

      <div className="sheet__body">
        <p className="callout">
          <span className="callout__mark" aria-hidden="true">
            <IconWarnung size={18} />
          </span>
          <span>
            <strong>Verbindlich ist die Beschilderung vor Ort.</strong> Gebühren und Zeiten können
            abschnittsweise abweichen — das sagt die Quelle selbst.
          </span>
        </p>

        {/*
          Eine Stadt zur Zeit — dasselbe Modell wie FreiFahren. Zonen,
          Meldungen, Heatmap und Grenzprüfung gehören zusammen; eine Karte, die
          Berliner Zonen über Hamburger Meldungen legt, beantwortet keine Frage
          richtig. Der Wechsel lädt die Seite neu, weil an ihm sechs Dinge
          hängen und die eine, die man vergisst, still falsch wäre.
        */}
        {selectableCities().length > 1 && (
          <>
            <h3 className="sheet__label">Stadt</h3>
            <ul className="rows">
              {selectableCities().map((city) => (
                <li key={city.key}>
                  <button
                    type="button"
                    className="rows__item"
                    aria-current={city.key === CITY.key ? 'true' : undefined}
                    disabled={city.key === CITY.key}
                    onClick={() => switchCity(city)}
                  >
                    <span>{city.name}</span>
                    <span className="rows__chevron" aria-hidden="true">
                      {city.key === CITY.key ? '✓' : '→'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="sheet__hint">
              Die App zeigt jeweils eine Stadt. Beim Wechsel lädt sie neu; ein gemerkter
              Parkplatz in der anderen Stadt bleibt dort erhalten.
            </p>
          </>
        )}

        {/*
          Nur im Testbetrieb. Wer den Link bekommen hat, soll wissen, warum die
          Seite nirgends auffindbar ist und wem sie gerade gehört.
        */}
        {__BETA__ && (
          <p className="callout callout--beta">
            <span className="callout__mark" aria-hidden="true">
              ⚑
            </span>
            <span>
              <strong>Geschlossener Testbetrieb.</strong> Die App ist noch nicht öffentlich und für
              Suchmaschinen gesperrt. Sie wird von einer Privatperson betrieben, bis der
              Trägerverein eingetragen ist — bitte den Link nicht weiterverbreiten.
            </span>
          </p>
        )}

        <h3 className="sheet__label">Auf dem Gerät</h3>
        <div className="install">
          <InstallRow state={install} />
        </div>

        <h3 className="sheet__label">Nutzungsstatistik</h3>
        <label className="schalter">
          <input
            type="checkbox"
            checked={statistik}
            onChange={(event) => {
              const an = event.target.checked
              setStatistikAus(!an)
              setStatistik(an)
            }}
          />
          <span>
            Anonym mitzählen, was benutzt wird
            <span className="schalter__hinweis">
              Gezählt werden Tag, Stunde, Stadt und was in der App passiert — bei Zonen ohne
              Uhrzeit. Keine Koordinaten, keine Kennung, keine Sitzung, kein Verlauf. Die Zahlen
              bleiben in derselben Datenbank in der EU wie die Meldungen.
            </span>
          </span>
        </label>

        <p className="hours">
          {/* Mit Schrägstrich am Ende: Ohne ihn antwortet Pages mit einer
              Umleitung, und die kostet einen zusätzlichen Abruf. */}
          <a href="/statistik/" target="_blank" rel="noreferrer">
            Zahlen ansehen
          </a>{' '}
          — was gezählt wurde, offen einsehbar.
        </p>

        <h3 className="sheet__label">Häufige Fragen</h3>
        <div className="faq">
          {faqFor(CITY.key).map((entry) => (
            <details key={entry.q} className="faq__item">
              <summary>{entry.q}</summary>
              <div className="faq__answer">{entry.a}</div>
            </details>
          ))}
        </div>

        <h3 className="sheet__label">Mitmachen</h3>
        <ul className="rows">
          {onFeedback !== null && (
            <li>
              <button type="button" className="rows__item" onClick={onFeedback}>
                <span>Feedback senden</span>
                <span className="rows__chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          )}
          <li>
            <a className="rows__item" href={REPO} target="_blank" rel="noreferrer">
              <span>Quellcode und Fehler melden</span>
              <span className="rows__chevron" aria-hidden="true">
                ↗
              </span>
            </a>
          </li>
          <li>
            <a className="rows__item" href={`${REPO}/blob/main/docs/data-sources.md`} target="_blank" rel="noreferrer">
              <span>Woher die Daten kommen</span>
              <span className="rows__chevron" aria-hidden="true">
                ↗
              </span>
            </a>
          </li>
        </ul>
        {/*
          Bewusst kein Spenden-Knopf. FreiFahren ist ein e. V. mit Vorstand und
          Beitragskonto; hier gibt es kein finanzielles Interesse, und ein
          "Unterstützen", hinter dem nichts steht, wäre Behauptung.
        */}
        <p className="sheet__hint">
          Am meisten hilft: melden, wenn du das Ordnungsamt siehst — und melden, wenn ein Tarif
          nicht zum Schild passt.
        </p>

        {/*
          Der Dank gehört dorthin, wo Nutzende ihn lesen, nicht nur ins
          Repository. Und er ist keine Floskel: Ein Link schickt ihnen Leute,
          und das ist das Einzige, was ein Projekt ohne Geld weitergeben kann.
        */}
        <h3 className="sheet__label">Vorbild</h3>
        <ul className="rows">
          <li>
            <a className="rows__item" href={FREIFAHREN} target="_blank" rel="noreferrer">
              <span>FreiFahren — Kontrollen im Berliner ÖPNV</span>
              <span className="rows__chevron" aria-hidden="true">
                ↗
              </span>
            </a>
          </li>
        </ul>
        <p className="sheet__hint">
          Aufbau, Kartenhosting und mehrere Dialoge dieser App sind von FreiFahren
          übernommen — dieselbe Idee, andere Kontrolle. Danke dafür.
        </p>

        <h3 className="sheet__label">Daten</h3>
        <p className="sheet__hint">
          {source} · Lizenz{' '}
          <a href={licenceUrl} target="_blank" rel="noreferrer">
            {licence}
          </a>
          . Kartenkacheln © OpenStreetMap-Mitwirkende (ODbL).
        </p>
        {/*
          Das Datum, nicht nur die Quelle: Ein Abzug von vor drei Wochen hat
          für „kostet das gerade etwas" eine andere Verlässlichkeit als einer
          von gestern — und ein Behördendienst, der schweigt, lässt den alten
          Abzug stehen. Genau das soll er, nur sichtbar.
        */}
        {stand !== null && (
          <p className="sheet__hint">
            Datenstand: bei der Quelle zuletzt geprüft am {stand.text}.
            {stand.alt && (
              <>
                {' '}
                <strong>Das ist länger als eine Woche her</strong> — der tägliche Abruf kommt seit dem
                nicht durch, die Daten können überholt sein.
              </>
            )}
          </p>
        )}
        {/*
          Bei Hamburg ist die Nennung der Quelle Lizenzbedingung
          (DL-DE/Namensnennung 2.0), bei Berlin freiwillig (DL-DE/Zero).
          Deshalb steht sie dort nicht nur klein unter „Daten", sondern wird
          ausdrücklich als Bedingung benannt — wer den Satz kürzt, kürzt eine
          Auflage weg.
        */}
        {CITY.attribution.attributionRequired && (
          <p className="sheet__hint">
            Die Lizenz dieser Stadt <strong>verlangt</strong> die Nennung der Quelle. Wer die
            Daten weiterverwendet, muss {CITY.attribution.source} nennen und auf den{' '}
            <a href={CITY.attribution.datasetUrl} target="_blank" rel="noreferrer">
              Datensatz
            </a>{' '}
            verweisen.
          </p>
        )}
        {/*
          Nur Creative Commons: § 3 a) 1) A) iv) verlangt neben Urheber und
          Lizenz einen Hinweis auf den Gewährleistungsausschluss. Die
          Datenlizenz Deutschland kennt diese Auflage nicht — der Satz hängt
          deshalb an der Lizenzfamilie, nicht am Anzeigenamen der Lizenz.
        */}
        {CITY.attribution.licenceFamily === 'cc-by' && (
          <p className="sheet__hint">
            Creative Commons verlangt zusätzlich den Hinweis, dass die Daten{' '}
            <strong>ohne Gewährleistung</strong> bereitgestellt werden — soweit rechtlich
            zulässig, „wie besehen".
          </p>
        )}
        {/*
          § 2 der Datenlizenz Deutschland verlangt bei Veränderungen einen
          Hinweis darauf — und verändert sind die Daten in jedem Fall: Wir
          bilden Teilmengen, vereinfachen Geometrien und übersetzen Freitext in
          ein eigenes Schema. Der Satz stand nirgends (Audit-Punkt M-016).
          Er gilt für alle Städte, nicht nur die mit Namensnennung: Auch unter
          Zero soll niemand die vereinfachte Geometrie für die amtliche halten.
        */}
        <p className="sheet__hint">
          Die Daten sind <strong>verändert</strong>: Teilmenge der amtlichen Ebenen, Geometrien
          vereinfacht, Zeiten und Tarife in ein eigenes Format übersetzt. Verbindlich ist der
          Originaldatensatz — und vor Ort die Beschilderung.
        </p>
      </div>

      <footer className="sheet__foot">
        <nav className="legal" aria-label="Rechtliches">
          {imprintUrl !== undefined && (
            <a href={imprintUrl} target="_blank" rel="noreferrer">
              Impressum
            </a>
          )}
          {privacyUrl !== undefined && (
            <a href={privacyUrl} target="_blank" rel="noreferrer">
              Datenschutz
            </a>
          )}
          <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
            Lizenz
          </a>
        </nav>
      </footer>
    </div>
  )
}
