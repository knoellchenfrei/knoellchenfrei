import type { QuietDay } from '@parkingzone/core'

interface Props {
  note: QuietDay
  onDismiss: () => void
}

/**
 * Erklärt eine auffällig niedrige Zahl kassierender Zonen.
 *
 * Zwei Anforderungen, die den Zuschnitt bestimmen:
 *
 * **Er muss wieder weggehen.** Ein Hinweis, der immer dasteht, wird zu Tapete
 * und nimmt auf einem Handy Platz weg, den die Karte braucht. Deshalb erscheint
 * er nur, wenn die Zahl wirklich erklärungsbedürftig ist, und lässt sich
 * schließen.
 *
 * **Kein Wort über Berlin oder Sonntag steht im Code.** Der Wochentag kommt aus
 * der Uhr, die Stunden und die Ruhetage aus den geladenen Fahrplänen. Eine
 * zweite Stadt bekommt denselben Hinweis mit ihren eigenen Zahlen.
 */
export function QuietDayNote({ note, onDismiss }: Props) {
  const weekday = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    timeZone: 'Europe/Berlin',
  }).format(new Date())

  const text =
    note.reason === 'restDay'
      ? `${weekday}: Die meisten Zonen kassieren an diesem Wochentag nicht.`
      : note.reason === 'beforeHours'
        ? `Die meisten Zonen kassieren erst ab ${note.usualStartHour} Uhr.`
        : `Die meisten Zonen kassieren nur bis ${note.usualEndHour} Uhr.`

  const exceptions =
    note.exceptions.length === 0
      ? null
      : note.exceptions.length === 1
        ? ` Ausnahme: Zone ${note.exceptions[0]}.`
        : ` Ausnahmen: Zonen ${note.exceptions.join(', ')}.`

  return (
    <p className="daynote" role="status">
      <span>
        {text}
        {exceptions}
      </span>
      <button type="button" onClick={onDismiss} aria-label="Hinweis ausblenden">
        <span aria-hidden="true">×</span>
      </button>
    </p>
  )
}
