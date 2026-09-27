// Approved news facts → an Excel file in the Master Sheet's column layout, so the workbook stays the authoring copy.
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import * as XLSX from 'xlsx'

const ADD = 'content/additions/news-facts.json'
if (!existsSync(ADD)) { console.log('No approved news facts yet.'); process.exit(0) }
const { facts } = JSON.parse(readFileSync(ADD, 'utf8'))
const COLS = ['ID', 'Category', 'Title', 'Value / Text', 'Year / Period', 'Source', 'Evidence Type', 'Priority', 'CSS Tags', 'Argument / Use', 'Source URL', 'Benchmark / Global Standard', 'Benchmark Value', 'LMIC Comparison', 'Comparator / Peer', 'Comparison Gap', 'Why It Matters', 'Optional Subject Relevance', 'Past-Paper Theme', 'What It Proves', 'Primary Argument', 'Evidence Role', 'How to Deploy', 'Pairs With', 'Counterargument / Qualification', 'Theory / Legal Link', 'Argument Map ID', 'Memory Hook', 'Verification Status']
const rows = facts.map((f) => ({
  ID: f.id, Category: f.theme, Title: f.title, 'Value / Text': f.value, 'Year / Period': f.period, Source: f.src ? `${f.src} (reported by ${f.reportedBy})` : f.reportedBy,
  'Evidence Type': f.type, Priority: f.t1 ? 'A' : 'B', 'CSS Tags': (f.tags ?? []).join('; '), 'Argument / Use': f.proves, 'Source URL': f.reportedUrl,
  'What It Proves': f.proves, 'Primary Argument': f.proves, 'Evidence Role': f.role, 'Pairs With': f.conflictWith ?? '', 'Counterargument / Qualification': [f.method, (f.cautions ?? []).join('; ')].filter(Boolean).join(' | '),
  'Argument Map ID': f.map, 'Verification Status': f.primaryChecked ? `Verified against primary source by ${f.reviewer}` : `Reported by ${f.reportedBy}; verify against primary source`,
}))
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, { header: COLS }), 'Evidence Bank')
mkdirSync('content/exports', { recursive: true })
const out = `content/exports/news-facts-${new Date().toISOString().slice(0, 10)}.xlsx`
XLSX.writeFile(wb, out)
console.log(`${rows.length} facts written to ${out}`)
