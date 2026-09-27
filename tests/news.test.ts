import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain JS modules
import { parseFeed } from '../news/lib/parse.mjs'
// @ts-expect-error plain JS modules
import { cluster, dedupe, shouldDrop } from '../news/lib/clean.mjs'
// @ts-expect-error plain JS modules
import { prescore } from '../news/lib/prescore.mjs'
// @ts-expect-error plain JS modules
import { parseAssess } from '../news/lib/assess.mjs'
// @ts-expect-error plain JS modules
import { articleText, evidenceSentences } from '../news/lib/article.mjs'
// @ts-expect-error plain JS modules
import { guard, parseExtract } from '../news/lib/extract.mjs'
// @ts-expect-error plain JS modules
import { matchCandidate } from '../news/lib/match.mjs'

const lexicon = JSON.parse(readFileSync('news/lexicon.json', 'utf8'))
const criteria = JSON.parse(readFileSync('news/criteria.json', 'utf8'))
const maps = [{ id: 'AM02', title: 'Pakistan IMF Structural Cycle', keywords: ['imf', 'fiscal', 'reserve', 'stabilization', 'export'] }]
const src = { id: 't', name: 'Test Paper', lang: 'en', group: 'pk-en', kind: 'news' }
const NOW = Date.parse('2026-09-27T12:00:00+05:00')

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
<item><title><![CDATA[Inflation rises to 7.2% in August &amp; food leads]]></title><link>https://ex.pk/a/1?utm_source=rss</link><pubDate>Sun, 27 Sep 2026 09:00:00 +0500</pubDate><category>Business</category>
<description><![CDATA[<img src="x.jpg"/><p>The Pakistan Bureau of Statistics said CPI inflation rose to 7.2% in August.</p>]]></description><content:encoded><![CDATA[${'<p>Body sentence with detail. </p>'.repeat(40)}]]></content:encoded></item>
<item><title>Pakistan win T20 thriller</title><link>https://ex.pk/sport/2</link><pubDate>Sun, 27 Sep 2026 08:00:00 +0500</pubDate><category>Sport</category><description>Match report</description></item>
<item><title>No link item</title><description>x</description></item></channel></rss>`
const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Court strikes down rule</title><link rel="alternate" href="https://ex.pk/b/3"/><updated>2026-09-27T06:00:00Z</updated><summary>IHC ruling</summary></entry></feed>`
const RDF = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><item rdf:about="https://ex.pk/c/4"><title>ترسیلات زر 44 ارب ڈالر سے زائد رہیں گی، گورنر اسٹیٹ بینک</title><link>https://ex.pk/c/4</link><dc:date>2026-09-27T05:00:00Z</dc:date><description>اسٹیٹ بینک کے مطابق ترسیلات میں اضافہ</description></item></rdf:RDF>`

describe('news: parse', () => {
  it('reads RSS, strips tracking and HTML, keeps full text in memory only', () => {
    const { stories, fullText } = parseFeed(RSS, src)
    expect(stories.length).toBe(2)
    expect(stories[0].title).toBe('Inflation rises to 7.2% in August & food leads')
    expect(stories[0].link).toBe('https://ex.pk/a/1')
    expect(stories[0].snippet).toBe('The Pakistan Bureau of Statistics said CPI inflation rose to 7.2% in August.')
    expect(fullText.has(stories[0].id)).toBe(true)
    expect(JSON.stringify(stories[0])).not.toContain('Body sentence')
  })
  it('removes HTML that the feed escaped', () => {
    const xml = RSS.replace('<![CDATA[<img src="x.jpg"/><p>The Pakistan Bureau', '&lt;p&gt;The Pakistan Bureau').replace('in August.</p>]]></description>', 'in August.&lt;/p&gt;</description>')
    expect(parseFeed(xml, src).stories[0].snippet).toBe('The Pakistan Bureau of Statistics said CPI inflation rose to 7.2% in August.')
  })
  it('reads Atom and RDF, including Urdu', () => {
    expect(parseFeed(ATOM, src).stories[0]).toMatchObject({ title: 'Court strikes down rule', link: 'https://ex.pk/b/3' })
    const ur = parseFeed(RDF, { ...src, lang: 'ur' }).stories[0]
    expect(ur.title).toContain('ترسیلات')
    expect(ur.at).toBe(Date.parse('2026-09-27T05:00:00Z'))
  })
})

