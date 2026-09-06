import { useMemo } from 'react'
import { chargeableAt, estimateCost, type ParkingZone } from '@parkingzone/core'

import { CITY } from './city.js'
import { MAX_STAY_MINUTES } from './format.js'
import type { ZoneProperties } from './types.js'

/** Adapts the shipped GeoJSON properties to the domain model in core. */
export function toParkingZone(properties: ZoneProperties): ParkingZone {
  // Hamburgs Feed nennt die Höchstparkdauer je Gebiet als Minutenzahl, Berlins
  // nur als Schlüssel einer abschnittsweisen Auswertung. Die verbindliche
  // Angabe gewinnt, wenn es sie gibt.
  const maxStay =
    properties.maxStayMinutes !== undefined && properties.maxStayMinutes !== null
      ? properties.maxStayMinutes
      : properties.maxStay === null
        ? undefined
        : MAX_STAY_MINUTES[properties.maxStay]
  return {
    id: properties.zone,
    name: properties.zone,
    land: CITY.land,
    fee: properties.fee,
    windows: properties.windows,
    ...(maxStay === undefined ? {} : { maxStayMinutes: maxStay }),
    unmodelledRules: properties.unmodelledRules,
  }
}

export interface ZoneStatus {
  zone: ParkingZone
  chargeable: boolean
  uncertain: boolean
  changesAt: Date | null
  /** Cost of one hour from now, for a quick headline figure. */
  hourly: ReturnType<typeof estimateCost>
}

export function useZoneStatus(properties: ZoneProperties | null, now: number): ZoneStatus | null {
  return useMemo(() => {
    if (properties === null) return null
    const zone = toParkingZone(properties)
    const { chargeable, uncertain, changesAt } = chargeableAt(zone, now)
    return { zone, chargeable, uncertain, changesAt, hourly: estimateCost(zone, now, 60) }
  }, [properties, now])
}
