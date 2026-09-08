import { useMemo, useState } from 'react'

import type { LoadedZone } from '../zones.js'
import { zoneKurz } from '../zone-label.js'

interface Props {
  zones: readonly LoadedZone[]
  onPick: (zone: LoadedZone) => void
}

/**
 * Search over the shipped zone list — zone number or district.
 *
 * Deliberately not a geocoder: an address lookup would mean a third-party
 * request on every keystroke and would stop working offline, while the zone and
 * district names are already on the device.
 */
export function SearchBox({ zones, onPick }: Props) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length === 0) return []
    return zones
      .filter(
        (zone) =>
          zone.properties.zone.toLowerCase().startsWith(needle) ||
          zone.properties.district.toLowerCase().includes(needle)
      )
      .slice(0, 8)
  }, [zones, query])

  return (
    <div className="search">
      <input
        type="search"
        className="search__input"
        placeholder="Zone oder Bezirk"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Nach Zone oder Bezirk suchen"
        aria-describedby="search-hint"
      />
      <span id="search-hint" className="visually-hidden">
        Treffer erscheinen darunter und sind mit Tab erreichbar.
      </span>
      {/* Announces how many results appeared; the list itself is silent. */}
      {query.trim().length > 0 && (
        <span className="visually-hidden" role="status">
          {matches.length === 0 ? 'Keine Treffer' : `${matches.length} Treffer`}
        </span>
      )}
      {matches.length > 0 && (
        <ul className="search__results">
          {/* Schlüssel ist die Flächenkennung, nicht `properties.zone` — siehe
              ReportSheet: In Hamburg tragen 44 von 145 Flächen den Schlüssel
              `-`, und doppelte React-Schlüssel lassen React beim Umsortieren
              den falschen Knoten wiederverwenden. */}
          {matches.map((zone) => (
            <li key={zone.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(zone)
                  setQuery('')
                }}
              >
                <strong>{zoneKurz(zone.properties)}</strong>
                <span>{zone.properties.district}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
