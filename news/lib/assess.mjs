// MODULE 2b: the criteria that need judgment. Codes in, codes out.
import { jsonArray } from './cli.mjs'

export const ASSESS_BATCH = 20

// Fixed prefix: identical on every call.
export const ASSESS_RUBRIC = (maps, criteria) => `You screen news stories for a Pakistan CSS (civil service exam) evidence bank. A story is worth keeping only if it likely contains evidence a candidate could use to prove, qualify, challenge or rebut an argument in an exam answer. Interesting is not enough.

Keep (keep=1) when the story carries at least one of: a specific figure from a credible body; a trend or comparison; a law, judgment, treaty or constitutional development; a concrete Pakistani programme, reform or case; evidence of a cause, impact, solution, progress or counter-point. Reject (keep=0): routine politics and statements, who-said-what, crime/accident reports without data, market ticks, sport, weather, foreign news with no use in a Pakistan answer.

Codes:
role: ${Object.entries(criteria.roles).map(([k, v]) => `${k}=${v}`).join(' ')}
use (papers, max 3): ${Object.entries(criteria.papers).map(([k, v]) => `${k}=${v}`).join(' ')}
map (argument map id or ""): ${maps.map((m) => `${m.id}=${m.title}`).join('; ')}
th: a theory it links to (e.g. "Principal–Agent", "Security Dilemma", "Human Capital") or ""
reuse: 0 one topic, 1 two topics, 2 three or more
t1: 1 if it could be one of ~150 facts worth instant recall, else 0
why: at most 12 words, what it could prove. Plain English even for Urdu stories.

Judge only from the title and snippet given. Reply with a JSON array only, one object per story, same ids:
[{"id":"","keep":0,"role":"","use":[],"map":"","th":"","reuse":0,"t1":0,"why":""}]
For keep=0 return only {"id":"","keep":0}.

STORIES
`

export const assessLine = (s) => `${s.id} | ${s.outlet} | ${s.title} | ${s.snippet.slice(0, 220)}`

export function parseAssess(text, ids, maps, criteria) {
  const mapIds = new Set(maps.map((m) => m.id))
  const out = new Map()
  for (const r of jsonArray(text)) {
    if (!ids.has(r.id)) continue
    if (!r.keep) { out.set(r.id, { keep: 0 }); continue }
    out.set(r.id, {
      keep: 1,
      role: criteria.roles[r.role] ? r.role : '',
      use: (Array.isArray(r.use) ? r.use : []).filter((u) => criteria.papers[u]).slice(0, 3),
      map: mapIds.has(r.map) ? r.map : '',
      th: String(r.th ?? '').slice(0, 40),
      reuse: [0, 1, 2].includes(r.reuse) ? r.reuse : 0,
      t1: r.t1 ? 1 : 0,
      why: String(r.why ?? '').split(/\s+/).slice(0, 14).join(' '),
    })
  }
  return out
}
