interface Props {
  onAllow: () => void
  onDismiss: () => void
}

/**
 * Fragt, bevor der Browser fragt.
 *
 * Der native Berechtigungsdialog erscheint ohne jeden Zusammenhang: ein Balken
 * am oberen Rand, der nicht sagt, wofür. Wer ihn ablehnt, hat die Berechtigung
 * für diese Seite dauerhaft verbrannt — ein zweites Mal fragt der Browser nicht.
 *
 * Deshalb erst diese Karte: Sie erklärt den Nutzen, nennt die Grenze („die
 * genaue Position sieht niemand sonst"), und **„Später" löst den nativen Dialog
 * gar nicht erst aus**. Damit bleibt die Entscheidung umkehrbar. Nach dem
 * Vorbild von FreiFahren, deren Fassung denselben Zweck erfüllt.
 *
 * Zweiter Grund, hier besonders wichtig: In einer eingebetteten Ansicht
 * verweigert der Browser den Zugriff stumm — kein Dialog, keine Meldung. Ohne
 * Vorschaltung wirkt das wie eine kaputte App. Der Text nennt deshalb von
 * vornherein die Alternative, die immer funktioniert.
 */
export function LocationPrompt({ onAllow, onDismiss }: Props) {
  return (
    <aside className="prompt" role="dialog" aria-label="Standort verwenden?">
      <h2 className="prompt__title">
        <span className="prompt__pin" aria-hidden="true">
          ◉
        </span>
        Standort verwenden?
      </h2>
      <p className="prompt__body">
        Dann steht sofort da, in welcher Zone du bist und was sie gerade kostet. Die genaue
        Position bleibt auf deinem Gerät — gemeldet wird sie nur, wenn du eine Sichtung abschickst,
        und dann auf 10&nbsp;Meter gerundet.
      </p>
      <div className="prompt__actions">
        <button type="button" className="button" onClick={onDismiss}>
          Später
        </button>
        <button type="button" className="button button--primary" onClick={onAllow}>
          Standort verwenden
        </button>
      </div>
      <p className="prompt__note">
        Geht auch ohne: einfach auf die Karte tippen, wo du stehst.
      </p>
    </aside>
  )
}
