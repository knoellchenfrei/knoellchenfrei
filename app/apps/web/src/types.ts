import type { ChargeWindow, Fee } from '@parkingzone/core'

export interface ZoneProperties {
  zone: string
  district: string
  rawHours: string
  rawFee: string
  note: string | null
  windows: ChargeWindow[]
  fee: Fee
  unmodelledRules: string[]
  sourceDefect: string | null
  spaces: number | null
  maxStay: string | null
  maxStayShare: number
  maxStayValues: string[]
  chargingPoints: number
  carsharing: number
}

export type PoiKind = 'charging' | 'carsharing' | 'park_and_ride' | 'accessible'

export interface PoiProperties {
  kind: PoiKind
  label: string
  detail: string | null
}

export interface Meta {
  source: string
  licence: string
  licenceUrl: string
  zones: number
  segments: number
  managedSpaces: number
  poi: number
  crs: string
}
