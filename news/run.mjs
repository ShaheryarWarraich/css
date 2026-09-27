// News module runner: fetch → clean → score → assess → extract → write the files the app loads.
//   node news/run.mjs                 full run
//   node news/run.mjs --no-llm        aggregator and rule scores only (0 tokens)
//   node news/run.mjs --cap 40        daily assessment cap (default 40)
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, readdirSync, unlinkSync } from 'node:fs'
import { parseFeed } from './lib/parse.mjs'
import { cluster, dedupe, shouldDrop } from './lib/clean.mjs'
import { mapsFromPack, prescore } from './lib/prescore.mjs'
import { ASSESS_BATCH, ASSESS_RUBRIC, assessLine, parseAssess } from './lib/assess.mjs'
import { articleText, evidenceSentences, fetchText } from './lib/article.mjs'
import { EXTRACT_BATCH, EXTRACT_RUBRIC, extractBlock, guard, parseExtract } from './lib/extract.mjs'
import { matchCandidate } from './lib/match.mjs'
import { estTokens, runCli, usage } from './lib/cli.mjs'
import { pktDay, stripHtml, truncate } from './lib/text.mjs'

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(`--${n}`)
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d)
const NO_LLM = flag('no-llm')
const CAP = Number(opt('cap', 40))
const EXTRACT_CAP = Number(opt('extract-cap', 20))
const MIN_SCORE = Number(opt('min-score', 6))
const KEEP_DAYS = 14
const DAY = 86_400_000
const now = Date.now()

const read = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d)
const sources = read('news/sources.json').filter((s) => !s.disabled)
const disabled = read('news/sources.json').filter((s) => s.disabled)
const lexicon = read('news/lexicon.json')
const criteria = read('news/criteria.json')
const pack = read('public/packs/core.json')
const maps = mapsFromPack(pack)
const themes = Object.keys(lexicon.themes)
mkdirSync('news/store', { recursive: true })
const store = read('news/store/stories.json', { stories: {}, assessedPerDay: {} })
const cands = read('news/store/candidates.json', { candidates: [], rejected: [] })
const log = (m) => { console.log(m); appendFileSync('news/store/run.log', `${new Date().toISOString()} ${m}\n`) }

// ── MODULE 1: fetch ──────────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
const fullText = new Map()
const health = []
async function pull(src) {
  const h = { id: src.id, name: src.name, lang: src.lang, ok: false, items: 0, newest: null, note: '' }
  const get = async (url) => {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(25_000), redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  }
  try {
    let parsed
    try {
      parsed = parseFeed(await get(src.url), src)
    } catch (e) {
      if (!src.alt) throw e
      parsed = parseFeed(await get(src.alt), src)
      // Aggregator feed: titles end with " - Outlet" and the description is a link list, not a snippet.
      for (const st of parsed.stories) { st.title = st.title.replace(new RegExp(`\\s[-–|]\\s${src.name}$`, 'i'), ''); st.snippet = ''; st.indirect = true }
      h.note = src.altNote ?? 'via fallback feed'
    }
    h.items = parsed.stories.length
    h.newest = Math.max(0, ...parsed.stories.map((s) => s.at ?? 0)) || null
    h.ok = h.items > 0
    if (!h.items) h.note = 'no items in feed'
    else if (h.newest && now - h.newest > 7 * DAY) h.note = `stale: newest item ${pktDay(h.newest)}`
    for (const [k, v] of parsed.fullText) fullText.set(k, v)
    health.push(h)
    return parsed.stories
  } catch (e) {
    h.note = String(e.cause?.code ?? e.message ?? e).slice(0, 80)
    health.push(h)
    return []
  }
}
const fetched = []
for (let i = 0; i < sources.length; i += 8) fetched.push(...(await Promise.all(sources.slice(i, i + 8).map(pull))).flat())

