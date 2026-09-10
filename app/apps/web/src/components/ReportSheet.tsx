import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'

import { distanceMetres, type Position } from '@knoellchenfrei/core'

import { representativePoint, zoneAt, type LoadedZone } from '../zones.js'
import { hatNummer, zoneKurz } from '../zone-label.js'

interface Props {
  zones: readonly LoadedZone[]
  /** Where the user last pointed, if anywhere. */
  anchor: Position | null
  /** GPS, if the device gave one. */
  position: Position | null
  /** Fallback for "near here": what the map is currently showing. */
  mapCentre: Position | null
  /** Ob gerade ein Standort geholt wird — dann sagt das Blatt das, statt zu schweigen. */
  locating: boolean
  /**
   * Vom Kartenknopf geöffnet: Der Standort steht vor der angetippten Stelle.
   * Aus dem Blatt heraus bleibt der Tipp vorn, denn dort hat jemand gezeigt.
   */
  preferGps: boolean
  onSubmit: (point: Position) => void
  onClose: () => void
  /** Null, wenn die Rückmeldung nirgendwo ankäme; dann fehlt der Knopf. */
  onFeedback: (() => void) | null
}

/** Nearby is a shortlist, not a directory. Three is what fits without scrolling. */
const NEARBY_COUNT = 3
const MAX_MATCHES = 8

interface Choice {
  key: string
  label: string
  detail: string
  point: Position
}

/**
 * Choosing where a sighting happened, as a form field rather than a map gesture.
 *
 * The old flow made the location an invisible piece of state: you had to tap the
 * map first, and on a phone the sheet covers the lower half, so the tap had to
 * land above it. Two people in a row read the resulting inactive button as
 * broken. Modelled on FreiFahren's report dialog, which makes the station a
 * labelled, required field with a search and a "nearby" shortlist — the map
 * stays available, it is just no longer the only way in.
 */
