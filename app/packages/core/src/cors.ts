/**
 * Die Allowlist für fremde Herkünfte, aus einer Konfigurationszeile gelesen.
 *
 * Steht hier und nicht im Worker, weil es fremde Eingabe zerlegt: eine
 * Zeichenkette aus der Umgebung, die ein Mensch getippt hat. Genau das ist die
 * Stelle, an der `''.split(',')` zubeißt — es ergibt `['']` und nicht `[]`.
 * Ohne gesetzte `ALLOWED_ORIGINS` stand damit ein **leerer Eintrag** in der
 * Liste, `includes('')` war wahr, und eine Anfrage mit dem leeren Header
 * `Origin:` kam an der Prüfung vorbei. Eine Allowlist, die ohne Konfiguration
 * einen Eintrag enthält, ist das Gegenteil von „fail closed" (Audit-Punkt
 * M-097). Dasselbe passiert bei einem Komma am Zeilenende.
 */
export function allowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '')
}

/**
 * Darf diese Herkunft?
 *
 * Die leere Herkunft ist **nie** erlaubt, auch wenn sie in der Liste stünde:
 * Sie steht für „kein `Origin`-Header" und damit für eine Anfrage, die gar
 * nicht aus einem Browser-Kontext kommt. Für die gilt die gleiche Antwort wie
 * für eine unbekannte Seite — keine CORS-Kopfzeile.
 */
export function originAllowed(raw: string | undefined, origin: string): boolean {
  if (origin === '') return false
  return allowedOrigins(raw).includes(origin)
}
