// MODULE 1: hard-coded cleaning. Drop off-syllabus sections, dedupe, cluster same-event stories.
import { jaccard, titleTokens } from './text.mjs'

const DAY = 86_400_000

export function shouldDrop(story, lexicon, now, maxAgeDays = 3) {
  if (story.at && now - story.at > maxAgeDays * DAY) return 'old'
  if (story.at && story.at - now > DAY) return 'future-dated'
  const sections = story.section.map((s) => s.toLowerCase())
  if (sections.some((s) => lexicon.drop.sections.includes(s))) return 'section'
  if (/\/(sport|sports|cricket|showbiz|entertainment|lifestyle|life-style|culture)\//i.test(story.link)) return 'section'
  const t = ' ' + story.title.toLowerCase() + ' '
  if (lexicon.drop.title.some((k) => t.includes(/^[a-z0-9 ]+$/.test(k) ? ` ${k} ` : k) || (/^[a-z0-9 ]+$/.test(k) && new RegExp(`\\b${k}\\b`).test(t)))) return 'topic'
  return null
}

const normTitle = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Same URL or same outlet + same title → one story. Prefers the entry with a date and the longer snippet. */
export function dedupe(stories) {
  const byKey = new Map()
  for (const s of stories) {
    for (const key of [s.id, s.outlet + '|' + normTitle(s.title)]) {
      const old = byKey.get(key)
      if (old && old !== s) {
        const keep = (old.at ? 1 : 0) * 1000 + old.snippet.length >= (s.at ? 1 : 0) * 1000 + s.snippet.length ? old : s
        const lose = keep === old ? s : old
        for (const [k, v] of byKey) if (v === lose) byKey.set(k, keep)
        byKey.set(key, keep)
      } else byKey.set(key, s)
    }
  }
  return [...new Set(byKey.values())]
}

/** Groups stories about the same event across outlets (same language, within 48h, similar titles). Sets story.cluster and story.outlets. */
export function cluster(stories, threshold = 0.5) {
  const toks = new Map(stories.map((s) => [s.id, titleTokens(s.title)]))
  const parent = new Map(stories.map((s) => [s.id, s.id]))
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)))
  const sorted = [...stories].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      if (a.at && b.at && b.at - a.at > 2 * DAY) break
      if (a.lang !== b.lang || a.outlet === b.outlet) continue
      const ta = toks.get(a.id)
      const tb = toks.get(b.id)
      if (ta.size < 4 || tb.size < 4) continue
      if (jaccard(ta, tb) >= threshold) parent.set(find(b.id), find(a.id))
    }
  const groups = new Map()
  for (const s of stories) {
    const r = find(s.id)
    groups.set(r, [...(groups.get(r) ?? []), s])
  }
  for (const [root, g] of groups) {
    const outlets = [...new Set(g.map((s) => s.outlet))]
    for (const s of g) {
      s.cluster = g.length > 1 ? root : null
      s.outlets = outlets.length
    }
  }
  return stories
}
