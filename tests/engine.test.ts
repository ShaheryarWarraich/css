import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildPack, expandRefs } from '../src/content/normalize'
import { gradeNumeric, numericDistractors, salientNumber } from '../src/content/numeric'
import { chainExercise, factExercise, gradeOrder } from '../src/engine/forms'
import { schedulerConfig } from '../src/engine/scheduler'
import { answer, buildPlan, exerciseFor, load } from '../src/engine/session'
import { db, DEFAULT_SETTINGS, mergePack } from '../src/db'
import type { Pack } from '../src/content/types'

let pack: Pack
beforeAll(() => {
  pack = buildPack(XLSX.read(readFileSync('content/source/evidence-bank-v1.xlsx'), { type: 'buffer' }), 'core', 'test')
})

describe('numeric', () => {
  it('picks the figure, not the year or label', () => {
    expect(salientNumber('Civil justice weakened in 68% of countries in the WJP 2025 index')!.raw).toBe('68')
    expect(salientNumber('US$452.1 billion')!.raw).toBe('452.1')
    expect(salientNumber('Free and compulsory education, ages 5-16')).toBeNull()
    expect(salientNumber('10,170 complaints concerned dignity')!.n).toBe(10170)
  })
  it('grades with tolerance', () => {
    const t = salientNumber('3.70%')!
    expect(gradeNumeric('3.7', t).correct).toBe(true)
    expect(gradeNumeric('about 3.7 percent', t).correct).toBe(true)
    expect(gradeNumeric('3.9', t)).toEqual({ correct: false, close: true })
    expect(gradeNumeric('7', t).correct).toBe(false)
  })
  it('makes three distinct distractors', () => {
    const t = salientNumber('28.9%')!
    const d = numericDistractors(t, 1)
    expect(new Set(d).size).toBe(3)
    expect(d).not.toContain('28.9')
  })
})

describe('normalize', () => {
  it('expands ranges', () => expect(expandRefs('E280; E344-E346')).toEqual(['E280', 'E344', 'E345', 'E346']))
  it('builds the pack and repairs shifted rows', () => {
    expect(pack.facts.length).toBeGreaterThan(550)
    expect(pack.chains.length).toBe(30)
    const con = pack.facts.find((f) => f.id === 'CON-001')!
    expect(con.source).toBe('Constitution of Pakistan')
    expect(con.proves).not.toMatch(/^http/)
    expect(pack.facts.filter((f) => f.tier === 1).length).toBe(150)
  })
})

describe('forms', () => {
  it('produces a valid exercise for every item at every strength', () => {
    const bank = { facts: pack.facts, factById: new Map(pack.facts.map((f) => [f.id, f])) }
    const forms = new Map<string, number>()
    for (const s of [0, 5, 20])
      for (let reps = 0; reps < 3; reps++) {
        for (const f of pack.facts) {
          const ex = factExercise(f, bank, s, reps)
          forms.set(ex.form, (forms.get(ex.form) ?? 0) + 1)
          if (ex.form === 'mcq') {
            expect(new Set(ex.options).size).toBe(4)
            expect(ex.answer).toBeGreaterThanOrEqual(0)
          }
          if (ex.form === 'cloze') expect(ex.stem).toContain('_____')
        }
        for (const c of pack.chains) {
          const ex = chainExercise(c, bank, s, reps)
          if (ex.form === 'order') expect(ex.shuffled.join()).not.toBe(ex.answer.join())
        }
      }
    console.log(Object.fromEntries(forms))
  })
  it('grades ordering', () => {
    expect(gradeOrder(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1)
    expect(gradeOrder(['c', 'a', 'b'], ['a', 'b', 'c'])).toBe(0.5)
    expect(gradeOrder(['c', 'b', 'a'], ['a', 'b', 'c'])).toBe(0)
  })
})

describe('scheduler', () => {
  it('caps intervals by exam distance', () => {
    expect(schedulerConfig('2027-01-27', new Date('2026-09-22')).maximumInterval).toBe(21)
    expect(schedulerConfig('2027-01-27', new Date('2027-01-17'))).toEqual({ maximumInterval: 5, requestRetention: 0.93 })
    expect(schedulerConfig('2027-09-22', new Date('2026-09-22')).maximumInterval).toBe(44)
  })
})

describe('session', () => {
  it('introduces, relearns and respects the load cap', async () => {
    await mergePack(pack)
    const settings = { ...DEFAULT_SETTINGS, newPerDay: 10 }
    const t0 = new Date('2026-09-22T09:00:00')
    const L = await load(settings, t0)
    const plan = await buildPlan(L, t0)
    expect(plan.queue.length).toBe(10)
    expect(new Set(plan.queue.map((q) => (q.item.data as any).theme)).size).toBeGreaterThan(5)

    const first = plan.queue[0]
    const { exercise } = exerciseFor(L, first)
    const wrong = await answer(L, first, exercise.form, 0, 3, 5000, t0)
    expect(wrong.again).toBe(true)
    expect(wrong.card.hyper).toBe(true)
    for (const q of plan.queue.slice(1)) await answer(L, q, 'mcq', 1, 2, 9000, t0)

    const later = await buildPlan(L, new Date('2026-09-22T09:30:00'))
    expect(later.queue.every((q) => q.card)).toBe(true) // daily new allowance used up
    const t7 = new Date('2026-09-29T09:00:00')
    const week = await buildPlan(await load(settings, t7), t7)
    expect(week.dueTotal).toBe(10)
    expect(week.queue.filter((q) => !q.card).length).toBe(10)
    expect(await db.logs.count()).toBe(10)
  })
  it('turns a changed value into a change card', async () => {
    const f = pack.facts.find((x) => x.id === 'ECON-001')!
    const v2 = { ...pack, facts: [{ ...f, value: '4.10%' }], chains: [] }
    const res = await mergePack(v2)
    expect(res.changed).toBe(1)
    expect((await db.items.get('ECON-001'))!.prevValue).toBe('3.70%')
  })
})
