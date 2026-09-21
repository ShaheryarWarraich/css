// Usage: npm run ingest  (or: tsx tools/ingest.ts path/to/sheet.xlsx [pack-id])
// Excel workbook → public/packs/<id>.json + docs/validation-report.md
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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
