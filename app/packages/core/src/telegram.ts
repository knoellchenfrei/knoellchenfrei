/**
 * Was eine Telegram-Nachricht für diese App bedeutet.
 *
 * Bewusst hier und nicht im Worker: Alles, was aus einem Webhook kommt, ist
 * fremder Text von jemandem, den niemand geprüft hat — Telegram stellt zu,
 * wer schreibt, entscheidet nicht. Solcher Code gehört an eine Stelle, an der
 * man ihn mit Unfug beschießen kann, und das sind die Unit-Tests dieses Pakets.
 *
 * Der Worker bleibt dadurch dünn: Er übersetzt nur noch die Absicht in einen
 * Datenbankeintrag und eine Antwort.
 */

/** Die Absicht hinter einer eingehenden Nachricht. */
export type TelegramIntent =
  /** Erklärung anfordern — `/start`, `/hilfe`, `/help`. */
  | { kind: 'help' }
  /** Eine Kontrolle an dieser Stelle melden. */
  | { kind: 'report'; lon: number; lat: number }
  /** Verstanden, aber nichts zu tun: Text ohne Standort. */
  | { kind: 'unknown' }
  /** Nicht für uns: Bearbeitungen, Beitritte, Kanäle, Unsinn. */
  | { kind: 'ignore' }

/** Wer geschrieben hat — als Zahl, nie als Name. */
export interface TelegramSender {
  /** Telegram-Nutzerkennung. Wird nur gehasht gespeichert. */
  userId: number
  /** Wohin die Antwort geht. Wird nicht gespeichert. */
  chatId: number
}

export interface TelegramMessage {
  intent: TelegramIntent
  sender: TelegramSender | null
}

/**
 * Berlin, großzügig umrandet. Dieselben Grenzen wie im Web-Pfad: Eine Meldung
 * außerhalb ist ein Fehler oder ein Missbrauchsversuch.
 */
const BOUNDS = { west: 13.0, east: 13.8, south: 52.3, north: 52.7 }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Telegram-Kennungen sind ganze Zahlen und können sehr groß werden. */
function asId(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
}

/**
 * Zerlegt ein Telegram-Update.
 *
 * Nichts daran wird geglaubt: Jedes Feld wird geprüft, bevor es benutzt wird.
 * Ein Update ohne `message` — bearbeitete Nachrichten, Kanalbeiträge,
 * Reaktionen — ist keins für uns; Telegram schickt davon reichlich, sobald der
 * Bot in einer Gruppe liegt.
 */
export function parseTelegramUpdate(update: unknown): TelegramMessage {
  if (!isRecord(update)) return { intent: { kind: 'ignore' }, sender: null }

  const message = update.message
  if (!isRecord(message)) return { intent: { kind: 'ignore' }, sender: null }

  const from = isRecord(message.from) ? message.from : null
  const chat = isRecord(message.chat) ? message.chat : null
  const userId = asId(from?.id)
  const chatId = asId(chat?.id)
  const sender = userId !== null && chatId !== null ? { userId, chatId } : null

  // Ohne Absender lässt sich weder eine Grenze durchsetzen noch antworten.
  if (sender === null) return { intent: { kind: 'ignore' }, sender: null }

  const location = isRecord(message.location) ? message.location : null
  if (location !== null) {
    const lon = Number(location.longitude)
    const lat = Number(location.latitude)
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return { intent: { kind: 'unknown' }, sender }
    }
    if (lon < BOUNDS.west || lon > BOUNDS.east || lat < BOUNDS.south || lat > BOUNDS.north) {
      return { intent: { kind: 'unknown' }, sender }
    }
    return { intent: { kind: 'report', lon, lat }, sender }
  }

  const text = typeof message.text === 'string' ? message.text.trim() : ''
  if (text.length === 0) return { intent: { kind: 'unknown' }, sender }

  // In Gruppen hängt Telegram den Bot-Namen an: `/hilfe@parkbot`. Und das erste
  // Wort zählt — der Rest der Zeile ist Beiwerk.
  const command = text.split(/\s+/)[0]?.toLowerCase().split('@')[0] ?? ''
  if (command === '/start' || command === '/hilfe' || command === '/help') {
    return { intent: { kind: 'help' }, sender }
  }

  return { intent: { kind: 'unknown' }, sender }
}