describe('news: clean', () => {
  const s = (o: object) => ({ id: Math.random().toString(36), outlet: 'A', lang: 'en', title: 't', link: 'https://ex.pk/x', section: [], snippet: '', at: NOW - 3600_000, ...o })
  it('drops sport, showbiz and old stories, keeps the rest', () => {
    expect(shouldDrop(s({ section: ['Sport'] }), lexicon, NOW)).toBe('section')
    expect(shouldDrop(s({ title: 'Babar hits century as Pakistan win cricket series' }), lexicon, NOW)).toBe('topic')
    expect(shouldDrop(s({ title: 'اداکارہ کی نئی فلم' }), lexicon, NOW)).toBe('topic')
    expect(shouldDrop(s({ at: NOW - 5 * 86_400_000 }), lexicon, NOW)).toBe('old')
    expect(shouldDrop(s({ title: 'Senate passes 27th Amendment' }), lexicon, NOW)).toBeNull()
    expect(shouldDrop(s({ title: 'Actors in the power sector seek tariff relief' }), lexicon, NOW)).toBeNull()
  })
  it('dedupes by URL and by outlet + title', () => {
    const a = s({ id: 'x', title: 'Same headline', snippet: 'short' })
    const b = s({ id: 'x', title: 'Same headline', snippet: 'a longer snippet here' })
    const c = s({ id: 'y', title: 'Same  Headline!' })
    const d = s({ id: 'z', outlet: 'B', title: 'Same headline' })
    const out = dedupe([a, b, c, d])
    expect(out.length).toBe(2)
    expect(out.find((o: any) => o.outlet === 'A').snippet).toBe('a longer snippet here')
  })
  it('clusters the same event across outlets only', () => {
    const out = cluster([
      s({ id: '1', outlet: 'A', title: 'IMF board approves $1.2bn tranche for Pakistan under EFF' }),
      s({ id: '2', outlet: 'B', title: 'IMF approves $1.2bn tranche for Pakistan under EFF programme' }),
      s({ id: '3', outlet: 'C', title: 'Punjab announces new school enrolment drive' }),
    ])
    expect(out[0].cluster).toBe(out[1].cluster)
    expect(out[0].outlets).toBe(2)
    expect(out[2].cluster).toBeNull()
  })
})

describe('news: rule scoring', () => {
  const st = (title: string, snippet = '', group = 'pk-en') => ({ title, snippet, group, kind: 'news' })
  const b = (title: string, snippet = '', group = 'pk-en') => prescore(st(title, snippet, group), '', lexicon, maps)
  it('awards each badge on the right evidence', () => {
    const r = b('Pakistan exports fell 12% year-on-year to $2.5bn, PBS data shows', 'Bangladesh and Vietnam gained share; IMF fiscal targets and reserves under pressure.')
    expect(r.badges).toEqual(expect.arrayContaining(['PK', 'SYL', 'SRC', 'NUM', 'TRD', 'CMP', 'MAP']))
    expect(r.themes[0]).toBe('Economy')
    expect(b('Supreme Court upholds 26th Amendment, cites Article 184').badges).toEqual(expect.arrayContaining(['LAW', 'SYL']))
    expect(b('Sindh approves policy for rural girls schools').badges).toEqual(expect.arrayContaining(['DIS', 'SOL', 'XTOP']))
  })
  it('scores Urdu stories', () => {
    const r = b('ترسیلات زر 44 ارب ڈالر سے زائد رہیں گی، گورنر اسٹیٹ بینک', 'پاکستان میں گزشتہ سال کے مقابلے میں اضافہ', 'pk-ur')
    expect(r.badges).toEqual(expect.arrayContaining(['PK', 'SYL', 'SRC', 'NUM']))
  })
  it('gates on Pakistan relevance and syllabus relevance', () => {
    expect(b('Argentina poverty rises to 32 percent, World Bank says', '', 'intl').score).toBeLessThanOrEqual(4)
    expect(b('Minister inaugurates flower show in Lahore').score).toBeLessThanOrEqual(3)
  })
  it('does not let full-text feeds outscore snippet feeds', () => {
    const story = st('Minister visits Lahore market')
    const long = 'x '.repeat(400) + 'IMF World Bank 45% rose India Supreme Court Article 25 reform'
    expect(prescore(story, long, lexicon, maps).score).toBe(prescore(story, '', lexicon, maps).score)
  })
  it('raises caution flags', () => {
    expect(b('Pakistan debt hits Rs80tr as deficit widens, reserves fall').flags).toContain('STOCKFLOW')
    expect(b('IMF disbursement of $1bn tranche expected').flags).toContain('IMF')
  })
})

