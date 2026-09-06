/**
 * Welche Stadt dieser Build ausliefert.
 *
 * Ein Build je Stadt, entschieden über `VITE_CITY` zur Bauzeit — nicht zur
 * Laufzeit umschaltbar. Der Grund ist nicht Bequemlichkeit: Die Zonendaten
 * (`public/data/*.geojson`) werden mitgebaut, und ein Umschalten im Browser
 * müsste den halben Datenbestand nachladen, um die Frage „bin ich hier in
 * einer Zone" überhaupt beantworten zu können.
 *
 * Ohne den Wert bleibt es Berlin. Das ist der eine Rückfall, den es gibt, und
 * er steht hier statt an vier Stellen verstreut: Berlin ist die Stadt, die
 * heute ausgeliefert wird, und ein Build ohne gesetzte Variable soll weiter
 * das tun, was er bisher tat. Ein *falscher* Wert fällt dagegen nicht zurück,
 * sondern wirft — siehe `cityByKey`.
 */

import { BERLIN, cityByKey, type City } from '@parkingzone/core'

const configured = import.meta.env.VITE_CITY as string | undefined

export const CITY: City =
  configured === undefined || configured === '' ? BERLIN : cityByKey(configured)
