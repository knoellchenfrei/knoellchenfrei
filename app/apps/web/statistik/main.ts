/**
 * Die Statistikseite — eine eigene Seite, kein Router in der App.
 *
 * Kein React, keine Karte, keine gemeinsamen Bausteine: Das App-Bündel wächst
 * dadurch um **null Byte**, und wer die Seite nie öffnet, lädt nichts davon.
 * Der Preis ist ein zweites bisschen Stil hier unten; er ist geringer als der
 * eines Routers in einer Anwendung, die genau eine Ansicht hat.
 *
 * Die Zahlen kommen fertig aus `GET /stats` — der Worker rechnet sie einmal je
 * Stunde und legt sie ins KV. Diese Seite rechnet nichts, sie zeichnet nur.
 */

import './stil.css'

interface Zeile {
  n: number
}
interface Stand {
  erzeugtAm: string | null
  leer?: boolean
  tage: number
  schwelle: number
  kopf: { heute: number; tage7: number; tage28: number }
  proTag: (Zeile & { day: string })[]
  proStunde: (Zeile & { hour: number })[]
  proStadt: (Zeile & { city: string })[]
  proName: (Zeile & { name: string })[]
  proZone: (Zeile & { city: string; zone: string })[]
}

const API_BASE = ((): string | undefined => {
  const roh = import.meta.env.VITE_API_BASE as string | undefined
  return typeof roh === 'string' && roh.length > 0 ? roh.replace(/\/+$/, '') : undefined
})()

const STADTNAMEN: Record<string, string> = {
  berlin: 'Berlin',
  hamburg: 'Hamburg',
  frankfurt: 'Frankfurt am Main',
  muenchen: 'München',
}

/**
 * Anzeigenamen — bewusst unvollständig.
 *
 * Ein Ereignis ohne Eintrag erscheint mit seinem technischen Namen. Das ist
 * Absicht: Ein neues Ereignis soll **von selbst** auf dieser Seite auftauchen,
 * ohne dass jemand hier etwas nachträgt. Wer es hervorheben will, tut es.
 */
const NAMEN: Record<string, string> = {
  'app.open': 'App geöffnet',
  'zone.open': 'Zone angesehen',
  'zone.answer': 'Antwort der App',
  'zone.source': 'Weg zur Zone',
  'zone.outside': 'Tipp ausserhalb aller Zonen',
  'park.start': 'Parkuhr gestartet',
  'layer.on': 'Ebene eingeschaltet',
  'city.switch': 'Stadt gewechselt',
  'city.suggest': 'Stadtvorschlag',
  locate: 'Standort freigegeben',
  feedback: 'Rückmeldung geschickt',
  'tow.open': '„Auto weg?" geöffnet',
}

const el = (tag: string, klasse?: string, text?: string): HTMLElement => {
  const knoten = document.createElement(tag)
  if (klasse !== undefined) knoten.className = klasse
  if (text !== undefined) knoten.textContent = text
  return knoten
}

/** Balken als reine Elemente — kein Diagramm-Paket für zwei Achsen. */
function balken(werte: { label: string; n: number }[], leerText: string): HTMLElement {
  const kasten = el('div', 'balken')
  if (werte.length === 0) {
    kasten.append(el('p', 'leer', leerText))
    return kasten
  }
  const max = Math.max(...werte.map((w) => w.n), 1)
  for (const wert of werte) {
    const zeile = el('div', 'balken__zeile')
    zeile.append(el('span', 'balken__label', wert.label))
    const spur = el('div', 'balken__spur')
    const fuellung = el('div', 'balken__fuellung')
    fuellung.style.width = `${Math.max(2, Math.round((wert.n / max) * 100))}%`
    spur.append(fuellung)
    zeile.append(spur)
    zeile.append(el('span', 'balken__zahl', String(wert.n)))
    kasten.append(zeile)
  }
  return kasten
}

function abschnitt(titel: string, inhalt: HTMLElement, hinweis?: string): HTMLElement {
  const s = el('section', 'block')
  s.append(el('h2', undefined, titel))
  if (hinweis !== undefined) s.append(el('p', 'hinweis', hinweis))
  s.append(inhalt)
  return s
}

