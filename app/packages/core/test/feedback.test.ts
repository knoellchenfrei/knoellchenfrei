import { describe, expect, it } from 'vitest'

import { isFeedbackKind, MAX_FEEDBACK_LENGTH, tidyFeedback } from '../src/index.js'

describe('tidyFeedback', () => {
  it('lässt gewöhnlichen Text, wie er ist', () => {
    expect(tidyFeedback('Zone 29 stimmt sonntags nicht.')).toBe('Zone 29 stimmt sonntags nicht.')
  })

  it('schneidet Ränder ab und vereinheitlicht Zeilenenden', () => {
    expect(tidyFeedback('  eins\r\nzwei  ')).toBe('eins\nzwei')
  })

  it('fasst lange Folgen von Leerzeilen zusammen', () => {
    expect(tidyFeedback('eins\n\n\n\n\nzwei')).toBe('eins\n\nzwei')
  })

  it('entfernt Bidi-Steuerzeichen', () => {
    // A right-to-left override makes what a reader sees differ from what is
    // stored — the whole point of the trick.
    expect(tidyFeedback('gut\u202eesob\u202c')).toBe('gutesob')
    expect(tidyFeedback('a\u2066b\u2069c')).toBe('abc')
  })

  it('entfernt Zeichen ohne Breite', () => {
    expect(tidyFeedback('a\u200bb\ufeffc')).toBe('abc')
  })

  it('behält Zeilenumbruch und Tabulator, wirft die übrigen Steuerzeichen weg', () => {
    expect(tidyFeedback('ab\tc\nd')).toBe('ab\tc\nd')
    expect(tidyFeedback('a\u0000b\u0007c')).toBe('abc')
  })

  it('kürzt statt abzuweisen, und zwar genau an der dokumentierten Grenze', () => {
    expect(tidyFeedback('x'.repeat(MAX_FEEDBACK_LENGTH + 500))).toHaveLength(MAX_FEEDBACK_LENGTH)
  })

  it('macht aus reinem Leerraum nichts, damit der Aufrufer ihn abweisen kann', () => {
    expect(tidyFeedback('   \n\n\t ')).toBe('')
    expect(tidyFeedback('\u200b\u200b')).toBe('')
  })
})

describe('isFeedbackKind', () => {
  it('nimmt die drei an, die das Formular anbietet, und sonst nichts', () => {
    expect(isFeedbackKind('idee')).toBe(true)
    expect(isFeedbackKind('fehler')).toBe(true)
    expect(isFeedbackKind('sonstiges')).toBe(true)
    expect(isFeedbackKind('__proto__')).toBe(false)
    expect(isFeedbackKind('constructor')).toBe(false)
    expect(isFeedbackKind(null)).toBe(false)
  })
})