const dropped = { old: 0, section: 0, topic: 0, 'future-dated': 0 }
let fresh = 0
for (const s of dedupe(fetched)) {
  const why = shouldDrop(s, lexicon, now)
  if (why) { dropped[why]++; continue }
  if (!s.at) s.at = now
  const old = store.stories[s.id]
  if (old) { if (s.snippet.length > old.snippet.length) old.snippet = s.snippet; continue }
  // Same outlet republishing the same headline under a new URL.
  if (Object.values(store.stories).some((o) => o.outlet === s.outlet && o.title === s.title)) continue
  store.stories[s.id] = s
  fresh++
}
for (const [id, s] of Object.entries(store.stories)) if (now - s.at > KEEP_DAYS * DAY) delete store.stories[id]
const all = Object.values(store.stories)
for (const s of all) if (/<\/?[a-z]/i.test(s.snippet)) s.snippet = truncate(stripHtml(s.snippet), 300)
cluster(all.filter((s) => now - s.at < 3 * DAY))
log(`fetch: ${health.filter((h) => h.ok).length}/${sources.length} feeds ok, ${fetched.length} items, ${fresh} new, dropped ${JSON.stringify(dropped)}`)
for (const h of health.filter((h) => !h.ok || h.note)) log(`  feed ${h.id}: ${h.note || 'failed'}`)

// ── MODULE 2a: rule scores ───────────────────────────────────────────────────
for (const s of all) if (!s.ps || fullText.has(s.id)) s.ps = prescore(s, fullText.get(s.id) ?? '', lexicon, maps)

// ── MODULE 2b: CLI assessment ────────────────────────────────────────────────
const today = pktDay(now)
let assessMode = 'rules'
if (!NO_LLM) {
  const left = CAP - (store.assessedPerDay[today] ?? 0)
  const queue = all
    .filter((s) => !s.as && s.ps.score >= MIN_SCORE && now - s.at < 2 * DAY)
    .sort((a, b) => b.ps.score - a.ps.score || (b.outlets ?? 1) - (a.outlets ?? 1) || b.at - a.at)
  // One story per event: assessing five outlets' versions of the same story wastes the cap.
  const seen = new Set()
  const pick = []
  for (const s of queue) {
    if (pick.length >= left) break
    if (s.cluster && seen.has(s.cluster)) continue
    if (s.cluster) seen.add(s.cluster)
    pick.push(s)
  }
  const rubric = ASSESS_RUBRIC(maps, criteria)
  for (let i = 0; i < pick.length; i += ASSESS_BATCH) {
    const batch = pick.slice(i, i + ASSESS_BATCH)
    try {
      const res = parseAssess(await runCli(rubric + batch.map(assessLine).join('\n')), new Set(batch.map((s) => s.id)), maps, criteria)
      for (const s of batch) if (res.has(s.id)) { s.as = res.get(s.id); store.assessedPerDay[today] = (store.assessedPerDay[today] ?? 0) + 1 }
      assessMode = 'cli'
    } catch (e) {
      log(`assess: batch failed (${e.message}); shortlist falls back to rule scores`)
      break
    }
  }
  if (all.some((s) => s.as)) assessMode = 'cli'
  log(`assess: ${pick.length} sent, kept ${pick.filter((s) => s.as?.keep).length}, cap left today ${CAP - (store.assessedPerDay[today] ?? 0)}`)
  // A kept story's verdict applies to the other outlets' versions of the same event.
  for (const s of all) if (!s.as && s.cluster) { const twin = all.find((o) => o.cluster === s.cluster && o.as); if (twin) s.as = { ...twin.as, via: twin.id } }
}

