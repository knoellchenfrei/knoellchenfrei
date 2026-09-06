import { useEffect, useRef } from 'react'

import { CITIES, HISTORY_DAYS, type City } from '@parkingzone/core'

import { CITY, switchCity } from '../city.js'
import { availableCities } from '../data-source.js'
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
}

const REPO = 'https://github.com/knoellchenfrei/knoellchenfrei'
const FREIFAHREN = 'https://freifahren.org'

/**
 * Welche Städte diese Auslieferung zeigen kann.
 *
 * Auf einem statischen Host jede, die es im Bündel gibt — die Daten werden
 * nachgeladen. Im Artifact nur die eingebetteten, weil dort nichts nachgeladen
 * werden kann: Dessen Sicherheitsrichtlinie blockiert jede fremde Anfrage.
 */
function selectableCities(): readonly City[] {
  const embedded = availableCities()
  return embedded === null ? CITIES : CITIES.filter((city) => embedded.includes(city.key))
}

/**
 * Fragen, die diese App selbst aufwirft.
 *
 * Keine allgemeine Hilfe, sondern genau die Stellen, an denen die Anzeige
 * überrascht und deshalb erklärt gehört — jede einzelne ist beim Bauen als
 * echte Verwirrung aufgetreten. Eine FAQ, die stattdessen „Wie benutze ich die
 * Karte?" beantwortet, liest niemand.
 */
const FAQ: readonly { q: string; a: React.ReactNode }[] = [
  {
    q: 'Warum kassiert sonntags nur eine einzige Zone?',
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
    q: 'Was bedeutet „unsicher"?',
    a: (
      <>
        Vier Zonen führen <code>Advents-Sa</code> in ihren Zeiten, ohne zu sagen, welche Samstage
        gemeint sind. An diesen Tagen zeigt die App „unsicher" statt zu raten — hier hilft nur der
        Automat vor Ort.
      </>
    ),
  },
  {
    q: 'Warum steht bei manchen Zonen eine Preisspanne?',
    a: (
      <>
        Weil sie so im Feed steht, etwa <code>2,00-3,00 Euro</code>. Auf einen Wert zu reduzieren
        würde dich um bis zu 50&nbsp;% verschätzen, deshalb bleibt die Spanne stehen.
      </>
    ),
  },
  {
    q: 'Warum steht bei der Höchstparkdauer eine Abdeckung dabei?',
    a: (
      <>
        Weil sie fast nie für die ganze Zone gilt: Von 45.917 Abschnitten tragen 747 einen Wert.
        Die App nennt ihn samt Anteil, statt ihn zur Zonenregel zu erklären.
      </>
    ),
  },
  {
    q: 'Kann ich hier bezahlen?',
    a: (
      <>
        Nein. Handyparken läuft in Berlin über eine geschlossene Plattform; ohne Vertrag ist kein
        Parkticket lösbar. Diese App sagt dir, was es kostet — bezahlen musst du am Automaten oder
        in einer der Anbieter-Apps.
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
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  const install = useInstallState()

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
            ⚠
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

        <h3 className="sheet__label">Häufige Fragen</h3>
        <div className="faq">
          {FAQ.map((entry) => (
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
          Bei Hamburg ist die Nennung der Quelle Lizenzbedingung
          (DL-DE/Namensnennung 2.0), bei Berlin freiwillig (DL-DE/Zero).
          Deshalb steht sie dort nicht nur klein unter „Daten", sondern wird
          ausdrücklich als Bedingung benannt — wer den Satz kürzt, kürzt eine
          Auflage weg.
        */}
        {CITY.attribution.attributionRequired && (
          <p className="sheet__hint">
            Die Lizenz dieser Stadt <strong>verlangt</strong> die Nennung der Quelle. Wer die
            Daten weiterverwendet, muss {CITY.attribution.source} nennen.
          </p>
        )}
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
