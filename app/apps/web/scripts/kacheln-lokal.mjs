/**
 * Liefert ein heruntergeladenes Kachelarchiv lokal aus — für die Aufnahme der
 * Bildschirmfotos.
 *
 * Warum nicht direkt gegen `tiles.knoellchenfrei.de` bauen: Die R2-CORS-Regel
 * lässt nur `https://knoellchenfrei.de` zu, die Aufnahme läuft aber gegen
 * `127.0.0.1`. Die Kachelanfragen scheitern dann still, und das Bild sieht aus
 * wie eine leere Karte mit Zonen darauf — nicht wie ein Fehler. Die Regel
 * dafür aufzumachen wäre der falsche Weg herum; ein Archiv einmal laden und
 * von hier ausliefern ist der richtige.
 *
 * Was PMTiles vom Server braucht und was dieser deshalb kann: Range-Requests
 * mit `206` und `Content-Range` (der Leser holt sich nur die Bytes, die er
 * braucht), `Access-Control-Allow-Origin: *` samt Preflight für `Range`, und
 * ein `ETag`, weil der Leser Folgeanfragen mit `If-Match` absichert.
 *
 *   curl -o /tmp/kacheln/berlin.pmtiles https://tiles.knoellchenfrei.de/aktuell/berlin.pmtiles
 *   node scripts/kacheln-lokal.mjs /tmp/kacheln 4190
 *   VITE_TILES_URL=http://127.0.0.1:4190/ pnpm build
 *   node scripts/make-screenshots.mjs && node scripts/make-docs-images.mjs
 */
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'

const dir = process.argv[2]
if (dir === undefined) {
  console.error('Aufruf: node scripts/kacheln-lokal.mjs <verzeichnis> [port]')
  process.exit(2)
}
const wurzel = resolve(dir)
const port = Number(process.argv[3] ?? 4190)

createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname).replace(/^\/+/, '')
  const file = join(wurzel, name)
  let size
  // Nur Dateien unterhalb des Verzeichnisses, und nur die, die es gibt.
  try {
    size = file.startsWith(wurzel) ? statSync(file).size : undefined
  } catch {
    size = undefined
  }
  if (size === undefined) {
    res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }).end()
    return
  }
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'range,if-match',
    'Access-Control-Expose-Headers': 'content-range,content-length,etag',
    'Accept-Ranges': 'bytes',
    'Content-Type': 'application/octet-stream',
    ETag: `"${size}"`,
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors).end()
    return
  }
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '')
  if (range === null) {
    res.writeHead(200, { ...cors, 'Content-Length': size })
    createReadStream(file).pipe(res)
    return
  }
  const start = Number(range[1])
  const end = range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1)
  res.writeHead(206, {
    ...cors,
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${size}`,
  })
  createReadStream(file, { start, end }).pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`Kacheln aus ${wurzel} auf http://127.0.0.1:${port}/`))
