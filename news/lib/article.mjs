// MODULE 3a: get the article text and keep only the sentences that can carry evidence. Zero tokens.
import { stripHtml, westernDigits } from './text.mjs'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

export async function fetchText(url, timeoutMs = 20_000) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.text()
}

/** Paragraph text of the article body. Generic: prefers <article>, falls back to the whole page. */
export function articleText(html) {
  const scope = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html
  const paras = [...scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripHtml(m[1])).filter((p) => p.length > 60 && !/^(read more|also read|follow us|subscribe|copyright|published in)/i.test(p))
  return paras.join(' ')
}

export function sentences(text) {
  return text
    .replace(/([.!?۔])\s+(?=[\p{Lu}\p{Lo}"“'‘(\d])/gu, '$1\n')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 25)
}

const FIGURE = /\d[\d,.]*\s?(?:%|percent|per cent|pc\b|bn\b|billion|mn\b|million|trillion|crore|lakh|bps|mw\b|maf\b|tonnes|فیصد|ارب|کروڑ|لاکھ|کھرب|ملین|ڈالر|روپے)|(?:rs\.?|pkr|us\$|\$)\s?\d/i

/** Sentences with a figure, a legal anchor or a named authority, plus one neighbour each side, capped. */
export function evidenceSentences(text, lexicon, cap = 1200) {
  const ss = sentences(westernDigits(text))
  const lower = ss.map((s) => s.toLowerCase())
  const strong = ss.map((s, i) => FIGURE.test(s) || lexicon.law.some((k) => lower[i].includes(k.trim())) || lexicon.authority.some((k) => (/^[\x20-\x7e]+$/.test(k) ? new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}([^a-z]|$)`).test(lower[i]) : s.includes(k))))
  const keep = new Set()
  strong.forEach((ok, i) => ok && [i - 1, i, i + 1].forEach((j) => j >= 0 && j < ss.length && keep.add(j)))
  // Evidence-bearing sentences first, neighbours only while the budget allows.
  const order = [...keep].sort((a, b) => Number(strong[b]) - Number(strong[a]) || a - b)
  const chosen = []
  let used = 0
  for (const i of order) {
    if (used + ss[i].length > cap) continue
    chosen.push(i)
    used += ss[i].length + 1
  }
  return chosen.sort((a, b) => a - b).map((i) => ss[i]).join(' ')
}
