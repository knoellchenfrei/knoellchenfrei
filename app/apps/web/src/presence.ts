/**
 * Live numbers about the app itself: who is looking right now, and how many
 * devices opened it today.
 *
 * Two different mechanisms, because they answer two different questions:
 *
 *   "gerade offen"  → the artifact runtime's `room`, which knows who is
 *                     connected this instant and forgets the moment they leave.
 *   "heute geöffnet" → one tally row per device per day in `db`, deleted after
 *                     two days.
 *
 * The daily tally uses a **new random id every day**. A stable per-device id
 * would let anyone reading the store link a device's visits across days, which
 * is a tracking identifier by any other name; a per-day one only ever answers
 * "how many distinct devices today".
 *
 * With a self-hosted worker there is no presence channel, so both figures come
 * from one row per device per day whose timestamp is overwritten on each ping:
 * "here now" is a fresh row, "here today" is a row with today's date. That
 * keeps no history — the row holds the latest ping, never a sequence.
 *
 * Where neither backend answers, the caller renders the figures it has and says
 * nothing about the ones it does not — a made-up "1 online" is worse than an
 * honest dash.
 */

interface DbDoc {
  set: (value: unknown) => Promise<unknown>
  delete?: () => Promise<unknown>
}

interface Db {
  doc: (path: string) => DbDoc
  collection: (path: string) => {
    onSnapshot: (handler: (snapshot: { docs: { id: string; data: unknown }[] }) => void) => () => void
  }
}

interface Room {
  presence: (patch: Record<string, unknown>) => Promise<void>
  onPeers: (
    handler: (change: { peers: readonly { kind: string }[] }) => void,
    onError?: (error: { code: string; message: string }) => void,
  ) => () => void
}

export interface LiveStats {
  /** Documents of this artifact open right now, or null when unknowable. */
  online: number | null
  /** Distinct devices that opened it today, or null when unknowable. */
  today: number | null
}

const VISIT_KEY = 'knoellchenfrei.visit.v1'
/** Tally rows are kept one day beyond the window, so a day boundary is not a cliff. */
const VISIT_KEEP_DAYS = 2

/** `YYYY-MM-DD` in Berlin, the same key the heatmap marks use. */
function berlinDay(at: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(at))
}

function randomId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : `v${Math.floor(Math.random() * 1e12).toString(36)}`
}

/**
 * This device's id for today, minted fresh whenever the day turns.
 *
 * Every accessor is guarded: `localStorage` throws outright in some embedded
 * contexts, and a stats strip is not worth taking the app down for.
 */
function visitIdForToday(day: string): string {
  try {
    const raw = window.localStorage.getItem(VISIT_KEY)
    const stored = raw === null ? null : (JSON.parse(raw) as { day?: string; id?: string })
    if (stored?.day === day && typeof stored.id === 'string' && /^[\w-]{1,32}$/.test(stored.id)) {
      return stored.id
    }
    const id = randomId()
    window.localStorage.setItem(VISIT_KEY, JSON.stringify({ day, id }))
    return id
  } catch {
    // No storage: the visit still counts, it just counts again after a reload.
    return randomId()
  }
}

/**
 * Die Zeilenkennung dieses Geräts für den Tag, an dem gerade gepingt wird.
 *
 * **Sie wird bei jedem Ping neu gebildet, nicht einmal beim Start** — und das
 * ist die Behebung eines Fehlers, den man nur um Mitternacht sieht. Der Worker
 * weist eine Kennung ab, deren Tag nicht der heutige ist (`422 stale day`);
 * das muss er, sonst liesse sich ein vergangener Tag aufblähen. Die App bildete
 * die Kennung aber **einmal** beim Aufsetzen und behielt sie. Ein Tab, der um
 * 23:55 offen war, schickte ab 00:00 stundenlang die Kennung von gestern:
 * jeder Ping ein 422, und weil ein fehlgeschlagener Ping absichtlich still
 * bleibt („dann gelten die vorigen Zahlen"), stand auf dem Schirm die ganze
 * Nacht die Zahl von kurz vor Mitternacht. Eine tote Zahl, die aussieht wie
 * eine lebende.
 *
 * `visitIdForToday` legt beim Tageswechsel von selbst eine neue Kennung an —
 * es fehlte nur der zweite Aufruf.
 */
