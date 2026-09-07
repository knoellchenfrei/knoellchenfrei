/**
 * Ab wann ein Ratenzähler zählt.
 *
 * Eine Zeile Rechnung, die trotzdem hierher gehört: Sie war falsch, und der
 * Fehler war unsichtbar. Der Worker speichert `feedback.created_at`
 * **auf die Stunde abgerundet** — die genaue Minute sagt über einen Vorschlag
 * nichts und grenzt ein, wer ihn geschrieben haben kann. Gezählt wurde aber
 * gegen ein rollendes Fenster `jetzt − 1 h`.
 *
 * Beides zusammen zählt am Stundenwechsel falsch: Eine um 10:59 geschriebene
 * Zeile trägt den Stempel 10:00. Um 11:01 beginnt das rollende Fenster bei
 * 10:01, die Zeile fällt heraus, und das Kontingent steht wieder auf null.
 * Vier Rückmeldungen um 10:59 und vier um 11:01 sind acht in zwei Minuten, bei
 * einer Grenze von vier je Stunde (Audit-Punkt M-045).
 *
 * Die Regel dahinter gilt über diesen Fall hinaus: **Wer Zeitstempel gröber
 * speichert, als er sie vergleicht, vergleicht Äpfel mit Stundenkästen.**
 * Entweder man zählt in denselben Kästen, oder das Fenster reicht einen Kasten
 * weiter zurück. Diese Funktion tut das Zweite — die Grenze wird dadurch eher
 * zu streng als zu locker, und das ist bei einer Missbrauchsbremse die
 * richtige Richtung.
 */
export function countingWindowStart(now: number, windowMs: number, granularityMs = 0): number {
  if (!Number.isFinite(now) || !Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error(`Unbrauchbares Zählfenster: now=${now}, windowMs=${windowMs}`)
  }
  if (!Number.isFinite(granularityMs) || granularityMs < 0) {
    throw new Error(`Unbrauchbare Speichergenauigkeit: ${granularityMs}`)
  }
  // Ohne Rundung beim Speichern ist das rollende Fenster genau richtig.
  if (granularityMs <= 1) return now - windowMs
  // Mit Rundung: erst auf den Kasten abrunden, in dem `now` liegt, dann ein
  // volles Fenster davor beginnen. Damit ist jede Zeile, die im laufenden
  // Kasten geschrieben wurde, garantiert enthalten.
  return Math.floor(now / granularityMs) * granularityMs - windowMs
}
