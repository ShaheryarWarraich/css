// The form ladder: the same item is tested in a different form as memory strengthens,
// so the learner memorises the fact and its use, not the card.
import type { Chain, Fact } from '../content/types'
import { clozeText, hashSeed, numericDistractors, salientNumber, seededShuffle, type NumToken } from '../content/numeric'

export type Exercise =
  | { form: 'mcq'; rung: number; stem: string; ask: string; options: string[]; answer: number }
  | { form: 'cloze'; rung: number; stem: string; ask: string; token: NumToken }
  | { form: 'recall'; rung: number; stem: string; ask: string; reveal: string }
  | { form: 'evidence'; rung: number; stem: string; ask: string; expected: { id: string; label: string }[] }
  | { form: 'order'; rung: number; stem: string; ask: string; shuffled: string[]; answer: string[] }

export interface Feedback {
  fact: string
  soWhat?: string
  caution?: string
  source: string
  sourceLabel?: string
  sourceUrl?: string
  example?: string
  exampleLabel?: string
  hook?: string
  useAgainst?: string
  pairs?: string[]
  why?: string
  changedFrom?: string
  flag?: string
}

export interface Bank {
  facts: Fact[]
  factById: Map<string, Fact>
}

const when = (f: Fact) => (f.period ? ` (${f.period})` : '')
const sentence = (f: Fact) => (f.titleIsValue ? f.value : `${f.title}${when(f)}: ${f.value}`)

export function feedbackFor(f: Fact, prevValue?: string, bank?: Bank): Feedback {
  return {
    hook: f.memoryHook,
    useAgainst: f.useAgainst,
    why: f.whyItMatters,
    pairs: bank ? f.pairsWith.map((id) => bank.factById.get(id)).filter((x): x is Fact => !!x).slice(0, 3).map(sentence) : undefined,
    fact: sentence(f),
    soWhat: f.proves || undefined,
    caution: f.qualification,
    source: f.period && !f.source.includes(f.period) ? `${f.source}, ${f.period}` : f.source,
    sourceUrl: f.sourceUrl,
    example: f.deploy || undefined,
    changedFrom: prevValue,
    flag: f.verification === 'needs-audit' ? 'This figure is still awaiting a source check. Verify before citing it in the exam.' : undefined,
  }
}

export function chainFeedback(c: Chain): Feedback {
  return {
    fact: c.links.join(' → '),
    soWhat: c.coreLogic,
    caution: c.counter,
    source: c.subjects.join(' · '),
    sourceLabel: 'Useful in',
    example: c.policy?.join(' + '),
    exampleLabel: 'Way forward',
  }
}

function pickOthers(pool: string[], correct: string, seed: number, n = 3): string[] {
  const uniq = [...new Set(pool)].filter((x) => x && x !== correct)
  return seededShuffle(uniq, seed).slice(0, n)
}

function mcq(stem: string, ask: string, correct: string, wrong: string[], seed: number): Exercise {
  const options = seededShuffle([correct, ...wrong], seed)
  return { form: 'mcq', rung: 1, stem, ask, options, answer: options.indexOf(correct) }
}

function numberStem(f: Fact, t: NumToken): string {
  const body = clozeText(f.value, t)
  return f.titleIsValue ? `${body}${when(f)}` : `${f.title}${when(f)}: ${body}`
}

