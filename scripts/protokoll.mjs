#!/usr/bin/env node
/**
 * Misst eine Claude-Code-Sitzung aus ihrem Verlauf.
 *
 * Die Zahlen in `docs/sitzungsstatistik.md` sollen nachrechenbar sein und
 * nicht geschätzt. Dieses Skript ist der Weg dorthin: Es liest das JSONL des
 * Sitzungsverlaufs zeilenweise, summiert die `usage`-Felder der
 * Assistenten-Nachrichten und zählt die `tool_use`-Blöcke.
 *
 * ```bash
 * node scripts/protokoll.mjs ~/.claude/projects/<projekt>/<sitzung>.jsonl
 * ```
 *
 * **Zwei Dinge, die man wissen muss, bevor man die Ausgabe glaubt:**
 *
 * 1. **Der Verlauf ist nicht die Buchhaltung.** `get_session` →
 *    `external_metadata.usage` ist massgeblich; der Verlauf zählt beim
 *    Streamen Zwischenstände mehrfach und überzeichnet vor allem das
 *    Cache-Lesen. Gemessen an der Sitzung vom 5./6. September: 777 Mio. im
 *    Verlauf gegen 483 Mio. in der Buchhaltung, Faktor 1,6.
 * 2. **Eine „echte" Nachricht des Nutzers ist eine mit reinem Text.**
 *    Werkzeugergebnisse kommen im Verlauf ebenfalls als `type: "user"` an. Wer
 *    sie mitzählt, bekommt 1.392 statt 51 — und damit ein völlig falsches Bild
 *    davon, wie viel Führung eine Sitzung gebraucht hat.
 */

import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const pfad = process.argv[2]
const werkzeuge = new Map()
const modelle = new Map()
let zeilen = 0, assistent = 0, nutzer = 0, echteNutzer = 0
let ein = 0, aus = 0, cacheW = 0, cacheR = 0
let erste = null, letzte = null
const agenten = new Set()

const rl = createInterface({ input: createReadStream(pfad), crlfDelay: Infinity })
for await (const zeile of rl) {
  zeilen += 1
  let e
  try { e = JSON.parse(zeile) } catch { continue }
  const t = e.timestamp
  if (typeof t === 'string') { if (erste === null || t < erste) erste = t; if (letzte === null || t > letzte) letzte = t }
  if (e.type === 'user') {
    nutzer += 1
    const inhalt = e.message?.content
    // Werkzeugergebnisse kommen ebenfalls als `type: "user"` an — siehe oben.
    if (typeof inhalt === 'string') echteNutzer += 1
    else if (Array.isArray(inhalt) && inhalt.every((teil) => teil.type === 'text')) echteNutzer += 1
  }
  if (e.type !== 'assistant') continue
  assistent += 1
  const m = e.message
  if (m?.model) modelle.set(m.model, (modelle.get(m.model) ?? 0) + 1)
  const u = m?.usage
  if (u) {
    ein += u.input_tokens ?? 0
    aus += u.output_tokens ?? 0
    cacheW += u.cache_creation_input_tokens ?? 0
    cacheR += u.cache_read_input_tokens ?? 0
  }
  for (const teil of m?.content ?? []) {
    if (teil.type !== 'tool_use') continue
    werkzeuge.set(teil.name, (werkzeuge.get(teil.name) ?? 0) + 1)
    if (teil.name === 'Agent') agenten.add(JSON.stringify(teil.input?.description ?? ''))
  }
}
const n = (x) => x.toLocaleString('de-DE')
console.log('Zeilen im Verlauf: ', n(zeilen))
console.log('Assistenten-Nachrichten:', n(assistent))
console.log('Nutzer-Ereignisse:', n(nutzer), ' davon echte Nachrichten:', n(echteNutzer))
console.log('Modelle:', [...modelle].map(([k,v]) => `${k}=${n(v)}`).join(', '))
console.log('Erste:', erste, ' Letzte:', letzte)
if (erste && letzte) {
  const ms = Date.parse(letzte) - Date.parse(erste)
  console.log('Laufzeit:', Math.floor(ms/3600000)+' h '+Math.round(ms%3600000/60000)+' min')
}
console.log('\nTokens (Verlauf):')
console.log('  Eingabe        ', n(ein))
console.log('  Ausgabe        ', n(aus))
console.log('  Cache geschrieb', n(cacheW))
console.log('  Cache gelesen  ', n(cacheR))
console.log('  SUMME          ', n(ein+aus+cacheW+cacheR))
console.log('\nWerkzeuge (' + werkzeuge.size + ' verschiedene, ' + n([...werkzeuge.values()].reduce((a,b)=>a+b,0)) + ' Aufrufe):')
for (const [k,v] of [...werkzeuge].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`)
console.log('\nAgenten:', agenten.size)
for (const a of agenten) console.log('  ', a)
