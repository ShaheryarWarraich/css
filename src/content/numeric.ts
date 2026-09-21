// Finding, blanking, varying and grading the numbers inside evidence text.

export interface NumToken {
  raw: string
  n: number
  start: number
  end: number
  decimals: number
  hasComma: boolean
}

const NUM_RE = /\d[\d,]*(?:\.\d+)?/g

export function findNumbers(text: string): NumToken[] {
  const out: NumToken[] = []
  for (const m of text.matchAll(NUM_RE)) {
    const raw = m[0].replace(/,$/, '')
    const n = Number(raw.replace(/,/g, ''))
    if (!Number.isFinite(n)) continue
    const start = m.index!
    out.push({
      raw,
      n,
      start,
      end: start + raw.length,
      decimals: raw.includes('.') ? raw.split('.')[1].length : 0,
      hasComma: raw.includes(','),
    })
  }
  return out
}

function looksLikeYear(t: NumToken, text: string): boolean {
  if (t.decimals || t.hasComma) return false
  if (t.n < 1900 || t.n > 2100) return false
  const after = text.slice(t.end, t.end + 2)
  return !/^\s?%/.test(after)
}

function isLabelNumber(t: NumToken, text: string): boolean {
  // "Article 25", "SDG 4", "FY2025", "5–16 population", "18th Amendment"
  const before = text.slice(Math.max(0, t.start - 10), t.start)
  const after = text.slice(t.end, t.end + 3)
  if (/(Article|Art\.|SDG|FY|CSS|Section|Goal|Q)\s?-?$/i.test(before)) return true
  if (/^(st|nd|rd|th)\b/.test(after)) return true
  if (/^[–-]\d/.test(after) || /\d[–-]$/.test(before)) return true
  return false
}

/** The number most worth memorising in a piece of evidence, or null if there is none. */
export function salientNumber(text: string): NumToken | null {
  const c = findNumbers(text).filter((t) => !looksLikeYear(t, text) && !isLabelNumber(t, text))
  if (!c.length) return null
  const pct = c.find((t) => /^\s?(%|per ?cent|pc\b)/i.test(text.slice(t.end, t.end + 9)))
  return pct ?? c[0]
}

export function clozeText(text: string, t: NumToken): string {
  return text.slice(0, t.start) + '_____' + text.slice(t.end)
}

export function formatLike(n: number, like: NumToken): string {
  const fixed = n.toFixed(like.decimals)
  if (!like.hasComma) return fixed
  const [i, d] = fixed.split('.')
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '')
}

/** Plausible wrong values in the same format. Deterministic for a given seed. */
export function numericDistractors(t: NumToken, seed: number, count = 3): string[] {
  const factors = [0.8, 1.25, 0.6, 1.5, 0.9, 1.12, 0.7] // near misses first, mixed above and below
  const out = new Set<string>()
  let i = seed
  let guard = 0
  while (out.size < count && guard++ < 40) {
    const f = factors[i++ % factors.length]
    let v = t.n * f
    if (t.decimals === 0) v = Math.round(v)
    const isPct = t.n <= 100 && t.n >= 0
    if (isPct && v > 100 && t.n <= 100) continue
    const s = formatLike(v, t)
    if (s !== t.raw && Number(s.replace(/,/g, '')) !== t.n) out.add(s)
  }
  return [...out]
}

/** Accepts "3.7", "3.70%", "~3.7", "452 bn". Tolerance: 2% relative, or rounding to the shown precision. */
export function gradeNumeric(answer: string, t: NumToken): { correct: boolean; close: boolean } {
  const tok = findNumbers(answer)[0]
  if (!tok) return { correct: false, close: false }
  const diff = Math.abs(tok.n - t.n)
  const unit = Math.pow(10, -t.decimals)
  const rel = t.n === 0 ? diff : diff / Math.abs(t.n)
  const correct = diff <= unit / 2 + 1e-9 || rel <= 0.02
  const close = !correct && rel <= 0.1
  return { correct, close }
}

export function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
