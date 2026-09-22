// Second pass over existing proposals: drafts a model sentence in the reviewer's language,
// worded differently from "proves", using only the fact and its approved-candidate pairings.
//   node tools/enrich-deploy.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const OUT = 'content/proposals/tier1-pass-1.json'
const [CMD, ...CMD_ARGS] = (process.env.ENRICH_CMD ?? 'claude -p').split(' ')
const pack = JSON.parse(readFileSync('public/packs/core.json', 'utf8'))
const byId = new Map(pack.facts.map((f) => [f.id, f]))
const doc = JSON.parse(readFileSync(OUT, 'utf8'))
const todo = doc.proposals.filter((p) => !p.field.deploy && byId.has(p.factId))
console.log(`${todo.length} proposals need a model sentence`)

const brief = (f) => `${f.id} | ${f.titleIsValue ? f.value : f.title + ': ' + f.value}${f.period ? ' (' + f.period + ')' : ''} | ${f.source}`
const nums = (s) => new Set([...String(s).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, '')))

const prompt = (batch) => `You are drafting, for Pakistan CSS exam candidates, ONE model sentence per fact showing how the fact could sit inside an argumentative paragraph. Candidates will see it only after answering, as a pattern to learn from, never to copy.

Rules:
- 1–2 sentences, 25–45 words, written the way a strong candidate writes: claim first, then the figure with its source and year as support, optionally one paired fact.
- Must NOT begin with "Use", must NOT restate the "Proves" line, must NOT be a generic instruction.
- Use ONLY figures that appear in the fact or its paired facts below. Do not add any other number, name or event.
- Vary sentence shapes across facts.

Reply with a JSON array only: [{"id": "...", "deploy": "..."}]

${batch
  .map((p) => {
    const f = byId.get(p.factId)
    const pairs = p.field.pairsWith.map((id) => byId.get(id)).filter(Boolean)
    return `### ${brief(f)}\nProves: ${f.proves}\nCaveat: ${p.field.qualification}\nPaired facts:\n${pairs.map(brief).join('\n') || '(none)'}`
  })
  .join('\n\n')}`

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

const save = () => {
  doc.updatedAt = new Date().toISOString()
  writeFileSync(OUT, JSON.stringify(doc, null, 1))
  writeFileSync('public/packs/proposals.json', JSON.stringify(doc))
}

const batches = []
for (let i = 0; i < todo.length; i += 8) batches.push(todo.slice(i, i + 8))
const lanes = Array.from({ length: 3 }, (_, k) => batches.filter((_, i) => i % 3 === k))
await Promise.all(
  lanes.map(async (mine) => {
    for (const batch of mine) {
      try {
        const text = await run(prompt(batch))
        const arr = JSON.parse((text.match(/\[[\s\S]*\]/) ?? [text])[0])
        for (const p of batch) {
          const d = arr.find((x) => x.id === p.factId)
          if (!d?.deploy) continue
          const f = byId.get(p.factId)
          const allowed = new Set([...nums(f.title + ' ' + f.value + ' ' + (f.period ?? '')), ...p.field.pairsWith.flatMap((id) => [...nums(byId.get(id)?.value ?? '')])])
          const foreign = [...nums(d.deploy)].filter((n) => !allowed.has(n) && !/^(19|20)\d\d$/.test(n))
          if (/^use /i.test(d.deploy)) p.draftIssues.push('deploy starts with "Use"')
          if (foreign.length) p.draftIssues.push('deploy cites figures not in fact/pairs: ' + foreign.join(', '))
          p.field.deploy = d.deploy.trim()
        }
        console.log('✓ ' + batch.map((p) => p.factId).join(','))
      } catch (e) {
        console.log('✗ ' + batch.map((p) => p.factId).join(',') + ': ' + e.message)
      }
      save()
    }
  }),
)
save()
console.log('done')
