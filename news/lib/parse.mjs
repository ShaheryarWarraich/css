// MODULE 1: RSS 2.0, Atom and RDF → one story shape. Titles and snippets are kept verbatim.
import { XMLParser } from 'fast-xml-parser'
import { canonicalUrl, hashId, stripHtml, truncate } from './text.mjs'

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', cdataPropName: '#cdata', trimValues: true, parseTagValue: false, processEntities: false })

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x])
const text = (x) => {
  if (x == null) return ''
  if (typeof x === 'string') return x
  if (Array.isArray(x)) return text(x[0])
  return x['#cdata'] ?? x['#text'] ?? ''
}

function linkOf(it) {
  if (typeof it.link === 'string') return it.link
  for (const l of arr(it.link)) {
    if (typeof l === 'string') return l
    if (l['@href'] && (!l['@rel'] || l['@rel'] === 'alternate')) return l['@href']
    if (l['#text']) return l['#text']
  }
  return text(it.guid) || it['@rdf:about'] || ''
}

export const SNIPPET_MAX = 300

/** @returns {{stories: object[], fullText: Map<string,string>}} fullText is for in-memory scoring only. */
export function parseFeed(xml, source) {
  const doc = parser.parse(xml)
  const items = arr(doc?.rss?.channel?.item).concat(arr(doc?.feed?.entry), arr(doc?.['rdf:RDF']?.item))
  const stories = []
  const fullText = new Map()
  for (const it of items) {
    const title = stripHtml(text(it.title))
    const link = canonicalUrl(linkOf(it))
    if (!title || !/^https?:\/\//.test(link)) continue
    const when = Date.parse(text(it.pubDate) || text(it.published) || text(it.updated) || text(it['dc:date']))
    const desc = stripHtml(text(it.description) || text(it.summary))
    const body = stripHtml(text(it['content:encoded']) || text(it.content))
    const section = arr(it.category).map((c) => stripHtml(typeof c === 'string' ? c : (c['@term'] ?? text(c)))).filter(Boolean).slice(0, 4)
    const id = hashId(link)
    stories.push({ id, src: source.id, outlet: source.name, lang: source.lang, group: source.group, kind: source.kind, title, link, at: Number.isFinite(when) ? when : null, section, snippet: truncate(desc || body, SNIPPET_MAX) })
    const long = body.length > desc.length ? body : desc
    if (long.length > SNIPPET_MAX + 200) fullText.set(id, long)
  }
  return { stories, fullText }
}
