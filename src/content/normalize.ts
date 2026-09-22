// Turns an evidence-bank workbook into a validated content pack.
// Runs both in Node (tools/ingest.ts) and in the browser (learner imports a new sheet).
import * as XLSX from 'xlsx'
import type { Chain, Fact, Issue, Pack, PastQuestion, Quote, Verification } from './types'
import { salientNumber } from './numeric'

type Row = Record<string, string>

const THEMES: [string, RegExp][] = [
  ['CSS Meta', /css meta|past-?paper|method/i],
  ['Constitution & Law', /constitution|legal|law\b|judici|justice|rule of law/i],
  ['Criminology', /criminolog|prison|crime|police/i],
  ['Gender', /gender|women/i],
  ['Education', /educat|school|literacy|learning/i],
  ['Health', /health|nutrition|stunting|immuni[sz]|vaccin|wash\b/i],
  ['Water & Food', /water|food|agricult|irrigation/i],
  ['Environment & Climate', /climate|environment|pollution|flood|disaster/i],
  ['Energy', /energy|power sector|electric|circular debt/i],
  ['Technology & Digital', /tech|digital|telecom|cyber|it\b|ai\b/i],
  ['Poverty & Social Protection', /poverty|social protection|bisp|inequal|human development/i],
  ['Labour & Population', /labou?r|employment|population|demograph|youth|migration|census|social statistics|urbani[sz]/i],
  ['Security', /security|terror|defen[cs]e|nuclear|milit/i],
  ['IR & Foreign Policy', /\bir\b|international|foreign|regional|china|india|afghan|cpec|refugee|trade/i],
  ['Democracy & Rights', /democra|election|rights|media|press|civic|parliament/i],
  ['Governance & Public Admin', /governance|public admin|devolution|federal|local government|corruption|civil service|institution|reform|fiscal federalism/i],
  ['Economy', /econom|fiscal|tax|debt|imf|monetary|inflation|export|invest|finance|budget|industry|growth|external sector|structural|development strategy|remittanc/i],
]

function themeOf(category: string, tags: string): string {
  for (const [name, re] of THEMES) if (re.test(category)) return name
  for (const [name, re] of THEMES) if (re.test(tags)) return name
  return 'Other'
}

const BOILERPLATE = [
  /^use with other records sharing the same css tags\.?$/i,
  /^check definition, year, denominator and source before comparing/i,
  /^preserve source definition\/year; avoid causal overclaim\.?$/i,
]
const isBoilerplate = (s: string) => BOILERPLATE.some((re) => re.test(s.trim()))

const clean = (v: unknown) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const key = wb.SheetNames.find((n) => n.trim().toLowerCase() === name.toLowerCase())
  if (!key) return []
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[key], { header: 1, raw: false, defval: '' })
  if (!grid.length) return []
  const hdr = grid[0].map(clean)
  return grid
    .slice(1)
    .filter((r) => r.some((c) => clean(c)))
    .map((r) => Object.fromEntries(hdr.map((h, i) => [h, clean(r[i])])))
}

/** "E280; E293; E344-E354" → individual IDs */
export function expandRefs(s: string): string[] {
  const out: string[] = []
  for (const part of s.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^E(\d+)\s*[-–]\s*E?(\d+)$/)
    if (m) {
      const a = Number(m[1])
      const b = Number(m[2])
      if (b >= a && b - a < 200) for (let i = a; i <= b; i++) out.push('E' + String(i).padStart(3, '0'))
    } else if (/^[A-Z]+-?\d+$/i.test(part)) out.push(part)
  }
  return out
}

const splitLinks = (s: string) => s.split(/→|->/).map((x) => x.trim()).filter(Boolean)
const splitList = (s: string) => s.split(/[;,]/).map((x) => x.trim()).filter(Boolean)

function verificationOf(s: string): Verification {
  if (/needs|reverify|verify exact|before memorization|before exam/i.test(s)) return 'needs-audit'
  if (/^verified( |$)(?!in source set)/i.test(s) && !/pending/i.test(s)) return 'verified'
  return 'source-set'
}

