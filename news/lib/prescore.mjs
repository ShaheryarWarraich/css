// MODULE 2a: the criteria that can be checked by rule. Zero tokens. Codes are documented in news/criteria.json.
import { westernDigits } from './text.mjs'

const isLatin = (k) => /^[\x20-\x7e]+$/.test(k)
function hits(text, list) {
  const out = []
  for (const k of list) {
    if (isLatin(k)) {
      const esc = k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = /^[a-z0-9]/i.test(k.trim()) && /[a-z0-9]$/i.test(k.trim()) ? new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i') : new RegExp(esc, 'i')
      if (re.test(text)) out.push(k.trim())
    } else if (text.includes(k)) out.push(k)
  }
  return out
}

const FIGURE = /(?:(?:rs\.?|pkr|us\$|usd|\$|€|£)\s?\d[\d,.]*\s?(?:bn|billion|mn|million|tr|trillion|crore|lakh|k)?)|(?:\d[\d,.]*\s?(?:%|percent|per cent|pc\b|bn\b|billion|mn\b|million|trillion|crore|lakh|bps|basis points|mw\b|maf\b|tonnes|tons|فیصد|ارب|کروڑ|لاکھ|کھرب|ملین|بلین|ڈالر|روپے|میگاواٹ))/i

export const WEIGHTS = { PK: 3, SYL: 2, MAP: 2, SRC: 2, NUM: 2, TRD: 1, CMP: 1, DIS: 1, LAW: 2, SOL: 1, XTOP: 1 }

/**
 * @param story   {title, snippet, group, kind}
 * @param body    full text when the feed carries it (in memory only), else ''
 * @param lexicon news/lexicon.json
 * @param maps    [{id, title, keywords[]}] derived from the evidence bank's argument maps
 */
export function prescore(story, body, lexicon, maps) {
  const head = westernDigits(`${story.title}. ${story.snippet}`)
  // Feeds that carry full text must not outscore feeds that carry a snippet: only the opening of the body counts.
  const all = westernDigits(`${head} ${(body ?? '').slice(0, 500)}`)
  const badges = []
  const add = (code, ok) => ok && badges.push(code)

  const themes = Object.entries(lexicon.themes)
    .map(([name, kws]) => ({ name, n: hits(head, kws).length }))
    .filter((t) => t.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((t) => t.name)
  const mapHits = maps
    .map((m) => ({ id: m.id, n: hits(head, m.keywords).length }))
    .filter((m) => m.n >= 2)
    .sort((a, b) => b.n - a.n)
    .map((m) => m.id)

  add('PK', hits(head, lexicon.pakistan).length > 0 || (story.group !== 'intl' && hits(all, lexicon.pakistan).length > 0))
  add('SYL', themes.length > 0)
  add('MAP', mapHits.length > 0)
  add('SRC', hits(all, lexicon.authority).length > 0)
  add('NUM', FIGURE.test(all))
  add('TRD', hits(head, lexicon.trend).length > 0 && /\d/.test(head))
  add('CMP', hits(head, lexicon.compare).length > 0)
  add('DIS', hits(head, lexicon.disaggregate).length > 0)
  add('LAW', hits(head, lexicon.law).length > 0)
  add('SOL', hits(head, lexicon.solution).length > 0)
  add('XTOP', themes.length >= 2)

  const flags = Object.entries(lexicon.flags)
    .filter(([code, kws]) => {
      const n = hits(all, kws).length
      return code === 'STOCKFLOW' ? n >= 2 : n >= 1 && (code !== 'RANK' || badges.includes('CMP'))
    })
    .map(([code]) => code)

  let score = badges.reduce((s, b) => s + WEIGHTS[b], 0)
  // Pakistan-first and syllabus relevance are gates, not bonuses.
  if (!badges.includes('PK')) score = Math.min(score, 4)
  if (!badges.includes('SYL')) score = Math.min(score, 3)
  return { score, badges, flags, themes: themes.slice(0, 3), maps: mapHits.slice(0, 2) }
}

/** Keywords for each argument map, taken from the evidence bank so both modules share one vocabulary. */
export function mapsFromPack(pack) {
  const STOP = new Set(['pakistan', 'and', 'the', 'of', 'to', 'in', 'weak', 'high', 'low', 'limited', 'risk', 'reform', 'growth', 'state', 'national', 'local', 'public', 'policy'])
  return pack.chains
    .filter((c) => c.kind === 'map')
    .map((c) => ({
      id: c.id,
      title: c.title,
      keywords: [...new Set(`${c.title} ${c.links.join(' ')}`.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s/]+/).filter((w) => w.length > 3 && !STOP.has(w)))],
    }))
}
