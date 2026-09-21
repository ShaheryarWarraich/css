// FSRS anchored to the exam date. A fact is never "done": the interval cap guarantees
// every item comes back inside the final weeks before the exam.
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type FSRS, type Grade } from 'ts-fsrs'

const DAY = 86_400_000

export function daysToExam(examDate: string, now: Date): number {
  return Math.ceil((new Date(examDate + 'T00:00:00').getTime() - now.getTime()) / DAY)
}

export interface SchedulerConfig {
  maximumInterval: number
  requestRetention: number
}

export function schedulerConfig(examDate: string, now: Date): SchedulerConfig {
  const d = daysToExam(examDate, now)
  if (d <= 0) return { maximumInterval: 60, requestRetention: 0.9 } // exam passed or unset: plain maintenance
  // Cepeda 2008: optimal gap ≈ 5–10% of the retention interval for a test months away.
  const cap = Math.min(45, Math.max(21, Math.round(d * 0.12)))
  return {
    maximumInterval: Math.max(1, Math.min(cap, Math.ceil(d / 2))),
    requestRetention: d <= 42 ? 0.93 : 0.9,
  }
}

export function makeScheduler(examDate: string, now: Date): FSRS {
  const c = schedulerConfig(examDate, now)
  return fsrs(generatorParameters({ request_retention: c.requestRetention, maximum_interval: c.maximumInterval, enable_fuzz: true, enable_short_term: true }))
}

export const newCard = (now: Date): Card => createEmptyCard(now)

/**
 * The system judges correctness; the learner only supplies confidence.
 * score: 1 correct, 0.5 close/partial, 0 wrong. confidence: 1 guess, 2 think so, 3 sure.
 */
export function ratingFor(score: number, confidence: 1 | 2 | 3, latencyMs: number): Grade {
  if (score < 0.5) return Rating.Again
  if (score < 1) return Rating.Hard
  if (confidence === 1) return Rating.Hard
  if (confidence === 3 && latencyMs < 8000) return Rating.Easy
  return Rating.Good
}

export interface ReviewOutcome {
  card: Card
  due: number
  hyper: boolean
}

export function review(f: FSRS, card: Card, now: Date, score: number, confidence: 1 | 2 | 3, latencyMs: number): ReviewOutcome {
  const next = f.next(card, now, ratingFor(score, confidence, latencyMs)).card
  // Hypercorrection fades within a week: a confident error must come back within 2 days
  // even after same-session relearning succeeds.
  const hyper = score < 0.5 && confidence === 3
  return { card: next, due: next.due.getTime(), hyper }
}

/** Applied when a card flagged `hyper` graduates from relearning with a long interval. */
export function capHyper(card: Card, now: Date): Card {
  const limit = now.getTime() + 2 * DAY
  if (card.state === State.Review && card.due.getTime() > limit) return { ...card, due: new Date(limit), scheduled_days: 2 }
  return card
}

export function retrievability(f: FSRS, card: Card, now: Date): number | null {
  if (card.state === State.New || !card.last_review) return null
  return f.get_retrievability(card, now, false)
}

export { Rating, State }