export function ReportSheet({
  zones,
  anchor,
  position,
  mapCentre,
  locating,
  preferGps,
  onSubmit,
  onClose,
  onFeedback,
}: Props) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Choice | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // The sheet takes the focus when it opens, so a keyboard or screen-reader user
  // lands inside it rather than behind it.
  useEffect(() => closeRef.current?.focus(), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const zoneChoice = (zone: LoadedZone, detail: string): Choice => ({
    // Die Flächenkennung, nicht der Zonenschlüssel: In Hamburg tragen 44 von
    // 145 Flächen den Schlüssel `-`, und mehrere davon können gleichzeitig in
    // dieser Liste stehen. Doppelte React-Schlüssel lassen React beim
    // Umsortieren den falschen Knoten wiederverwenden — die Auswahl springt
    // dann auf eine andere Zeile, als angeklickt wurde.
    key: `zone-${zone.id}`,
    label: zoneKurz(zone.properties),
    detail,
    point: representativePoint(zone),
  })

  /** What the user already pointed at, offered first because it is usually right. */
  const fromMap = useMemo<Choice | null>(() => {
    if (anchor === null) return null
    const zone = zoneAt(zones, anchor)
    return {
      key: 'map',
      label: zone === null ? 'Angetippte Stelle' : zoneKurz(zone.properties),
      detail: zone === null ? 'außerhalb der Parkzonen' : `${zone.properties.district} · angetippt`,
      // The tapped point itself, not the zone's centre: it is more precise, and
      // the report is coarsened to ~10 m anyway.
      point: anchor,
    }
  }, [anchor, zones])

  const fromGps = useMemo<Choice | null>(() => {
    if (position === null) return null
    const zone = zoneAt(zones, position)
    // Die Zone als Name, der Standort als Herkunft: Der Absenden-Knopf sagt
    // dann „Melden — Zone 12" statt „Melden — Mein Standort", und das ist
    // die Zeile, die jemand vor dem Bestätigen liest.
    return {
      key: 'gps',
      label: zone === null ? 'Mein Standort' : zoneKurz(zone.properties),
      detail:
        zone === null ? 'außerhalb der Parkzonen · mein Standort' : `${zone.properties.district} · mein Standort`,
      point: position,
    }
  }, [position, zones])

  /**
   * Zones closest to whatever reference point exists, cheapest first: the tapped
   * point, then GPS, then what the map is showing. Distance is measured to a
   * point inside the polygon rather than to its bounding-box centre, which for
   * an L-shaped zone can lie in a different zone entirely.
   */
  const nearby = useMemo<Choice[]>(() => {
    const from = anchor ?? position ?? mapCentre
    if (from === null) return []
    const already = new Set([fromMap?.key, fromGps?.key].filter(Boolean))
    return zones
      .map((zone) => ({ zone, point: representativePoint(zone) }))
      .map((entry) => ({ ...entry, metres: distanceMetres(from, entry.point) }))
      .sort((a, b) => a.metres - b.metres)
      .slice(0, NEARBY_COUNT + already.size)
      .map(({ zone, metres }) =>
        zoneChoice(
          zone,
          metres < 1000
            ? `${zone.properties.district} · ${Math.round(metres / 10) * 10} m`
            : `${zone.properties.district} · ${(metres / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`,
        ),
      )
      .slice(0, NEARBY_COUNT)
  }, [zones, anchor, position, mapCentre, fromMap, fromGps])

  const matches = useMemo<Choice[]>(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length === 0) return []
    return zones
      .filter(
        (zone) =>
          // Nur eine echte Nummer ist suchbar: Hamburgs Quell-Kennungen
          // (DE.HH.…) sind Schlüssel, keine Namen — auf „de" kämen 44 Treffer.
          (hatNummer(zone.properties) && zone.properties.zone.toLowerCase().startsWith(needle)) ||
          zone.properties.district.toLowerCase().includes(needle),
      )
      .slice(0, MAX_MATCHES)
      .map((zone) => zoneChoice(zone, zone.properties.district))
  }, [zones, query])

  const suggestions = (preferGps ? [fromGps, fromMap] : [fromMap, fromGps]).filter(
    (choice): choice is Choice => choice !== null,
  )
  const selected = picked ?? suggestions[0] ?? null

  const option = (choice: Choice): ReactElement => (
    <li key={choice.key}>
      <button
        type="button"
        className={`sheet__option${selected?.key === choice.key ? ' sheet__option--on' : ''}`}
        onClick={() => setPicked(choice)}
        aria-pressed={selected?.key === choice.key}
      >
        <span className="sheet__option-label">{choice.label}</span>
        <span className="sheet__option-detail">{choice.detail}</span>
      </button>
    </li>
  )

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Sichtung melden">
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
        <h2 className="sheet__title">Sichtung melden</h2>
        {onFeedback !== null && (
          <button type="button" className="sheet__aside" onClick={onFeedback}>
            Feedback
          </button>
        )}
      </header>

      <div className="sheet__body">
        <h3 className="sheet__label">
          Wo <span className="sheet__required">erforderlich</span>
        </h3>

        {locating && position === null && (
          <p className="sheet__hint" role="status">
            Standort wird ermittelt …
          </p>
        )}
        {suggestions.length > 0 && <ul className="sheet__options">{suggestions.map(option)}</ul>}

        <input
          type="search"
          className="sheet__search"
          placeholder="Zone oder Bezirk suchen"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Nach Zone oder Bezirk suchen"
        />

        {query.trim().length > 0 ? (
          <>
            <span className="visually-hidden" role="status">
              {matches.length === 0 ? 'Keine Treffer' : `${matches.length} Treffer`}
            </span>
            {matches.length === 0 ? (
              <p className="sheet__empty">Keine Zone gefunden.</p>
            ) : (
              <ul className="sheet__options">{matches.map(option)}</ul>
            )}
          </>
        ) : (
          nearby.length > 0 && (
            <>
              <h4 className="sheet__group">In der Nähe</h4>
              <ul className="sheet__options">{nearby.map(option)}</ul>
            </>
          )
        )}

        <p className="sheet__hint">
          Genauer geht es über die Karte: schließen, die Stelle antippen, wieder öffnen — sie
          steht dann ganz oben zur Auswahl.
        </p>
      </div>

      <footer className="sheet__foot">
        <button
          type="button"
          className="button button--primary sheet__submit"
          disabled={selected === null}
          onClick={() => {
            if (selected !== null) onSubmit(selected.point)
          }}
        >
          {selected === null ? 'Erst einen Ort wählen' : `Melden — ${selected.label}`}
        </button>
        <p className="sheet__note">
          Anonym geteilt. Position auf ~10 m gerundet, Zeit auf 5 Minuten. Verfällt nach 90
          Minuten.
        </p>
      </footer>
    </div>
  )
}
