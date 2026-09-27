// Merges reviewer decision files (downloaded from the app's Review screen) into the content.
//   node tools/apply-review.mjs content/reviews/*.json
// Writes content/overrides/layer-b.json (applied by `npm run ingest`) and marks the shipped
// proposals as decided so other devices no longer see them as pending.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const files = process.argv.slice(2)
if (!files.length) { console.error('usage: node tools/apply-review.mjs <review.json>...'); process.exit(1) }

const OVR = 'content/overrides/layer-b.json'
const ADD = 'content/additions/news-facts.json'
const STORE = 'news/store/candidates.json'
const PROPS = 'content/proposals/tier1-pass-1.json'
const overrides = existsSync(OVR) ? JSON.parse(readFileSync(OVR, 'utf8')) : {}
const props = JSON.parse(readFileSync(PROPS, 'utf8'))
const byId = new Map(props.proposals.map((p) => [p.id, p]))
let applied = 0, rejected = 0, added = 0, updated = 0
const additions = existsSync(ADD) ? JSON.parse(readFileSync(ADD, 'utf8')) : { facts: [] }
const store = existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')) : null
const day = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '')

for (const file of files) {
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  if (doc.format !== 'css-os-review') { console.error(`${file}: not a review file`); continue }
  for (const c of doc.candidates ?? []) {
    const inStore = store?.candidates.find((x) => x.id === c.id)
    if (inStore) inStore.status = c.status
    additions.facts = additions.facts.filter((f) => f.candidateId !== c.id)
    if (c.status === 'rejected') continue
    const v = { title: c.title, value: c.value, period: c.period, src: c.src, proves: c.proves, method: c.method, theme: c.theme, ...(c.edited ?? {}) }
    const stamp = day(c.story.at)
    const n = additions.facts.filter((f) => f.id.startsWith(`N-${stamp}-`)).length + 1
    const isUpdate = c.match.kind === 'update' && c.match.factId && !c.asNew
    additions.facts.push({
      id: isUpdate ? c.match.factId : `N-${stamp}-${String(n).padStart(2, '0')}`,
      op: isUpdate ? 'update' : 'add',
      candidateId: c.id,
      ...v,
      type: c.type, role: c.role, tags: c.tags, map: c.map, cautions: c.cautions, t1: c.t1 ?? 0, conflictWith: c.match.kind === 'conflict' ? c.match.factId : undefined,
      reportedBy: c.story.outlet, reportedUrl: c.story.link, reportedAt: c.story.at, quote: c.quote,
      primaryChecked: !!c.primaryChecked, reviewer: c.reviewer, note: c.note, decidedAt: c.decidedAt,
    })
    isUpdate ? updated++ : added++
  }
  for (const d of doc.decisions ?? []) {
    const p = byId.get(d.id)
    if (p) Object.assign(p, { status: d.status, edited: d.edited, note: d.note, reviewer: d.reviewer, decidedAt: d.decidedAt })
    if (d.status === 'rejected') { delete overrides[d.factId]; rejected++; continue }
    const v = d.edited ?? d.field
    overrides[d.factId] = { qualification: v.qualification, pairsWith: v.pairsWith, memoryHook: v.hook, useAgainst: v.useAgainst, deploy: v.deploy, reviewer: d.reviewer, note: d.note, decidedAt: d.decidedAt }
    applied++
  }
}
mkdirSync('content/overrides', { recursive: true })
writeFileSync(OVR, JSON.stringify(overrides, null, 1))
props.updatedAt = new Date().toISOString()
writeFileSync(PROPS, JSON.stringify(props, null, 1))
writeFileSync('public/packs/proposals.json', JSON.stringify(props))
mkdirSync('content/additions', { recursive: true })
writeFileSync(ADD, JSON.stringify(additions, null, 1))
if (store) {
  writeFileSync(STORE, JSON.stringify(store, null, 1))
  writeFileSync('public/packs/candidates.json', JSON.stringify({ updatedAt: new Date().toISOString(), candidates: store.candidates.filter((c) => c.status === 'pending') }))
}
console.log(`${applied} Tier 1 overrides applied, ${rejected} rejected; news facts: ${added} added, ${updated} updates. Now run: npm run ingest`)
