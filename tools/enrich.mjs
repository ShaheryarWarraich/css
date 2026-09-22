// Tier 1 content pass. Drafts, for each Tier 1 fact, the three Layer-B fields the workbook
// left as boilerplate: a real qualification, real pairings, and a memory hook.
// Drafts are PROPOSALS: nothing reaches learners until a reviewer approves them in the app.
//   node tools/enrich.mjs [--tier 1] [--limit N] [--ids E227,E235]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] ?? true] : [])).filter((x) => x.length))
const TIER = Number(args.tier ?? 1)
const LIMIT = Number(args.limit ?? 9999)
const ONLY = args.ids ? String(args.ids).split(',') : null
const BATCH = 8
const CONCURRENCY = 3
const OUT = 'content/proposals/tier1-pass-1.json'
const [CMD, ...CMD_ARGS] = (process.env.ENRICH_CMD ?? 'claude -p').split(' ')

const pack = JSON.parse(readFileSync('public/packs/core.json', 'utf8'))
const byId = new Map(pack.facts.map((f) => [f.id, f]))
const targets = pack.facts.filter((f) => f.tier === TIER && (!ONLY || ONLY.includes(f.id))).slice(0, LIMIT)

const prior = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).proposals : []
const done = new Set(prior.map((p) => p.factId))
const todo = targets.filter((f) => !done.has(f.id))
console.log(`Tier ${TIER}: ${targets.length} facts, ${todo.length} to draft`)

const brief = (f) => `${f.id} | ${f.titleIsValue ? f.value : f.title + ': ' + f.value}${f.period ? ' (' + f.period + ')' : ''} | ${f.source}`

function candidates(f) {
  const chains = new Set(f.chainIds)
  const pool = pack.facts.filter((x) => x.id !== f.id && (x.theme === f.theme || x.chainIds.some((c) => chains.has(c))))
  pool.sort((a, b) => a.tier - b.tier || (b.chainIds.some((c) => chains.has(c)) ? 1 : 0) - (a.chainIds.some((c) => chains.has(c)) ? 1 : 0))
  return pool.slice(0, 30)
}

const prompt = (facts) => `You are helping build an evidence bank for Pakistan's CSS exam (civil-service competitive exam). Examiners fail answers that use statistics as trivia, that overclaim, and that repeat stock phrases. For each fact below, draft three things a strong candidate would carry in their head.

For each fact return:
- "qualification": 1–2 sentences. What this figure does NOT prove, a definitional/denominator/year caveat specific to THIS indicator, or the strongest opposing evidence. Be concrete. Never write generic advice like "check the source" or "avoid overclaiming".
- "pairsWith": 2–3 IDs chosen ONLY from that fact's candidate list, which together with this fact make a stronger paragraph (cause + effect, national + comparison, problem + partial progress). Prefer pairs across different indicators over near-duplicates.
- "hook": a recall cue of at most 14 words in the pattern "figure → meaning", e.g. "22.7% → four in five working-age women outside the labour force". Vivid, exact, no clichés.
- "useAgainst": one sentence: the claim an examiner would expect this fact to be used to REBUT (a common but wrong assertion). Start with the wrong claim in quotes.

Do not invent figures. Everything must follow from the fact text given. Reply with a JSON array only, no prose:
[{"id": "...", "qualification": "...", "pairsWith": ["..."], "hook": "...", "useAgainst": "..."}]

FACTS:
${facts
  .map(
    (f) => `
### ${brief(f)}
Proves: ${f.proves}
${f.whyItMatters ? 'Why it matters: ' + f.whyItMatters + '\n' : ''}${f.benchmark ? 'Benchmark: ' + JSON.stringify(f.benchmark) + '\n' : ''}Candidates for pairsWith:
${candidates(f).map(brief).join('\n')}`,
  )
  .join('\n')}`

function run(text) {
  return new Promise((resolve, reject) => {
    const p = spawn(CMD, CMD_ARGS, { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => (p.kill(), reject(new Error('timeout'))), 300_000)
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (code) => (clearTimeout(timer), code === 0 ? resolve(out) : reject(new Error(err || `exit ${code}`))))
    p.stdin.end(text)
  })
}

function validate(f, d) {
  const cands = new Set(candidates(f).map((x) => x.id))
  const problems = []
  if (!d.qualification || d.qualification.length < 30) problems.push('qualification too short')
  if (/check (the )?(definition|source)|avoid (causal )?overclaim/i.test(d.qualification ?? '')) problems.push('generic qualification')
  const pairs = (d.pairsWith ?? []).filter((id) => cands.has(id))
  if (pairs.length < 1) problems.push('no valid pairings')
  if (!d.hook || d.hook.split(/\s+/).length > 18) problems.push('hook missing or too long')
  return { ok: problems.length === 0, problems, pairs }
}

const results = [...prior]
let failed = []
async function worker(batches) {
  for (const batch of batches) {
    const ids = batch.map((f) => f.id).join(',')
    try {
      const text = await run(prompt(batch))
      const m = text.match(/\[[\s\S]*\]/)
      const arr = JSON.parse(m ? m[0] : text)
      for (const f of batch) {
        const d = arr.find((x) => x.id === f.id)
        if (!d) { failed.push(f.id); continue }
        const v = validate(f, d)
        results.push({
          id: 'P-' + f.id,
          factId: f.id,
          field: { qualification: d.qualification?.trim() ?? '', pairsWith: v.pairs, hook: d.hook?.trim() ?? '', useAgainst: d.useAgainst?.trim() ?? '' },
          draftIssues: v.problems,
          status: 'pending',
          draftedAt: new Date().toISOString(),
        })
      }
      console.log(`✓ ${ids}`)
    } catch (e) {
      console.log(`✗ ${ids}: ${e.message}`)
      failed.push(...batch.map((f) => f.id))
    }
    save()
  }
}
function save() {
  mkdirSync('content/proposals', { recursive: true })
  const doc = { pass: 'tier1-pass-1', generatedWith: `${CMD} ${CMD_ARGS.join(' ')}`.trim(), updatedAt: new Date().toISOString(), proposals: results }
  writeFileSync(OUT, JSON.stringify(doc, null, 1))
  writeFileSync('public/packs/proposals.json', JSON.stringify(doc))
}

const batches = []
for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH))
const lanes = Array.from({ length: CONCURRENCY }, (_, k) => batches.filter((_, i) => i % CONCURRENCY === k))
await Promise.all(lanes.map(worker))
save()
console.log(`done: ${results.length} proposals, ${failed.length} failed${failed.length ? ' (' + failed.join(',') + ')' : ''}`)
