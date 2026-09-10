/**
 * Die Seite vor der App.
 *
 * Sie ist bewusst eine **eigene** Seite und kein Dialog in der App: Ein Login
 * im React-Bündel wäre eine Tür neben einem offenen Fenster — wer ihn umgeht,
 * lädt `assets/index-*.js` und `data/berlin/zones.geojson` trotzdem. Diese
 * Seite wird von der Pages-Funktion ausgeliefert, bevor irgendetwas aus `dist`
 * den Rechner verlässt.
 *
 * Drei Festlegungen, jede mit Grund:
 *
 *  - **Kein externes Ding.** Keine Schrift von fremden Servern, kein Bild, kein
 *    Skript. Wer hier steht, ist nicht angemeldet — er soll auch keine Spur bei
 *    Dritten hinterlassen, nur weil er die Adresse kannte.
 *  - **Ohne JavaScript benutzbar.** Ein Formular, ein `POST`, fertig. Was den
 *    Riegel öffnet, soll nicht davon abhängen, dass ein Bündel lädt.
 *  - **Dieselbe Palette wie die App** (`src/styles.css`), damit der Riegel wie
 *    die Tür des Hauses aussieht und nicht wie ein Bauzaun davor. Die Werte
 *    stehen hier noch einmal, weil diese Seite ohne den Vite-Build entsteht;
 *    sie sind der einzige bewusst geduldete Abzug aus `styles.css`.
 */

const PALETTE = {
  bg: '#0f1216',
  panel: '#171c22',
  edge: '#262d36',
  text: '#e8edf3',
  muted: '#94a3b8',
  accent: '#2563eb',
  danger: '#ef4444',
} as const

/**
 * Warum der Riegel gerade zu ist.
 *
 * Eine feste Auswahl statt einer Zeichenkette: In diese Seite darf nichts
 * einfließen, was von außen kommt. Damit ist die Frage nach dem Maskieren von
 * HTML gar nicht erst zu stellen — es gibt keinen Wert, der zu maskieren wäre.
 */
export type LoginNotice = 'none' | 'wrong-password' | 'expired'

const NOTICES: Record<LoginNotice, string> = {
  none: '',
  'wrong-password': 'Das Passwort stimmt nicht.',
  expired: 'Der Zugang ist abgelaufen. Bitte das Passwort noch einmal eingeben.',
}

/**
 * Was ein Messenger zeigt, wenn jemand den Link teilt.
 *
 * iMessage, Discord, Telegram und Slack holen die Adresse **ohne Cookie** und
 * sehen deshalb genau diese Seite — nicht die App. Bis zum 10. September
 * hatte sie keine Open-Graph-Angaben, und die Vorschau war ein leerer Kasten
 * (Betreiber). Das Bild muss ohne Cookie erreichbar sein; `_middleware.ts`
 * lässt genau diesen einen Pfad durch.
 */
export const OG_IMAGE = '/og.png'
export const OG_TITLE = 'knoellchenfrei — kostet Parken hier gerade?'
export const OG_DESCRIPTION =
  'Parkzonen in Berlin, Hamburg, Frankfurt, München, Köln, Düsseldorf und Karlsruhe: ' +
  'Gebührenpflicht, Preis, Höchstparkdauer — und ob das Ordnungsamt unterwegs ist. ' +
  'Aus amtlichen Daten, offener Quelltext.'

function openGraph(origin: string): string {
  const image = `${origin}${OG_IMAGE}`
  return `<meta property="og:type" content="website">
<meta property="og:site_name" content="knoellchenfrei">
<meta property="og:title" content="${OG_TITLE}">
<meta property="og:description" content="${OG_DESCRIPTION}">
<meta property="og:url" content="${origin}/">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="640">
<meta property="og:image:alt" content="knoellchenfrei — was Parken hier gerade kostet, und ob das Ordnungsamt unterwegs ist">
<meta property="og:locale" content="de_DE">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${OG_TITLE}">
<meta name="twitter:description" content="${OG_DESCRIPTION}">
<meta name="twitter:image" content="${image}">`
}