function zeichnen(stand: Stand): HTMLElement {
  const wurzel = el('div', 'seite')
  wurzel.append(el('h1', undefined, 'Nutzung'))

  const kopf = el('div', 'kopf')
  for (const [label, zahl] of [
    ['heute', stand.kopf.heute],
    ['7 Tage', stand.kopf.tage7],
    [`${stand.tage} Tage`, stand.kopf.tage28],
  ] as [string, number][]) {
    const karte = el('div', 'kopf__karte')
    karte.append(el('div', 'kopf__zahl', zahl.toLocaleString('de-DE')))
    karte.append(el('div', 'kopf__label', `Öffnungen ${label}`))
    kopf.append(karte)
  }
  wurzel.append(kopf)

  wurzel.append(
    abschnitt(
      'Verlauf',
      balken(
        stand.proTag.map((z) => ({
          label: new Date(`${z.day}T12:00:00`).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
          }),
          n: z.n,
        })),
        'Noch keine Öffnungen gezählt.'
      )
    )
  )

  wurzel.append(
    abschnitt(
      'Tagesgang',
      balken(
        stand.proStunde.map((z) => ({ label: `${String(z.hour).padStart(2, '0')} Uhr`, n: z.n })),
        'Noch nichts zu sehen.'
      ),
      'Stunden ohne Zählung fehlen — sie werden nicht als Null gezeichnet. Am Tag der Zeitumstellung gibt es eine Stunde doppelt oder gar nicht.'
    )
  )

  wurzel.append(
    abschnitt(
      'Nach Stadt',
      balken(
        stand.proStadt.map((z) => ({ label: STADTNAMEN[z.city] ?? z.city, n: z.n })),
        'Noch keine Stadt gezählt.'
      )
    )
  )

  for (const stadt of stand.proStadt) {
    const zonen = stand.proZone.filter((z) => z.city === stadt.city)
    if (zonen.length === 0) continue
    wurzel.append(
      abschnitt(
        `Zonen in ${STADTNAMEN[stadt.city] ?? stadt.city}`,
        balken(
          zonen.map((z) => ({ label: z.zone === '' ? 'andere' : z.zone, n: z.n })),
          'Noch keine Zone angesehen.'
        ),
        `Eine Zone wird erst ab ${stand.schwelle} Aufrufen beim Namen genannt; seltenere stehen zusammen unter „andere". Zonen tragen keine Uhrzeit.`
      )
    )
  }

  wurzel.append(
    abschnitt(
      'Was benutzt wird',
      balken(
        stand.proName.map((z) => ({ label: NAMEN[z.name] ?? z.name, n: z.n })),
        'Noch nichts gezählt.'
      )
    )
  )

  const nicht = el('section', 'block')
  nicht.append(el('h2', undefined, 'Was hier nicht steht'))
  const liste = el('ul', 'nicht')
  for (const satz of [
    'Keine Koordinaten. Die feinste Ortsangabe ist die Zone — und die ohne Uhrzeit.',
    'Keine Minute. Nur die Stunde, und nur ohne Ort.',
    'Keine Kennung, keine Sitzung, keine Reihenfolge.',
    'Keine IP-Adresse. Der Server sieht sie beim Empfang, speichert sie nicht — auch nicht gehasht.',
    'Kein Referrer, kein Browserkennzeichen, keine Bildschirmgröße, kein Freitext.',
    'Nichts auf dem Gerät. Die Zählungen liegen bis zum Senden im Arbeitsspeicher.',
  ]) {
    liste.append(el('li', undefined, satz))
  }
  nicht.append(liste)
  nicht.append(
    el(
      'p',
      'hinweis',
      'In den Einstellungen der App lässt sich das Mitzählen abschalten. Ein Gerät, das globalPrivacyControl meldet, wird von vornherein nicht gezählt.'
    )
  )
  wurzel.append(nicht)

  const fuss = el('p', 'fuss')
  fuss.textContent =
    stand.erzeugtAm === null
      ? 'Noch kein Stand berechnet.'
      : `Stand: ${new Date(stand.erzeugtAm).toLocaleString('de-DE')} — die Zahlen werden einmal je Stunde neu gerechnet.`
  wurzel.append(fuss)
  return wurzel
}

async function los(): Promise<void> {
  const ziel = document.getElementById('statistik')
  if (ziel === null) return
  if (API_BASE === undefined) {
    ziel.replaceChildren(
      el('p', 'leer', 'Diese Auslieferung hat keinen Server — es wird nichts gezählt und nichts ausgewertet.')
    )
    return
  }
  try {
    const antwort = await fetch(`${API_BASE}/stats`)
    if (!antwort.ok) throw new Error(String(antwort.status))
    const stand = (await antwort.json()) as Stand
    if (stand.leer === true || stand.erzeugtAm === null) {
      ziel.replaceChildren(
        el('p', 'leer', 'Noch kein Stand berechnet — die Auswertung läuft einmal je Stunde.')
      )
      return
    }
    ziel.replaceChildren(zeichnen(stand))
  } catch (fehler) {
    ziel.replaceChildren(
      el('p', 'leer', `Die Zahlen sind gerade nicht abrufbar (${(fehler as Error).message}).`)
    )
  }
}

void los()
