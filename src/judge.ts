// Optional LLM judgment for free-text answers, via the local bridge (tools/judge-bridge.mjs).
// Without a bridge the learner self-checks against the model answer.
export interface Verdict {
  score: 0 | 0.5 | 1
  feedback: string
}

export async function judge(url: string, input: { stem: string; ask: string; reference: string; answer: string }): Promise<Verdict> {
  const res = await fetch(url.replace(/\/$/, '') + '/judge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
  if (!res.ok) throw new Error(`Judge bridge returned ${res.status}`)
  const v = await res.json()
  if (![0, 0.5, 1].includes(v.score)) throw new Error('Judge returned an unreadable verdict')
  return v
}

export async function pingJudge(url: string): Promise<boolean> {
  try {
    return (await fetch(url.replace(/\/$/, '') + '/health')).ok
  } catch {
    return false
  }
}
