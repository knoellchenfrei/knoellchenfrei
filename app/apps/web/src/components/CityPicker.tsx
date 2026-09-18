import { useState } from 'react'

import { COUNTRY_NAMES, cityCountry, type City, type Country } from '@knoellchenfrei/core'

import { CITY, recentCities, selectableCities } from '../city.js'
import { vorText, zuletztGenutzt } from '../zuletzt.js'

interface Props {
  /** Eine Stadt wurde angetippt. Die aktuelle ist nicht antippbar. */
  onPick: (city: City) => void
}

/**
 * Erst das Land, dann die Stadt — an zwei Stellen dieselbe Wahl: in den
 * Einstellungen und beim ersten Start. Eine Liste, die es zweimal gäbe,
 * liefe auseinander; deshalb steht sie hier einmal.
 *
 * Ein Land zur Zeit, wie eine Stadt zur Zeit: Wer nach Wien will, wählt
 * erst Österreich. Der Betreiber wollte den Wechsel über eine Grenze
 * **bewusst** — andere Feiertage, anderes Recht, in der Schweiz eine andere
 * Währung. Das Land ist ein natives Auswahlfeld, keine Segmentleiste: Mit
 * sechs Ländern lief die Leiste auf dem Handy nach rechts aus dem Bild
 * (18. September). Nur sichtbar, wenn es überhaupt zwei Länder gibt.
 */
export function CityPicker({ onPick }: Props) {
  const laender = (Object.keys(COUNTRY_NAMES) as Country[]).filter((land) =>
    selectableCities().some((city) => cityCountry(city) === land)
  )
  const [country, setCountry] = useState<Country>(cityCountry(CITY))
  // „Zuletzt genutzt": nur Städte, die diese Auslieferung kennt — ein
  // Schlüssel aus einem älteren Stand darf die Liste nicht sprengen.
  const jetzt = Date.now()
  const zuletzt = zuletztGenutzt(recentCities(), CITY.key).flatMap((n) => {
    const city = selectableCities().find((c) => c.key === n.key)
    return city === undefined ? [] : [{ city, text: vorText(n.at, jetzt) }]
  })
  return (
    <>
      {zuletzt.length > 0 && (
        <>
          <h3 className="sheet__label">Zuletzt genutzt</h3>
          <ul className="rows rows--recent">
            {zuletzt.map(({ city, text }) => (
              <li key={`zuletzt:${city.key}`}>
                <button type="button" className="rows__item" onClick={() => onPick(city)}>
                  <span>
                    {city.name}
                    <small className="rows__sub">{text}</small>
                  </span>
                  <span className="rows__chevron" aria-hidden="true">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <h3 className="sheet__label">Alle Städte</h3>
        </>
      )}
      {laender.length > 1 && (
        <select
          className="select"
          aria-label="Land"
          value={country}
          onChange={(event) => setCountry(event.target.value as Country)}
        >
          {laender.map((land) => (
            <option key={land} value={land}>
              {COUNTRY_NAMES[land]}
            </option>
          ))}
        </select>
      )}
      <ul className="rows">
        {selectableCities()
          .filter((city) => cityCountry(city) === country)
          .map((city) => (
            <li key={city.key}>
              <button
                type="button"
                className="rows__item"
                aria-current={city.key === CITY.key ? 'true' : undefined}
                disabled={city.key === CITY.key}
                onClick={() => onPick(city)}
              >
                <span>{city.name}</span>
                <span className="rows__chevron" aria-hidden="true">
                  {city.key === CITY.key ? '✓' : '→'}
                </span>
              </button>
            </li>
          ))}
      </ul>
    </>
  )
}
