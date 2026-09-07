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

import { cityAt, type City } from './city.js'

/** Die Absicht hinter einer eingehenden Nachricht. */
export type TelegramIntent =
  /** Erklärung anfordern — `/start`, `/hilfe`, `/help`. */
  | { kind: 'help' }
  /**
   * Eine Kontrolle an dieser Stelle melden.
   *
   * Die Stadt gehört dazu, weil sie hier schon feststeht: Der Parser hat den
   * Punkt gegen die Boxen gehalten, um überhaupt zu entscheiden, ob es eine
   * Meldung ist. Sie ein zweites Mal im Worker abzuleiten hiesse, dieselbe
   * Frage zweimal zu beantworten — und zwei Antworten können auseinanderlaufen.
   */
  | { kind: 'report'; lon: number; lat: number; city: City }
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
 * `cities` steckt die Grenzen, innerhalb derer ein Standort als Meldung gilt.
 * Als Parameter und nicht als Konstante: Der Parser ist die einzige Stelle,
 * an der fremder Text auf eine Stadtgrenze trifft, und eine fest verdrahtete
 * Grenze wäre genau hier am teuersten.
 *
 * Eine **Liste**, seit der Worker mehr als eine Stadt bedient: Ein gesendeter
 * Standort bringt keine Stadt mit, die Stadt steht nur im Punkt. Vorher nahm
 * der Parser genau eine Stadt entgegen, der Worker gab ihm die konfigurierte
 * — und jede Hamburger Meldung an einen Berliner Bot war „unknown".
 *
 * Nichts daran wird geglaubt: Jedes Feld wird geprüft, bevor es benutzt wird.
 * Ein Update ohne `message` — bearbeitete Nachrichten, Kanalbeiträge,
 * Reaktionen — ist keins für uns; Telegram schickt davon reichlich, sobald der
 * Bot in einer Gruppe liegt.
 */
export function parseTelegramUpdate(update: unknown, cities: readonly City[]): TelegramMessage {
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
    // Dieselben Boxen wie im Web-Pfad, und aus derselben Quelle. Sie standen
    // hier vorher ein zweites Mal als Zahlenpaar; zwei Boxen, die
    // auseinanderlaufen, heissen: Der Bot nimmt eine Meldung an, die die App
    // abweist.
    const city = cityAt(lon, lat, cities)
    if (city === undefined) {
      return { intent: { kind: 'unknown' }, sender }
    }
    return { intent: { kind: 'report', lon, lat, city }, sender }
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
