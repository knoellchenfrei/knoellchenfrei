#!/usr/bin/env node
/**
 * Prüft die Dokumentation auf zwei Sorten Schaden, die beide schon eingetreten
 * sind und beide leise waren.
 *
 * ## 1. Verschwundene Abschnitte
 *
 * `docs/todo.md` hat vier nummerierte Abschnitte verloren — dreimal am
 * 7. September (`## 3.`, `## 5.`, `## 8.`), einmal unbemerkt schon davor
 * (`## 6.`, in einem Commit über Worker-Tests). Ursache war jedes Mal
 * dieselbe: ein zeilenbasiertes Ersetzen, dessen Block nicht an der nächsten
 * Überschrift endete. Gefunden wurden sie durch Nachzählen, und zwar erst
 * Stunden später.
 *
 * Die Prüfung ist billig und hätte alle vier sofort gemeldet: Nummerierte
 * Abschnitte müssen lückenlos aufsteigen. Ein Abschnitt, der absichtlich
 * entfällt, wird umnummeriert — dann sagt es der Diff.
 *
 * ## 2. Verweise ins Leere
 *
 * Die Doku verweist quer durcheinander; das ist gewollt. Ein Verweis auf eine
 * Datei, die verschoben wurde, sieht in der gerenderten Ansicht aus wie ein
 * gültiger Link und ist einer, der 404 gibt. Geprüft werden relative Verweise
 * auf Dateien und, wo ein Anker drankhängt, ob es die Überschrift gibt.
 *
 * Aufruf: `node scripts/doku-pruefen.mjs`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const AUS = ['node_modules', '.git', 'dist', 'coverage', 'test-results', 'playwright-report']

/** Alle Markdown-Dateien des Baums, ohne Erzeugtes. */
function markdownDateien(verzeichnis) {
  const gefunden = []
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    if (AUS.includes(eintrag.name)) continue
    const pfad = join(verzeichnis, eintrag.name)
    if (eintrag.isDirectory()) gefunden.push(...markdownDateien(pfad))
    else if (eintrag.name.endsWith('.md')) gefunden.push(pfad)
  }
  return gefunden
}

/**
 * Der Anker, den GitHub aus einer Überschrift baut.
 *
 * Kleinschreibung, Satzzeichen weg, Leerzeichen zu Bindestrichen — Umlaute
 * bleiben stehen. Nachgemessen an den Überschriften dieses Repositories, nicht
 * aus einer Erinnerung.
 */
