import { useEffect, useMemo, useState } from 'react'

import { CITY } from '../city.js'
import { IconOrt, IconSuche } from '../icons.js'
import { MIN_QUERY, searchStreets, type StreetHit } from '../street-search.js'
import type { LoadedZone } from '../zones.js'
import { hatNummer, zoneKurz } from '../zone-label.js'

interface Props {
  zones: readonly LoadedZone[]
  onPick: (zone: LoadedZone) => void
  onPickStreet: (hit: StreetHit) => void
  /** Meldet, ob gerade eine Trefferliste offen ist — für den Verlaufseintrag (Android „Zurück"). */
  onOpenChange?: (open: boolean) => void
}

/** Wie lange die Tastatur ruhen muss, bevor eine Straßenanfrage geht. */
const DEBOUNCE_MS = 300

/**
 * Suche über Zonen und Bezirke (vom Gerät) und Straßen (Photon, ab drei
 * Zeichen). Die Zonen kommen zuerst und sofort; die Straßen folgen, wenn
 * eine Antwort kommt — und fehlen still, wenn keine kommt. Der Grund für die
 * Zweiteilung steht in `street-search.ts`.
 */
export function SearchBox({ zones, onPick, onPickStreet, onOpenChange }: Props) {
  const [query, setQuery] = useState('')
  const [streets, setStreets] = useState<StreetHit[]>([])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length === 0) return []
    return zones
      .filter(
        (zone) =>
          // Nur eine echte Nummer ist suchbar: Hamburgs Quell-Kennungen
          // (DE.HH.…) sind Schlüssel, keine Namen — auf „de" kämen 44 Treffer.
          (hatNummer(zone.properties) && zone.properties.zone.toLowerCase().startsWith(needle)) ||
          zone.properties.district.toLowerCase().includes(needle)
      )
      .slice(0, 6)
  }, [zones, query])

  useEffect(() => {
    const needle = query.trim()
    if (needle.length < MIN_QUERY) {
      setStreets([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchStreets(needle, CITY.reportBounds, controller.signal)
        .then((hits) => {
          if (!controller.signal.aborted) setStreets(hits)
        })
        .catch(() => {
          /* offline oder Photon nicht erreichbar: die Zonen bleiben */
        })
    }, DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const total = matches.length + streets.length
  const open = total > 0
  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])
  const reset = (): void => {
    setQuery('')
    setStreets([])
  }

  return (
    <div className="search">
      <IconSuche className="search__icon" size={20} aria-hidden="true" />
      <input
        type="search"
        className="search__input"
        placeholder="Zone, Bezirk, Straße"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        // Die „Suchen"-Taste der Android-Tastatur wählt den ersten Treffer
        // und schliesst die Tastatur; vorher tat sie nichts, und der erste
        // Treffer lag unter der Tastatur (Android-Audit A-010). `autoComplete`
        // aus, damit Chromes Autofill-Leiste nicht über die Treffer fällt.
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          const zone = matches[0]
          const street = streets[0]
          if (zone !== undefined) onPick(zone)
          else if (street !== undefined) onPickStreet(street)
          else return
          reset()
          event.currentTarget.blur()
        }}
        enterKeyHint="search"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Nach Zone, Bezirk oder Straße suchen"
        aria-describedby="search-hint"
      />
      <span id="search-hint" className="visually-hidden">
        Treffer erscheinen darunter und sind mit Tab erreichbar.
      </span>
      {/* Announces how many results appeared; the list itself is silent. */}
      {query.trim().length > 0 && (
        <span className="visually-hidden" role="status">
          {total === 0 ? 'Keine Treffer' : `${total} Treffer`}
        </span>
      )}
      {total > 0 && (
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
                  reset()
                }}
              >
                <strong>{zoneKurz(zone.properties)}</strong>
                <span>{zone.properties.district}</span>
              </button>
            </li>
          ))}
          {streets.length > 0 && matches.length > 0 && (
            <li className="search__group" aria-hidden="true">
              Straßen
            </li>
          )}
          {streets.map((hit) => (
            <li key={`${hit.name}|${hit.detail ?? ''}`}>
              <button
                type="button"
                onClick={() => {
                  onPickStreet(hit)
                  reset()
                }}
              >
                <strong>
                  <IconOrt size={14} aria-hidden="true" /> {hit.name}
                </strong>
                <span>{hit.detail ?? 'Straße'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