// ── MODULE 3: extraction ─────────────────────────────────────────────────────
if (!NO_LLM) {
  const queue = all.filter((s) => s.as?.keep && !s.as.via && !s.ex && !s.indirect).sort((a, b) => b.ps.score - a.ps.score).slice(0, EXTRACT_CAP)
  const ready = []
  for (const s of queue) {
    try {
      const body = fullText.get(s.id) ?? articleText(await fetchText(s.link))
      const excerpt = evidenceSentences(body, lexicon)
      if (excerpt.length < 80) { s.ex = 'no-evidence-sentences'; continue }
      ready.push({ s, excerpt })
    } catch (e) { s.ex = 'fetch-failed'; log(`extract: ${s.outlet} article not fetched (${e.message})`) }
  }
  const rubric = EXTRACT_RUBRIC(themes, maps, criteria)
  let made = 0, refused = 0
  for (let i = 0; i < ready.length; i += EXTRACT_BATCH) {
    const batch = ready.slice(i, i + EXTRACT_BATCH)
    try {
      const out = parseExtract(await runCli(rubric + batch.map((b) => extractBlock(b.s, b.excerpt)).join('\n\n')), new Set(batch.map((b) => b.s.id)), themes, maps, criteria)
      for (const { s, excerpt } of batch) {
        let n = 0
        for (const c of out.filter((c) => c.sid === s.id).slice(0, 3)) {
          const g = guard(c, `${s.title}. ${excerpt}`)
          if (!g.ok) { refused++; cands.rejected.push({ sid: s.id, title: c.title, value: c.value, reason: g.reason, at: now }); continue }
          const m = matchCandidate(c, pack.facts)
          if (m.kind === 'duplicate') { refused++; cands.rejected.push({ sid: s.id, title: c.title, value: c.value, reason: `duplicate of ${m.factId}`, at: now }); continue }
          if (cands.candidates.some((o) => o.title.toLowerCase() === c.title.toLowerCase() && o.value === c.value)) continue
          cands.candidates.push({ id: `C-${s.id}-${++n}`, ...c, t1: s.as.t1, use: s.as.use, match: m, story: { id: s.id, outlet: s.outlet, title: s.title, link: s.link, at: s.at, lang: s.lang }, status: 'pending', extractedAt: new Date(now).toISOString() })
          made++
        }
        s.ex = n ? `ok:${n}` : 'none'
      }
    } catch (e) { log(`extract: batch failed (${e.message})`); break }
  }
  cands.rejected = cands.rejected.slice(-300)
  log(`extract: ${ready.length} stories read, ${made} candidates, ${refused} refused by guards or as duplicates`)
}

// ── write ────────────────────────────────────────────────────────────────────
writeFileSync('news/store/stories.json', JSON.stringify(store))
writeFileSync('news/store/candidates.json', JSON.stringify(cands, null, 1))

if (all.some((s) => s.as)) assessMode = 'cli'
mkdirSync('public/news', { recursive: true })
const slim = (s) => ({ id: s.id, o: s.outlet, l: s.lang, g: s.group, k: s.kind, t: s.title, u: s.link, at: s.at, sn: s.snippet, c: s.cluster ?? undefined, n: s.outlets > 1 ? s.outlets : undefined, ps: { s: s.ps.score, b: s.ps.badges, f: s.ps.flags, th: s.ps.themes, m: s.ps.maps }, as: s.as ? { ...s.as, via: undefined } : undefined })
const byDay = new Map()
for (const s of all) byDay.set(pktDay(s.at), [...(byDay.get(pktDay(s.at)) ?? []), s])
const days = [...byDay.keys()].sort().reverse().slice(0, KEEP_DAYS)
for (const f of readdirSync('public/news')) if (/^\d{4}-\d\d-\d\d\.json$/.test(f) && !days.includes(f.slice(0, 10))) unlinkSync(`public/news/${f}`)
for (const d of days) writeFileSync(`public/news/${d}.json`, JSON.stringify(byDay.get(d).sort((a, b) => b.at - a.at).map(slim)))
writeFileSync('public/news/index.json', JSON.stringify({
  updatedAt: new Date(now).toISOString(),
  assessMode,
  days: days.map((d) => ({ date: d, count: byDay.get(d).length, kept: byDay.get(d).filter((s) => s.as?.keep).length })),
  health: health.map((h) => ({ id: h.id, name: h.name, lang: h.lang, ok: h.ok, items: h.items, newest: h.newest, note: h.note })),
  unavailable: disabled.map((d) => ({ name: d.name, reason: d.disabled })),
  labels: { rule: criteria.rule, flag: criteria.flag, roles: criteria.roles, papers: criteria.papers, maps: Object.fromEntries(maps.map((m) => [m.id, m.title])) },
}))
const pending = cands.candidates.filter((c) => c.status === 'pending')
writeFileSync('public/packs/candidates.json', JSON.stringify({ updatedAt: new Date(now).toISOString(), candidates: pending }))

log(`done: ${all.length} stories over ${days.length} days, ${pending.length} candidates pending review, CLI calls ${usage.calls}, ~${estTokens()} tokens this run`)
