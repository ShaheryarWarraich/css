// MODULE 3b: candidate facts in the Master Sheet's shape, then hard-coded guards against invention.
import { jsonArray } from './cli.mjs'
import { numbersIn, westernDigits } from './text.mjs'

export const EXTRACT_BATCH = 5
const CAUTIONS = ['DENOM', 'DEF', 'STOCKFLOW', 'IMF', 'RANK', 'CAUSAL', 'HIST']

export const EXTRACT_RUBRIC = (themes, maps, criteria) => `You extract evidence for a Pakistan CSS exam evidence bank from news excerpts. Extract only what the excerpt states. Up to 3 facts per story; zero is a valid answer.

A fact qualifies only if it is specific (a figure with unit, a legal provision, a named programme or case), attributable, and usable to prove or rebut a Pakistan-specific argument in an exam answer.

Rules:
- "value": copy the figure or provision EXACTLY as written in the excerpt, with its unit. Never compute, convert or round.
- "quote": the exact sentence (or part, max 25 words) the value came from, copied verbatim from the excerpt in its original language.
- "src": the body the excerpt attributes the figure to (e.g. PBS, SBP, IMF, Supreme Court). If the excerpt names none, use "".
- "period": the year or period the figure refers to, as written. "" if not stated.
- "method": denominator, definition, coverage, only if the excerpt states them. Else "".
- "cautions": any of ${CAUTIONS.join(', ')} that apply (DENOM denominator trap, DEF definition-sensitive, STOCKFLOW stock vs flow, IMF commitment vs disbursement, RANK ranking over-interpretation, CAUSAL association reported as cause, HIST historical not current).
- "title": the indicator name, 3–8 words, English. "proves": one sentence, English.
- "type": Statistic | Trend | Comparative statistic | Index | Legal | Case study | Programme | Quotation
- "role": ${Object.entries(criteria.roles).map(([k, v]) => `${k}=${v}`).join(' ')}
- "theme": one of ${themes.join(' | ')}
- "map": ${maps.map((m) => `${m.id}=${m.title}`).join('; ')} or ""
- "tags": 2–4 short CSS topic tags.

Reply with a JSON array only:
[{"sid":"","title":"","value":"","period":"","src":"","type":"","role":"","theme":"","tags":[],"map":"","proves":"","method":"","cautions":[],"quote":""}]

STORIES
`

export const extractBlock = (s, excerpt) => `### ${s.id} | ${s.outlet} | ${s.title}\n${excerpt}`

const squash = (s) => westernDigits(String(s)).toLowerCase().replace(/[\s"'“”‘’]+/g, ' ').trim()

/**
 * Guards. Returns {ok, reason}. `text` is the full excerpt the model was shown.
 * Figure check: every number in value must be in the text. Quote check: quote must be verbatim.
 */
export function guard(c, text) {
  if (!c.title || !c.value || !c.proves) return { ok: false, reason: 'missing title, value or proves' }
  const hay = squash(text)
  const textNums = new Set(numbersIn(text))
  const foreign = numbersIn(c.value).filter((n) => !textNums.has(n))
  if (foreign.length) return { ok: false, reason: `figure not in article: ${foreign.join(', ')}` }
  if (!c.quote || !hay.includes(squash(c.quote).replace(/…$/, ''))) return { ok: false, reason: 'quote is not verbatim' }
  if (c.quote.split(/\s+/).length > 32) return { ok: false, reason: 'quote too long' }
  const specific = numbersIn(c.value).length > 0 || /Legal|Case study|Programme|Quotation/.test(c.type)
  if (!specific) return { ok: false, reason: 'not specific: no figure, provision or named case' }
  return { ok: true }
}

export function parseExtract(text, storyIds, themes, maps, criteria) {
  const mapIds = new Set(maps.map((m) => m.id))
  const out = []
  for (const r of jsonArray(text)) {
    if (!storyIds.has(r.sid)) continue
    out.push({
      sid: r.sid,
      title: String(r.title ?? '').trim(),
      value: String(r.value ?? '').trim(),
      period: String(r.period ?? '').trim(),
      src: String(r.src ?? '').trim(),
      type: String(r.type ?? 'Statistic').trim(),
      role: criteria.roles[r.role] ?? 'Supporting Evidence',
      theme: themes.includes(r.theme) ? r.theme : 'Other',
      tags: (Array.isArray(r.tags) ? r.tags : []).map(String).slice(0, 4),
      map: mapIds.has(r.map) ? r.map : '',
      proves: String(r.proves ?? '').trim(),
      method: String(r.method ?? '').trim(),
      cautions: (Array.isArray(r.cautions) ? r.cautions : []).filter((x) => CAUTIONS.includes(x)),
      quote: String(r.quote ?? '').trim(),
    })
  }
  return out
}