export function visitRowId(at: number): string {
  const tag = berlinDay(at)
  return `${tag}-${visitIdForToday(tag)}`
}

/** Row ids are `<day>-<id>`; the day has to survive a malformed body. */
function dayOf(docId: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})-[\w-]{1,32}$/.exec(docId)
  return match === null ? null : (match[1] as string)
}

function daysBetween(a: string, b: string): number {
  const parse = (key: string): number => Date.parse(`${key}T00:00:00Z`)
  const from = parse(a)
  const to = parse(b)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.POSITIVE_INFINITY
  return Math.round((to - from) / 86_400_000)
}

/** How often a viewer says "still here". Two minutes keeps a viewer well inside
 *  the worker's five-minute window while costing 30 requests an hour. */
const PING_MS = 2 * 60_000

function workerStats(base: string, onChange: (patch: Partial<LiveStats>) => void): () => void {
  let stopped = false

  const ping = (): void => {
    // A hidden tab is not a viewer. Without this a phone left on the homescreen
    // would count as present for as long as the browser keeps the page alive.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    // Bei jedem Ping neu — siehe `visitRowId`. Ein Tab, der über Mitternacht
    // offen bleibt, zählte sonst ab 00:00 gar nicht mehr, und zwar still.
    const id = visitRowId(Date.now())
    void fetch(`${base}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      signal: AbortSignal.timeout(10_000),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const body = (await response.json()) as { today?: unknown; online?: unknown }
        if (stopped) return
        const patch: Partial<LiveStats> = {}
        if (Number.isFinite(body.today)) patch.today = Number(body.today)
        if (Number.isFinite(body.online)) patch.online = Number(body.online)
        onChange(patch)
      })
      .catch(() => {
        /* one failed ping just means the previous figures stand */
      })
  }

  ping()
  const timer = setInterval(ping, PING_MS)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}

/**
 * Starts reporting live figures. Returns a teardown, and calls `onChange` only
 * for the figures it can actually establish.
 */
export function openLiveStats(onChange: (patch: Partial<LiveStats>) => void): () => void {
  const teardown: (() => void)[] = []
  let stopped = false

  const apiBase = import.meta.env.VITE_API_BASE as string | undefined
  if (typeof apiBase === 'string' && apiBase.length > 0) {
    return workerStats(apiBase.replace(/\/+$/, ''), onChange)
  }

  const claude = typeof window === 'undefined' ? undefined : window.claude
  if (claude === undefined) return () => undefined

  void claude
    .use('room')
    .then((value) => {
      const room = value as Room | null
      if (room === null || stopped) return
      // Nothing identifying: the count is the whole point, and presence is
      // readable by everyone in the room.
      void room.presence({ app: 'knoellchenfrei' }).catch(() => undefined)
      teardown.push(
        room.onPeers(
          (change) => {
            // Agents are counted separately by the platform and are not people.
            onChange({ online: change.peers.filter((peer) => peer.kind === 'viewer').length })
          },
          () => onChange({ online: null }),
        ),
      )
    })
    .catch(() => undefined)

  void claude
    .use('db')
    .then((value) => {
      const db = value as Db | null
      if (db === null || stopped) return
      const today = berlinDay(Date.now())
      const id = visitRowId(Date.now())
      // Written before the first snapshot so this device is in its own count.
      void db.doc(`visits/${id}`).set({ day: today }).catch(() => undefined)

      teardown.push(
        db.collection('visits').onSnapshot((snapshot) => {
          const now = berlinDay(Date.now())
          let count = 0
          for (const doc of snapshot.docs) {
            const day = dayOf(doc.id)
            if (day === null || daysBetween(day, now) >= VISIT_KEEP_DAYS) {
              void db.doc(`visits/${doc.id}`).delete?.().catch(() => undefined)
              continue
            }
            if (day === now) count += 1
          }
          onChange({ today: count })
        }),
      )
    })
    .catch(() => undefined)

  return () => {
    stopped = true
    for (const stop of teardown) stop()
  }
}