function anker(ueberschrift) {
  return ueberschrift
    .trim()
    .toLowerCase()
    .replace(/[`*_[\]()]/g, '')
    .replace(/[^\p{L}\p{N} \-]/gu, '')
    .trim()
    // Jedes Leerzeichen wird zu einem Bindestrich, nicht jede *Folge*. Das ist
    // kein Detail: "gründen — **du**" ergibt nach dem Entfernen des Gedanken-
    // strichs zwei Leerzeichen nebeneinander, und GitHubs Anker heisst deshalb
    // `…-gründen--du` mit zwei Bindestrichen. Wer die Folge zusammenzieht,
    // meldet vier gültige Verweise als kaputt.
    .replace(/ /g, '-')
}

/** Codezäune ausblenden: Was darin steht, ist Beispiel und kein Verweis. */
function ohneCode(text) {
  return text.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, ' '))
}

/**
 * Die Prüfung prüft sich selbst, bevor sie prüft.
 *
 * Dieselbe Regel wie bei `geheimnisse-pruefen.sh`: Eine Prüfung, die nie
 * anschlägt, ist von einer kaputten nicht zu unterscheiden. Beide Muster
 * werden hier an erfundenen Beispielen ausgelöst; schlägt eines davon nicht
 * an, bricht das Skript ab, statt grün zu melden.
 */
function selbsttest() {
  const luecke = ['## 1. Eins', '## 2. Zwei', '## 4. Vier'].join('\n')
  const nummern = [...luecke.matchAll(/^## (\d+)\. /gm)].map((t) => Number(t[1]))
  const gefunden = nummern.some((n, i) => i > 0 && n !== nummern[i - 1] + 1)
  if (!gefunden) {
    console.error('Selbsttest: die Lückenprüfung schlägt bei 1, 2, 4 nicht an.')
    process.exit(2)
  }
  // Der Ankerbau an einer Überschrift, die genau die Falle enthält, an der die
  // erste Fassung vier gültige Verweise als kaputt gemeldet hat.
  const gebaut = anker('## 1. Trägerschaft: Verein gründen — **du**'.replace(/^#+ /, ''))
  if (gebaut !== '1-trägerschaft-verein-gründen--du') {
    console.error(`Selbsttest: Anker falsch gebaut — "${gebaut}".`)
    process.exit(2)
  }
}

selbsttest()

const fehler = []
const dateien = markdownDateien(WURZEL)

// --- 1. Lückenlose Nummerierung ---------------------------------------------
for (const datei of dateien) {
  const nummern = []
  for (const zeile of ohneCode(readFileSync(datei, 'utf8')).split('\n')) {
    const treffer = /^## (\d+)\. /.exec(zeile)
    if (treffer !== null) nummern.push(Number(treffer[1]))
  }
  if (nummern.length < 2) continue
  for (let i = 1; i < nummern.length; i += 1) {
    const erwartet = nummern[i - 1] + 1
    if (nummern[i] !== erwartet) {
      fehler.push(
        `${relative(WURZEL, datei)}: Abschnitt ${erwartet} fehlt — nach ${nummern[i - 1]} ` +
          `kommt ${nummern[i]}. Entweder ist er verlorengegangen oder es muss umnummeriert werden.`
      )
    }
  }
}

// --- 2. Verweise ------------------------------------------------------------
/** Die Anker je Datei, einmal berechnet. */
const ankerJeDatei = new Map()
for (const datei of dateien) {
  const menge = new Set()
  for (const zeile of ohneCode(readFileSync(datei, 'utf8')).split('\n')) {
    const treffer = /^#{1,6} +(.*)$/.exec(zeile)
    if (treffer !== null) menge.add(anker(treffer[1]))
  }
  ankerJeDatei.set(resolve(datei), menge)
}

for (const datei of dateien) {
  const inhalt = ohneCode(readFileSync(datei, 'utf8'))
  for (const treffer of inhalt.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const ziel = treffer[1]
    // Nur relative Verweise. Alles mit Schema, Protokoll oder Mailto gehört
    // nicht hierher — ob eine fremde Adresse noch antwortet, sagt ein
    // Linkchecker im Netz, nicht diese Prüfung.
    if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(ziel)) continue
    const [pfad, fragment] = ziel.split('#')
    const absolut = resolve(dirname(datei), pfad)
    let existiert = true
    try {
      statSync(absolut)
    } catch {
      existiert = false
    }
    if (!existiert) {
      fehler.push(`${relative(WURZEL, datei)}: Verweis auf "${ziel}" — die Datei gibt es nicht.`)
      continue
    }
    if (fragment === undefined || fragment === '') continue
    const anke = ankerJeDatei.get(absolut)
    // Anker in Dateien, die wir nicht gelesen haben (kein Markdown), prüfen
    // wir nicht — dort gibt es keine Überschriften, die wir kennen könnten.
    if (anke !== undefined && !anke.has(fragment)) {
      fehler.push(
        `${relative(WURZEL, datei)}: Verweis auf "${ziel}" — die Überschrift "#${fragment}" ` +
          `gibt es in ${pfad} nicht.`
      )
    }
  }
}

if (fehler.length > 0) {
  console.error('Doku-Prüfung fehlgeschlagen:\n')
  for (const zeile of fehler) console.error(`  ${zeile}`)
  console.error(`\n  ${fehler.length} Befund(e).`)
  process.exit(1)
}
console.log(`  ✓ Doku geprüft: ${dateien.length} Dateien, Nummerierung lückenlos, Verweise tragen`)
