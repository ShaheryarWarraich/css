import Dexie, { type Table } from 'dexie'
import type { Card } from 'ts-fsrs'
import type { Chain, Fact, Pack, Proposal, ProposalFields } from './content/types'

export interface ItemRow {
  id: string
  kind: 'fact' | 'chain'
  packId: string
  data: Fact | Chain
  addedAt: number
  /** set when an imported sheet changed the value of a fact the learner already had */
  prevValue?: string
  changedAt?: number
  retired?: boolean
}

export interface CardRow {
  id: string
  card: Card
  due: number
  introducedAt: number
  /** confident-and-wrong last time: re-test soon, the correction fades */
  hyper?: boolean
}

export interface LogRow {
  id?: number
  itemId: string
  ts: number
  form: string
  score: number // 0..1
  confidence: 1 | 2 | 3
  latencyMs: number
  rating: number
  predicted: number | null // retrievability FSRS predicted just before the answer
  isNew: boolean
}

export interface ProposalRow extends Proposal {
  /** reviewer's version of the fields (for revised) */
  edited?: ProposalFields
  note?: string
  reviewer?: string
  decidedAt?: number
}

export interface Settings {
  examDate: string
  minutesPerDay: number
  newPerDay: number
  tiers: number[]
  judgeUrl: string
  reviewerName: string
}

export const DEFAULT_SETTINGS: Settings = {
  examDate: '2027-01-27',
  minutesPerDay: 30,
  newPerDay: 15,
  tiers: [1],
  judgeUrl: '',
  reviewerName: '',
}

class CssDb extends Dexie {
  items!: Table<ItemRow, string>
  cards!: Table<CardRow, string>
  logs!: Table<LogRow, number>
  kv!: Table<{ key: string; value: unknown }, string>
  proposals!: Table<ProposalRow, string>
  constructor() {
    super('css-os')
    this.version(1).stores({
      items: 'id, kind, packId',
      cards: 'id, due',
      logs: '++id, itemId, ts',
      kv: 'key',
    })
    this.version(2).stores({ proposals: 'id, factId, status' })
  }
}
export const db = new CssDb()

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings')
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) }
}
export const saveSettings = (s: Settings) => db.kv.put({ key: 'settings', value: s })

export interface MergeResult {
  added: number
  changed: number
  unchanged: number
  retired: number
}

/** Merge a pack into the local bank. New rows become "to learn"; changed values become change cards. */
export async function mergePack(pack: Pack, opts: { retireMissing: boolean } = { retireMissing: false }): Promise<MergeResult> {
  const now = Date.now()
  const res: MergeResult = { added: 0, changed: 0, unchanged: 0, retired: 0 }
  await db.transaction('rw', db.items, db.cards, async () => {
    const existing = new Map((await db.items.toArray()).map((i) => [i.id, i]))
    const incoming: { id: string; kind: 'fact' | 'chain'; data: Fact | Chain }[] = [
      ...pack.facts.map((f) => ({ id: f.id, kind: 'fact' as const, data: f })),
      ...pack.chains.map((c) => ({ id: c.id, kind: 'chain' as const, data: c })),
    ]
    for (const inc of incoming) {
      const old = existing.get(inc.id)
      if (!old) {
        await db.items.put({ ...inc, packId: pack.id, addedAt: now })
        res.added++
        continue
      }
      const oldVal = old.kind === 'fact' ? (old.data as Fact).value : (old.data as Chain).links.join('→')
      const newVal = inc.kind === 'fact' ? (inc.data as Fact).value : (inc.data as Chain).links.join('→')
      if (oldVal !== newVal) {
        await db.items.put({ ...old, ...inc, packId: pack.id, prevValue: oldVal, changedAt: now, retired: false })
        const card = await db.cards.get(inc.id)
        if (card) await db.cards.put({ ...card, due: now }) // surface the change card today
        res.changed++
      } else {
        await db.items.put({ ...old, ...inc, packId: pack.id, retired: false })
        res.unchanged++
      }
    }
    if (opts.retireMissing) {
      const ids = new Set(incoming.map((i) => i.id))
      for (const old of existing.values())
        if (old.packId === pack.id && !ids.has(old.id) && !old.retired) {
          await db.items.put({ ...old, retired: true })
          res.retired++
        }
    }
  })
  return res
}

/** New drafts are added; decisions already made on this device are kept. */
export async function mergeProposals(list: Proposal[]): Promise<number> {
  let added = 0
  await db.transaction('rw', db.proposals, async () => {
    const have = new Set((await db.proposals.toArray()).map((p) => p.id))
    for (const p of list) if (!have.has(p.id)) { await db.proposals.put({ ...p }); added++ }
  })
  return added
}

/** Approved or revised proposals override the fact's boilerplate fields. */
export function applyProposals(facts: Fact[], rows: ProposalRow[]): Fact[] {
  const live = new Map(rows.filter((p) => p.status === 'approved' || p.status === 'revised').map((p) => [p.factId, p.edited ?? p.field]))
  return facts.map((f) => {
    const v = live.get(f.id)
    return v ? { ...f, qualification: v.qualification || f.qualification, pairsWith: v.pairsWith.length ? v.pairsWith : f.pairsWith, memoryHook: v.hook || undefined, useAgainst: v.useAgainst || undefined, deploy: v.deploy || f.deploy } : f
  })
}

export async function exportReview(): Promise<string> {
  const rows = (await db.proposals.toArray()).filter((p) => p.status !== 'pending')
  return JSON.stringify({ format: 'css-os-review', version: 1, exportedAt: new Date().toISOString(), decisions: rows }, null, 1)
}

export async function exportState(): Promise<string> {
  const [cards, logs, kv, items, proposals] = await Promise.all([db.cards.toArray(), db.logs.toArray(), db.kv.toArray(), db.items.toArray(), db.proposals.toArray()])
  return JSON.stringify({ format: 'css-os-state', version: 2, exportedAt: new Date().toISOString(), cards, logs, kv, items, proposals })
}

export async function importState(json: string): Promise<void> {
  const s = JSON.parse(json)
  if (s.format !== 'css-os-state') throw new Error('Not a CSS OS backup file.')
  const revive = (c: CardRow): CardRow => ({ ...c, card: { ...c.card, due: new Date(c.card.due), last_review: c.card.last_review ? new Date(c.card.last_review) : undefined } })
  await db.transaction('rw', db.items, db.cards, db.logs, db.kv, db.proposals, async () => {
    await Promise.all([db.items.clear(), db.cards.clear(), db.logs.clear(), db.kv.clear(), db.proposals.clear()])
    await db.items.bulkPut(s.items)
    await db.cards.bulkPut(s.cards.map(revive))
    await db.logs.bulkPut(s.logs)
    await db.kv.bulkPut(s.kv)
    if (s.proposals) await db.proposals.bulkPut(s.proposals)
  })
}