describe('news: assessment parsing', () => {
  it('keeps only known ids and valid codes', () => {
    const out = parseAssess('noise [{"id":"a","keep":1,"role":"C","use":["CA","ZZ","PA"],"map":"AM99","th":"Principal–Agent","reuse":2,"t1":1,"why":"one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen"},{"id":"b","keep":0},{"id":"ghost","keep":1}] tail', new Set(['a', 'b']), maps, criteria)
    expect(out.size).toBe(2)
    expect(out.get('a')).toMatchObject({ keep: 1, role: 'C', use: ['CA', 'PA'], map: '', t1: 1 })
    expect(out.get('a').why.split(' ').length).toBe(14)
    expect(out.get('b')).toEqual({ keep: 0 })
  })
})

describe('news: article text', () => {
  it('keeps evidence sentences and respects the cap', () => {
    const html = `<html><body><nav><p>Menu item that is long enough to be a paragraph but is outside the article.</p></nav><article><p>The minister spoke at length about national unity and the spirit of the people.</p><p>According to the State Bank, remittances rose to $38.3 billion in FY2025. Officials welcomed the figure warmly.</p><p>Follow us on social media for more updates every single day of the week.</p></article></body></html>`
    const text = articleText(html)
    expect(text).not.toContain('Menu item')
    const ev = evidenceSentences(text, lexicon)
    expect(ev).toContain('$38.3 billion')
    expect(evidenceSentences(text.repeat(30), lexicon, 400).length).toBeLessThanOrEqual(400)
  })
})

describe('news: extraction guards', () => {
  const text = 'Remittances test. According to the State Bank, remittances rose to $38.3 billion in FY2025 from $30.3 billion a year earlier.'
  const c = { title: 'Workers remittances', value: '$38.3 billion', proves: 'Remittances finance the external account.', quote: 'remittances rose to $38.3 billion in FY2025', type: 'Statistic' }
  it('accepts a figure and quote that are in the article', () => expect(guard(c, text).ok).toBe(true))
  it('rejects a figure that is not in the article', () => expect(guard({ ...c, value: '$39.1 billion' }, text)).toMatchObject({ ok: false, reason: expect.stringContaining('39.1') }))
  it('rejects a quote that is not verbatim', () => expect(guard({ ...c, quote: 'remittances climbed to $38.3 billion in FY2025' }, text).reason).toBe('quote is not verbatim'))
  it('rejects a candidate with nothing specific', () => expect(guard({ ...c, value: 'remittances are high', quote: 'According to the State Bank' }, text).reason).toContain('not specific'))
  it('checks Urdu digits like English ones', () => expect(guard({ ...c, value: '۴۴ ارب ڈالر', quote: 'ترسیلات 44 ارب ڈالر' }, 'ترسیلات 44 ارب ڈالر سے زائد').ok).toBe(true))
  it('parses and sanitises model output', () => {
    const out = parseExtract('[{"sid":"s1","title":"T","value":"5%","theme":"Nonsense","role":"C","map":"AM02","cautions":["DEF","BOGUS"],"tags":["a","b","c","d","e"],"proves":"p","quote":"q"},{"sid":"other"}]', new Set(['s1']), Object.keys(lexicon.themes), maps, criteria)
    expect(out.length).toBe(1)
    expect(out[0]).toMatchObject({ theme: 'Other', role: 'Cause', map: 'AM02', cautions: ['DEF'] })
    expect(out[0].tags.length).toBe(4)
  })
})

describe('news: matching against the bank', () => {
  const pack = JSON.parse(readFileSync('public/packs/core.json', 'utf8'))
  const gdp = pack.facts.find((f: any) => f.id === 'ECON-001') // GDP growth 3.70% FY2025-26
  it('finds duplicate, conflict, update and new', () => {
    const pbs = 'Pakistan Bureau of Statistics'
    expect(matchCandidate({ title: 'GDP growth', value: '3.7%', period: 'FY2025-26', theme: 'Economy', src: 'IMF' }, pack.facts)).toMatchObject({ kind: 'duplicate', factId: gdp.id })
    expect(matchCandidate({ title: 'GDP growth', value: '3.1%', period: 'FY2025-26', theme: 'Economy', src: pbs }, pack.facts)).toMatchObject({ kind: 'conflict', factId: gdp.id })
    expect(matchCandidate({ title: 'GDP growth', value: '4.2%', period: 'FY2026-27', theme: 'Economy', src: 'PBS' }, pack.facts)).toMatchObject({ kind: 'update', factId: gdp.id })
    // Same indicator from a different body is a separate measurement, never a silent replacement.
    expect(matchCandidate({ title: 'GDP growth', value: '3.2%', period: 'FY2026-27', theme: 'Economy', src: 'IMF' }, pack.facts)).toMatchObject({ kind: 'new', factId: gdp.id, note: 'different-source' })
    expect(matchCandidate({ title: 'Registered fuel relief scheme beneficiaries', value: '6 million', period: '2026', theme: 'Poverty & Social Protection' }, pack.facts).kind).toBe('new')
  })
})
