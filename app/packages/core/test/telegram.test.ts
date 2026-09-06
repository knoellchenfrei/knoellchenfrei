import { describe, expect, it } from 'vitest'

import { parseTelegramUpdate } from '../src/telegram.js'

/**
 * Alles hier ist fremder Text. Telegram stellt zu, wer schreibt, entscheidet
 * nicht — jede dieser Formen kann ein Fremder auslösen.
 */

const SENDER = { from: { id: 42 }, chat: { id: 42 } }

function update(message: unknown): unknown {
  return { update_id: 1, message }
}

describe('parseTelegramUpdate', () => {
  it('reads a location inside Berlin as a report', () => {
    const parsed = parseTelegramUpdate(
      update({ ...SENDER, location: { longitude: 13.4, latitude: 52.52 } }),
    )
    expect(parsed.intent).toEqual({ kind: 'report', lon: 13.4, lat: 52.52 })
    expect(parsed.sender).toEqual({ userId: 42, chatId: 42 })
  })

  it('refuses a location outside Berlin', () => {
    // Hamburg. Eine Meldung von dort ist ein Fehler oder ein Versuch.
    const parsed = parseTelegramUpdate(
      update({ ...SENDER, location: { longitude: 9.99, latitude: 53.55 } }),
    )
    expect(parsed.intent.kind).toBe('unknown')
    // Der Absender bleibt bekannt: Auch eine abgelehnte Nachricht bekommt eine
    // Antwort, sonst wirkt der Bot kaputt.
    expect(parsed.sender).not.toBeNull()
  })

  it.each([
    ['/start', 'help'],
    ['/hilfe', 'help'],
    ['/help', 'help'],
    ['/HILFE', 'help'],
    // In Gruppen hängt Telegram den Bot-Namen an.
    ['/hilfe@parkbot', 'help'],
    ['  /start  ', 'help'],
    ['/start bitte', 'help'],
    ['moin', 'unknown'],
    ['/melden', 'unknown'],
    ['/starten', 'unknown'],
  ])('reads %j as %s', (text, kind) => {
    expect(parseTelegramUpdate(update({ ...SENDER, text })).intent.kind).toBe(kind)
  })

  it.each([
    ['nichts', null],
    ['leeres Objekt', {}],
    ['Zeichenkette', 'hallo'],
    ['Zahl', 7],
    ['Feld message ist eine Zeichenkette', { message: 'hallo' }],
  ])('ignores %s', (_name, raw) => {
    expect(parseTelegramUpdate(raw).intent.kind).toBe('ignore')
  })

  it('ignores anything without a usable sender', () => {
    // Kanalbeiträge haben kein `from`. Ohne Absender lässt sich weder eine
    // Grenze durchsetzen noch antworten.
    expect(parseTelegramUpdate(update({ chat: { id: 1 }, text: '/start' })).intent.kind).toBe(
      'ignore',
    )
    expect(parseTelegramUpdate(update({ from: { id: 1 }, text: '/start' })).intent.kind).toBe(
      'ignore',
    )
  })

  it('refuses an id that is not a safe integer', () => {
    // Kommt so nicht von Telegram — aber der Webhook ist eine öffentliche
    // Adresse, und wer sie kennt, schickt, was er will.
    expect(
      parseTelegramUpdate(update({ from: { id: 1e300 }, chat: { id: 1 }, text: '/start' })).intent
        .kind,
    ).toBe('ignore')
    expect(
      parseTelegramUpdate(update({ from: { id: '42' }, chat: { id: 42 }, text: '/start' })).intent
        .kind,
    ).toBe('ignore')
  })

  it('treats a location with unusable numbers as unreadable, not as a report', () => {
    const parsed = parseTelegramUpdate(
      update({ ...SENDER, location: { longitude: 'dreizehn', latitude: null } }),
    )
    expect(parsed.intent.kind).toBe('unknown')
  })

  it('does not read a caption or a forwarded location as a command', () => {
    // Weiterleitungen tragen `forward_origin`; der Text bleibt derselbe. Wir
    // behandeln sie wie jede andere Nachricht — es gibt keinen Grund, einer
    // weitergeleiteten Nachricht mehr zu glauben.
    const parsed = parseTelegramUpdate(
      update({ ...SENDER, caption: '/start', forward_origin: { type: 'user' } }),
    )
    expect(parsed.intent.kind).toBe('unknown')
  })
})
