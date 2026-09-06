import { useEffect, useState } from 'react'

import { applyUpdate, watchUpdate } from '../pwa.js'

/**
 * Meldet sich, wenn im Hintergrund eine neue Version bereitliegt.
 *
 * Sie wird nicht ungefragt übernommen: Der Austausch lädt die Seite neu, und
 * das mitten im Melden oder beim laufenden Parkzeit-Timer wäre ein Datenverlust
 * — die App entscheidet das nicht für den Nutzer.
 */
export function UpdateBar() {
  const [ready, setReady] = useState(false)
  useEffect(() => watchUpdate(setReady), [])
  if (!ready) return null

  return (
    <aside className="updatebar" role="status">
      <span>Neue Version bereit.</span>
      <button type="button" className="updatebar__go" onClick={applyUpdate}>
        Jetzt laden
      </button>
    </aside>
  )
}