function shell(title: string, body: string, origin: string): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${PALETTE.bg}">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${OG_DESCRIPTION}">
${openGraph(origin)}
<title>${title}</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px calc(24px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(24px + env(safe-area-inset-left));
    background: ${PALETTE.bg};
    /* Ein sehr leiser Schein hinter der Karte — dieselbe Farbe wie der
       Akzent, weit aufgezogen. Genug, dass die Seite nicht wie ein
       Fehlerbildschirm wirkt, zu wenig, um vom Formular abzulenken. */
    background-image: radial-gradient(120% 80% at 50% -10%, rgba(37, 99, 235, 0.18), transparent 60%);
    color: ${PALETTE.text};
    font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main {
    width: 100%;
    max-width: 384px;
    background: ${PALETTE.panel};
    border: 1px solid ${PALETTE.edge};
    border-radius: 14px;
    padding: 28px 26px 24px;
    box-shadow: 0 24px 60px -30px rgba(0, 0, 0, 0.9);
  }
  .mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px; height: 44px;
    border-radius: 11px;
    background: ${PALETTE.accent};
    color: #fff;
    font-size: 27px; font-weight: 700; line-height: 1;
    letter-spacing: -0.02em;
  }
  .eyebrow {
    margin: 18px 0 0;
    color: ${PALETTE.muted};
    font-size: 12px; font-weight: 500;
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  h1 { margin: 5px 0 0; font-size: 25px; letter-spacing: -0.02em; font-weight: 650; }
  .lede { margin: 12px 0 0; color: ${PALETTE.muted}; font-size: 14px; }
  form { margin: 22px 0 0; }
  label { display: block; margin: 0 0 7px; font-size: 13px; font-weight: 500; }
  input {
    width: 100%;
    min-height: 48px;
    padding: 11px 13px;
    background: ${PALETTE.bg};
    border: 1px solid ${PALETTE.edge};
    border-radius: 9px;
    color: ${PALETTE.text};
    font: inherit;
  }
  input:focus-visible { outline: 2px solid ${PALETTE.accent}; outline-offset: 1px; border-color: transparent; }
  button {
    width: 100%;
    min-height: 48px;
    margin: 12px 0 0;
    padding: 11px 13px;
    background: ${PALETTE.accent};
    border: 1px solid transparent;
    border-radius: 9px;
    color: #fff;
    font: inherit; font-weight: 600;
    cursor: pointer;
  }
  button:hover { filter: brightness(1.08); }
  button:focus-visible { outline: 2px solid ${PALETTE.text}; outline-offset: 2px; }
  .notice {
    margin: 16px 0 0;
    padding: 10px 12px;
    border: 1px solid rgba(239, 68, 68, 0.45);
    border-radius: 9px;
    background: rgba(239, 68, 68, 0.1);
    color: ${PALETTE.danger};
    font-size: 13.5px;
  }
  .foot {
    margin: 20px 0 0; padding: 16px 0 0;
    border-top: 1px solid ${PALETTE.edge};
    color: ${PALETTE.muted}; font-size: 12.5px;
  }
  @media (prefers-reduced-motion: no-preference) {
    main { animation: rise 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
    @keyframes rise { from { opacity: 0; transform: translateY(6px); } }
  }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`
}

/** Die Seite mit dem Formular. */
export function loginPage(notice: LoginNotice, origin = 'https://knoellchenfrei.de'): string {
  const message = NOTICES[notice]
  return shell(
    'knoellchenfrei — geschlossener Testbetrieb',
    `  <div class="mark" aria-hidden="true">P</div>
  <p class="eyebrow">Geschlossener Testbetrieb</p>
  <h1>knoellchenfrei</h1>
  <p class="lede">Parkzonen in Berlin, Hamburg, Frankfurt am Main, München, Köln,
  Düsseldorf und Karlsruhe: Gilt hier gerade Gebührenpflicht, was kostet es, wie
  lange darf ich stehen — und ist das Ordnungsamt unterwegs?
  Öffentlich ist die App noch nicht — bis der Trägerverein steht, kommt nur
  hinein, wer das Passwort hat.</p>
${message === '' ? '' : `  <p class="notice" role="alert">${message}</p>\n`}  <form method="post" autocomplete="on">
    <label for="password">Passwort</label>
    <input id="password" name="password" type="password" autocomplete="current-password"
           autocapitalize="off" autocorrect="off" spellcheck="false" required autofocus enterkeyhint="go"
           maxlength="200" aria-describedby="foot">
    <button type="submit">Weiter</button>
  </form>
  <p class="foot" id="foot">Kein Konto, kein Name, keine Aufzeichnung darüber, wer
  eintritt. Der Zugang gilt 30 Tage auf diesem Gerät.</p>`,
    origin
  )
}

/**
 * Die Seite, wenn gar kein Passwort hinterlegt ist.
 *
 * Sie ist der Grund, warum der Riegel **zufällt** statt aufzugehen, wenn die
 * Konfiguration fehlt. Andersherum wäre bequemer und genau der Fehler, den
 * dieses Projekt schon zweimal gemacht hat: etwas meldet Erfolg und tut
 * nichts. Ein vergessenes Secret öffnete dann stillschweigend die Beta.
 */
export function unconfiguredPage(origin = 'https://knoellchenfrei.de'): string {
  return shell(
    'knoellchenfrei — Riegel nicht eingerichtet',
    `  <div class="mark" aria-hidden="true">P</div>
  <p class="eyebrow">Nicht eingerichtet</p>
  <h1>Kein Zugang</h1>
  <p class="lede">Für diese Auslieferung ist kein Beta-Passwort hinterlegt. Der
  Riegel bleibt deshalb geschlossen — er geht nicht auf, nur weil eine
  Einstellung fehlt.</p>
  <p class="foot">Zu setzen als Secret <code>BETA_PASSWORD</code> im
  Pages-Projekt. Der Weg steht in <code>docs/hosting.md</code>.</p>`,
    origin
  )
}
