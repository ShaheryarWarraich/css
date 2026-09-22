// Builds today's queue under a time budget and records answers.
import type { FSRS } from 'ts-fsrs'
import type { Chain, Fact } from '../content/types'
import { applyProposals, db, type CardRow, type ItemRow, type Settings } from '../db'
import { chainExercise, chainFeedback, factExercise, feedbackFor, type Bank, type Exercise, type Feedback } from './forms'
import { capHyper, makeScheduler, newCard, ratingFor, retrievability, review, State } from './scheduler'

const SECONDS_PER_REVIEW = 25
const SECONDS_PER_NEW = 50

export interface QueueEntry {
  item: ItemRow
  card: CardRow | null // null = never seen: introduce first
}

export interface Plan {
  queue: QueueEntry[]
  dueTotal: number
  newToday: number
  newAvailable: number
  deferred: number // due reviews pushed to tomorrow by the time budget
}

export interface Loaded {
  bank: Bank
  items: Map<string, ItemRow>
  fsrs: FSRS
  settings: Settings
}

export async function load(settings: Settings, now = new Date()): Promise<Loaded> {
  const rows = (await db.items.toArray()).filter((i) => !i.retired)
  const facts = applyProposals(rows.filter((r) => r.kind === 'fact').map((r) => r.data as Fact), await db.proposals.toArray())
  const factById = new Map(facts.map((f) => [f.id, f]))
  for (const r of rows) if (r.kind === 'fact') r.data = factById.get(r.id)!
  return {
    bank: { facts, factById },
    items: new Map(rows.map((r) => [r.id, r])),
    fsrs: makeScheduler(settings.examDate, now),
    settings,
  }
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Round-robin across themes so first exposure is already interleaved. */
function interleaveByTheme(facts: ItemRow[]): ItemRow[] {
  const groups = new Map<string, ItemRow[]>()
  for (const r of facts) {
    const k = (r.data as Fact).theme
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const lists = [...groups.values()]
  const out: ItemRow[] = []
  for (let i = 0; out.length < facts.length; i++) for (const l of lists) if (l[i]) out.push(l[i])
  return out
}

export async function buildPlan(L: Loaded, now = new Date()): Promise<Plan> {
  const { settings, items, fsrs } = L
  const cards = await db.cards.toArray()
  const cardIds = new Set(cards.map((c) => c.id))
  const budget = settings.minutesPerDay * 60

  const due = cards
    .filter((c) => c.due <= now.getTime() && items.has(c.id))
    .map((c) => ({ c, r: retrievability(fsrs, c.card, now) ?? 0 }))
    .sort((a, b) => a.r - b.r) // most-forgotten first
  const maxReviews = Math.floor(budget / SECONDS_PER_REVIEW)
  const reviews = due.slice(0, maxReviews)

  const introducedToday = cards.filter((c) => c.introducedAt >= startOfDay(now)).length
  const spare = budget - reviews.length * SECONDS_PER_REVIEW
  // Backlog guard: no new material while reviews overflow the budget.
  const allowance = due.length > maxReviews ? 0 : Math.max(0, Math.min(settings.newPerDay - introducedToday, Math.floor(spare / SECONDS_PER_NEW)))

  const unseen = [...items.values()].filter((i) => !cardIds.has(i.id))
  const newFacts = interleaveByTheme(
    unseen
      .filter((i) => i.kind === 'fact' && settings.tiers.includes((i.data as Fact).tier))
      .sort((a, b) => (a.data as Fact).tier - (b.data as Fact).tier),
  )
  // A chain is introduced only once the learner holds some of its evidence.
  const newChains = unseen.filter((i) => i.kind === 'chain' && (i.data as Chain).evidenceIds.filter((e) => cardIds.has(e)).length >= 2)
  const fresh: ItemRow[] = []
  for (let i = 0; fresh.length < allowance && (newFacts.length || newChains.length); i++) {
    const next = i % 6 === 5 && newChains.length ? newChains.shift()! : (newFacts.shift() ?? newChains.shift()!)
    fresh.push(next)
  }

  const queue: QueueEntry[] = reviews.map(({ c }) => ({ item: items.get(c.id)!, card: c }))
  // Spread new items through the session instead of stacking them at the end.
  const gap = Math.max(1, Math.floor((queue.length + fresh.length) / (fresh.length + 1)))
  fresh.forEach((item, i) => queue.splice(Math.min(queue.length, (i + 1) * gap), 0, { item, card: null }))

  return { queue, dueTotal: due.length, newToday: introducedToday, newAvailable: newFacts.length + newChains.length + fresh.length, deferred: due.length - reviews.length }
}

export function exerciseFor(L: Loaded, e: QueueEntry): { exercise: Exercise; feedback: Feedback } {
  const stability = e.card && e.card.card.state === State.Review ? e.card.card.stability : 0
  const reps = e.card?.card.reps ?? 0
  if (e.item.kind === 'fact') {
    const f = e.item.data as Fact
    return { exercise: factExercise(f, L.bank, stability, reps, e.item.prevValue), feedback: feedbackFor(f, e.item.prevValue, L.bank) }
  }
  const c = e.item.data as Chain
  return { exercise: chainExercise(c, L.bank, stability, reps), feedback: chainFeedback(c) }
}

export interface AnswerResult {
  card: CardRow
  /** due again within this session (learning / relearning step) */
  again: boolean
  nextDue: number
}

export async function answer(L: Loaded, e: QueueEntry, form: string, score: number, confidence: 1 | 2 | 3, latencyMs: number, now = new Date()): Promise<AnswerResult> {
  const isNew = !e.card
  const base = e.card?.card ?? newCard(now)
  const predicted = e.card ? retrievability(L.fsrs, base, now) : null
  const out = review(L.fsrs, base, now, score, confidence, latencyMs)
  const hyper = out.hyper || (!!e.card?.hyper && out.card.state !== State.Review)
  const card = e.card?.hyper && out.card.state === State.Review ? capHyper(out.card, now) : out.card
  const row: CardRow = { id: e.item.id, card, due: card.due.getTime(), introducedAt: e.card?.introducedAt ?? now.getTime(), hyper }
  await db.transaction('rw', db.cards, db.logs, db.items, async () => {
    await db.cards.put(row)
    await db.logs.add({ itemId: e.item.id, ts: now.getTime(), form, score, confidence, latencyMs, rating: ratingFor(score, confidence, latencyMs), predicted, isNew })
    if (e.item.prevValue && score === 1) await db.items.update(e.item.id, { prevValue: undefined }) // change card learned
  })
  return { card: row, again: row.due - now.getTime() < 20 * 60_000, nextDue: row.due }
}
