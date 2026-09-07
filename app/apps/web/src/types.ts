import type { ChargeWindow, Fee } from '@knoellchenfrei/core'

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
  /**
   * Verbindliche Höchstparkdauer der Zone, in Minuten.
   *
   * Nur Hamburg setzt sie: Dort ist sie eine Regel des Gebiets und steht als
   * Zahl im Feed. In Berlin ist sie eine Eigenschaft einzelner
   * Straßenabschnitte — sie dort als Zonenregel auszugeben war ein gefundener
   * Fehler, und `maxStayShare` sagt seitdem, auf wie wenigen sie gilt.
   *
   * Frankfurt setzt sie aus demselben Grund **nicht**: Dort steht sie je
   * Parkscheinautomat, und in 19 von 27 Bereichen stehen mehrere Werte
   * nebeneinander, oft „1 h" neben „keine". Der Weg über `maxStayShare` ist
   * dort der einzige, der nicht mehr behauptet, als die Quelle sagt.
   */
  maxStayMinutes?: number | null
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