export function buildPack(wb: XLSX.WorkBook, id: string, name: string): Pack {
  const issues: Issue[] = []
  const issue = (level: Issue['level'], code: string, ref: string, message: string) =>
    issues.push({ level, code, ref, message })

  const rows = sheetRows(wb, 'Evidence Bank')
  if (!rows.length) issue('error', 'no-evidence-sheet', '-', 'No "Evidence Bank" sheet with rows was found.')

  const facts: Fact[] = []
  const questions: PastQuestion[] = []
  const seenIds = new Set<string>()
  const seenContent = new Map<string, string>()

  for (const r0 of rows) {
    let r = r0
    const rid = r['ID']
    if (!rid) {
      issue('error', 'missing-id', r['Title'] || '?', 'Row has no ID and was skipped.')
      continue
    }
    // Repair rows where "Year / Period" is missing and later columns slid one to the left.
    if (!/^[ABC]$/.test(r['Priority']) && /^[ABC]$/.test(r['Evidence Type'])) {
      r = {
        ...r,
        'Year / Period': '',
        Source: r['Year / Period'],
        'Evidence Type': r['Source'],
        Priority: r['Evidence Type'],
        'CSS Tags': r['Priority'],
        'Argument / Use': r['CSS Tags'],
        'Source URL': r['Argument / Use'],
      }
      issue('warn', 'shifted-columns', rid, 'Columns were shifted one to the left; repaired automatically. Fix in the sheet.')
    }
    if (seenIds.has(rid)) {
      issue('error', 'duplicate-id', rid, 'Duplicate ID; later row skipped.')
      continue
    }
    seenIds.add(rid)

    const title = r['Title']
    const value = r['Value / Text']
    if (!title || !value) {
      issue('error', 'missing-field', rid, 'Title or Value / Text is empty; row skipped.')
      continue
    }

    if (/past-?paper/i.test(r['Evidence Type'])) {
      questions.push({ id: rid, text: value, period: r['Year / Period'] || undefined, tags: splitList(r['CSS Tags']) })
      continue
    }

    const ckey = (title + '|' + value).toLowerCase()
    if (seenContent.has(ckey)) issue('warn', 'duplicate-content', rid, `Same title and value as ${seenContent.get(ckey)}.`)
    else seenContent.set(ckey, rid)

    if (!r['Source']) issue('error', 'no-source', rid, 'No source. Principle: no source, no card.')
    if (!r['Source URL']) issue('info', 'no-url', rid, 'No source URL.')
    if (!r['Year / Period']) issue('info', 'no-period', rid, 'No year / period.')
    let priority = r['Priority'] as Fact['priority']
    if (!/^[ABC]$/.test(priority)) {
      issue('warn', 'bad-priority', rid, `Priority "${r['Priority']}" is not A/B/C; treated as B.`)
      priority = 'B'
    }

    const qual = r['Counterargument / Qualification']
    const pairs = r['Pairs With']
    const isUrl = (x: string) => /^https?:\/\//i.test(x)
    const proves = [r['What It Proves'], r['Primary Argument'], r['Argument / Use']].find((x) => x && !isUrl(x)) ?? ''
    if (!proves) issue('warn', 'no-argument', rid, 'No "What It Proves" / argument text; Layer B drills are unavailable for this row.')
    if (qual && isBoilerplate(qual)) issue('info', 'boilerplate-qualification', rid, 'Counterargument / Qualification is generic boilerplate.')

    const bench = {
      standard: r['Benchmark / Global Standard'] || undefined,
      value: r['Benchmark Value'] || undefined,
      lmic: r['LMIC Comparison'] || undefined,
      peer: r['Comparator / Peer'] || undefined,
      gap: r['Comparison Gap'] || undefined,
    }
    const t = title.replace(/[.…]+$/, '').toLowerCase()
    facts.push({
      id: rid,
      theme: themeOf(r['Category'], r['CSS Tags']),
      category: r['Category'],
      title,
      value,
      titleIsValue: value.toLowerCase().startsWith(t.slice(0, 40)),
      period: r['Year / Period'] || undefined,
      source: r['Source'],
      sourceUrl: r['Source URL'] || undefined,
      evidenceType: r['Evidence Type'],
      role: r['Evidence Role'] || 'Supporting Evidence',
      priority,
      tier: 3,
      tags: splitList(r['CSS Tags']),
      proves,
      // 496 of 591 rows carry a generated sentence ("Use X (value) to support the claim that <proves>"): it repeats
      // 'proves' and is dropped rather than shown as a model sentence.
      deploy: /https?:\/\//i.test(r['How to Deploy']) || /^Use .{0,200} to support the claim that /i.test(r['How to Deploy']) ? '' : r['How to Deploy'],
      whyItMatters: r['Why It Matters'] && r['Why It Matters'].trim() !== proves.trim() ? r['Why It Matters'] : undefined,
      qualification: qual && !isBoilerplate(qual) ? qual : undefined,
      theoryLink: r['Theory / Legal Link'] || undefined,
      benchmark: Object.values(bench).some(Boolean) ? bench : undefined,
      pairsWith: pairs && !isBoilerplate(pairs) ? expandRefs(pairs) : [],
      chainIds: r['Argument Map ID'] ? [r['Argument Map ID']] : [],
      verification: verificationOf(r['Verification Status']),
      verificationNote: r['Verification Status'],
    })
  }

  const byId = new Map(facts.map((f) => [f.id, f]))
  const chains: Chain[] = []
  const addChain = (c: Chain, refs: string[]) => {
    const missing = refs.filter((e) => !byId.has(e))
    if (missing.length)
      issue('warn', 'dangling-ref', c.id, `${missing.length} of ${refs.length} evidence IDs do not exist: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`)
    c.evidenceIds = refs.filter((e) => byId.has(e))
    for (const e of c.evidenceIds) {
      const f = byId.get(e)!
      if (!f.chainIds.includes(c.id)) f.chainIds.push(c.id)
    }
    if (c.links.length < 3) issue('info', 'short-chain', c.id, 'Fewer than 3 links; ordering drill is skipped for this chain.')
    chains.push(c)
  }
  for (const r of sheetRows(wb, 'Argument Chains')) {
    if (!r['Argument Chain ID']) continue
    addChain(
      { id: r['Argument Chain ID'], kind: 'chain', title: r['Argument Chain'], links: splitLinks(r['Argument Chain']), evidenceIds: [], subjects: splitList(r['Subjects']), coreLogic: r['Core Logic'] || undefined },
      expandRefs(r['Evidence IDs']),
    )
  }
  for (const r of sheetRows(wb, 'Argument Maps')) {
    if (!r['Map ID']) continue
    addChain(
      { id: r['Map ID'], kind: 'map', title: r['Title'], links: splitLinks(r['Causal Chain']), evidenceIds: [], subjects: splitList(r['CSS Use']), counter: r['Counterargument / Qualification'] || undefined, policy: r['Policy / Solution Chain'] ? r['Policy / Solution Chain'].split('+').map((x) => x.trim()) : undefined },
      expandRefs(r['Evidence IDs']),
    )
  }

  const quotes: Quote[] = []
  for (const r of sheetRows(wb, 'Quotes Bank')) {
    if (!r['Quote ID']) continue
    const refs = expandRefs(r['Pairs With'])
    const missing = refs.filter((e) => !byId.has(e))
    if (missing.length) issue('warn', 'dangling-ref', r['Quote ID'], `Evidence IDs do not exist: ${missing.join(', ')}`)
    quotes.push({ id: r['Quote ID'], author: r['Author'], text: r['Exact Quote'], year: r['Year'] || undefined, argument: r['Primary Argument'], evidenceIds: refs.filter((e) => byId.has(e)), deploy: r['How to Deploy'] || undefined, source: r['Source'] || undefined })
  }

  // Tiering: Priority alone cannot rank (most rows are A), so score by argument reach and usability.
  const score = (f: Fact) =>
    f.chainIds.filter((c) => c.startsWith('AC')).length * 2 +
    f.chainIds.filter((c) => c.startsWith('AM')).length * 2 +
    (f.priority === 'A' ? 1 : 0) +
    (f.benchmark ? 1 : 0) +
    (salientNumber(f.value) ? 1 : 0) +
    (f.verification === 'verified' ? 1 : 0) -
    (f.verification === 'needs-audit' ? 2 : 0)
  const ranked = facts.map((f, i) => ({ f, s: score(f), i })).sort((a, b) => b.s - a.s || a.i - b.i)
  ranked.forEach(({ f }, rank) => (f.tier = rank < 150 ? 1 : rank < 350 ? 2 : 3))

  return { id, name, builtAt: new Date().toISOString(), facts, chains, quotes, questions, issues }
}
