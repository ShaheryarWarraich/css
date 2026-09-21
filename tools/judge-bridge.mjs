// Local judge bridge: lets the app on this machine ask your own LLM CLI to check a free-text answer.
// Runs on your subscription; nothing leaves your computer except the CLI's own call.
//   npm run judge
//   JUDGE_CMD="gemini -p" npm run judge        (any CLI that reads a prompt on stdin and prints text)
//   ALLOWED_ORIGINS="https://you.github.io" npm run judge
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'

const PORT = Number(process.env.PORT ?? 8787)
const [CMD, ...ARGS] = (process.env.JUDGE_CMD ?? 'claude -p').split(' ')
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173').split(',')

const PROMPT = ({ stem, ask, reference, answer }) => `You are checking a CSS (Pakistan civil service exam) aspirant's short recall answer. Be strict about substance, lenient about wording.

PROMPT SHOWN TO LEARNER: ${stem}
TASK: ${ask}
REFERENCE ANSWER (from the verified evidence bank; treat as ground truth): ${reference}
LEARNER'S ANSWER: ${answer}

Rules:
- score 1: the core claim of the reference is present and nothing stated contradicts it.
- score 0.5: partly right, vague, or missing the key mechanism/figure.
- score 0: wrong, empty, or contradicts the reference.
- Do not reward length. Do not reward copying the reference wording; own words are better.
- If the learner states any figure that contradicts the reference, say so.
- feedback: at most 2 sentences, addressed to the learner, naming the single most useful fix. Never write a model answer for them.

Reply with JSON only: {"score": 0|0.5|1, "feedback": "..."}`

function run(prompt) {
  return new Promise((resolve, reject) => {
    const p = spawn(CMD, ARGS, { stdio: ['pipe', 'pipe', 'pipe'] }) // no shell: learner text is never interpreted
    let out = ''
    let err = ''
    const timer = setTimeout(() => (p.kill(), reject(new Error('judge timed out'))), 90_000)
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (code) => (clearTimeout(timer), code === 0 ? resolve(out) : reject(new Error(err || `exit ${code}`))))
    p.stdin.end(prompt)
  })
}

createServer(async (req, res) => {
  const origin = req.headers.origin ?? ''
  const ok = ALLOWED.includes(origin)
  if (ok) {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('access-control-allow-headers', 'content-type')
    res.setHeader('vary', 'origin')
  }
  if (req.method === 'OPTIONS') return res.writeHead(ok ? 204 : 403).end()
  if (req.url === '/health') return res.writeHead(200).end('ok')
  if (req.method !== 'POST' || req.url !== '/judge') return res.writeHead(404).end()
  if (!ok) return res.writeHead(403).end('origin not allowed') // other websites must not spend your subscription
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 20_000) return res.writeHead(413).end()
  }
  try {
    const input = JSON.parse(body)
    const text = await run(PROMPT(input))
    const m = text.match(/\{[\s\S]*\}/)
    const v = JSON.parse(m ? m[0] : text)
    const score = [0, 0.5, 1].includes(v.score) ? v.score : 0
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ score, feedback: String(v.feedback ?? '') }))
  } catch (e) {
    res.writeHead(500).end(String(e.message ?? e))
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Judge bridge on http://127.0.0.1:${PORT} using "${CMD} ${ARGS.join(' ')}". Allowed origins: ${ALLOWED.join(', ')}`))
