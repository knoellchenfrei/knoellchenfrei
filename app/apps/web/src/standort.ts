/**
 * Den Standort holen — in zwei Stufen, weil eine nicht reicht.
 *
 * Bis zum 18. September fragte „Wo bin ich?" genau einmal, mit hoher
 * Genauigkeit und zehn Sekunden Frist. Auf einem Android-Gerät mit gerade
 * eingeschaltetem GPS braucht der erste Fix drinnen oft länger; der Aufruf
 * lief in `TIMEOUT`, und die App sagte „Standort konnte nicht ermittelt
 * werden" — obwohl GPS an war (ein Android-Tester, Brave). Eine grobe
 * Position aus Funkzelle und WLAN kommt in Sekunden und reicht, um die Zone
 * zu treffen: Zonen sind hunderte Meter groß. Deshalb: erst genau, bei
 * Zeitüberschreitung oder „nicht verfügbar" grob mit längerer Frist, und
 * der laufende `watchPosition` rückt den Punkt danach nach.
 *
 * Eine verweigerte Berechtigung bricht sofort ab — eine zweite Anfrage
 * würde den Dialog nicht noch einmal zeigen.
 */
export interface StandortQuelle {
  getCurrentPosition(
    ok: (position: GeolocationPosition) => void,
    fehler: (cause: GeolocationPositionError) => void,
    optionen?: PositionOptions,
  ): void
}

/** Die Codes aus `GeolocationPositionError`, hier als Zahlen — in Node gibt es die Klasse nicht. */
export const VERWEIGERT = 1
export const KEINE_POSITION = 2
export const ZEIT_ABGELAUFEN = 3

export const GENAU: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
export const GROB: PositionOptions = { enableHighAccuracy: false, timeout: 15_000, maximumAge: 120_000 }

export function holeStandort(
  quelle: StandortQuelle,
  stufen: readonly PositionOptions[] = [GENAU, GROB],
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    const versuch = (i: number): void => {
      const optionen = stufen[i]
      if (optionen === undefined) {
        reject(new Error('keine Stufe'))
        return
      }
      quelle.getCurrentPosition(
        resolve,
        (cause) => {
          if (cause.code === VERWEIGERT || i + 1 >= stufen.length) reject(cause)
          else versuch(i + 1)
        },
        optionen,
      )
    }
    versuch(0)
  })
}

/** Der Satz für den Menschen — je Ursache ein anderer, denn die Abhilfe ist eine andere. */
export function standortFehlerText(cause: { code: number }): string {
  switch (cause.code) {
    case VERWEIGERT:
      // In an embedded frame the browser refuses without ever asking, so
      // "denied" here usually means "not offered". Say what to do instead.
      return 'Standort ist hier nicht verfügbar — in eingebetteten Ansichten fragt der Browser gar nicht erst. Tippe stattdessen auf die Karte.'
    case ZEIT_ABGELAUFEN:
      return 'Kein Standort in 25 Sekunden — drinnen braucht GPS oft länger. Noch einmal versuchen oder auf die Karte tippen.'
    default:
      return 'Standort gerade nicht verfügbar — das Gerät liefert keine Position. Tippe stattdessen auf die Karte.'
  }
}
