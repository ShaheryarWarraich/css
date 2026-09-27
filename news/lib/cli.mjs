// The only place the news module talks to a model: your own CLI, prompt on stdin, no shell.
import { spawn } from 'node:child_process'

const [CMD, ...ARGS] = (process.env.NEWS_CMD ?? 'claude -p').split(' ')
export const usage = { calls: 0, charsIn: 0, charsOut: 0 }
/** Rough token estimate: 4 characters per token for English, fewer for Urdu. Logged, never billed from. */
export const estTokens = () => Math.round((usage.charsIn + usage.charsOut) / 3.6)

export function runCli(prompt, timeoutMs = 240_000) {
  return new Promise((resolve, reject) => {
    const p = spawn(CMD, ARGS, { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => (p.kill(), reject(new Error('CLI timed out'))), timeoutMs)
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', (e) => (clearTimeout(timer), reject(e)))
    p.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error(err.trim() || `CLI exited ${code}`))
      usage.calls++
      usage.charsIn += prompt.length
      usage.charsOut += out.length
      resolve(out)
    })
    p.stdin.end(prompt)
  })
}

export function jsonArray(text) {
  const m = text.match(/\[[\s\S]*\]/)
  const v = JSON.parse(m ? m[0] : text)
  if (!Array.isArray(v)) throw new Error('expected a JSON array')
  return v
}
