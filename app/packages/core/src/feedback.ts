/**
 * Normalising free-text feedback.
 *
 * Lives in core rather than in the app because two places need exactly the same
 * result: the browser before it sends, and the worker before it stores. A second
 * implementation would drift, and the one in the worker is the one that matters
 * — a client can be bypassed.
 */

export type FeedbackKind = 'idee' | 'fehler' | 'sonstiges'

/** Long enough for a paragraph, short enough that nobody files a novel. */
export const MAX_FEEDBACK_LENGTH = 1000

const KINDS: readonly FeedbackKind[] = ['idee', 'fehler', 'sonstiges']

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value)
}

/**
 * C0 and C1 controls except newline and tab, plus zero-width characters and
 * bidirectional overrides.
 *
 * The last group is the reason this exists rather than a plain trim: those
 * characters render as nothing and reorder what surrounds them, which is how a
 * short message hides a longer one from whoever reads it.
 */
const INVISIBLE =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g

/**
 * Trims, collapses runs of blank lines, strips the characters above, and
 * truncates to the documented limit.
 *
 * Truncation rather than rejection: the form counts down and blocks at the same
 * limit, so anything longer arrived by a route the form does not offer, and
 * silently shortening it is friendlier than an error nobody will see.
 */
export function tidyFeedback(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_FEEDBACK_LENGTH)
}
