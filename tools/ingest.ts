// Usage: npm run ingest  (or: tsx tools/ingest.ts path/to/sheet.xlsx [pack-id])
// Excel workbook → public/packs/<id>.json + docs/validation-report.md
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { buildPack } from '../src/content/normalize'

const file = process.argv[2]
const id = process.argv[3] ?? 'core'
if (!file) {
  console.error('usage: tsx tools/ingest.ts <workbook.xlsx> [pack-id]')
  process.exit(1)
}

const wb = XLSX.read(readFileSync(file), { type: 'buffer' })
const pack = buildPack(wb, id, 'CSS Evidence Bank')

// Reviewer-approved Layer-B content (see tools/apply-review.mjs) overrides the workbook's boilerplate.
const OVR = 'content/overrides/layer-b.json'
if (existsSync(OVR)) {
  const overrides = JSON.parse(readFileSync(OVR, 'utf8')) as Record<string, { qualification?: string; pairsWith?: string[]; memoryHook?: string; useAgainst?: string; deploy?: string }>
  let n = 0
  for (const f of pack.facts) {
    const o = overrides[f.id]
    if (!o) continue
    if (o.qualification) f.qualification = o.qualification
    if (o.pairsWith?.length) f.pairsWith = o.pairsWith
    if (o.memoryHook) f.memoryHook = o.memoryHook
    if (o.useAgainst) f.useAgainst = o.useAgainst
    if (o.deploy) f.deploy = o.deploy
    n++
  }
  console.log(`${n} facts carry reviewer-approved Layer-B content`)
}

// Reviewer-approved facts extracted from the news (see news/run.mjs and tools/apply-review.mjs).
const ADD = 'content/additions/news-facts.json'
if (existsSync(ADD)) {
  const { facts: extra } = JSON.parse(readFileSync(ADD, 'utf8')) as { facts: any[] }
  const byId = new Map(pack.facts.map((f) => [f.id, f]))
  let added = 0
  let updated = 0
  for (const a of extra) {
    const status = a.primaryChecked ? `Verified against primary source by ${a.reviewer}` : `Reported by ${a.reportedBy}; verify against ${a.src || 'the primary source'}`
    const source = a.src ? `${a.src} (reported by ${a.reportedBy})` : a.reportedBy
    const caution = [a.method, ...(a.cautions ?? []).map((c: string) => ({ DENOM: 'Check the denominator before comparing.', DEF: 'Definition-sensitive: state which definition.', STOCKFLOW: 'Keep stock and flow figures separate.', IMF: 'Commitment, disbursement and outstanding credit are different.', RANK: 'A rank change may reflect other countries.', CAUSAL: 'Association, not proven cause.', HIST: 'Historical figure, not current.' })[c])].filter(Boolean).join(' ')
    const old = byId.get(a.id)
    if (a.op === 'update' && old) {
      Object.assign(old, { value: a.value, period: a.period || old.period, source, sourceUrl: a.reportedUrl, proves: a.proves || old.proves, qualification: caution || old.qualification, verification: a.primaryChecked ? 'verified' : 'needs-audit', verificationNote: status })
      old.titleIsValue = false
      updated++
      continue
    }
    if (old) continue
    pack.facts.push({
      id: a.id, theme: a.theme, category: a.theme, title: a.title, value: a.value, titleIsValue: false, period: a.period || undefined,
      source, sourceUrl: a.reportedUrl, evidenceType: a.type, role: a.role, priority: a.t1 ? 'A' : 'B', tier: a.t1 ? 1 : 3, tags: a.tags ?? [],
      proves: a.proves, deploy: '', qualification: caution || undefined, pairsWith: a.conflictWith ? [a.conflictWith] : [], chainIds: a.map ? [a.map] : [],
      verification: a.primaryChecked ? 'verified' : 'needs-audit', verificationNote: status,
    })
    const chain = pack.chains.find((c) => c.id === a.map)
    if (chain && !chain.evidenceIds.includes(a.id)) chain.evidenceIds.push(a.id)
    added++
  }
  console.log(`news facts: ${added} added, ${updated} updated`)
}

mkdirSync('public/packs', { recursive: true })
writeFileSync(`public/packs/${id}.json`, JSON.stringify(pack))

const count = <T>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, number>()
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
const table = (rows: [string, number][]) => ['| | Count |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join('\n')

const byCode = count(pack.issues, (i) => `${i.level}: ${i.code}`)
const report = `# Validation report — ${id}

Built ${pack.builtAt} from \`${file}\`.

**${pack.facts.length}** facts · **${pack.chains.length}** chains and maps · **${pack.quotes.length}** quotes · **${pack.questions.length}** past-paper questions

## Issues by type
${table(byCode)}

## Facts by theme
${table(count(pack.facts, (f) => f.theme))}

## Facts by tier
${table(count(pack.facts, (f) => 'Tier ' + f.tier))}

## Facts by verification status
${table(count(pack.facts, (f) => f.verification))}

## Errors and warnings
${pack.issues.filter((i) => i.level !== 'info').map((i) => `- **${i.level}** \`${i.code}\` ${i.ref}: ${i.message}`).join('\n') || 'None.'}
`
writeFileSync('docs/validation-report.md', report)

console.log(`${pack.facts.length} facts, ${pack.chains.length} chains/maps, ${pack.quotes.length} quotes, ${pack.questions.length} questions`)
for (const [k, v] of byCode) console.log(`  ${String(v).padStart(4)}  ${k}`)
if (pack.issues.some((i) => i.code === 'no-evidence-sheet')) process.exit(1)
