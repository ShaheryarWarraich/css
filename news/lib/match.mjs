// MODULE 3c: compare a candidate with the bank. Zero tokens.
import { jaccard, numbersIn, titleTokens } from './text.mjs'

const ALIASES = [['pbs', 'pakistan bureau of statistics', 'labour force survey', 'census'], ['sbp', 'state bank'], ['imf', 'international monetary fund'], ['wef', 'world economic forum'], ['finance division', 'ministry of finance', 'economic survey'], ['world bank'], ['undp'], ['unicef'], ['transparency international']]
const bodies = (s) => {
  const t = String(s ?? '').toLowerCase()
  return new Set(ALIASES.map((a, i) => (a.some((k) => new RegExp(`(^|[^a-z])${k}([^a-z]|$)`).test(t)) ? i : -1)).filter((i) => i >= 0))
}
/** True when both name the same body. Unknown or missing sources never count as the same. */
export function sameSource(a, b) {
  const x = bodies(a)
  const y = bodies(b)
  if (x.size && y.size) return [...x].some((i) => y.has(i))
  const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
  return !!norm(a) && (norm(b).includes(norm(a)) || norm(a).includes(norm(b).split(' (')[0]))
}

const years = (s) => new Set((String(s ?? '').match(/(?:19|20)\d\d/g) ?? []))
const latest = (s) => Math.max(0, ...[...years(s)].map(Number))

/**
 * @returns {{kind:'new'|'update'|'conflict'|'duplicate', factId?:string, similarity?:number}}
 */
export function matchCandidate(c, facts) {
  const ct = titleTokens(c.title)
  let best = null
  for (const f of facts) {
    const ft = titleTokens(f.titleIsValue ? f.value.slice(0, 80) : f.title)
    let sim = jaccard(ct, ft)
    let inter = 0
    for (const x of ct) if (ft.has(x)) inter++
    const contain = Math.min(ct.size, ft.size) ? inter / Math.min(ct.size, ft.size) : 0
    sim = Math.max(sim, contain >= 0.75 && inter >= 2 ? 0.6 : 0)
    if (f.theme === c.theme) sim += 0.05
    if (!best || sim > best.sim) best = { f, sim }
  }
  if (!best || best.sim < 0.55) return { kind: 'new', factId: best?.sim >= 0.35 ? best.f.id : undefined, similarity: best?.sim ?? 0 }
  const f = best.f
  const cn = numbersIn(c.value)
  const fn = new Set(numbersIn(f.value))
  const sameValue = cn.length > 0 && cn.every((n) => fn.has(n))
  const cy = latest(c.period)
  const fy = latest(f.period)
  const samePeriod = cy && fy ? cy === fy : !cy && !fy
  if (sameValue && (samePeriod || !cy)) return { kind: 'duplicate', factId: f.id, similarity: best.sim }
  // A figure from a different body is a different measurement, not a newer value of the same one
  // (source-conflict preservation, no definition mixing). It enters as its own fact, shown next to the nearest one.
  if (!sameSource(c.src, f.source)) return { kind: 'new', factId: f.id, similarity: best.sim, note: 'different-source' }
  if (samePeriod && cy) return { kind: 'conflict', factId: f.id, similarity: best.sim }
  if (cy && fy && cy < fy) return { kind: 'new', factId: f.id, similarity: best.sim } // older than what the bank holds: historical, not an update
  return { kind: 'update', factId: f.id, similarity: best.sim }
}
