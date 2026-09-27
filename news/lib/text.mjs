// Small text helpers shared by every stage. No dependencies.
import { createHash } from 'node:crypto'

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' }

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
}

const untag = (s) => s.replace(/<(script|style|figure|figcaption|iframe)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/?[a-z][^>]*>/gi, ' ')

/** Some feeds escape their HTML (&lt;p&gt;), so tags are removed both before and after decoding. */
export function stripHtml(html) {
  return untag(decodeEntities(untag(String(html ?? ''))))
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncate(s, max) {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const at = cut.lastIndexOf(' ')
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.…-]+$/, '') + '…'
}

/** Eastern Arabic and Persian digits → 0-9, so Urdu figures are checked like English ones. */
export function westernDigits(s) {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
}

export function canonicalUrl(u) {
  try {
    const url = new URL(u.trim())
    url.hash = ''
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|at_)/i.test(k)) url.searchParams.delete(k)
    return url.toString().replace(/\/$/, '')
  } catch {
    return u.trim()
  }
}

export const hashId = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12)

const STOP = new Set('a an the of in on at to for from by with and or as is are was were be been has have had will would says said say over after amid into its it this that than new more not but no up out about against between pm cm'.split(' '))

export function titleTokens(title) {
  return new Set(
    westernDigits(title.toLowerCase())
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  )
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

/** Figures as canonical strings: "3.70", "3.7" and "3,7"-style thousands all compare equal where they should. */
export const numbersIn = (s) => [...westernDigits(String(s)).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => String(Number(m[0].replace(/,/g, '')))).filter((n) => n !== 'NaN')

/** Date (YYYY-MM-DD) in Pakistan time. */
export const pktDay = (ms) => new Date(ms + 5 * 3_600_000).toISOString().slice(0, 10)
