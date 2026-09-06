import { describe, expect, it } from 'vitest'

import { isFeedbackKind, MAX_FEEDBACK_LENGTH, tidyFeedback } from '../src/index.js'

describe('tidyFeedback', () => {
  it('keeps ordinary text as written', () => {
    expect(tidyFeedback('Zone 29 stimmt sonntags nicht.')).toBe('Zone 29 stimmt sonntags nicht.')
  })

  it('trims and normalises line endings', () => {
    expect(tidyFeedback('  eins\r\nzwei  ')).toBe('eins\nzwei')
  })

  it('collapses long runs of blank lines', () => {
    expect(tidyFeedback('eins\n\n\n\n\nzwei')).toBe('eins\n\nzwei')
  })

  it('strips bidirectional overrides', () => {
    // A right-to-left override makes what a reader sees differ from what is
    // stored — the whole point of the trick.
    expect(tidyFeedback('gut\u202eesob\u202c')).toBe('gutesob')
    expect(tidyFeedback('a\u2066b\u2069c')).toBe('abc')
  })

  it('strips zero-width characters', () => {
    expect(tidyFeedback('a\u200bb\ufeffc')).toBe('abc')
  })

  it('keeps newline and tab, drops the other controls', () => {
    expect(tidyFeedback('ab\tc\nd')).toBe('ab\tc\nd')
    expect(tidyFeedback('a\u0000b\u0007c')).toBe('abc')
  })

  it('truncates rather than rejecting, at exactly the documented limit', () => {
    expect(tidyFeedback('x'.repeat(MAX_FEEDBACK_LENGTH + 500))).toHaveLength(MAX_FEEDBACK_LENGTH)
  })

  it('reduces whitespace-only input to nothing, so the caller can refuse it', () => {
    expect(tidyFeedback('   \n\n\t ')).toBe('')
    expect(tidyFeedback('\u200b\u200b')).toBe('')
  })
})

describe('isFeedbackKind', () => {
  it('accepts the three the form offers and nothing else', () => {
    expect(isFeedbackKind('idee')).toBe(true)
    expect(isFeedbackKind('fehler')).toBe(true)
    expect(isFeedbackKind('sonstiges')).toBe(true)
    expect(isFeedbackKind('__proto__')).toBe(false)
    expect(isFeedbackKind('constructor')).toBe(false)
    expect(isFeedbackKind(null)).toBe(false)
  })
})
