// Merges reviewer decision files (downloaded from the app's Review screen) into the content.
//   node tools/apply-review.mjs content/reviews/*.json
// Writes content/overrides/layer-b.json (applied by `npm run ingest`) and marks the shipped
// proposals as decided so other devices no longer see them as pending.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const files = process.argv.slice(2)
if (!files.length) { console.error('usage: node tools/apply-review.mjs <review.json>...'); process.exit(1) }

const OVR = 'content/overrides/layer-b.json'
const PROPS = 'content/proposals/tier1-pass-1.json'
const overrides = existsSync(OVR) ? JSON.parse(readFileSync(OVR, 'utf8')) : {}
const props = JSON.parse(readFileSync(PROPS, 'utf8'))
const byId = new Map(props.proposals.map((p) => [p.id, p]))
let applied = 0, rejected = 0

for (const file of files) {
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  if (doc.format !== 'css-os-review') { console.error(`${file}: not a review file`); continue }
  for (const d of doc.decisions) {
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
console.log(`${applied} overrides applied, ${rejected} rejected. Now run: npm run ingest`)