export function factExercise(f: Fact, bank: Bank, stabilityDays: number, reps: number, prevValue?: string): Exercise {
  const seed = hashSeed(f.id) + reps
  const t = salientNumber(f.value)
  const provesRecall = (): Exercise => ({
    form: 'recall',
    rung: 3,
    stem: sentence(f),
    ask: 'In an exam answer, what does this evidence prove? Say it in your own words — and name one thing it does not prove.',
    reveal: f.proves + (f.qualification ? `\n\nCaution: ${f.qualification}` : ''),
  })
  const provesMcq = (): Exercise | null => {
    const wrong = pickOthers(bank.facts.filter((x) => x.theme !== f.theme && x.proves).map((x) => x.proves), f.proves, seed)
    return wrong.length === 3 ? { ...mcq(sentence(f), 'Which claim does this evidence best support?', f.proves, wrong, seed), rung: 3 } : null
  }

  // Rung 1 — recognition with competitive distractors (new or just-lapsed items)
  if (stabilityDays < 2) {
    if (t) {
      const wrong = numericDistractors(t, seed)
      const old = prevValue ? salientNumber(prevValue) : null
      if (old && old.raw !== t.raw) wrong[0] = old.raw // last year's value is the best lure
      if (wrong.length === 3) return mcq(numberStem(f, t), 'Which value is correct?', t.raw, wrong, seed)
    } else if (!f.titleIsValue) {
      const pool = bank.facts.filter((x) => x.theme === f.theme && !x.titleIsValue && !salientNumber(x.value)).map((x) => x.value)
      const wrong = pickOthers(pool, f.value, seed)
      if (wrong.length === 3) return mcq(`${f.title}${when(f)}`, 'Which statement is correct?', f.value, wrong, seed)
    }
    return (f.proves && provesMcq()) || provesRecall()
  }

  // Rung 2 — cued recall
  const cued = (): Exercise | null => {
    if (t) return { form: 'cloze', rung: 2, stem: numberStem(f, t), ask: 'Type the missing figure.', token: t }
    if (!f.titleIsValue) return { form: 'recall', rung: 2, stem: `${f.title}${when(f)}`, ask: `State it from memory. Source: ${f.source}.`, reveal: f.value }
    return null
  }
  if (stabilityDays < 8) return cued() ?? provesRecall()

  // Rung 2–3 rotation — strong items alternate recall, reversed cue and meaning
  const rotation: (() => Exercise | null)[] = [cued]
  if (f.proves) rotation.push(provesRecall)
  if (t && !f.titleIsValue)
    rotation.push(() => ({ form: 'recall', rung: 2, stem: `${f.value} — ${[f.period, f.source].filter(Boolean).join(', ')}`, ask: 'Which indicator is this, and what is it evidence of?', reveal: `${f.title}\n\n${f.proves}` }))
  for (let i = 0; i < rotation.length; i++) {
    const ex = rotation[(reps + i) % rotation.length]()
    if (ex) return ex
  }
  return provesRecall()
}

export function chainExercise(c: Chain, bank: Bank, stabilityDays: number, reps: number): Exercise {
  const seed = hashSeed(c.id) + reps
  const order = (): Exercise | null => {
    if (c.links.length < 3) return null
    // Capitalisation must not give away the first link.
    const plain = (l: string) => (/^[A-Z][a-z]/.test(l) ? l[0].toLowerCase() + l.slice(1) : l)
    const links = c.links.map(plain)
    let shuffled = seededShuffle(links, seed)
    if (shuffled.join() === links.join()) shuffled = [...links].reverse()
    return { form: 'order', rung: 6, stem: c.kind === 'map' ? c.title : 'Rebuild this argument chain', ask: 'Put the links in causal order.', shuffled, answer: links }
  }
  const evidence = (): Exercise | null => {
    const facts = c.evidenceIds.map((id) => bank.factById.get(id)!).filter(Boolean).sort((a, b) => a.tier - b.tier)
    if (facts.length < 2) return null
    const expected = seededShuffle(facts.slice(0, 8), seed).slice(0, 5).map((f) => ({ id: f.id, label: sentence(f) }))
    return { form: 'evidence', rung: 4, stem: c.links.join(' → '), ask: `From memory, write ${Math.min(3, expected.length)} or more pieces of evidence that support this argument. Then reveal and tick the ones you recalled.`, expected }
  }
  const counter = (): Exercise | null =>
    c.counter ? { form: 'recall', rung: 3, stem: `${c.title}: ${c.links.join(' → ')}`, ask: 'What is the strongest qualification or counter-argument to this causal story?', reveal: c.counter } : null
  const policy = (): Exercise | null =>
    c.policy ? { form: 'recall', rung: 3, stem: `${c.title}: ${c.links.join(' → ')}`, ask: 'List the way-forward measures that answer this chain.', reveal: c.policy.join('\n') } : null

  const ladder = stabilityDays < 4 ? [order, evidence] : [evidence, counter, order, policy]
  for (let i = 0; i < ladder.length; i++) {
    const ex = ladder[(reps + i) % ladder.length]()
    if (ex) return ex
  }
  return { form: 'recall', rung: 3, stem: c.title, ask: 'State the core logic of this argument.', reveal: c.coreLogic ?? c.links.join(' → ') }
}

export function gradeOrder(given: string[], answer: string[]): number {
  if (given.join('|') === answer.join('|')) return 1
  let ok = 0
  for (let i = 0; i < given.length - 1; i++) if (answer.indexOf(given[i + 1]) === answer.indexOf(given[i]) + 1) ok++
  return ok / (answer.length - 1) >= 0.5 ? 0.5 : 0
}

export function gradeEvidence(ticked: number, expected: number): number {
  const need = Math.min(3, expected)
  return ticked >= need ? 1 : ticked >= 1 ? 0.5 : 0
}
